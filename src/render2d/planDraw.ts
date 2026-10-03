import type { FillInput, GraphicsContext } from "pixi.js";
import { config } from "../sim/config";
import { corridorJoints, corridors, hasBulkhead } from "../sim/corridors";
import { edgeById, edgeSides, isGalleryEdge, type Edge } from "../sim/edges";
import { isOpen } from "../sim/excavation";
import type { Hole } from "../sim/geometry";
import { roomAt, type Cell, type Layout, type RoomInstance } from "../sim/placement";
import { roomLabel } from "../sim/roomName";
import { roomDef } from "../sim/rooms";
import { glazedWalls } from "../sim/windows";
import { openShaftRadius, ringRadii, slotAngles } from "../render3d/cylinder";
import { doorsOnFloor } from "../view/doors";
import { tubeAt } from "../view/gallery";
import { roomFinish } from "../view/roomFinish";
import { shade, tint } from "./art";
import { corridorStrip } from "./corridorArt";
import { CATEGORY_COLORS } from "./palette";

// The plan view's drawing: one floor seen from above, drawn flat, onto a Pixi GraphicsContext. The
// web's plan stage (plan.ts) draws with it, and so does the Godot viewer's bridge (src/bridge/plan.ts),
// recording what's drawn, so the two plans are the same. Metres round the shaft's axis, PX to a metre.

export const C = {
  bg: 0x1a0d0a,
  rock: 0x2a1510,
  shaft: 0x0d0706,
  gallery: 0x6b5448,
  galleryEdge: 0x2b1a14,
  slot: 0x4a2c22,
  slotEdge: 0x2b1812,
  locked: 0x33201a,
  seam: 0xe07a3f,
  hover: 0xffe2b0,
  selected: 0xffffff,
  label: 0xd8c0ae,
  roomText: 0x1a0f0d,
  ok: 0x7fd67f,
  bad: 0xe0503a,
  dig: 0xe07a3f,
  door: 0x2a1a14,
  window: 0x9fd2ff,
  build: 0xe0a03a,
  /** A cell still solid rock, and one dug out with nothing in it. */
  rockCell: 0x341e17,
  empty: 0x6e5445,
  pillar: 0x3d2b22,
};

/** Built rooms' colours with room colours off: what they're built from (as surfaces.ts FINISH_LOOK). */
const FINISH_COLORS: Record<string, number> = { rock: 0x7a4f3c, marscrete: 0x9c8f84, brick: 0x9c5438, metal: 0x8d9299 };

/** Pixels per metre at zoom 1. */
export const PX = 7;
/** Margin of rock shown around the outermost ring, in metres. */
export const RIM_M = 8;
export const ARC_STEP = 0.05; // radians per segment when drawing arcs as polylines
export const RING_D = config.geometry.roomDepthM;
export const TAU = Math.PI * 2;
/** A corridor's width on the plan: its true 3 m. */
export const BAND = corridors.widthM * PX;
/** A gallery tube's width on the plan: the ledge inside the shaft wall. */
export const TUBE = config.geometry.galleryWidthM * PX * 0.9;

/** Screen position (px, before zoom) of a point r metres out at angle a. */
export const xy = (r: number, a: number): [number, number] => [r * PX * Math.cos(a), r * PX * Math.sin(a)];

/** An annular sector between radii r0..r1 and angles a0..a1, as a closed polygon. */
export function sector(r0: number, r1: number, a0: number, a1: number): number[] {
  const pts: number[] = [];
  const steps = Math.max(1, Math.ceil((a1 - a0) / ARC_STEP));
  for (let i = 0; i <= steps; i++) pts.push(...xy(r1, a0 + ((a1 - a0) * i) / steps));
  for (let i = steps; i >= 0; i--) pts.push(...xy(r0, a0 + ((a1 - a0) * i) / steps));
  return pts;
}

export function cellSector(hole: Hole, c: { ring: number; slot: number }, inset = 0): number[] {
  const n = hole.ringSlots[c.ring - 1]!;
  const [a0, a1] = slotAngles(c.slot, n);
  const [r0, r1] = ringRadii(hole, c.ring);
  const da = inset / r0;
  return sector(r0 + inset, r1 - inset, a0 + da, a1 - da);
}

/** A cell's sector, from a given inner radius (metres). */
export function cellSectorFrom(hole: Hole, c: { ring: number; slot: number }, rInner: number): number[] {
  const n = hole.ringSlots[c.ring - 1]!;
  const [a0, a1] = slotAngles(c.slot, n);
  return sector(rInner, ringRadii(hole, c.ring)[1], a0, a1);
}

/** Where on this floor a room's cells sit: their mean angle at their mean radius, and a size that fits the smallest cell. */
export function roomCentre(hole: Hole, cells: Cell[]): { x: number; y: number; size: number } {
  let vx = 0;
  let vy = 0;
  let rSum = 0;
  let size = Infinity;
  for (const c of cells) {
    const n = hole.ringSlots[c.ring - 1]!;
    const [a0, a1] = slotAngles(c.slot, n);
    const [r0, r1] = ringRadii(hole, c.ring);
    const a = (a0 + a1) / 2;
    vx += Math.cos(a);
    vy += Math.sin(a);
    rSum += (r0 + r1) / 2;
    size = Math.min(size, (r1 - r0) * PX, (a1 - a0) * r0 * PX);
  }
  const [x, y] = xy(rSum / cells.length, Math.atan2(vy, vx));
  return { x, y, size };
}

/** A room's marker on the plan: its icon and name at its centre, which the caller draws (upright as the plan turns). */
export interface Marker {
  room: RoomInstance;
  x: number;
  y: number;
  /** The smallest of its cells, px: how big its icon may be. */
  size: number;
  ink: number;
  text: string | null;
  textColor: number;
}

export interface RoomsOptions {
  /** Rooms under construction are hatched in these (Pixi needs a texture: the web's constructionStripes). */
  stripes: FillInput;
  onMarker: (m: Marker) => void;
  /** Rooms a crew is at, with its icon. */
  crews?: Map<number, string>;
  roomColors?: boolean;
}

export function drawBase(g: GraphicsContext, h: Hole, domed = false): void {
  const outer = ringRadii(h, h.ringSlots.length)[1] + RIM_M;
  g.circle(0, 0, outer * PX).fill(C.rock);
  // Every slot of every ring: carved ones open, locked ones darker.
  h.ringSlots.forEach((n, ri) => {
    const ring = ri + 1;
    for (let slot = 0; slot < n; slot++) {
      g.poly(cellSector(h, { ring, slot })).fill(ring > h.unlockedRings ? C.locked : C.slot).stroke({ color: C.slotEdge, width: 1 });
    }
  });
  // The open shaft, Mars air, out to the shaft wall: gallery tubes hang in it where they're built (drawn with the corridors).
  g.circle(0, 0, h.shaftRadiusM * PX).fill(domed ? C.gallery : C.shaft).stroke({ color: C.galleryEdge, width: 2 });
  // Under the dome the ledge is open walkway all round; the open shaft is inside it.
  if (domed) g.circle(0, 0, openShaftRadius(h) * PX).fill(C.shaft);
  // The 0° seam, where the unrolled view starts.
  const [sx, sy] = xy(openShaftRadius(h), 0);
  const [ex, ey] = xy(outer, 0);
  g.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: C.seam, width: 2, alpha: 0.5 });
}


export function drawRooms(g: GraphicsContext, l: Layout, floor: number, opts: RoomsOptions): void {
  const h = l.hole;
  const onFloor = (cells: Cell[]) => cells.filter((c) => c.floor === floor);
  // Cells with no room: solid rock (speckled), or dug-out empty space with a pillar at each corner.
  if (floor <= h.floors) {
    for (let ring = 1; ring <= h.unlockedRings; ring++) {
      const n = h.ringSlots[ring - 1]!;
      const [r0, r1] = ringRadii(h, ring);
      for (let slot = 0; slot < n; slot++) {
        const c = { floor, ring, slot };
        if (roomAt(l, c)) continue;
        const [a0, a1] = slotAngles(slot, n);
        if (isOpen(l, c)) {
          g.poly(cellSector(h, c, 0.3)).fill(C.empty);
          for (const [r, a] of [[r0 + 1, a0 + 1 / r0], [r0 + 1, a1 - 1 / r0], [r1 - 1, a0 + 1 / r1], [r1 - 1, a1 - 1 / r1]] as const) {
            const [x, y] = xy(r, a);
            g.circle(x, y, 0.55 * PX).fill(C.pillar);
          }
        } else {
          g.poly(cellSector(h, c, 0.3)).fill(C.rockCell);
          let seed = ((ring * 97 + slot) * 2654435761) >>> 0;
          for (let i = 0; i < 3; i++) {
            seed = (seed * 1103515245 + 12345) >>> 0;
            const t = seed / 4294967296;
            seed = (seed * 1103515245 + 12345) >>> 0;
            const u = seed / 4294967296;
            const [x, y] = xy(r0 + 1.5 + t * (r1 - r0 - 3), a0 + (0.15 + 0.7 * u) * (a1 - a0));
            g.circle(x, y, 0.3 * PX).fill(tint(C.rockCell, 0.15));
          }
        }
      }
    }
  }
  for (const room of l.rooms) {
    if (room.at.kind !== "ring") continue;
    const cells = onFloor(room.cells);
    if (!cells.length) continue;
    const def = roomDef(room.type);
    const category = CATEGORY_COLORS[def.category] ?? 0x888888;
    // Room colours off (the 3D view's toggle): built rooms in what they're built from.
    const color = opts.roomColors === false && !room.planned && !room.building ? FINISH_COLORS[roomFinish(room.type)]! : category;
    // A cargo elevator passing through this floor: just its shaft, with the cables.
    if (def.cargoShaft && floor < Math.max(...room.cells.map((c) => c.floor))) {
      for (const c of cells) {
        g.poly(cellSector(h, c, 0.3)).fill(shade(color, 0.35));
        const centre = roomCentre(h, [c]);
        g.circle(centre.x - 4, centre.y, 2).circle(centre.x + 4, centre.y, 2).fill(shade(color, 0.75));
      }
      continue;
    }
    // Cells fill edge to edge, so a room reads as one piece; its outline marks where it ends.
    for (const c of cells) {
      // Public rooms on a gallery tube open onto it: fill over the shaft wall's line.
      const poly = def.public && c.ring === 1 && tubeAt(l, c.floor, c.slot) ? cellSectorFrom(h, c, h.shaftRadiusM - 0.3) : cellSector(h, c);
      if (room.planned) g.poly(poly).fill({ color, alpha: 0.3 });
      else if (room.building) g.poly(poly).fill({ color, alpha: 0.4 }).poly(poly).fill(opts.stripes);
      else g.poly(poly).fill(color);
    }
    // Under construction: an orange outline, like tape around the works.
    if (room.building) outlineCells(g, h, cells, C.build, 2.5, !!def.public);
    else outlineCells(g, h, cells, room.connected ? shade(color, 0.45) : C.bad, room.connected ? 1.5 : 3, !!def.public);
    const waiting = onFloor(room.pendingCells ?? []);
    if (waiting.length) {
      for (const c of waiting) g.poly(cellSector(h, c)).fill({ color, alpha: 0.4 }).poly(cellSector(h, c)).fill(opts.stripes);
      outlineCells(g, h, waiting, C.build, 2.5, !!def.public);
    }
    // The room's icon and name, together at its centre.
    const centre = roomCentre(h, cells);
    const ink = room.planned ? color : shade(color, 0.55);
    const crew = opts.crews?.get(room.id);
    opts.onMarker({
      room,
      x: centre.x,
      y: centre.y,
      size: centre.size,
      ink,
      text: def.short ? `${room.connected ? roomLabel(room) : `${roomLabel(room)} ⚠`}${crew ? ` ${crew}` : ""}` : null,
      textColor: room.planned ? color : C.roomText,
    });
  }
  drawCorridors(g, l, floor);
  for (const room of l.rooms) if (!room.planned && !room.building) drawWindows(g, l, floor, room);
}


/** A room's windows on this floor: panes along its side of each glazed border (just inside the shaft wall on ring 1), around its door. */
export function drawWindows(g: GraphicsContext, l: Layout, floor: number, room: RoomInstance): void {
  const h = l.hole;
  const own = new Set(room.cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
  for (const { edge: e } of glazedWalls(l, room)) {
    if (e.floor !== floor) continue;
    let s = stripOf(h, e);
    let off = 0;
    if (e.kind === "arc" && isGalleryEdge(e)) {
      // Along the shaft wall, on the room's side of it.
      const r = h.shaftRadiusM + 0.5;
      const a0 = e.a0 * TAU;
      const len = (e.a1 - e.a0) * TAU * r * PX;
      s = { at: (t) => xy(r, a0 + t / (r * PX)), normal: (t) => [Math.cos(a0 + t / (r * PX)), Math.sin(a0 + t / (r * PX))], len, mid: len / 2 };
    } else {
      const [a] = edgeSides(h, e);
      const sign = a && own.has(`${a.floor}:${a.ring}:${a.slot}`) ? -1 : 1;
      off = sign * ((l.corridors[e.id] ? BAND / 2 : 0) + 2);
    }
    const door = doorsOnFloor(l, floor).some((d) => d.edge === e.id && d.roomId === room.id);
    for (let t = 3; t + 8 <= s.len - 3; t += 11) {
      if (door && Math.abs(t + 4 - s.mid) < 8) continue;
      const [x0, y0] = s.at(t);
      const [x1, y1] = s.at(t + 8);
      const [nx, ny] = s.normal(t);
      g.moveTo(x0 + nx * off, y0 + ny * off).lineTo(x1 + nx * off, y1 + ny * off);
    }
    g.stroke({ color: C.window, width: 3, alpha: 0.9 });
  }
}


/** A corridor's centreline on the plan, in px: out along a spoke, or around an arc (a gallery tube's along the ledge, inside the shaft wall). */
export function stripOf(h: Hole, e: Edge): { at: (t: number) => [number, number]; normal: (t: number) => [number, number]; len: number; mid: number } {
  if (e.kind === "arc" && isGalleryEdge(e)) {
    const r = (openShaftRadius(h) + h.shaftRadiusM) / 2;
    const a0 = e.a0 * TAU;
    const len = (e.a1 - e.a0) * TAU * r * PX;
    return { at: (t) => xy(r, a0 + t / (r * PX)), normal: (t) => [Math.cos(a0 + t / (r * PX)), Math.sin(a0 + t / (r * PX))], len, mid: len / 2 };
  }
  if (e.kind === "radial") {
    const a = e.turn * TAU;
    const [r0] = ringRadii(h, e.ring);
    const dir: [number, number] = [Math.cos(a), Math.sin(a)];
    return { at: (t) => xy(r0 + t / PX, a), normal: () => [-dir[1], dir[0]], len: RING_D * PX, mid: (RING_D * PX) / 2 };
  }
  const r = ringRadii(h, e.circle)[1];
  const a0 = e.a0 * TAU;
  const len = (e.a1 - e.a0) * TAU * r * PX;
  return {
    at: (t) => xy(r, a0 + t / (r * PX)),
    normal: (t) => [Math.cos(a0 + t / (r * PX)), Math.sin(a0 + t / (r * PX))],
    len,
    mid: len / 2,
  };
}


/** Corridors on this floor, carved over the rooms, with doors and unlinked warnings (as in the unrolled view). */
export function drawCorridors(g: GraphicsContext, l: Layout, floor: number): void {
  const h = l.hole;
  for (const [id, finish] of Object.entries(l.corridors)) {
    const e = edgeById(h, id);
    if (!e || e.floor !== floor) continue;
    const s = stripOf(h, e);
    const planned = e.floor > h.floors;
    const building = l.corridorsBuilding?.[id] !== undefined;
    const tube = isGalleryEdge(e);
    const poly = corridorStrip(g, s.at, s.normal, s.len, tube ? TUBE : BAND, finish, planned || building ? 0.45 : 1);
    // A bulkhead: a sealed door across the corridor, in hazard stripes.
    if (hasBulkhead(l, id)) {
      const [mx, my] = s.at(s.mid);
      const [nx, ny] = s.normal(s.mid);
      const half = BAND / 2 + 1;
      g.moveTo(mx - nx * half, my - ny * half).lineTo(mx + nx * half, my + ny * half).stroke({ color: 0x3b3f45, width: 5 });
      g.moveTo(mx - nx * half, my - ny * half).lineTo(mx + nx * half, my + ny * half).stroke({ color: 0xe0a03a, width: 2 });
    }
    if (building || l.corridorsFilling?.[id] !== undefined) {
      g.poly(poly).stroke({ color: C.build, width: 2 });
      if (building) continue;
    }
    if (!l.corridorLinked?.[id] && !planned) {
      g.poly(poly).stroke({ color: C.bad, width: 2 });
      continue;
    }
    const [a, z] = edgeSides(h, e);
    // Only where a room's door is (one a floor, on the best border it has).
    const doors = doorsOnFloor(l, e.floor).filter((d) => d.edge === id);
    const opens = (c: Cell | null) => !!c && doors.some((d) => d.cell.ring === c.ring && d.cell.slot === c.slot);
    // A tube's door is in the shaft wall, into the ring-1 room behind it.
    if (tube) {
      if (opens(z)) g.circle(...xy(h.shaftRadiusM + 0.5, ((e.kind === "arc" ? e.a0 + e.a1 : 0) / 2) * TAU), 3).fill(C.door);
      continue;
    }
    const [mx, my] = s.at(s.mid);
    const [nx, ny] = s.normal(s.mid);
    const door = (sign: number) => {
      const cx = mx + nx * sign * (BAND / 2 + 2);
      const cy = my + ny * sign * (BAND / 2 + 2);
      g.circle(cx, cy, 3).fill(C.door);
    };
    // Side 0 is the inner / earlier cell; the normal points outward (arcs) or to the later slot (spokes).
    if (opens(a)) door(-1);
    if (opens(z)) door(1);
  }
  // Square joints where corridors turn, so the outer edges meet in a clean corner.
  for (const joint of corridorJoints(l).values()) {
    if (joint.floor !== floor || joint.circle === 0) continue;
    const r = h.shaftRadiusM + joint.circle * RING_D;
    const a = joint.turn * TAU;
    const half = BAND / 2 / PX;
    corridorStrip(g, (t) => xy(r - half + t / PX, a), () => [-Math.sin(a), Math.cos(a)], BAND, BAND, joint.finish, joint.floor > h.floors ? 0.45 : 1);
  }
}


/** The outline of a group of cells: arcs on the ring edges they don't share, sides where the next slot isn't theirs. */
export function outlineCells(g: GraphicsContext, h: Hole, cells: Cell[], color: number, width: number, openToShaft = false): void {
  const own = new Set(cells.map((c) => `${c.ring}:${c.slot}`));
  const rings = cells.map((c) => c.ring);
  const inner = Math.min(...rings);
  const outer = Math.max(...rings);
  const style = { color, width, cap: "round" as const };
  for (const c of cells) {
    const n = h.ringSlots[c.ring - 1]!;
    const [a0, a1] = slotAngles(c.slot, n);
    const [r0, r1] = ringRadii(h, c.ring);
    const arc = (r: number) => {
      const steps = Math.max(1, Math.ceil((a1 - a0) / ARC_STEP));
      g.moveTo(...xy(r, a0));
      for (let i = 1; i <= steps; i++) g.lineTo(...xy(r, a0 + ((a1 - a0) * i) / steps));
      g.stroke(style);
    };
    if (c.ring === inner && !(openToShaft && c.ring === 1)) arc(r0 + 0.15);
    if (c.ring === outer) arc(r1 - 0.15);
    if (!own.has(`${c.ring}:${(c.slot - 1 + n) % n}`)) g.moveTo(...xy(r0, a0)).lineTo(...xy(r1, a0)).stroke(style);
    if (!own.has(`${c.ring}:${(c.slot + 1) % n}`)) g.moveTo(...xy(r0, a1)).lineTo(...xy(r1, a1)).stroke(style);
  }
}


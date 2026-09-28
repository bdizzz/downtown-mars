import { Application, Container, Graphics, GraphicsContext, Text } from "pixi.js";
import { previewEffects, type EffectField } from "../sim/effects";
import type { Hole } from "../sim/geometry";
import type { Happiness } from "../sim/happiness";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import type { DrillView } from "../sim/snapshot";
import { FLOOR_H, openShaftRadius, pickAt, ringRadii, slotAngles } from "../render3d/cylinder";
import { clickWith, edgeHoverFor, hoverInfoFor, hoverKeyFor, paints } from "../view/interaction";
import { EMPTY_CHAIN, extendChain, type Chain } from "../view/corridorPlan";
import type { HoverInfo, Pick, Proposal, Stage, StageOptions, Tool } from "../view/types";
import { drawGlyph, drawPlus, shade } from "./art";
import { corridorStrip } from "./corridorArt";
import { config } from "../sim/config";
import { corridors } from "../sim/corridors";
import { edgeById, edgeSides, nearestEdge, type Edge } from "../sim/edges";
import { roomAt } from "../sim/placement";
import { CATEGORY_COLORS, HEAT } from "./palette";

// The plan view: one floor seen from above, drawn flat. The shaft in the
// middle, the gallery ledge around it, then each ring as a band of slots.
// It uses the 3D view's geometry (metres around the shaft's axis), so a slot
// is in the same place and direction as in the 3D top-down camera.

const C = {
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
  build: 0xe0a03a,
};

/** Pixels per metre at zoom 1. */
const PX = 7;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 5;
const CLICK_SLOP = 5;
const ARC_STEP = 0.05; // radians per segment when drawing arcs as polylines
const FIELD_MAX = 3;
const FIELD_ALPHA = 0.7;
const LABEL_PX = 12;
const MIN_LABEL_PX = 10;
/** Margin of rock shown around the outermost ring, in metres. */
const RIM_M = 8;
const RING_D = config.geometry.roomDepthM;
const TAU = Math.PI * 2;
/** A corridor's width on the plan: its true 3 m. */
const BAND = corridors.widthM * PX;

/** Screen position (px, before zoom) of a point r metres out at angle a. */
const xy = (r: number, a: number): [number, number] => [r * PX * Math.cos(a), r * PX * Math.sin(a)];

/** An annular sector between radii r0..r1 and angles a0..a1, as a closed polygon. */
function sector(r0: number, r1: number, a0: number, a1: number): number[] {
  const pts: number[] = [];
  const steps = Math.max(1, Math.ceil((a1 - a0) / ARC_STEP));
  for (let i = 0; i <= steps; i++) pts.push(...xy(r1, a0 + ((a1 - a0) * i) / steps));
  for (let i = steps; i >= 0; i--) pts.push(...xy(r0, a0 + ((a1 - a0) * i) / steps));
  return pts;
}

function cellSector(hole: Hole, c: { ring: number; slot: number }, inset = 0): number[] {
  const n = hole.ringSlots[c.ring - 1]!;
  const [a0, a1] = slotAngles(c.slot, n);
  const [r0, r1] = ringRadii(hole, c.ring);
  const da = inset / r0;
  return sector(r0 + inset, r1 - inset, a0 + da, a1 - da);
}

/** A cell's sector, from a given inner radius (metres). */
function cellSectorFrom(hole: Hole, c: { ring: number; slot: number }, rInner: number): number[] {
  const n = hole.ringSlots[c.ring - 1]!;
  const [a0, a1] = slotAngles(c.slot, n);
  return sector(rInner, ringRadii(hole, c.ring)[1], a0, a1);
}

/** Where on this floor a room's cells sit: their mean angle at their mean radius, and a size that fits the smallest cell. */
function roomCentre(hole: Hole, cells: Cell[]): { x: number; y: number; size: number } {
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

export async function createPlanStage(host: HTMLElement, opts: StageOptions = {}): Promise<Stage> {
  const app = new Application();
  await app.init({ resizeTo: host, background: C.bg, antialias: true, resolution: window.devicePixelRatio, autoDensity: true });
  host.appendChild(app.canvas);

  const baseCtx = new GraphicsContext();
  const roomsCtx = new GraphicsContext();
  const fieldCtx = new GraphicsContext();
  const overlayCtx = new GraphicsContext();
  const world = new Container();
  let labels = new Container();
  world.addChild(new Graphics(baseCtx), new Graphics(roomsCtx), new Graphics(fieldCtx), labels, new Graphics(overlayCtx));
  const caption = new Text({ text: "", style: { fill: C.label, fontSize: 13, fontWeight: "700" } });
  caption.position.set(10, 8);
  app.stage.addChild(world, caption);

  let layout: Layout | null = null;
  let floor = 1;
  let drawnKey = "";
  let gameId = "";
  let drill: DrillView | null = null;
  let resources: Record<string, number> = {};
  let gates: string[] = [];
  let selected: number | null = null;
  let tool: Tool = null;
  let overlayType: string | null = null;
  let heat = HEAT.normal;
  let field: EffectField | null = null;
  let happiness: Happiness | null = null;
  let fieldKey = "";
  let hoverKey = "";
  let fitted = false;
  /** Until the player pans or zooms, keep the floor fitted to the view as it resizes. */
  let userMoved = false;
  const cam = { x: 0, y: 0, zoom: 1 };

  // ---- drawing ----

  const onFloor = (cells: Cell[]) => cells.filter((c) => c.floor === floor);

  function drawBase(h: Hole): void {
    baseCtx.clear();
    const outer = ringRadii(h, h.ringSlots.length)[1] + RIM_M;
    baseCtx.circle(0, 0, outer * PX).fill(C.rock);
    // Every slot of every ring: carved ones open, locked ones darker.
    h.ringSlots.forEach((n, ri) => {
      const ring = ri + 1;
      for (let slot = 0; slot < n; slot++) {
        baseCtx.poly(cellSector(h, { ring, slot })).fill(ring > h.unlockedRings ? C.locked : C.slot).stroke({ color: C.slotEdge, width: 1 });
      }
    });
    // The gallery ledge, and the open shaft inside it.
    baseCtx.circle(0, 0, h.shaftRadiusM * PX).fill(C.gallery).stroke({ color: C.galleryEdge, width: 2 });
    baseCtx.circle(0, 0, openShaftRadius(h) * PX).fill(C.shaft);
    // The 0° seam, where the unrolled view starts.
    const [sx, sy] = xy(openShaftRadius(h), 0);
    const [ex, ey] = xy(outer, 0);
    baseCtx.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: C.seam, width: 2, alpha: 0.5 });
  }

  function drawRooms(l: Layout): void {
    roomsCtx.clear();
    labels.destroy({ children: true });
    labels = new Container();
    world.addChildAt(labels, 3);
    const h = l.hole;
    for (const room of l.rooms) {
      if (room.at.kind !== "ring") continue;
      const cells = onFloor(room.cells);
      if (!cells.length) continue;
      const def = roomDef(room.type);
      const color = CATEGORY_COLORS[def.category] ?? 0x888888;
      // Cells fill edge to edge, so a room reads as one piece; its outline marks where it ends.
      for (const c of cells) {
        // Public rooms on the gallery open onto it: fill over the gallery's edge line.
        const poly = def.public && c.ring === 1 ? cellSectorFrom(h, c, h.shaftRadiusM - 0.3) : cellSector(h, c);
        if (room.planned) roomsCtx.poly(poly).fill({ color, alpha: 0.3 });
        else if (room.building) roomsCtx.poly(poly).fill({ color, alpha: 0.4 });
        else roomsCtx.poly(poly).fill(color);
      }
      // Under construction: an orange outline, like tape around the works.
      if (room.building) outlineCells(roomsCtx, cells, C.build, 2.5, !!def.public);
      else outlineCells(roomsCtx, cells, room.connected ? shade(color, 0.45) : C.bad, room.connected ? 1.5 : 3, !!def.public);
      const waiting = onFloor(room.pendingCells ?? []);
      if (waiting.length) {
        for (const c of waiting) roomsCtx.poly(cellSector(h, c)).fill({ color, alpha: 0.4 });
        outlineCells(roomsCtx, waiting, C.build, 2.5, !!def.public);
      }
      const centre = roomCentre(h, cells);
      const ink = room.planned ? color : shade(color, 0.55);
      drawGlyph(roomsCtx, room.type, centre.x, centre.y + 5, Math.min(26, centre.size * 0.55), ink);
      if (def.short) {
        const text = new Text({
          text: room.connected ? def.short : `${def.short} ⚠`,
          style: { fill: room.planned ? color : C.roomText, fontSize: LABEL_PX, fontWeight: "600" },
        });
        text.anchor.set(0.5, 1);
        text.position.set(centre.x, centre.y - Math.min(10, centre.size * 0.25));
        labels.addChild(text);
      }
    }
    drawCorridors(l);
  }

  /** A corridor's centreline on the plan, in px: out along a spoke, or around an arc. */
  function stripOf(h: Hole, e: Edge): { at: (t: number) => [number, number]; normal: (t: number) => [number, number]; len: number; mid: number } {
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
  function drawCorridors(l: Layout): void {
    const h = l.hole;
    for (const [id, finish] of Object.entries(l.corridors)) {
      const e = edgeById(h, id);
      if (!e || e.floor !== floor) continue;
      const s = stripOf(h, e);
      const planned = e.floor > h.floors;
      const building = l.corridorsBuilding?.[id] !== undefined;
      const poly = corridorStrip(roomsCtx, s.at, s.normal, s.len, BAND, finish, planned || building ? 0.45 : 1);
      if (building) {
        roomsCtx.poly(poly).stroke({ color: C.build, width: 2 });
        continue;
      }
      if (!l.corridorLinked?.[id] && !planned) {
        roomsCtx.poly(poly).stroke({ color: C.bad, width: 2 });
        continue;
      }
      const [a, z] = edgeSides(h, e);
      const opens = (c: Cell | null) => {
        const r = c ? roomAt(l, c) : undefined;
        return !!r && !r.planned && !roomDef(r.type).public;
      };
      if (s.len < 16) continue;
      const [mx, my] = s.at(s.mid);
      const [nx, ny] = s.normal(s.mid);
      const door = (sign: number) => {
        const cx = mx + nx * sign * (BAND / 2 + 2);
        const cy = my + ny * sign * (BAND / 2 + 2);
        roomsCtx.circle(cx, cy, 3).fill(C.door);
      };
      // Side 0 is the inner / earlier cell; the normal points outward (arcs) or to the later slot (spokes).
      if (opens(a)) door(-1);
      if (opens(z)) door(1);
    }
  }

  /** The outline of a group of cells: arcs on the ring edges they don't share, sides where the next slot isn't theirs. */
  function outlineCells(g: GraphicsContext, cells: Cell[], color: number, width: number, openToShaft = false): void {
    if (!layout) return;
    const h = layout.hole;
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

  function drawField(): void {
    fieldCtx.clear();
    if (!layout || !overlayType) return;
    const h = layout.hole;
    const tintCell = (c: { ring: number; slot: number }, v: number) => {
      if (Math.abs(v) < 0.05) return;
      fieldCtx.poly(cellSector(h, c, 0.15)).fill({ color: v < 0 ? heat.bad : heat.good, alpha: Math.min(1, Math.abs(v) / FIELD_MAX) * FIELD_ALPHA });
    };
    if (overlayType === "happiness") {
      for (const pool of happiness?.pools ?? []) {
        const room = layout.rooms.find((r) => r.id === pool.roomId);
        if (!room) continue;
        for (const c of onFloor(room.cells)) tintCell(c, ((pool.happiness - 50) / 50) * FIELD_MAX);
      }
      return;
    }
    const grid = field?.[overlayType]?.[floor - 1];
    grid?.forEach((slots, ri) => {
      if (ri + 1 > h.unlockedRings) return;
      slots.forEach((v, slot) => tintCell({ ring: ri + 1, slot }, v));
    });
  }

  function drawHalo(type: string, cells: Cell[]): void {
    if (!layout) return;
    const effects = roomDef(type).effects.filter((e) => !e.residentsOnly && e.radius > 0);
    if (!effects.length) return;
    const main = effects.reduce((a, b) => (Math.abs(b.strength) > Math.abs(a.strength) ? b : a));
    const grid = previewEffects(layout, type, cells)[main.type]?.[floor - 1];
    if (!grid) return;
    const own = new Set(cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
    grid.forEach((slots, ri) =>
      slots.forEach((v, slot) => {
        if (Math.abs(v) < 0.05 || own.has(`${floor}:${ri + 1}:${slot}`)) return;
        overlayCtx.poly(cellSector(layout!.hole, { ring: ri + 1, slot }, 0.15)).fill({ color: v < 0 ? heat.bad : heat.good, alpha: Math.min(1, Math.abs(v) / FIELD_MAX) * 0.6 });
      }),
    );
  }

  function markRoom(room: RoomInstance, color: number): void {
    const cells = onFloor(room.cells);
    if (cells.length) outlineCells(overlayCtx, cells, color, 3);
  }

  /** A border on this floor highlighted: its strip outlined in a colour, with the finish previewed if given. */
  function ghostEdge(id: string, color: number, finish: string | null, alpha: number): void {
    if (!layout) return;
    const e = edgeById(layout.hole, id);
    if (!e || e.floor !== floor) return;
    const s = stripOf(layout.hole, e);
    const poly = corridorStrip(overlayCtx, s.at, s.normal, s.len, BAND, finish ?? "rock", finish ? 0.7 : 0);
    overlayCtx.poly(poly).fill({ color, alpha }).stroke({ color, width: 2.5 });
  }

  function drawOverlay(info: HoverInfo | null): void {
    overlayCtx.clear();
    if (!layout) return;
    const h = layout.hole;
    const sel = selected !== null ? layout.rooms.find((r) => r.id === selected) : undefined;
    if (sel) markRoom(sel, C.selected);
    // A snaked chain (while dragging, or waiting for confirmation): every border on this floor highlighted.
    const shown = snaking ? { edges: chain.edges, erase: chainErase } : proposal;
    if (shown?.edges.length) {
      for (const id of shown.edges) {
        if (shown.erase) ghostEdge(id, C.bad, null, 0.35);
        else if (layout.corridors[id]) ghostEdge(id, C.hover, null, 0.1);
        else ghostEdge(id, C.ok, tool?.kind === "corridor" ? tool.finish : null, 0.15);
      }
      return;
    }
    if (!info) return;
    const p = info.pick;
    if (info.edge) {
      const color = info.edge.refusal || info.edge.erase ? C.bad : C.ok;
      const preview = !info.edge.erase && !info.edge.refusal && tool?.kind === "corridor" ? tool.finish : null;
      ghostEdge(info.edge.id, color, preview, info.edge.erase ? 0.35 : 0.15);
      return;
    }
    if (tool?.kind === "build" && info.check) {
      const color = info.check.ok ? C.ok : C.bad;
      const cells = onFloor(info.check.cells.length ? info.check.cells : p.kind === "slot" ? [p as Cell] : []);
      if (info.check.ok && cells.length) drawHalo(tool.room, cells);
      for (const c of cells) overlayCtx.poly(cellSector(h, c, 0.15)).fill({ color, alpha: 0.35 });
      if (cells.length) outlineCells(overlayCtx, cells, color, 3);
      if (info.check.ok && info.check.merges && cells.length) {
        const centre = roomCentre(h, cells);
        drawPlus(overlayCtx, centre.x, centre.y, Math.min(24, centre.size * 0.6), color);
      }
      return;
    }
    if (info.room) {
      if (info.room.id !== selected || tool?.kind === "demolish") markRoom(info.room, tool?.kind === "demolish" ? C.bad : C.hover);
      return;
    }
    if (p.kind === "slot") overlayCtx.poly(cellSector(h, p, 0.15)).fill({ color: C.hover, alpha: 0.15 }).stroke({ color: C.hover, width: 2 });
    else if (p.kind === "gallery") {
      overlayCtx.circle(0, 0, h.shaftRadiusM * PX).stroke({ color: C.hover, width: 2 });
    }
  }

  function updateCaption(): void {
    if (!layout) return;
    const dug = drill?.floor === floor ? ` · being dug, ${Math.floor((drill.progress ?? 0) * 100)}%: blueprints only` : "";
    caption.text = `Floor ${floor}${dug}`;
  }

  // ---- camera ----

  /** Fit the floor's carved rings on screen. */
  function fit(): void {
    if (!layout) return;
    // Frame the carved rings, with one locked ring showing past them.
    const h = layout.hole;
    const outer = ringRadii(h, Math.min(h.ringSlots.length, h.unlockedRings + 1))[1] * PX;
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (Math.min(app.screen.width, app.screen.height) * 0.92) / (outer * 2)));
    cam.x = 0;
    cam.y = 0;
  }

  function applyCamera(): void {
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom));
    world.scale.set(cam.zoom);
    world.x = app.screen.width / 2 - cam.x * cam.zoom;
    world.y = app.screen.height / 2 - cam.y * cam.zoom;
    const labelScale = Math.max(1, MIN_LABEL_PX / (LABEL_PX * cam.zoom));
    for (const label of labels.children) label.scale.set(labelScale);
    refreshHover();
  }

  // ---- hover and input ----

  const canvas = app.canvas;
  let pointer: { clientX: number; clientY: number } | null = null;
  let drag: { x: number; y: number; moved: number } | null = null;

  function screenToPlan(e: { clientX: number; clientY: number }): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [cam.x + (e.clientX - r.left - app.screen.width / 2) / cam.zoom, cam.y + (e.clientY - r.top - app.screen.height / 2) / cam.zoom];
  }

  function pickHere(): Pick {
    if (!layout || !pointer) return { kind: "rock" };
    const [px, py] = screenToPlan(pointer);
    // Mid-height of this floor, in the same metres as the 3D view.
    return pickAt(layout.hole, px / PX, -(floor - 0.5) * FLOOR_H, py / PX);
  }

  /** Shift erases with the corridor tool. */
  let shift = false;

  /** The border nearest the pointer, on this floor. */
  function edgeHere(): Edge | null {
    if (!layout || !pointer) return null;
    const h = layout.hole;
    const [px, py] = screenToPlan(pointer);
    const r = Math.hypot(px, py) / PX;
    const rings = (r - h.shaftRadiusM) / RING_D;
    return nearestEdge(h, floor, rings, Math.atan2(py, px) / TAU, RING_D);
  }

  function hoverInfo(): HoverInfo | null {
    if (!layout || !pointer) return null;
    if (tool?.kind === "corridor") return edgeHoverFor(layout, resources, tool, pickHere(), edgeHere(), shift);
    return hoverInfoFor(layout, resources, tool, pickHere(), gates);
  }

  function refreshHover(force = false): void {
    const info = hoverInfo();
    const key = hoverKeyFor(info, tool, layout?.version ?? -1, selected) + floor;
    if (!force && key === hoverKey) return;
    hoverKey = key;
    drawOverlay(info);
    opts.onHover?.(info);
  }

  // Snaking corridors: the chain grows and shrinks under the pointer while the button is held.
  let snaking = false;
  let chain: Chain = EMPTY_CHAIN;
  let chainErase = false;
  let proposal: Proposal | null = null;

  function snake(): void {
    if (!layout) return;
    const next = extendChain(layout, chain, edgeHere(), chainErase);
    if (next === chain) return;
    chain = next;
    refreshHover(true);
  }

  /** Released: a chain goes to the player to confirm; a single border is just drawn (or filled in). */
  function endSnake(): void {
    snaking = false;
    const done = chain;
    chain = EMPTY_CHAIN;
    if (done.edges.length > 1) opts.onPropose?.({ edges: done.edges, erase: chainErase });
    else if (done.edges.length === 1 && layout) {
      const info = hoverInfo();
      if (info) clickWith(layout, tool, info, opts);
    }
    refreshHover(true);
  }


  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    pointer = e;
    shift = e.shiftKey;
    canvas.setPointerCapture(e.pointerId);
    if (paints(tool) && tool?.kind === "corridor") {
      snaking = true;
      chainErase = shift || tool.erase;
      chain = EMPTY_CHAIN;
      snake();
      return;
    }
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
  };
  const onPointerMove = (e: PointerEvent) => {
    pointer = e;
    shift = e.shiftKey;
    if (snaking) {
      snake();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > CLICK_SLOP) canvas.style.cursor = "grabbing";
      cam.x -= dx / cam.zoom;
      cam.y -= dy / cam.zoom;
      if (drag.moved > CLICK_SLOP) userMoved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      applyCamera();
      return;
    }
    refreshHover();
  };
  const onPointerUp = (e: PointerEvent) => {
    pointer = e;
    if (drag && drag.moved <= CLICK_SLOP && layout) {
      const info = hoverInfo();
      if (info) clickWith(layout, tool, info, opts);
    }
    drag = null;
    if (snaking) endSnake();
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = "";
  };
  const onPointerLeave = () => {
    pointer = null;
    refreshHover();
  };
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    opts.onCancel?.();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    pointer = e;
    userMoved = true;
    if (e.ctrlKey) {
      // Pinch or ctrl+wheel: zoom around the cursor.
      const [wx, wy] = screenToPlan(e);
      cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * Math.exp(-e.deltaY * 0.01)));
      const r = canvas.getBoundingClientRect();
      cam.x = wx - (e.clientX - r.left - app.screen.width / 2) / cam.zoom;
      cam.y = wy - (e.clientY - r.top - app.screen.height / 2) / cam.zoom;
    } else {
      cam.x += e.deltaX / cam.zoom;
      cam.y += e.deltaY / cam.zoom;
    }
    applyCamera();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Shift" || shift === (e.type === "keydown")) return;
    shift = e.type === "keydown";
    refreshHover(true);
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  app.renderer.on("resize", () => {
    if (!userMoved) fit();
    applyCamera();
  });

  function redraw(force = false): void {
    if (!layout) return;
    const key = `${gameId}:${layout.version}:${JSON.stringify(layout.hole)}:${floor}`;
    if (!force && key === drawnKey) return;
    drawnKey = key;
    drawBase(layout.hole);
    drawRooms(layout);
    fieldKey = "";
    if (!fitted) {
      fit();
      fitted = true;
    }
    applyCamera();
  }

  function redrawField(force = false): void {
    const key = `${overlayType}:${floor}:${heat.bad}`;
    if (!force && key === fieldKey) return;
    fieldKey = key;
    drawField();
  }

  const stage: Stage = {
    update(snapshot) {
      const identity = `${snapshot.gameId}:${snapshot.holeId}`;
      if (identity !== gameId) {
        gameId = identity;
        selected = null;
        fitted = false;
        userMoved = false;
      }
      layout = snapshot.layout;
      drill = snapshot.drill;
      resources = snapshot.resources;
      gates = snapshot.holeGates;
      const fieldChanged = snapshot.effects !== field || (overlayType === "happiness" && snapshot.happiness.pools !== happiness?.pools);
      field = snapshot.effects;
      happiness = snapshot.happiness;
      redraw();
      redrawField(fieldChanged);
      updateCaption();
      refreshHover();
    },
    setTool(t) {
      tool = t;
      refreshHover(true);
    },
    setSelected(id) {
      selected = id;
      refreshHover(true);
    },
    setOverlay(type) {
      overlayType = type;
      redrawField(true);
    },
    setColorBlind(on) {
      heat = on ? HEAT.colorBlind : HEAT.normal;
      redrawField(true);
      refreshHover(true);
    },
    setQuality() {
      // Flat drawing: nothing to trade.
    },
    setProposal(p) {
      proposal = p;
      refreshHover(true);
    },
    setFloor(f) {
      const next = f ?? 1;
      if (next === floor) return;
      floor = next;
      redraw(true);
      redrawField(true);
      updateCaption();
      refreshHover(true);
    },
    destroy() {
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      app.destroy({ removeView: true }, { children: true, context: true });
    },
  };
  return stage;
}

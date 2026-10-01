import { UI_FONT } from "../view/font";
import { roomLabel } from "../sim/roomName";
import { crewsAt, crewsKey } from "../view/crews";
import { CONDITION_ALPHA, conditionKey, conditionTints } from "../view/conditionView";
import { reachTints } from "../view/reachView";
import { Application, Container, Graphics, GraphicsContext, Text } from "pixi.js";
import type { Hole } from "../sim/geometry";
import { config } from "../sim/config";
import { roomAt, type Cell, type Layout, type RoomInstance } from "../sim/placement";
import { doorsOnFloor } from "../view/doors";
import { glazedWalls } from "../sim/windows";
import { isOpen } from "../sim/excavation";
import { edgeById, edgeSides, galleryEdges, isGalleryEdge, nearestEdge, type Edge } from "../sim/edges";
import { corridorJoints, corridors, hasBulkhead } from "../sim/corridors";
import { constructionStripes, corridorBand } from "./corridorArt";
import { roomDef } from "../sim/rooms";
import { previewEffects, type EffectField } from "../sim/effects";
import { clickWith, edgeHoverFor, highlightsSlot, hoverInfoFor, hoverKeyFor, paints } from "../view/interaction";
import { EMPTY_CHAIN, extendChain, type Chain } from "../view/corridorPlan";
import type { HoverInfo, Proposal, Stage, StageOptions, Tool, Warning } from "../view/types";
import type { Happiness } from "../sim/happiness";
import type { DrillView, Snapshot } from "../sim/snapshot";
import {
  FLOOR_GAP,
  GALLERY_H,
  RING_H,
  SURFACE_H,
  TURN_W,
  floorTop,
  pick,
  ringTop,
  slotX,
  worldHeight,
} from "./layout";

export type { HoverInfo, Stage, StageOptions, Tool };
import { drawAirlock, drawEmptySpace, drawGlyph, drawHeadframe, drawHills, drawLandingPad, drawPlus, drawPod, drawRockCell, drawRoverDepot, drawSolarArray, shade, STARS } from "./art";
import { CATEGORY_COLORS, HEAT } from "./palette";

// The unrolled view. One full turn of the hole is drawn into shared graphics
// contexts, and several copies sit side by side so panning wraps seamlessly.

const C = {
  rock: 0x2a1510,
  undug: 0x22110d,
  nightSky: 0x120a14,
  daySky: 0xc98a5e,
  sun: 0xf3e2c4,
  ground: 0x7a3b22,
  gallery: 0x6b5448,
  galleryEdge: 0x2b1a14,
  /** The open shaft: Mars air, where no gallery tube hangs. */
  shaft: 0x140c0a,
  slot: 0x4a2c22,
  slotEdge: 0x2b1812,
  locked: 0x33201a,
  hatch: 0x3f2820,
  seam: 0xe07a3f,
  hover: 0xffe2b0,
  selected: 0xffffff,
  label: 0xd8c0ae,
  roomText: 0x1a0f0d,
  ok: 0x7fd67f,
  bad: 0xe0503a,
  digRock: 0x3a2018,
  /** A cell still solid rock, and one dug out with nothing in it. */
  rockCell: 0x341e17,
  empty: 0x6e5445,
  digFront: 0xe07a3f,
  lander: 0xd9d4cc,
  hillsNight: 0x1c0f12,
  hillsDay: 0x9a5a3a,
  star: 0xf6efe6,
  window: 0x9fd2ff,
  door: 0x2a1a14,
  rail: 0x4a3a32,
  landerDark: 0x6b6660,
  flame: 0xffb35c,
  build: 0xe0a03a,
};


const FIELD_MAX = 3; // effect strength shown at full colour
const FIELD_ALPHA = 0.75;


const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const HATCH_STEP = 16; // divides TURN_W so the hatch lines up across copies
const EDGE_MARGIN = 40; // how far past the content the camera may scroll
const CLICK_SLOP = 5; // px of movement before a press counts as a drag
const SURFACE_ROOM_H = 34;
const GROUND_H = 10;
const MIN_LABEL_PX = 11; // room labels never render smaller than this on screen
const LABEL_PX = 12;
/** A corridor band's thickness: 3 m, at the scale of a ring's depth. */
const BAND = RING_H * (corridors.widthM / config.geometry.roomDepthM);

export async function createStage(host: HTMLElement, opts: StageOptions = {}): Promise<Stage> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: C.rock,
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  const skyCtx = new GraphicsContext();
  const holeCtx = new GraphicsContext();
  const digCtx = new GraphicsContext();
  const roomsCtx = new GraphicsContext();
  const overlayCtx = new GraphicsContext();
  const landerCtx = new GraphicsContext();
  const buildCtx = new GraphicsContext();
  const fieldCtx = new GraphicsContext();

  const world = new Container();
  const floorLabels = new Container();
  app.stage.addChild(world, floorLabels);

  let layout: Layout | null = null;
  let holeKey = "";
  let layoutVersion = -1;
  /** Rooms a maintenance or cleaning crew is at, with its icon, shown on their labels. */
  let crews = new Map<number, string>();
  let gameId = "";
  let drill: DrillView | null = null;
  let resources: Record<string, number> = {};
  let deposits: string[] = [];
  let selected: number | null = null;
  /** Build mode is open: bare rock lights up under the pointer, as somewhere to build. */
  let building = false;
  let overlayType: string | null = null;
  let heat = HEAT.normal;
  let field: EffectField | null = null;
  let happiness: Happiness | null = null;
  let digKey = "";
  let tool: Tool = null;
  let hoverKey = "";
  /** The hover the UI was last told about. */
  let notifiedKey = "";
  const cam = { x: 0, y: -EDGE_MARGIN / 2, zoom: 1 };

  // ---- drawing ----

  function drawSky(s: Snapshot): void {
    const f = s.time.dayFraction;
    // Daylight 0..1: up at 06:00, peak at noon, down at 18:00.
    const light = f > 0.25 && f < 0.75 ? Math.sin((Math.PI * (f - 0.25)) / 0.5) : 0;
    const groundY = SURFACE_H - GROUND_H;
    skyCtx.clear();
    skyCtx.rect(0, 0, TURN_W, SURFACE_H).fill(mix(C.nightSky, C.daySky, light));
    const starAlpha = 1 - Math.min(1, light * 3);
    if (starAlpha > 0) {
      for (const [sx, sy, r] of STARS) skyCtx.circle(sx * TURN_W, sy * (groundY - 30), r).fill({ color: C.star, alpha: starAlpha * 0.8 });
    }
    if (light > 0) {
      const x = ((f - 0.25) / 0.5) * TURN_W;
      skyCtx.circle(x, SURFACE_H - 60 - light * (SURFACE_H - 80), 12).fill(C.sun);
    }
    drawHills(skyCtx, TURN_W, groundY, mix(C.hillsNight, C.hillsDay, light));
    skyCtx.rect(0, groundY, TURN_W, GROUND_H).fill(C.ground);
    skyCtx.rect(0, groundY, 2, GROUND_H).fill(C.seam); // 0° marker
  }

  /** Red where an effect hurts, green where it helps, stronger for bigger values. */
  /** The condition overlay's colours as last drawn. */
  let conditionShown = "";
  function drawHappiness(): void {
    if (!layout || !happiness) return;
    for (const pool of happiness.pools) {
      const room = layout.rooms.find((r) => r.id === pool.roomId);
      if (!room) continue;
      // Same scale as the effects: 50 is neutral, 0 and 100 are full colour.
      const v = ((pool.happiness - 50) / 50) * FIELD_MAX;
      const alpha = Math.min(1, Math.abs(v) / FIELD_MAX) * FIELD_ALPHA;
      const color = v < 0 ? heat.bad : heat.good;
      if (room.at.kind === "surface") fieldCtx.rect(...surfaceRect(room.surfaceCells, layout.surface.length)).fill({ color, alpha });
      else for (const row of cellRows(layout.hole, room.cells)) fieldCtx.rect(...rowRect(layout.hole, row)).fill({ color, alpha });
    }
  }

  /** Each room in its condition's colour, green to red. */
  function drawCondition(): void {
    if (!layout) return;
    for (const { room, color } of conditionTints(layout.rooms)) {
      if (room.at.kind === "surface") fieldCtx.rect(...surfaceRect(room.surfaceCells, layout.surface.length)).fill({ color, alpha: CONDITION_ALPHA });
      else for (const row of cellRows(layout.hole, room.cells)) fieldCtx.rect(...rowRect(layout.hole, row)).fill({ color, alpha: CONDITION_ALPHA });
    }
  }

  /** With no overlay on and a service or amenity selected: the homes it reaches on foot, and those it doesn't. */
  function drawReach(): void {
    if (!layout) return;
    for (const { room, color, alpha } of reachTints(layout, selected) ?? []) {
      for (const row of cellRows(layout.hole, room.cells)) fieldCtx.rect(...rowRect(layout.hole, row)).fill({ color, alpha });
    }
  }

  function drawField(): void {
    fieldCtx.clear();
    if (!overlayType) return drawReach();
    if (overlayType === "happiness") return drawHappiness();
    if (overlayType === "condition") return drawCondition();
    if (!layout || !field || !overlayType) return;
    const grid = field[overlayType];
    if (!grid) return;
    const h = layout.hole;
    grid.forEach((rings, fi) => {
      for (let ring = 1; ring <= h.unlockedRings; ring++) {
        const n = h.ringSlots[ring - 1]!;
        const y = ringTop(fi + 1, ring, h.ringSlots.length);
        rings[ring - 1]!.forEach((v, slot) => {
          if (Math.abs(v) < 0.05) return;
          const [x0, x1] = slotX(slot, n);
          const alpha = Math.min(1, Math.abs(v) / FIELD_MAX) * FIELD_ALPHA;
          fieldCtx.rect(x0 + 1, y + 1, x1 - x0 - 2, RING_H - 2).fill({ color: v < 0 ? heat.bad : heat.good, alpha });
        });
      }
    });
  }

  /** Progress bars on rooms under construction, updated as the crews work. */
  let buildKey = "";
  function drawBuild(s: Snapshot): void {
    const key = s.construction.jobs.map((j) => `${j.id}:${j.phase}:${Math.floor(j.progress * 50)}`).join(",") + s.layout.version;
    if (key === buildKey) return;
    buildKey = key;
    buildCtx.clear();
    const labels: { text: string; x: number; y: number }[] = [];
    for (const job of s.construction.jobs) {
      const room = job.roomId !== undefined ? s.layout.rooms.find((r) => r.id === job.roomId) : undefined;
      if (!room || room.at.kind !== "ring") continue;
      const cells = job.kind === "extend" ? (room.pendingCells ?? []) : room.cells;
      const row = cellRows(s.layout.hole, cells)[0];
      if (!row) continue;
      const [x, y, w, hh] = rowRect(s.layout.hole, row);
      const bar = { x: x + 6, y: y + hh - 9, w: w - 12 };
      buildCtx.rect(bar.x, bar.y, bar.w, 5).fill({ color: 0x1a0f0d, alpha: 0.8 });
      buildCtx.rect(bar.x, bar.y, bar.w * job.progress, 5).fill(C.build);
      labels.push({ text: `${job.phase === "excavating" ? "⛏ " : ""}${Math.floor(job.progress * 100)}%`, x: x + w / 2, y: y + hh / 2 - 4 });
    }
    // The percentage, in every copy of the turn.
    for (const copy of world.children as Container[]) {
      const layer = copy.children[BUILD_LABELS_INDEX] as Container | undefined;
      if (!layer) continue;
      layer.removeChildren().forEach((c) => c.destroy());
      for (const l of labels) {
        const t = new Text({ text: l.text, style: { fontFamily: UI_FONT, fill: 0xffffff, fontSize: 14, fontWeight: "800", stroke: { color: 0x1a0f0d, width: 4 } } });
        t.anchor.set(0.5);
        t.position.set(l.x, l.y);
        layer.addChild(t);
      }
    }
  }

  /** The Earth lander coming down onto the pad in the last hours before a drop. */
  function drawLander(s: Snapshot): void {
    landerCtx.clear();
    const descent = config.earth.descentDays * config.ticksPerDay;
    const e = s.earth;
    if (!e.padReady || e.waiting || e.ticksToDrop > descent) return;
    const pad = s.layout.rooms.find((r) => r.type === "landing_pad");
    if (!pad) return;
    const [px, py, pw] = surfaceRect(pad.surfaceCells, s.layout.surface.length);
    const t = 1 - e.ticksToDrop / descent; // 0 high up .. 1 touching down
    const w = 26;
    const h = 22;
    const x = px + pw / 2 - w / 2;
    const y = -h + (py - 6 - (-h)) * (1 - (1 - t) * (1 - t)); // eases in to land
    landerCtx.moveTo(x + w / 2, y - 10).lineTo(x + w, y).lineTo(x, y).closePath().fill(C.lander);
    landerCtx.rect(x, y, w, h).fill(C.lander).stroke({ color: C.landerDark, width: 2 });
    landerCtx.moveTo(x + 2, y + h).lineTo(x - 4, y + h + 6).moveTo(x + w - 2, y + h).lineTo(x + w + 4, y + h + 6).stroke({ color: C.landerDark, width: 2 });
    if (t < 0.97) landerCtx.moveTo(x + 7, y + h + 2).lineTo(x + w / 2, y + h + 14 + 6 * Math.sin(t * 90)).lineTo(x + w - 7, y + h + 2).closePath().fill({ color: C.flame, alpha: 0.9 });
  }

  /** Dug floors, plus the floor being dug (its rock cover is drawn separately). */
  function drawHole(h: Hole, digFloor: number | null, domed = false): void {
    const maxRings = h.ringSlots.length;
    const lastFloor = digFloor ?? h.floors;
    holeCtx.clear();
    for (let floor = 1; floor <= lastFloor; floor++) {
      const top = floorTop(floor, maxRings);
      // The open shaft, Mars air: gallery tubes hang in it where they're built (drawn with the corridors).
      // Under the dome it's air: an open walkway all the way round, with its railing.
      if (domed && floor <= h.floors) {
        holeCtx.rect(0, top, TURN_W, GALLERY_H).fill(C.gallery);
        holeCtx.rect(0, top + 2, TURN_W, 1.5).fill(C.rail);
        for (let x = 0; x < TURN_W; x += HATCH_STEP) holeCtx.rect(x, top + 2, 1.5, 6).fill(C.rail);
      } else holeCtx.rect(0, top, TURN_W, GALLERY_H).fill(C.shaft);
      holeCtx.rect(0, top + GALLERY_H - 2, TURN_W, 2).fill(C.galleryEdge);

      for (let ring = 1; ring <= maxRings; ring++) {
        const y = ringTop(floor, ring, maxRings);
        const n = h.ringSlots[ring - 1]!;
        const locked = ring > h.unlockedRings;
        if (locked) {
          holeCtx.rect(0, y, TURN_W, RING_H).fill(C.locked);
          for (let x = -RING_H; x < TURN_W; x += HATCH_STEP) {
            holeCtx.moveTo(x, y + RING_H).lineTo(x + RING_H, y);
          }
          holeCtx.stroke({ color: C.hatch, width: 2 });
        }
        for (let slot = 0; slot < n; slot++) {
          const [x0, x1] = slotX(slot, n);
          const r = holeCtx.rect(x0 + 1, y + 1, x1 - x0 - 2, RING_H - 2);
          if (locked) r.stroke({ color: C.slotEdge, width: 1 });
          else r.fill(C.slot).stroke({ color: C.slotEdge, width: 2 });
        }
      }
    }
    // Seam line at 0° through every floor.
    const bottom = floorTop(lastFloor + 1, maxRings) - FLOOR_GAP;
    holeCtx.rect(0, SURFACE_H, 2, bottom - SURFACE_H).fill({ color: C.seam, alpha: 0.5 });
    holeCtx.rect(0, bottom, TURN_W, worldHeight(h) - bottom).fill(C.undug);
  }

  /** Rock still to be dug on the floor being excavated, cleared top-down as the drill works. */
  function drawDig(h: Hole, d: DrillView | null): void {
    digCtx.clear();
    if (!d?.floor) return;
    const top = floorTop(d.floor, h.ringSlots.length);
    const height = floorTop(d.floor + 1, h.ringSlots.length) - FLOOR_GAP - top;
    const front = top + height * d.progress;
    digCtx.rect(0, front, TURN_W, top + height - front).fill({ color: C.digRock, alpha: 0.85 });
    digCtx.rect(0, front - 1, TURN_W, 3).fill({ color: C.digFront, alpha: d.active ? 1 : 0.4 });
  }

  /** One rect per ring row the cells cover (per floor, for tall rooms). x may run past TURN_W; the next copy shows it. */
  function cellRows(h: Hole, cells: Cell[]): { floor: number; ring: number; x0: number; x1: number; first: boolean; last: boolean }[] {
    const out = [];
    for (const floor of [...new Set(cells.map((c) => c.floor))].sort((a, b) => a - b)) {
      const here = cells.filter((c) => c.floor === floor);
      const rings = [...new Set(here.map((c) => c.ring))].sort((a, b) => a - b);
      for (const ring of rings) {
        const n = h.ringSlots[ring - 1]!;
        const slots = new Set(here.filter((c) => c.ring === ring).map((c) => c.slot));
        for (const s of slots) {
          if (slots.has((s - 1 + n) % n) && slots.size < n) continue; // not the start of a run
          let len = 1;
          while (len < n && slots.has((s + len) % n)) len++;
          out.push({
            floor,
            ring,
            x0: (s / n) * TURN_W,
            x1: ((s + len) / n) * TURN_W,
            first: ring === rings[0],
            last: ring === rings[rings.length - 1],
          });
          if (slots.size === n) break;
        }
      }
    }
    return out;
  }

  function rowRect(h: Hole, row: ReturnType<typeof cellRows>[number]): [number, number, number, number] {
    const top = ringTop(row.floor, row.ring, h.ringSlots.length) + (row.first ? 2 : 0);
    const bottom = ringTop(row.floor, row.ring, h.ringSlots.length) + RING_H - (row.last ? 2 : 0);
    return [row.x0 + 2, top, row.x1 - row.x0 - 4, bottom - top];
  }

  function surfaceRect(slots: number[], total: number): [number, number, number, number] {
    const w = TURN_W / total;
    // Slots are consecutive but may wrap; start from the one without a predecessor.
    const set = new Set(slots);
    const start = slots.find((s) => !set.has((s - 1 + total) % total)) ?? slots[0]!;
    return [start * w + 3, SURFACE_H - GROUND_H - SURFACE_ROOM_H, slots.length * w - 6, SURFACE_ROOM_H];
  }

  /** Every cell of the dug floors that isn't a room: solid rock, or dug-out empty space with pillars. */
  function drawCells(l: Layout): void {
    const h = l.hole;
    for (let floor = 1; floor <= h.floors; floor++) {
      for (let ring = 1; ring <= h.unlockedRings; ring++) {
        const n = h.ringSlots[ring - 1]!;
        const y = ringTop(floor, ring, h.ringSlots.length);
        for (let slot = 0; slot < n; slot++) {
          const c = { floor, ring, slot };
          if (roomAt(l, c)) continue;
          const [x0, x1] = slotX(slot, n);
          if (isOpen(l, c)) drawEmptySpace(roomsCtx, x0 + 1, y + 1, x1 - x0 - 2, RING_H - 2, C.empty);
          else drawRockCell(roomsCtx, x0 + 1, y + 1, x1 - x0 - 2, RING_H - 2, C.rockCell, (floor * 64 + ring) * 512 + slot);
        }
      }
    }
  }

  function drawRooms(l: Layout): void {
    roomsCtx.clear();
    drawCells(l);
    const groundY = SURFACE_H - GROUND_H;
    for (const room of l.rooms) {
      const def = roomDef(room.type);
      const color = CATEGORY_COLORS[def.category] ?? C.label;
      if (room.at.kind === "surface") {
        const [x, , w] = surfaceRect(room.surfaceCells, l.surface.length);
        if (room.type === "solar_array") drawSolarArray(roomsCtx, x, w, groundY, color);
        else if (room.type === "landing_pad") drawLandingPad(roomsCtx, x, w, groundY, color);
        else if (room.type === "landing_pod") drawPod(roomsCtx, x, w, groundY, color);
        else if (room.type === "rover_depot") drawRoverDepot(roomsCtx, x, w, groundY, color);
        else roomsCtx.rect(...surfaceRect(room.surfaceCells, l.surface.length)).fill(color);
        continue;
      }
      // A cargo elevator's shaft: a dark column with its cables down to the stop.
      const stop = def.cargoShaft ? Math.max(...room.cells.map((c) => c.floor)) : 0;
      if (def.cargoShaft) {
        for (const row of cellRows(l.hole, room.cells.filter((c) => c.floor < stop))) {
          const [x, y, w, hh] = rowRect(l.hole, row);
          roomsCtx.rect(x, y, w, hh).fill(shade(color, room.building || room.planned ? 0.25 : 0.35));
          for (const cx of [x + w * 0.35, x + w * 0.65]) roomsCtx.moveTo(cx, y).lineTo(cx, y + hh).stroke({ color: shade(color, 0.7), width: 1.5 });
        }
      }
      const rows = cellRows(l.hole, def.cargoShaft ? room.cells.filter((c) => c.floor === stop) : room.cells);
      for (const row of rows) {
        let [x, y, w, hh] = rowRect(l.hole, row);
        // Public rooms on a gallery tube have no wall there: they open right onto it.
        const open = def.public && row.ring === 1 && galleryEdges(l.hole, row.floor).some((e) => l.corridors[e.id] && e.a0 * TURN_W >= row.x0 - 0.5 && e.a1 * TURN_W <= row.x1 + 0.5);
        if (open) [y, hh] = [y - 3, hh + 3];
        const r = roomsCtx.rect(x, y, w, hh);
        if (room.planned) r.fill({ color, alpha: 0.3 }).stroke({ color, width: 2 });
        else if (room.building) scaffold(x, y, w, hh, color);
        else r.fill(color);
        if (def.public && !room.planned && !room.building) {
          const wall = { color: shade(color, 0.45), width: 1.5, alpha: 0.9 };
          roomsCtx.moveTo(x, y).lineTo(x, y + hh).lineTo(x + w, y + hh).lineTo(x + w, y);
          if (!open) roomsCtx.lineTo(x, y);
          roomsCtx.stroke(wall);
        }
      }
      // Stairs or an elevator reaching further: the new floors under scaffolding.
      for (const row of cellRows(l.hole, room.pendingCells ?? [])) scaffold(...rowRect(l.hole, row), color);
      if (!room.planned && !room.building && !def.public) drawFrontage(l, room, rows, color);
      drawRoomGlyph(l, room, rows, color);
      if (!room.connected) for (const row of rows) roomsCtx.rect(...rowRect(l.hole, row)).stroke({ color: C.bad, width: 3 });
    }
    // At the rim, in front of the surface buildings (nearer the shaft): the entrance's airlock, and cargo headframes.
    for (const room of l.rooms) {
      const def = roomDef(room.type);
      if (!def.surfaceLink || room.at.kind !== "ring") continue;
      const row = cellRows(l.hole, room.cells.filter((c) => c.floor === 1))[0];
      if (!row) continue;
      const color = CATEGORY_COLORS[def.category] ?? C.label;
      const w = Math.max(row.x1 - row.x0, 40);
      const x = (row.x0 + row.x1) / 2 - w / 2;
      if (def.cargoShaft) drawHeadframe(roomsCtx, x, w, groundY + 4, room.building || room.planned ? shade(color, 0.6) : color);
      else drawAirlock(roomsCtx, x, w, groundY + 4, color);
    }
    drawCorridors(l);
    for (const room of l.rooms) if (!room.planned && !room.building) drawWindows(l, room);
  }

  /**
   * A room's windows onto corridors and walk-through rooms (shaft windows are
   * part of its frontage): panes along its side of each glazed border, around its door.
   */
  function drawWindows(l: Layout, room: RoomInstance): void {
    const h = l.hole;
    const own = new Set(room.cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
    for (const { edge: e } of glazedWalls(l, room)) {
      if (isGalleryEdge(e)) continue;
      const b = bandOf(h, e);
      const [a] = edgeSides(h, e);
      const first = !!a && own.has(`${a.floor}:${a.ring}:${a.slot}`);
      // Out from the border to the room's side: past the corridor's half, if one runs here.
      const off = l.corridors[e.id] ? BAND / 2 : 0;
      const door = doorsOnFloor(l, e.floor).some((d) => d.edge === e.id && d.roomId === room.id);
      const mid = b.len / 2;
      for (let t = 4; t + 10 <= b.len - 4; t += 13) {
        if (door && Math.abs(t + 5 - mid) < 12) continue;
        if (b.along === "v") {
          const x = b.x + BAND / 2 + (first ? -off - 3 : off);
          roomsCtx.rect(x, b.y + t, 3, 10).fill({ color: C.window, alpha: 0.9 });
        } else {
          const y = b.y + BAND / 2 + (first ? -off - 3 : off);
          roomsCtx.rect(b.x + t, y, 10, 3).fill({ color: C.window, alpha: 0.9 });
        }
      }
    }
  }

  /** Where a corridor's band sits: centred on its border, carving into both sides. A gallery tube fills the band over its floor. */
  function bandOf(h: Hole, e: Edge): { x: number; y: number; len: number; along: "h" | "v"; thick: number } {
    const maxRings = h.ringSlots.length;
    if (e.kind === "arc" && isGalleryEdge(e)) return { x: e.a0 * TURN_W, y: floorTop(e.floor, maxRings), len: (e.a1 - e.a0) * TURN_W, along: "h", thick: GALLERY_H - 2 };
    if (e.kind === "radial") return { x: e.turn * TURN_W - BAND / 2, y: ringTop(e.floor, e.ring, maxRings), len: RING_H, along: "v", thick: BAND };
    return { x: e.a0 * TURN_W, y: ringTop(e.floor, e.circle, maxRings) + RING_H - BAND / 2, len: (e.a1 - e.a0) * TURN_W, along: "h", thick: BAND };
  }

  /**
   * Corridors, drawn over the rooms: a band in its finish, carved out of
   * whatever it runs between. A door wherever a linked corridor meets a room;
   * red hatching on corridors that don't reach the shaft yet.
   */
  function drawCorridors(l: Layout): void {
    const h = l.hole;
    for (const [id, finish] of Object.entries(l.corridors)) {
      const e = edgeById(h, id);
      if (!e) continue;
      const planned = e.floor > h.floors;
      const linked = !!l.corridorLinked?.[id];
      const b = bandOf(h, e);
      const building = l.corridorsBuilding?.[id] !== undefined;
      const BAND = b.thick;
      corridorBand(roomsCtx, b.x, b.y, b.len, BAND, b.along, finish, planned || building ? 0.45 : 1);
      // A bulkhead: a sealed door across the corridor, in hazard stripes.
      if (hasBulkhead(l, id)) {
        const [bx, by, bw, bh] = b.along === "h" ? [b.x + b.len / 2 - 2.5, b.y - 1, 5, BAND + 2] : [b.x - 1, b.y + b.len / 2 - 2.5, BAND + 2, 5];
        roomsCtx.rect(bx, by, bw, bh).fill(0x3b3f45);
        for (let k = 0; k < (b.along === "h" ? bh : bw); k += 4) {
          if (b.along === "h") roomsCtx.rect(bx, by + k, bw, 2).fill(0xe0a03a);
          else roomsCtx.rect(bx + k, by, 2, bh).fill(0xe0a03a);
        }
      }
      const [w, hh] = b.along === "h" ? [b.len, BAND] : [BAND, b.len];
      if (building || l.corridorsFilling?.[id] !== undefined) {
        // Not built yet, or about to be filled in: a dashed orange outline, like tape around a dig.
        for (let t = 0; t < b.len; t += 8) {
          const [x0, y0, x1, y1] = b.along === "h" ? [b.x + t, b.y, b.x + Math.min(t + 4, b.len), b.y] : [b.x, b.y + t, b.x, b.y + Math.min(t + 4, b.len)];
          roomsCtx.moveTo(x0, y0).lineTo(x1, y1);
          if (b.along === "h") roomsCtx.moveTo(x0, y0 + BAND).lineTo(x1, y1 + BAND);
          else roomsCtx.moveTo(x0 + BAND, y0).lineTo(x1 + BAND, y1);
        }
        roomsCtx.stroke({ color: C.build, width: 2 });
        if (building) continue;
      }
      if (!linked && !planned) {
        for (let t = 0; t < b.len; t += 8) {
          const [x0, y0] = b.along === "h" ? [b.x + t, b.y + BAND] : [b.x, b.y + t + BAND];
          roomsCtx.moveTo(x0, y0).lineTo(x0 + BAND * 0.7, y0 - BAND * 0.7);
        }
        roomsCtx.stroke({ color: C.bad, width: 1.5, alpha: 0.8 });
        roomsCtx.rect(b.x, b.y, w, hh).stroke({ color: C.bad, width: 1.5 });
        continue;
      }
      // Doors into the rooms on either side that open onto it here (public rooms are open anyway); ring 1's frontage has its own onto a tube.
      if (isGalleryEdge(e)) continue;
      const [a, z] = edgeSides(h, e);
      const doors = doorsOnFloor(l, e.floor).filter((d) => d.edge === id);
      const opens = (c: Cell | null) => !!c && doors.some((d) => d.cell.ring === c.ring && d.cell.slot === c.slot);
      if (b.along === "v") {
        const y = b.y + RING_H / 2 - 7;
        if (opens(a)) roomsCtx.rect(b.x - 3, y, 3, 14).fill(C.door);
        if (opens(z)) roomsCtx.rect(b.x + BAND, y, 3, 14).fill(C.door);
      } else {
        const mid = b.x + b.len / 2 - 7;
        if (opens(a)) roomsCtx.rect(mid, b.y - 3, 14, 3).fill(C.door);
        if (opens(z)) roomsCtx.rect(mid, b.y + BAND, 14, 3).fill(C.door);
      }
    }
    // Square joints where corridors turn, so the outer edges meet in a clean corner.
    const maxRings = h.ringSlots.length;
    for (const joint of corridorJoints(l).values()) {
      if (joint.circle === 0) continue; // a tube hangs in its own band, clear of the rooms
      const y = joint.circle === 0 ? ringTop(joint.floor, 1, maxRings) : ringTop(joint.floor, joint.circle, maxRings) + RING_H;
      const x = joint.turn * TURN_W;
      corridorBand(roomsCtx, x - BAND / 2, y - BAND / 2, BAND, BAND, "h", joint.finish, joint.floor > h.floors ? 0.45 : 1);
    }
  }

  /** Under construction: faint, under semi-opaque diagonal hazard stripes, taped in orange. */
  function scaffold(x: number, y: number, w: number, hh: number, color: number): void {
    roomsCtx.rect(x, y, w, hh).fill({ color, alpha: 0.4 });
    roomsCtx.rect(x, y, w, hh).fill(constructionStripes());
    roomsCtx.rect(x, y, w, hh).stroke({ color: C.build, width: 2 });
  }

  /**
   * Frontage: windows on the shaft side of ring 1, with a door onto a gallery
   * tube where one runs along it (a full wall of windows where none does);
   * plain wall elsewhere. Doors onto corridors come with the corridors.
   */
  function drawFrontage(l: Layout, room: RoomInstance, rows: ReturnType<typeof cellRows>, color: number): void {
    // Shaft windows only where the player has put them in.
    const glazed = glazedWalls(l, room).flatMap((g) => (g.edge.kind === "arc" && isGalleryEdge(g.edge) ? [g.edge] : []));
    const h = l.hole;
    const wall = shade(color, 0.45);
    for (const row of rows) {
      const [x, y, w, hh] = rowRect(h, row);
      roomsCtx.rect(x, y, w, hh).stroke({ color: wall, width: 1.5, alpha: 0.9 });
      if (row.ring === 1) {
        // Shaft windows, with the door onto the gallery in the middle. They keep clear of
        // corridors carved along either end, so they move with the room's walls.
        const n = h.ringSlots[0]!;
        const startSlot = Math.round((row.x0 / TURN_W) * n) % n;
        const endSlot = Math.round((row.x1 / TURN_W) * n) % n;
        const cut = (slot: number) => (l.corridors[`R${row.floor}.1.${slot}`] ? BAND / 2 : 0);
        const xs = x + cut(startSlot);
        const xe = x + w - cut(endSlot);
        // The tubes along this stretch of wall: the door goes in the middle of them.
        const tubes = galleryEdges(h, row.floor).filter((e) => l.corridors[e.id] && e.a0 * TURN_W >= row.x0 - 0.5 && e.a1 * TURN_W <= row.x1 + 0.5);
        // The room's door onto them, where the 3D view cuts it.
        const door = doorsOnFloor(l, row.floor).find((d) => d.side === "inner" && d.cell.ring === 1 && tubes.some((t) => t.id === d.edge));
        const mid = door ? (door.angle / (Math.PI * 2)) * TURN_W : null;
        // Behind a tube, a band of windows; with none, a window wall nearly floor to ceiling.
        const tubeOver = (px: number) => tubes.some((e) => px >= e.a0 * TURN_W && px <= e.a1 * TURN_W);
        const glass = (px: number) => glazed.some((e) => e.floor === row.floor && px >= e.a0 * TURN_W && px <= e.a1 * TURN_W);
        for (let wx = xs + 5; wx + 10 < xe - 4; wx += 13) {
          if (mid !== null && Math.abs(wx + 5 - mid) < 9) continue;
          if (!glass(wx + 5)) continue;
          if (tubeOver(wx + 5)) roomsCtx.rect(wx, y + 3, 10, 5).fill({ color: C.window, alpha: 0.85 });
          else roomsCtx.rect(wx, y + 2, 10, hh * 0.55).fill({ color: C.window, alpha: 0.85 });
        }
        if (mid !== null) roomsCtx.rect(mid - 5, y, 10, 11).fill(C.door);
      }
    }
  }

  function drawRoomGlyph(l: Layout, room: RoomInstance, rows: ReturnType<typeof cellRows>, color: number): void {
    const ink = room.planned ? color : shade(color, 0.55);
    if (room.type === "farm") {
      // Rows of crops across the whole farm.
      for (const row of rows) {
        const [x, y, w, hh] = rowRect(l.hole, row);
        for (let gx = x + 18; gx < x + w - 10; gx += 26) drawGlyph(roomsCtx, "farm", gx, y + hh / 2 + 6, 22, ink);
      }
      return;
    }
    const row = rows[0];
    if (!row) return;
    const [x, y, w, hh] = rowRect(l.hole, row);
    const size = Math.min(26, w * 0.5, hh - 14);
    const cx = w > 70 ? x + w - size / 2 - 8 : x + w / 2;
    drawGlyph(roomsCtx, room.type, cx, y + hh / 2 + 6, size, ink);
  }

  function roomLabels(l: Layout): Container {
    const c = new Container();
    for (const room of l.rooms) {
      const def = roomDef(room.type);
      if (!def.short) continue;
      const text = new Text({
        text: `${room.connected ? roomLabel(room) : `${roomLabel(room)} ⚠`}${crews.has(room.id) ? ` ${crews.get(room.id)}` : ""}`,
        style: {
          fontFamily: UI_FONT,
          fill: room.planned ? (CATEGORY_COLORS[def.category] ?? C.label) : C.roomText,
          fontSize: LABEL_PX,
          fontWeight: "600",
        },
      });
      if (room.at.kind === "surface") {
        const [x, y] = surfaceRect(room.surfaceCells, l.surface.length);
        text.position.set(x + 5, y + 4);
      } else {
        const row = cellRows(l.hole, room.cells)[0]!;
        const [x, y] = rowRect(l.hole, row);
        text.position.set(x + 4, y + 3);
      }
      c.addChild(text);
    }
    return c;
  }

  function outlineRoom(room: RoomInstance, color: number, width: number): void {
    if (!layout) return;
    if (room.at.kind === "surface") {
      overlayCtx.rect(...surfaceRect(room.surfaceCells, layout.surface.length)).stroke({ color, width });
    } else {
      for (const row of cellRows(layout.hole, room.cells)) overlayCtx.rect(...rowRect(layout.hole, row)).stroke({ color, width });
    }
  }

  /** A border highlighted: its band outlined in a colour, with the finish previewed if given. */
  function ghostEdge(id: string, color: number, finish: string | null, alpha: number): void {
    if (!layout) return;
    const e = edgeById(layout.hole, id);
    if (!e) return;
    const b = bandOf(layout.hole, e);
    const [w, hh] = b.along === "h" ? [b.len, BAND] : [BAND, b.len];
    if (finish) corridorBand(overlayCtx, b.x, b.y, b.len, BAND, b.along, finish, 0.7);
    overlayCtx.rect(b.x, b.y, w, hh).fill({ color, alpha }).stroke({ color, width: 2.5 });
  }

  function drawOverlay(info: HoverInfo | null): void {
    overlayCtx.clear();
    if (!layout) return;
    const sel = selected !== null ? layout.rooms.find((r) => r.id === selected) : undefined;
    if (sel) outlineRoom(sel, C.selected, 3);
    const h = layout.hole;
    // A warning is up: the corridors it would fill in, and whatever they'd cut off, in red.
    if (warning) {
      for (const id of warning.edges) ghostEdge(id, C.bad, null, 0.45);
      for (const id of warning.rooms) {
        const r = layout.rooms.find((x) => x.id === id);
        if (r) outlineRoom(r, C.bad, 4);
      }
    }
    // A snaked chain (while dragging, or waiting for confirmation): every border highlighted.
    const shown = snaking ? { edges: chain.edges, erase: chainErase } : proposal;
    if (shown?.edges.length) {
      for (const id of shown.edges) {
        const existing = !!layout.corridors[id];
        if (shown.erase) ghostEdge(id, C.bad, null, 0.35);
        else if (existing) ghostEdge(id, C.hover, null, 0.1); // already there: rides along free
        else ghostEdge(id, C.ok, tool?.kind === "corridor" ? tool.finish : null, 0.15);
      }
      return;
    }
    if (!info) return;
    const p = info.pick;

    if (info.edge) {
      const color = info.edge.refusal ? C.bad : info.edge.erase ? C.bad : C.ok;
      const preview = !info.edge.erase && !info.edge.refusal && tool?.kind === "corridor" && !info.edge.windows ? tool.finish : null;
      // The windows tool lights up the whole wall it would glaze.
      for (const id of info.edge.windows?.edges ?? [info.edge.id]) ghostEdge(id, color, preview, info.edge.erase ? 0.35 : 0.15);
      return;
    }

    if (tool?.kind === "build" && info.check) {
      const color = info.check.ok ? C.ok : C.bad;
      const cells = info.check.cells.length ? info.check.cells : p.kind === "slot" ? [p as Cell] : [];
      if (info.check.ok && cells.length) drawHalo(tool.room, cells);
      for (const row of cellRows(h, cells)) {
        overlayCtx.rect(...rowRect(h, row)).fill({ color, alpha: 0.35 }).stroke({ color, width: 3 });
      }
      // Extending stairs or an elevator: a plus on the piece being added.
      if (info.check.ok && info.check.merges && p.kind === "slot") {
        const n = h.ringSlots[p.ring - 1]!;
        const [x0, x1] = slotX(p.slot, n);
        drawPlus(overlayCtx, (x0 + x1) / 2, ringTop(p.floor, p.ring, h.ringSlots.length) + RING_H / 2, 18, color);
      }
      if (info.check.surfaceCells.length) {
        overlayCtx.rect(...surfaceRect(info.check.surfaceCells, layout.surface.length)).fill({ color, alpha: 0.35 }).stroke({ color, width: 3 });
      }
      return;
    }

    if (info.room) {
      if (info.room.id !== selected || tool?.kind === "demolish") outlineRoom(info.room, tool?.kind === "demolish" ? C.bad : C.hover, 3);
      return;
    }

    if (p.kind === "slot" && highlightsSlot(layout, p, building)) {
      const n = h.ringSlots[p.ring - 1]!;
      const [x0, x1] = slotX(p.slot, n);
      const y = ringTop(p.floor, p.ring, h.ringSlots.length);
      overlayCtx.rect(x0 + 1, y + 1, x1 - x0 - 2, RING_H - 2).fill({ color: C.hover, alpha: 0.15 }).stroke({ color: C.hover, width: 3 });
    } else if (p.kind === "gallery") {
      overlayCtx.rect(0, floorTop(p.floor, h.ringSlots.length), TURN_W, GALLERY_H).fill({ color: C.hover, alpha: 0.25 });
    }
  }

  /**
   * While placing, show what the room would radiate: its strongest effect,
   * spread exactly as the sim would spread it.
   */
  function drawHalo(type: string, cells: Cell[]): void {
    if (!layout) return;
    const effects = roomDef(type).effects.filter((e) => !e.residentsOnly && e.radius > 0);
    if (!effects.length) return;
    const main = effects.reduce((a, b) => (Math.abs(b.strength) > Math.abs(a.strength) ? b : a));
    const grid = previewEffects(layout, type, cells)[main.type];
    if (!grid) return;
    const own = new Set(cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
    const h = layout.hole;
    grid.forEach((rings, fi) =>
      rings.forEach((slots, ri) => {
        const n = h.ringSlots[ri]!;
        slots.forEach((v, slot) => {
          if (Math.abs(v) < 0.05 || own.has(`${fi + 1}:${ri + 1}:${slot}`)) return;
          const [x0, x1] = slotX(slot, n);
          const y = ringTop(fi + 1, ri + 1, h.ringSlots.length);
          const alpha = Math.min(1, Math.abs(v) / FIELD_MAX) * FIELD_ALPHA;
          overlayCtx.rect(x0 + 1, y + 1, x1 - x0 - 2, RING_H - 2).fill({ color: v < 0 ? heat.bad : heat.good, alpha });
        });
      }),
    );
  }

  function rebuildFloorLabels(h: Hole, digFloor: number | null): void {
    floorLabels.removeChildren().forEach((c) => c.destroy());
    for (let floor = 1; floor <= (digFloor ?? h.floors); floor++) {
      floorLabels.addChild(new Text({ text: `F${floor}`, style: { fontFamily: UI_FONT, fill: C.label, fontSize: 13, fontWeight: "700" } }));
    }
  }

  function updateDigLabel(d: DrillView | null): void {
    if (!d?.floor) return;
    const label = floorLabels.children[d.floor - 1] as Text | undefined;
    if (label) label.text = `F${d.floor} ⛏ ${Math.floor(d.progress * 100)}%${d.active ? "" : " (paused)"}`;
  }

  // ---- camera ----

  // Each copy: sky, hole, dig, rooms, effect field, room labels, lander, build progress, progress labels, overlay.
  const LABELS_INDEX = 5;
  const BUILD_LABELS_INDEX = 8;

  function ensureCopies(): void {
    const needed = Math.ceil(app.screen.width / (TURN_W * cam.zoom)) + 2;
    while (world.children.length < needed) {
      const copy = new Container();
      copy.addChild(new Graphics(skyCtx), new Graphics(holeCtx), new Graphics(digCtx), new Graphics(roomsCtx), new Graphics(fieldCtx));
      copy.addChild(layout ? roomLabels(layout) : new Container());
      copy.addChild(new Graphics(landerCtx), new Graphics(buildCtx), new Container(), new Graphics(overlayCtx));
      buildKey = ""; // the new copy needs its progress labels
      copy.x = world.children.length * TURN_W;
      world.addChild(copy);
    }
    while (world.children.length > needed) world.removeChildAt(world.children.length - 1).destroy({ children: true });
  }

  function rebuildRoomLabels(l: Layout): void {
    for (const copy of world.children as Container[]) {
      copy.removeChildAt(LABELS_INDEX).destroy({ children: true });
      copy.addChildAt(roomLabels(l), LABELS_INDEX);
    }
  }

  function clampCamera(): void {
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom));
    if (!layout) return;
    const minY = -EDGE_MARGIN;
    const maxY = worldHeight(layout.hole) - app.screen.height / cam.zoom + EDGE_MARGIN;
    cam.y = Math.max(minY, Math.min(Math.max(minY, maxY), cam.y));
  }

  function applyCamera(): void {
    clampCamera();
    ensureCopies();
    const offset = ((cam.x % TURN_W) + TURN_W) % TURN_W;
    world.scale.set(cam.zoom);
    world.x = -(offset + TURN_W) * cam.zoom;
    world.y = -cam.y * cam.zoom;
    const labelScale = Math.max(1, MIN_LABEL_PX / (LABEL_PX * cam.zoom));
    for (const copy of world.children as Container[]) {
      for (const label of (copy.children[LABELS_INDEX] as Container).children) label.scale.set(labelScale);
    }
    if (layout) {
      const maxRings = layout.hole.ringSlots.length;
      floorLabels.children.forEach((label, i) => {
        label.x = 8;
        label.y = Math.max(4, (floorTop(i + 1, maxRings) - cam.y) * cam.zoom + 1);
      });
    }
    // The world moved under a still cursor, so what it points at may have changed.
    refreshHover();
  }

  // ---- hover and tools ----

  const canvas = app.canvas;
  let drag: { x: number; y: number; moved: number } | null = null;
  let pointer: { clientX: number; clientY: number } | null = null;

  function screenToWorld(e: { clientX: number; clientY: number }): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [cam.x + (e.clientX - r.left) / cam.zoom, cam.y + (e.clientY - r.top) / cam.zoom];
  }

  /** Shift erases with the corridor tool. */
  let shift = false;

  /** The border nearest a world point, if it's in a ring. */
  function edgeAt(x: number, y: number): Edge | null {
    if (!layout) return null;
    const h = layout.hole;
    const p = pick(h, x, y);
    // Over the shaft band: the gallery edge there.
    if (p.kind === "gallery") return nearestEdge(h, p.floor, -0.1, x / TURN_W, config.geometry.roomDepthM);
    if (p.kind !== "slot") return null;
    const v = (y - ringTop(p.floor, p.ring, h.ringSlots.length)) / RING_H;
    return nearestEdge(h, p.floor, p.ring - 1 + v, x / TURN_W, config.geometry.roomDepthM);
  }

  function hoverInfo(): HoverInfo | null {
    if (!layout || !pointer) return null;
    const [x, y] = screenToWorld(pointer);
    const p = pick(layout.hole, x, y);
    if (tool?.kind === "corridor") return edgeHoverFor(layout, resources, tool, p, edgeAt(x, y), shift);
    return hoverInfoFor(layout, resources, tool, p, deposits);
  }

  function refreshHover(): void {
    const info = hoverInfo();
    const key = hoverKeyFor(info, tool, layoutVersion, selected) + building;
    if (key === hoverKey) return;
    // Setters clear hoverKey to force a redraw; the UI only hears about a hover that changed.
    const changed = key !== notifiedKey;
    hoverKey = notifiedKey = key;
    drawOverlay(info);
    if (changed) opts.onHover?.(info);
  }

  // Snaking corridors: the chain grows and shrinks under the pointer while the button is held.
  let snaking = false;
  let chain: Chain = EMPTY_CHAIN;
  let chainErase = false;
  let proposal: Proposal | null = null;
  let warning: Warning | null = null;

  function edgeUnderPointer(): Edge | null {
    if (!layout || !pointer) return null;
    return edgeAt(...screenToWorld(pointer));
  }

  function snake(): void {
    if (!layout) return;
    const next = extendChain(layout, chain, edgeUnderPointer(), chainErase);
    if (next === chain) return;
    chain = next;
    hoverKey = "";
    refreshHover();
  }

  /** Released: a chain goes to the player to confirm; a single border is just drawn (or filled in). */
  function endSnake(): void {
    snaking = false;
    const done = chain;
    chain = EMPTY_CHAIN;
    if (done.edges.length > 1) opts.onPropose?.({ edges: done.edges, erase: chainErase });
    else if (done.edges.length === 1) click();
    hoverKey = "";
    refreshHover();
  }


  function click(): void {
    const info = hoverInfo();
    if (info && layout) clickWith(layout, tool, info, opts);
  }

  // ---- input ----

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    pointer = e; // a tap may arrive with no move before it
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
    if (snaking) snake();
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > CLICK_SLOP) canvas.style.cursor = "grabbing";
      cam.x -= dx / cam.zoom;
      cam.y -= dy / cam.zoom;
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
    applyCamera();
  };
  const onPointerUp = (e: PointerEvent) => {
    pointer = e;
    if (drag && drag.moved <= CLICK_SLOP) click();
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
    if (e.ctrlKey) {
      // Pinch or ctrl+wheel: zoom around the cursor.
      const [wx, wy] = screenToWorld(e);
      cam.zoom *= Math.exp(-e.deltaY * 0.01);
      clampCamera();
      const r = canvas.getBoundingClientRect();
      cam.x = wx - (e.clientX - r.left) / cam.zoom;
      cam.y = wy - (e.clientY - r.top) / cam.zoom;
    } else {
      const [dx, dy] = e.shiftKey ? [e.deltaY, e.deltaX] : [e.deltaX, e.deltaY];
      cam.x += dx / cam.zoom;
      cam.y += dy / cam.zoom;
    }
    applyCamera();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Shift" || shift === (e.type === "keydown")) return;
    shift = e.type === "keydown";
    hoverKey = "";
    refreshHover();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  app.renderer.on("resize", applyCamera);

  return {
    update(snapshot) {
      const identity = `${snapshot.gameId}:${snapshot.holeId}`;
      if (identity !== gameId) {
        // A new game, a loaded save or another hole: forget everything drawn from the old one.
        gameId = identity;
        holeKey = "";
        layoutVersion = -1;
        digKey = "";
        field = null;
        selected = null;
      }
      const l = snapshot.layout;
      layout = l;
      drill = snapshot.drill;
      const key = JSON.stringify([l.hole, drill.floor, !!l.domed]);
      if (key !== holeKey) {
        holeKey = key;
        drawHole(l.hole, drill.floor, !!l.domed);
        rebuildFloorLabels(l.hole, drill.floor);
        applyCamera();
      }
      // Redraw the dig front only when it has visibly moved.
      const dk = `${drill.floor}:${Math.floor(drill.progress * 200)}:${drill.active}`;
      if (dk !== digKey) {
        digKey = dk;
        drawDig(l.hole, drill);
        updateDigLabel(drill);
      }
      const ck = overlayType === "condition" ? conditionKey(snapshot.layout.rooms) : "";
      if (snapshot.effects !== field || (overlayType === "happiness" && snapshot.happiness.pools !== happiness?.pools) || ck !== conditionShown) {
        conditionShown = ck;
        field = snapshot.effects;
        happiness = snapshot.happiness;
        drawField();
      }
      happiness = snapshot.happiness;
      const nextCrews = crewsAt(snapshot);
      if (crewsKey(nextCrews) !== crewsKey(crews)) layoutVersion = -1;
      crews = nextCrews;
      if (l.version !== layoutVersion) {
        layoutVersion = l.version;
        drawRooms(l);
        rebuildRoomLabels(l);
        applyCamera();
      }
      drawSky(snapshot);
      drawLander(snapshot);
      drawBuild(snapshot);
      resources = snapshot.resources;
      deposits = snapshot.holeGates;
      refreshHover(); // affordability may have changed
    },
    setTool(t) {
      tool = t;
      refreshHover();
    },
    setView3d() {},
    setBuildMode(on) {
      building = on;
      refreshHover();
    },
    setGraphics() {
      // The 2D view is cheap at any detail; nothing to trade.
    },
    setFloor() {
      // The unrolled view shows every floor at once.
    },
    setProposal(p) {
      proposal = p;
      hoverKey = "";
      refreshHover();
    },
    setWarning(w) {
      warning = w;
      hoverKey = "";
      refreshHover();
    },
    setColorBlind(on) {
      heat = on ? HEAT.colorBlind : HEAT.normal;
      drawField();
      hoverKey = "";
      refreshHover();
    },
    setOverlay(type) {
      overlayType = type;
      drawField();
    },
    setSelected(id) {
      selected = id;
      hoverKey = ""; // force a redraw of the selection outline
      refreshHover();
      drawField(); // a service's reach, when no overlay is on
    },
    destroy() {
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      app.destroy({ removeView: true }, { children: true, context: true });
    },
  };
}

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const lerp = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

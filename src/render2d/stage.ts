import { Application, Container, Graphics, GraphicsContext, Text } from "pixi.js";
import type { Hole } from "../sim/geometry";
import { config } from "../sim/config";
import { neighborCells, roomAt, type Cell, type Layout, type RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { previewEffects, type EffectField } from "../sim/effects";
import { clickWith, hoverInfoFor, hoverKeyFor, paintCommand, paints } from "../view/interaction";
import type { HoverInfo, Stage, StageOptions, Tool } from "../view/types";
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
import { drawGlyph, drawHills, drawLandingPad, drawPod, drawSolarArray, shade, STARS, tint } from "./art";
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
  const fieldCtx = new GraphicsContext();

  const world = new Container();
  const floorLabels = new Container();
  app.stage.addChild(world, floorLabels);

  let layout: Layout | null = null;
  let holeKey = "";
  let layoutVersion = -1;
  let gameId = "";
  let drill: DrillView | null = null;
  let resources: Record<string, number> = {};
  let selected: number | null = null;
  let overlayType: string | null = null;
  let heat = HEAT.normal;
  let field: EffectField | null = null;
  let happiness: Happiness | null = null;
  let digKey = "";
  let tool: Tool = null;
  let hoverKey = "";
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

  function drawField(): void {
    fieldCtx.clear();
    if (overlayType === "happiness") return drawHappiness();
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
  function drawHole(h: Hole, digFloor: number | null): void {
    const maxRings = h.ringSlots.length;
    const lastFloor = digFloor ?? h.floors;
    holeCtx.clear();
    for (let floor = 1; floor <= lastFloor; floor++) {
      const top = floorTop(floor, maxRings);
      holeCtx.rect(0, top, TURN_W, GALLERY_H).fill(C.gallery);
      // The gallery's railing, facing the open shaft.
      holeCtx.rect(0, top + 2, TURN_W, 1.5).fill(C.rail);
      for (let x = 0; x < TURN_W; x += HATCH_STEP) holeCtx.rect(x, top + 2, 1.5, 6).fill(C.rail);
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

  /** One rect per ring row the cells cover. x may run past TURN_W; the next copy shows it. */
  function cellRows(h: Hole, cells: Cell[]): { floor: number; ring: number; x0: number; x1: number; first: boolean; last: boolean }[] {
    const rings = [...new Set(cells.map((c) => c.ring))].sort((a, b) => a - b);
    const out = [];
    for (const ring of rings) {
      const n = h.ringSlots[ring - 1]!;
      const slots = new Set(cells.filter((c) => c.ring === ring).map((c) => c.slot));
      for (const s of slots) {
        if (slots.has((s - 1 + n) % n) && slots.size < n) continue; // not the start of a run
        let len = 1;
        while (len < n && slots.has((s + len) % n)) len++;
        out.push({
          floor: cells[0]!.floor,
          ring,
          x0: (s / n) * TURN_W,
          x1: ((s + len) / n) * TURN_W,
          first: ring === rings[0],
          last: ring === rings[rings.length - 1],
        });
        if (slots.size === n) break;
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

  function drawRooms(l: Layout): void {
    roomsCtx.clear();
    const groundY = SURFACE_H - GROUND_H;
    for (const room of l.rooms) {
      const def = roomDef(room.type);
      const color = CATEGORY_COLORS[def.category] ?? C.label;
      if (room.at.kind === "surface") {
        const [x, , w] = surfaceRect(room.surfaceCells, l.surface.length);
        if (room.type === "solar_array") drawSolarArray(roomsCtx, x, w, groundY, color);
        else if (room.type === "landing_pad") drawLandingPad(roomsCtx, x, w, groundY, color);
        else if (room.type === "landing_pod") drawPod(roomsCtx, x, w, groundY, color);
        else roomsCtx.rect(...surfaceRect(room.surfaceCells, l.surface.length)).fill(color);
        continue;
      }
      const rows = cellRows(l.hole, room.cells);
      for (const row of rows) {
        const r = roomsCtx.rect(...rowRect(l.hole, row));
        if (room.planned) r.fill({ color, alpha: 0.3 }).stroke({ color, width: 2 });
        else r.fill(room.type === "corridor" ? shade(color, 0.15) : color);
      }
      if (room.type === "corridor") drawCorridorFloor(l, room, color);
      else if (!room.planned) drawFrontage(l, room, rows, color);
      drawRoomGlyph(l, room, rows, color);
      if (!room.connected) for (const row of rows) roomsCtx.rect(...rowRect(l.hole, row)).stroke({ color: C.bad, width: 3 });
    }
  }

  const isCorridor = (l: Layout, c: Cell) => roomAt(l, c)?.type === "corridor";

  /**
   * Frontage, picked from each face's neighbor like auto-tiling: windows on
   * the shaft side of ring 1, a door wherever a face meets a corridor, plain
   * wall against other rooms.
   */
  function drawFrontage(l: Layout, room: RoomInstance, rows: ReturnType<typeof cellRows>, color: number): void {
    const h = l.hole;
    const maxRings = h.ringSlots.length;
    const wall = shade(color, 0.45);
    for (const row of rows) {
      const [x, y, w, hh] = rowRect(h, row);
      roomsCtx.rect(x, y, w, hh).stroke({ color: wall, width: 1.5, alpha: 0.9 });
      if (row.ring === 1) {
        // Shaft windows, with the door onto the gallery in the middle.
        const mid = x + w / 2;
        for (let wx = x + 5; wx + 10 < x + w - 4; wx += 13) {
          if (Math.abs(wx + 5 - mid) < 9) continue;
          roomsCtx.rect(wx, y + 3, 10, 5).fill({ color: C.window, alpha: 0.85 });
        }
        roomsCtx.rect(mid - 5, y, 10, 11).fill(C.door);
      }
    }
    const own = new Set(room.cells.map((c) => `${c.ring}:${c.slot}`));
    for (const nb of neighborCells(h, room.cells)) {
      if (!isCorridor(l, nb)) continue;
      // Find the room cell this corridor touches, to place the door on the shared edge.
      for (const c of room.cells) {
        const n = h.ringSlots[c.ring - 1]!;
        const [cx0, cx1] = slotX(c.slot, n);
        const top = ringTop(c.floor, c.ring, maxRings);
        if (nb.ring === c.ring) {
          const left = (c.slot - 1 + n) % n === nb.slot && !own.has(`${c.ring}:${nb.slot}`);
          const right = (c.slot + 1) % n === nb.slot && !own.has(`${c.ring}:${nb.slot}`);
          if (left) roomsCtx.rect(cx0, top + RING_H / 2 - 7, 5, 14).fill(C.door);
          if (right) roomsCtx.rect(cx1 - 5, top + RING_H / 2 - 7, 5, 14).fill(C.door);
          if (left || right) break;
        } else if (Math.abs(nb.ring - c.ring) === 1) {
          const m = h.ringSlots[nb.ring - 1]!;
          const [nx0, nx1] = slotX(nb.slot, m);
          const lo = Math.max(cx0, nx0);
          const hi = Math.min(cx1, nx1);
          if (hi - lo < 8) continue;
          const doorY = nb.ring < c.ring ? top : top + RING_H - 5;
          roomsCtx.rect((lo + hi) / 2 - 6, doorY, 12, 5).fill(C.door);
          break;
        }
      }
    }
  }

  /** Floor markings along the way a corridor runs: out from the shaft, around the ring, or both. */
  function drawCorridorFloor(l: Layout, room: RoomInstance, color: number): void {
    const h = l.hole;
    const mark = { color: tint(color, 0.35), width: 1.5, alpha: 0.8 };
    for (const c of room.cells) {
      const n = h.ringSlots[c.ring - 1]!;
      const [x0, x1] = slotX(c.slot, n);
      const top = ringTop(c.floor, c.ring, h.ringSlots.length);
      const nbs = neighborCells(h, [c]);
      const radial = c.ring === 1 || nbs.some((nb) => nb.ring !== c.ring && isCorridor(l, nb));
      const around = nbs.some((nb) => nb.ring === c.ring && isCorridor(l, nb));
      const cx = (x0 + x1) / 2;
      const cy = top + RING_H / 2;
      if (radial || !around) for (let y = top + 4; y < top + RING_H - 6; y += 8) roomsCtx.moveTo(cx, y).lineTo(cx, y + 4).stroke(mark);
      if (around) for (let x = x0 + 4; x < x1 - 6; x += 8) roomsCtx.moveTo(x, cy).lineTo(x + 4, cy).stroke(mark);
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
        text: room.connected ? def.short : `${def.short} ⚠`,
        style: {
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

  function drawOverlay(info: HoverInfo | null): void {
    overlayCtx.clear();
    if (!layout) return;
    const sel = selected !== null ? layout.rooms.find((r) => r.id === selected) : undefined;
    if (sel) outlineRoom(sel, C.selected, 3);
    if (!info) return;
    const h = layout.hole;
    const p = info.pick;

    if (tool?.kind === "build" && info.check) {
      const color = info.check.ok ? C.ok : C.bad;
      const cells = info.check.cells.length ? info.check.cells : p.kind === "slot" ? [p as Cell] : [];
      if (info.check.ok && cells.length) drawHalo(tool.room, cells);
      for (const row of cellRows(h, cells)) {
        overlayCtx.rect(...rowRect(h, row)).fill({ color, alpha: 0.35 }).stroke({ color, width: 3 });
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

    if (p.kind === "slot") {
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
      floorLabels.addChild(new Text({ text: `F${floor}`, style: { fill: C.label, fontSize: 13, fontWeight: "700" } }));
    }
  }

  function updateDigLabel(d: DrillView | null): void {
    if (!d?.floor) return;
    const label = floorLabels.children[d.floor - 1] as Text | undefined;
    if (label) label.text = `F${d.floor} ⛏ ${Math.floor(d.progress * 100)}%${d.active ? "" : " (paused)"}`;
  }

  // ---- camera ----

  // Each copy: sky, hole, dig, rooms, effect field, room labels, lander, overlay.
  const LABELS_INDEX = 5;

  function ensureCopies(): void {
    const needed = Math.ceil(app.screen.width / (TURN_W * cam.zoom)) + 2;
    while (world.children.length < needed) {
      const copy = new Container();
      copy.addChild(new Graphics(skyCtx), new Graphics(holeCtx), new Graphics(digCtx), new Graphics(roomsCtx), new Graphics(fieldCtx));
      copy.addChild(layout ? roomLabels(layout) : new Container());
      copy.addChild(new Graphics(landerCtx), new Graphics(overlayCtx));
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
  let painting = false;

  function screenToWorld(e: { clientX: number; clientY: number }): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [cam.x + (e.clientX - r.left) / cam.zoom, cam.y + (e.clientY - r.top) / cam.zoom];
  }

  function hoverInfo(): HoverInfo | null {
    if (!layout || !pointer) return null;
    return hoverInfoFor(layout, resources, tool, pick(layout.hole, ...screenToWorld(pointer)));
  }

  function refreshHover(): void {
    const info = hoverInfo();
    const key = hoverKeyFor(info, tool, layoutVersion, selected);
    if (key === hoverKey) return;
    hoverKey = key;
    drawOverlay(info);
    opts.onHover?.(info);
  }

  let paintedKey = "";

  function paint(): void {
    if (!layout || !pointer) return;
    const p = pick(layout.hole, ...screenToWorld(pointer));
    if (p.kind !== "slot") return;
    const key = `${p.floor}:${p.ring}:${p.slot}`;
    if (key === paintedKey) return;
    paintedKey = key;
    const cmd = paintCommand(tool, p);
    if (cmd) opts.onCommand?.(cmd, true);
  }

  function click(): void {
    const info = hoverInfo();
    if (info && layout) clickWith(layout, tool, info, opts);
  }

  // ---- input ----

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    pointer = e; // a tap may arrive with no move before it
    canvas.setPointerCapture(e.pointerId);
    if (paints(tool)) {
      painting = true;
      paintedKey = "";
      paint();
      return;
    }
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
  };
  const onPointerMove = (e: PointerEvent) => {
    pointer = e;
    if (painting) paint();
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
    painting = false;
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
      const key = JSON.stringify([l.hole, drill.floor]);
      if (key !== holeKey) {
        holeKey = key;
        drawHole(l.hole, drill.floor);
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
      if (snapshot.effects !== field || (overlayType === "happiness" && snapshot.happiness.pools !== happiness?.pools)) {
        field = snapshot.effects;
        happiness = snapshot.happiness;
        drawField();
      }
      happiness = snapshot.happiness;
      if (l.version !== layoutVersion) {
        layoutVersion = l.version;
        drawRooms(l);
        rebuildRoomLabels(l);
        applyCamera();
      }
      drawSky(snapshot);
      drawLander(snapshot);
      resources = snapshot.resources;
      refreshHover(); // affordability may have changed
    },
    setTool(t) {
      tool = t;
      refreshHover();
    },
    setQuality() {
      // The 2D view is cheap at any detail; nothing to trade.
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
    },
    destroy() {
      canvas.removeEventListener("wheel", onWheel);
      app.destroy({ removeView: true }, { children: true, context: true });
    },
  };
}

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const lerp = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

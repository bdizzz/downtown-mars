import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { corridors } from "../src/sim/corridors";
import { galleryEdges, radialEdge, type Edge } from "../src/sim/edges";
import { ensureFloors, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { clickWith, corridorMap, demolishHoverFor, hoverInfoFor } from "../src/view/interaction";
import type { Pick } from "../src/view/types";
import type { SimCommand } from "../src/sim/commands";

// #556: corridor mode's map of a floor; #557: demolish takes corridors too.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const slot = (floor: number, r: number, s: number): Pick => ({ kind: "slot", floor, ring: r, slot: s, locked: false, digging: false, angle: 0 });

function site(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  s.unlocks = ["basicHomes"];
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60, electronics: 60 });
  return s;
}

function carve(s: SimState, e: Edge): void {
  const r = applyCommand(s, { type: "drawCorridors", edges: [e.id], finish: "rock" });
  if (!r.ok) throw new Error(r.reason);
}

describe("corridor mode's map (#556)", () => {
  it("shows the borders a corridor could go along and those already carved, on one floor", () => {
    const s = site();
    const e = radialEdge(s.layout.hole, 2, 1, 3);
    carve(s, e);
    const map = corridorMap(s.layout, { kind: "corridor", finish: "rock", erase: false }, 2);
    expect(map.built).toContain(e.id);
    expect(map.open).not.toContain(e.id);
    expect(map.open.length).toBeGreaterThan(20);
    // Everything on the asked floor, none past the unlocked rings.
    expect(map.open.every((id) => /^[RA]2\./.test(id))).toBe(true);
    expect(map.open).not.toContain(radialEdge(s.layout.hole, 2, s.layout.hole.unlockedRings + 1, 0)?.id);
  });

  it("erasing shows only what's there; the windows tool and other tools show nothing", () => {
    const s = site();
    const e = radialEdge(s.layout.hole, 2, 1, 3);
    carve(s, e);
    const erase = corridorMap(s.layout, { kind: "corridor", finish: "rock", erase: true }, 2);
    expect(erase.open).toEqual([]);
    expect(erase.built).toEqual([e.id]);
    expect(corridorMap(s.layout, { kind: "corridor", finish: "rock", erase: false, windows: true }, 2)).toEqual({ open: [], built: [] });
    expect(corridorMap(s.layout, { kind: "demolish" }, 2)).toEqual({ open: [], built: [] });
    expect(corridorMap(s.layout, null, 2)).toEqual({ open: [], built: [] });
  });
});

describe("demolish takes corridors (#557)", () => {
  it("near a corridor, or over no room, it's the corridor; deep in a room, the room", () => {
    const s = site();
    const room = applyCommand(s, { type: "build", room: "apartment", at: ring(2, 1, 1, 2) });
    expect(room.ok).toBe(true);
    const e = radialEdge(s.layout.hole, 2, 1, 1);
    carve(s, e);
    const half = corridors.widthM / 2;
    const near = demolishHoverFor(s.layout, s.resources, slot(2, 1, 1), { edge: e, m: half - 0.1 });
    expect(near.edge?.id).toBe(e.id);
    expect(near.edge?.erase).toBe(true);
    expect(near.room).toBeUndefined();
    const deep = demolishHoverFor(s.layout, s.resources, slot(2, 1, 1), { edge: e, m: half + 1 });
    expect(deep.edge).toBeUndefined();
    expect(deep.room?.id).toBe(room.ok ? room.roomId : -1);
    // In rock beside it, no room to prefer: the corridor, however far into the cell.
    const rock = demolishHoverFor(s.layout, s.resources, slot(2, 1, 0), { edge: e, m: 4 });
    expect(rock.edge?.id).toBe(e.id);
  });

  it("a click fills it in, the same command corridor erase sends", () => {
    const s = site();
    const e = radialEdge(s.layout.hole, 2, 1, 3);
    carve(s, e);
    const info = demolishHoverFor(s.layout, s.resources, slot(2, 1, 3), { edge: e, m: 0.5 });
    const sent: SimCommand[] = [];
    clickWith(s.layout, { kind: "demolish" }, info, { onCommand: (c) => sent.push(c) });
    expect(sent).toEqual([{ type: "removeCorridors", edges: [e.id] }]);
  });

  it("leaves floor 1's starter gallery tube alone, but takes a tube the player built deeper", () => {
    const s = site();
    const starter = galleryEdges(s.layout.hole, 1)[2]!;
    expect(s.layout.corridors[starter.id]).toBeTruthy();
    const p: Pick = { kind: "gallery", floor: 1, angle: 0, digging: false };
    expect(demolishHoverFor(s.layout, s.resources, p, { edge: starter, m: 0.2 })).toEqual(hoverInfoFor(s.layout, s.resources, { kind: "demolish" }, p));
    const deeper = galleryEdges(s.layout.hole, 2)[2]!;
    carve(s, deeper);
    expect(demolishHoverFor(s.layout, s.resources, { ...p, floor: 2 }, { edge: deeper, m: 0.2 }).edge?.id).toBe(deeper.id);
  });

  it("no corridor on the nearest border: it's as before", () => {
    const s = site();
    const e = radialEdge(s.layout.hole, 2, 1, 3);
    expect(demolishHoverFor(s.layout, s.resources, slot(2, 1, 3), { edge: e, m: 0.1 }).edge).toBeUndefined();
  });
});

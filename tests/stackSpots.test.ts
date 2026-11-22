import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { isOpen, openCells } from "../src/sim/excavation";
import { placeRoom, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { stackClick, stackHover, stackSpots } from "../src/view/stackSpots";
import type { Pick } from "../src/view/types";

// Ghost markers (#520): where a stair or elevator column could reach one floor further.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const slotPick = (floor: number, r: number, slot: number): Pick => ({ kind: "slot", floor, ring: r, slot, locked: false, digging: false, angle: 0 });

function site(floors = 5): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  Object.assign(s.resources, { rock: 300, brick: 150, metal: 150, machinery: 30, electronics: 30, power: 50 });
  s.layout.hole.floors = floors;
  while (s.layout.grid.length < floors + 1) s.layout.grid.push(s.layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
  while (s.layout.open && s.layout.open.length < floors + 1) s.layout.open.push(s.layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
  return s;
}
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r;
};
const floorsOf = (spots: ReturnType<typeof stackSpots>) => spots.map((g) => g.cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`).join(","));

describe("stair and elevator ghost markers", () => {
  it("show on the floor just above and just below a column, in its slots", () => {
    const s = site();
    build(s, "stairwell", ring(2, 1, 3)); // floors 2–3
    expect(floorsOf(stackSpots(s.layout, 1))).toEqual(["1:1:3"]);
    expect(floorsOf(stackSpots(s.layout, 4))).toEqual(["4:1:3"]);
    expect(stackSpots(s.layout, 2)).toEqual([]);
    expect(stackSpots(s.layout, 3)).toEqual([]);
    expect(stackSpots(s.layout, 5)).toEqual([]);
  });

  it("don't show where another room sits, or on a floor not dug yet", () => {
    const s = site(3);
    build(s, "stairwell", ring(2, 1, 3)); // floors 2–3, the deepest dug
    expect(stackSpots(s.layout, 4)).toEqual([]);
    build(s, "galley", ring(1, 1, 3));
    expect(stackSpots(s.layout, 1)).toEqual([]);
  });

  it("show over empty dug space as well as rock", () => {
    const s = site();
    build(s, "stairwell", ring(2, 1, 3));
    openCells(s.layout, [{ floor: 4, ring: 1, slot: 3 }]); // floor 4's cell already dug out, nothing in it
    expect(isOpen(s.layout, { floor: 4, ring: 1, slot: 3 })).toBe(true);
    expect(floorsOf(stackSpots(s.layout, 4))).toEqual(["4:1:3"]);
  });

  it("don't show past a column's height limit", () => {
    const s = site();
    expect(placeRoom(s.layout, "spiral_stair", ring(2, 1, 5)).ok).toBe(true); // straight onto the layout: it's locked early on
    expect(stackSpots(s.layout, 1).filter((g) => g.type === "spiral_stair")).toEqual([]);
    expect(stackSpots(s.layout, 4).filter((g) => g.type === "spiral_stair")).toEqual([]);
  });

  it("one click builds the piece: the column grows a floor at a time, and the marker moves on", () => {
    const s = site();
    const stairs = build(s, "stairwell", ring(2, 1, 3));
    let cmd: unknown = null;
    for (const [floor, expectGrown] of [[4, [2, 3, 4]], [1, [1, 2, 3, 4]], [5, [1, 2, 3, 4, 5]]] as const) {
      const info = stackHover(s.layout, s.resources, slotPick(floor, 1, 3));
      expect(info?.check?.ok).toBe(true);
      stackClick(info!, { onCommand: (c) => (cmd = c), onInvalid: (r) => { throw new Error(r); } });
      expect(applyCommand(s, cmd as Parameters<typeof applyCommand>[1]).ok).toBe(true);
      const room = s.layout.rooms.find((r) => r.id === stairs.roomId)!;
      const floors = [...new Set([...room.cells, ...(room.pendingCells ?? [])].map((c) => c.floor))].sort();
      expect(floors).toEqual(expectGrown);
      expect(stackSpots(s.layout, floor)).toEqual([]);
    }
    // A column on every floor: nowhere left to grow.
    for (let f = 1; f <= 5; f++) expect(stackSpots(s.layout, f)).toEqual([]);
  });

  it("hovering says why not when it can't be afforded, and a click refuses", () => {
    const s = site();
    build(s, "stairwell", ring(2, 1, 3));
    s.resources.rock = 0;
    const info = stackHover(s.layout, s.resources, slotPick(4, 1, 3));
    expect(info?.check?.ok).toBe(false);
    let refused = "";
    stackClick(info!, { onCommand: () => { throw new Error("built"); }, onInvalid: (r) => (refused = r) });
    expect(refused).not.toBe("");
  });

  it("nothing to hover off a marker", () => {
    const s = site();
    build(s, "stairwell", ring(2, 1, 3));
    expect(stackHover(s.layout, s.resources, slotPick(4, 1, 4))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ensureFloors, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

/** A hole with three dug floors, and the means to build. */
function deep(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 3;
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 400, brick: 200, metal: 200, machinery: 50, electronics: 50 });
  return s;
}
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return s.layout.rooms.find((x) => x.id === r.roomId)!;
};

describe("the entrance, and stairs down", () => {
  it("the entrance is on floor 1, in ring 1, and reachable from the surface", () => {
    const s = createInitialState(config);
    const entrance = s.layout.rooms.find((r) => r.type === "entrance")!;
    expect(entrance.at).toMatchObject({ kind: "ring", floor: 1, ring: 1 });
    expect(entrance.connected).toBe(true);
    // Floor 1's gallery is reached through it.
    expect(build(s, "galley", ring(1, 1, 3)).connected).toBe(true);
  });

  it("a floor with no stairs to the entrance is cut off", () => {
    const s = deep();
    const galley = build(s, "galley", ring(2, 1, 3));
    expect(galley.connected).toBe(false);
  });

  it("stairs from floor 1 reach floor 2's gallery, and a chain of them reaches floor 3", () => {
    const s = deep();
    const g2 = build(s, "galley", ring(2, 1, 3));
    const g3 = build(s, "galley", ring(3, 1, 3));
    build(s, "stairwell", ring(1, 1, 5)); // floors 1–2
    expect(g2.connected).toBe(true);
    expect(g3.connected).toBe(false);
    build(s, "stairwell", ring(2, 1, 5)); // extends to floor 3
    expect(g3.connected).toBe(true);
  });

  it("stairs that don't reach floor 1 link floors 2 and 3 to each other, but not to the surface", () => {
    const s = deep();
    const g3 = build(s, "galley", ring(3, 1, 3));
    build(s, "stairwell", ring(2, 1, 5)); // floors 2–3
    expect(g3.connected).toBe(false);
  });

  it("an old save's open shaft reaches every floor", () => {
    const s = deep();
    const g3 = build(s, "galley", ring(3, 1, 3));
    s.layout.openShaft = true;
    applyCommand(s, { type: "setDrill", active: false });
    applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 1, 6) }); // anything that recomputes access
    expect(g3.connected).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { checkPlacement, ensureFloors, type Location } from "../src/sim/placement";
import { checkBuild } from "../src/sim/costs";
import { holeGates, setAdults, unlock } from "../src/sim/people";
import { step } from "../src/sim/step";
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

describe("the cargo elevator", () => {
  function unlocked(): SimState {
    const s = deep();
    s.layout.hole.floors = 4;
    ensureFloors(s.layout);
    unlock(s, "cargo");
    return s;
  }

  it("unlocks once the hole is big enough", () => {
    const s = deep();
    expect(checkBuild(s.layout, s.resources, "cargo_elevator", ring(3, 2, 4), config, holeGates(s))).toMatchObject({ ok: false, reason: expect.stringMatching(/Unlocks at \d+ colonists/) });
    setAdults(s, config.unlocks.cargoPopulation, config);
    for (let i = 0; i < config.ticksPerDay; i++) step(s, config);
    expect(holeGates(s)).toContain("cargo");
  });

  it("runs from the surface to its stop, which is reached without stairs; the floors above aren't", () => {
    const s = unlocked();
    const g3 = build(s, "galley", ring(3, 1, 3));
    const g2 = build(s, "galley", ring(2, 1, 3));
    const cargo = build(s, "cargo_elevator", ring(3, 1, 4));
    expect(new Set(cargo.cells.map((c) => c.floor))).toEqual(new Set([1, 2, 3]));
    expect(cargo.connected).toBe(true);
    expect(g3.connected).toBe(true);
    expect(g2.connected).toBe(false);
  });

  it("needs its column clear on every floor above its stop, and a stop below floor 1", () => {
    const s = unlocked();
    build(s, "clinic", ring(2, 2, 4));
    expect(checkPlacement(s.layout, "cargo_elevator", ring(3, 2, 4))).toMatchObject({ ok: false, reason: "Floor 2 above: its shaft overlaps Clinic" });
    expect(checkPlacement(s.layout, "cargo_elevator", ring(1, 2, 4))).toMatchObject({ ok: false });
    expect(checkPlacement(s.layout, "cargo_elevator", ring(5, 2, 5))).toMatchObject({ ok: false, reason: "That floor isn't dug yet" });
    expect(checkPlacement(s.layout, "cargo_elevator", ring(4, 2, 5))).toMatchObject({ ok: true });
  });
});

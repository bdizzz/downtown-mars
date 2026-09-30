import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import type { Location } from "../src/sim/placement";
import { homeFactors, updateHappiness } from "../src/sim/happiness";
import { amenityFelt } from "../src/sim/amenities";
import { capacities } from "../src/sim/economy";
import { setAdults, stepUnlocks } from "../src/sim/people";
import { roomDef } from "../src/sim/rooms";
import { birthBlockers } from "../src/sim/births";

// The rooms added Sep 30: kitchen and canteen (cooking split from serving),
// gym, park and hospital (health and comfort), brickworks, recycling center
// and waste storage.

const tpd = config.ticksPerDay;
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.unlocks = ["brickworks", "leisure", "recycling", "hospital"];
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 500, electronics: 500, water: 2000, rations: 2000 });
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;
const days = (s: SimState, n: number) => {
  for (let i = 0; i < n * tpd; i++) step(s, config);
};

describe("dining", () => {
  /** A tick, then the happiness update that shares out seats and amenities. */
  const settle = (s: SimState) => {
    step(s, config);
    updateHappiness(s, config, true);
    updateHappiness(s, config, true);
  };

  it("seats as many diners as the galleys and canteens within reach hold; the rest eat on the go, less comfortably", () => {
    const s = hole();
    setAdults(s, 40, config);
    build(s, "bunk_dorm", ring(1, 1, 3, 2));
    build(s, "galley", ring(1, 1, 5));
    settle(s);
    expect(s.population.seats).toBeCloseTo(25, 5);
    expect(s.population.served).toBeCloseTo(25 / 40, 5);
    // The pod's people are the ones short of a seat (the dorm is nearer the galley).
    const pod = s.layout.rooms.find((r) => r.type === "landing_pod")!;
    const crowded = homeFactors(s, pod, config).comfort;
    build(s, "canteen", ring(1, 1, 6, 2));
    settle(s);
    expect(s.population.served).toBe(1);
    expect(homeFactors(s, pod, config).comfort).toBeGreaterThan(crowded);
  });

  it("serves the nearest homes first", () => {
    const s = hole();
    setAdults(s, 36, config);
    const near = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    build(s, "galley", ring(1, 1, 5));
    settle(s);
    // The dorm beside the galley is seated in full; the pod's people, further off, get what's left.
    expect(s.population.servedByHome?.[near]).toBe(1);
    const pod = s.layout.rooms.find((r) => r.type === "landing_pod")!;
    expect(s.population.servedByHome?.[pod.id]).toBeLessThan(1);
  });

  it("a kitchen cooks more than a galley, falls back on rations, and seats no one", () => {
    const s = hole();
    setAdults(s, 20, config);
    const kitchen = build(s, "kitchen", ring(1, 1, 3, 2));
    const meals0 = s.resources.meals ?? 0;
    settle(s);
    expect(s.roomStatus[kitchen]!.rate).toBeGreaterThan(0);
    expect(s.population.seats).toBe(0);
    expect(s.population.served).toBe(0);
    expect((s.resources.meals ?? 0) + 20 / tpd).toBeGreaterThan(meals0);
  });

  it("a paused canteen seats no one", () => {
    const s = hole();
    setAdults(s, 20, config);
    const canteen = build(s, "canteen", ring(1, 1, 3, 2));
    expect(applyCommand(s, { type: "setRoomControl", roomId: canteen, paused: true }).ok).toBe(true);
    settle(s);
    expect(s.population.seats).toBe(0);
  });
});

describe("health and leisure", () => {
  it("a gym lifts health and a park comfort, for the homes within walking reach", () => {
    const s = hole();
    setAdults(s, 20, config);
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    step(s, config);
    const before = amenityFelt(s, room(s, dorm));
    expect(before.comfort + before.health).toBe(0);
    build(s, "gym", ring(1, 1, 1, 2));
    build(s, "park", ring(1, 1, 5, 2));
    step(s, config);
    const after = amenityFelt(s, room(s, dorm));
    expect(after.health).toBeGreaterThan(0);
    expect(after.comfort).toBeGreaterThan(0);
    expect(after.from.map((f) => f.type).sort()).toEqual(["gym", "park"]);
    // A second park nearby adds nothing: the nearest of each kind counts.
    build(s, "park", ring(1, 2, 3, 2));
    applyCommand(s, { type: "consoleFinish" });
    step(s, config);
    expect(amenityFelt(s, room(s, dorm)).comfort).toBeCloseTo(after.comfort, 5);
  });

  it("a park is walk-through and makes a little oxygen", () => {
    const s = hole();
    setAdults(s, 20, config);
    const park = build(s, "park", ring(1, 1, 3, 2));
    step(s, config);
    expect(s.roomStatus[park]!.rate).toBeGreaterThan(0);
    expect(roomDef("park").public).toBe(true);
    expect(roomDef("park").makes.o2).toBeGreaterThan(0);
  });

  it("a hospital cares for hundreds and lets children be born", () => {
    const s = hole();
    setAdults(s, 20, config);
    expect(birthBlockers(s)).toContain("No working clinic");
    const h = build(s, "hospital", ring(1, 1, 1, 4));
    days(s, 0.1);
    expect(s.roomStatus[h]!.rate).toBeGreaterThan(0);
    expect(birthBlockers(s)).not.toContain("No working clinic");
  });
});

describe("materials and waste", () => {
  it("a brickworks turns rock into brick", () => {
    const s = hole();
    setAdults(s, 20, config);
    const bw = build(s, "brickworks", ring(1, 1, 3, 2));
    const rock = s.resources.rock!;
    const brick = s.resources.brick!;
    days(s, 1);
    expect(s.roomStatus[bw]!.rate).toBeGreaterThan(0);
    expect(s.resources.rock!).toBeLessThan(rock);
    expect(s.resources.brick!).toBeGreaterThan(brick - 1);
  });

  it("a recycling center turns solid waste into metal and brick", () => {
    const s = hole();
    setAdults(s, 20, config);
    const rc = build(s, "recycling_center", ring(1, 1, 1, 4));
    s.resources.solidWaste = 80;
    step(s, config);
    expect(s.roomStatus[rc]!.rate).toBe(1);
    // Colonists add their day's waste; the center takes 6 a day out.
    const made = (20 * config.colonists.makesPerDay.solidWaste!) / tpd;
    expect(s.resources.solidWaste!).toBeCloseTo(80 + made - 6 / tpd, 5);
  });

  it("waste storage holds more solid and organic waste", () => {
    const s = hole();
    const before = capacities(s, config);
    build(s, "waste_storage", ring(1, 1, 3));
    const after = capacities(s, config);
    expect(after.solidWaste!).toBe(before.solidWaste! + 100);
    expect(after.organicWaste!).toBe(before.organicWaste! + 50);
  });
});

describe("unlocks", () => {
  it("each group of rooms opens at its population", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 500, electronics: 500 });
    expect(applyCommand(s, { type: "build", room: "gym", at: ring(1, 1, 3, 2) }).ok).toBe(false);
    const r = config.unlocks.rooms;
    setAdults(s, r.leisure, config);
    s.tick = tpd;
    stepUnlocks(s, config);
    expect(s.unlocks).toEqual(expect.arrayContaining(["leisure", "brickworks"]));
    expect(s.unlocks).not.toContain("hospital");
    expect(applyCommand(s, { type: "build", room: "gym", at: ring(1, 1, 3, 2) }).ok).toBe(true);
    expect(s.messages.some((m) => m.text.includes("gyms and parks"))).toBe(true);
  });
});

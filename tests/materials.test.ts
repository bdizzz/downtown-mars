import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { CONDITION, conditionOf, stepCondition } from "../src/sim/condition";
import { homeFactors } from "../src/sim/happiness";
import { canLine, liningKind, liningOf, liningText, liningWear, MATERIALS, sharedLiningComfort } from "../src/sim/materials";
import type { Location } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { createWorld } from "../src/sim/world";

const tpd = config.ticksPerDay;
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 500, electronics: 500, water: 2000, rations: 2000 });
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;
/** Wear alone, no breakdowns, for a number of days. */
function wear(s: SimState, days: number) {
  const b = CONDITION.breakdown.chancePerDay;
  CONDITION.breakdown.chancePerDay = 0;
  for (let i = 0; i < days * tpd; i++) {
    s.tick++;
    stepCondition(s, config);
  }
  CONDITION.breakdown.chancePerDay = b;
}
const step = (material: string, finish: string) => MATERIALS.walls.find((w) => w.material === material && w.finish === finish)!;

describe("room linings", () => {
  it("every room starts as bare rock", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    expect(liningOf(room(s, dorm)).name).toBe("Bare rock");
    expect(liningWear(room(s, dorm))).toBe(1);
    expect(liningText(room(s, dorm))).toBe("Bare rock");
  });

  it("a home lined from the console gets the comfort and wears slower", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    const before = homeFactors(s, room(s, dorm), config).comfort;
    expect(applyCommand(s, { type: "consoleLining", roomId: dorm, material: "brick" }).ok).toBe(true);
    expect(room(s, dorm).material).toBe("brick");
    expect(homeFactors(s, room(s, dorm), config).comfort).toBeCloseTo(before + step("brick", "base").comfort, 5);
    expect(applyCommand(s, { type: "consoleLining", roomId: dorm, material: "metal", finish: "fine" }).ok).toBe(true);
    expect(homeFactors(s, room(s, dorm), config).comfort).toBeCloseTo(before + step("metal", "fine").comfort, 5);
    // A floor on top adds to it.
    expect(applyCommand(s, { type: "consoleLining", roomId: dorm, flooring: "fibre_panels" }).ok).toBe(true);
    expect(homeFactors(s, room(s, dorm), config).comfort).toBeCloseTo(before + step("metal", "fine").comfort + MATERIALS.floorings[0]!.comfort, 5);
    expect(liningText(room(s, dorm))).toMatch(/^Inlaid metal, fibre-composite panels floor: comfort \+1\.25, wears 30% slower$/);

    // Wear: brick against bare rock, side by side.
    const bare = build(s, "bunk_dorm", ring(1, 1, 6, 2));
    applyCommand(s, { type: "consoleLining", roomId: dorm, material: "brick" });
    wear(s, 10);
    expect(1 - conditionOf(room(s, dorm))).toBeCloseTo((1 - conditionOf(room(s, bare))) * step("brick", "base").wear, 5);

    // Back to bare rock leaves nothing behind; the floor stays until it's taken up.
    applyCommand(s, { type: "consoleLining", roomId: dorm, material: "rock" });
    expect(room(s, dorm).material).toBeUndefined();
    expect(room(s, dorm).flooring).toBe("fibre_panels");
    applyCommand(s, { type: "consoleLining", roomId: dorm, flooring: null });
    expect(room(s, dorm).flooring).toBeUndefined();
    expect(homeFactors(s, room(s, dorm), config).comfort).toBeCloseTo(before, 5);
  });

  it("heavy rooms get no comfort but twice the wear benefit; people rooms lift shared comfort", () => {
    const s = hole();
    const smelter = build(s, "machine_shop", ring(1, 1, 7, 2));
    room(s, smelter).material = "metal";
    expect(liningKind("machine_shop")).toBe("heavy");
    expect(liningWear(room(s, smelter))).toBeCloseTo(1 - (1 - step("metal", "base").wear) * 2, 5);
    expect(sharedLiningComfort(s)).toBe(0);

    const dorm = build(s, "bunk_dorm", ring(1, 1, 5, 2));
    const galley = build(s, "galley", ring(1, 1, 3));
    const restroom = build(s, "restroom", ring(1, 1, 4));
    const before = homeFactors(s, room(s, dorm), config).comfort;
    expect(liningKind("restroom")).toBe("people");
    expect(sharedLiningComfort(s)).toBe(0);
    room(s, galley).material = "brick";
    // Half the people rooms in brick: their average, scaled.
    const share = (step("brick", "base").comfort / 2) * MATERIALS.shared.scale;
    expect(sharedLiningComfort(s)).toBeCloseTo(share, 5);
    expect(homeFactors(s, room(s, dorm), config).comfort).toBeCloseTo(before + share, 5);
    // Never more than the most.
    room(s, galley).material = room(s, restroom).material = "metal";
    room(s, galley).finish = room(s, restroom).finish = "fine";
    room(s, galley).flooring = room(s, restroom).flooring = "fibre_panels";
    expect(sharedLiningComfort(s)).toBe(MATERIALS.shared.max);
  });

  it("refuses rooms without walls of their own, and unknown linings", () => {
    const s = hole();
    const entrance = s.layout.rooms.find((r) => r.type === "entrance")!;
    const pod = s.layout.rooms.find((r) => r.type === "landing_pod")!;
    expect(canLine(entrance)).toBe(false);
    expect(canLine(pod)).toBe(false);
    expect(applyCommand(s, { type: "consoleLining", roomId: entrance.id, material: "brick" }).ok).toBe(false);
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    expect(applyCommand(s, { type: "consoleLining", roomId: dorm, material: "gold" }).ok).toBe(false);
    expect(applyCommand(s, { type: "consoleLining", roomId: dorm, flooring: "carpet" }).ok).toBe(false);
    expect(room(s, dorm).material).toBeUndefined();
  });

  it("linings survive a save", () => {
    const w = createWorld(config, 7);
    const s = w.holes[0]!;
    Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 500, electronics: 500 });
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    applyCommand(s, { type: "consoleLining", roomId: dorm, material: "brick", finish: "fine" });
    applyCommand(s, { type: "consoleLining", roomId: dorm, flooring: "fibre_panels" });
    const back = deserialize(serialize(w));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const r = back.world.holes[0]!.layout.rooms.find((x) => x.id === dorm)!;
    expect([r.material, r.finish, r.flooring]).toEqual(["brick", "fine", "fibre_panels"]);
  });
});

import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { updateHappiness } from "../src/sim/happiness";
import { modifiers } from "../src/sim/ordinances";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const hours = (s: SimState, n: number) => {
  for (let i = 0; i < n * 10; i++) step(s, config);
};

function rich(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { metal: 500, rock: 500, brick: 500, machinery: 50, electronics: 50 });
  return s;
}
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return s.layout.rooms.at(-1)!;
};

/** 36 colonists, so the noisy dorm fills once the pod is full. */
function noisyDorm(): SimState {
  const s = rich();
  build(s, "life_support", ring(1, 1, 1, 4));
  build(s, "bunk_dorm", ring(1, 1, 5, 2));
  s.population.count = 36;
  updateHappiness(s, config, true);
  return s;
}

describe("notables", () => {
  it("start with six, each with a role and two different traits", () => {
    const s = createInitialState(config);
    expect(s.notables).toHaveLength(6);
    for (const n of s.notables) {
      expect(n.traits).toHaveLength(2);
      expect(n.traits[0]).not.toBe(n.traits[1]);
    }
    expect(new Set(s.notables.map((n) => n.name)).size).toBe(6);
  });

  it("are the same for the same seed", () => {
    expect(createInitialState(config).notables).toEqual(createInitialState(config).notables);
  });
});

describe("noise complaint", () => {
  it("arrives when a lived-in home is noisy", () => {
    const s = noisyDorm();
    hours(s, 1);
    expect(s.office.waiting.map((v) => v.kind)).toContain("noise_complaint");
    expect(s.office.waiting[0]!.text).toMatch(/bunk dorm on floor 1/);
  });

  it("a kept promise raises loyalty and happiness", () => {
    const s = noisyDorm();
    hours(s, 1);
    const visit = s.office.waiting.find((v) => v.kind === "noise_complaint")!;
    const notable = () => s.notables.find((n) => n.id === visit.notableId)!;
    const before = notable().loyalty;
    expect(applyCommand(s, { type: "answerVisit", visitId: visit.id, choice: "promise" })).toEqual({ ok: true });
    // Fix it: move life support away.
    applyCommand(s, { type: "demolish", roomId: s.layout.rooms.find((r) => r.type === "life_support")!.id });
    hours(s, 2);
    expect(s.office.promises).toHaveLength(0);
    expect(notable().loyalty).toBe(before + 5 + 15);
  });

  it("a broken promise costs loyalty", () => {
    const s = noisyDorm();
    hours(s, 1);
    const visit = s.office.waiting.find((v) => v.kind === "noise_complaint")!;
    const before = s.notables.find((n) => n.id === visit.notableId)!.loyalty;
    applyCommand(s, { type: "answerVisit", visitId: visit.id, choice: "promise" });
    hours(s, 3 * 24 + 1);
    expect(s.notables.find((n) => n.id === visit.notableId)!.loyalty).toBe(before + 5 - 20);
  });

  it("quiet hours takes an ordinance slot and halves the noise felt", () => {
    const s = noisyDorm();
    hours(s, 1);
    const visit = s.office.waiting.find((v) => v.kind === "noise_complaint")!;
    const dorm = s.layout.rooms.find((r) => r.type === "bunk_dorm")!;
    const noise = s.happiness.pools.find((p) => p.roomId === dorm.id)!.factors.noise;
    applyCommand(s, { type: "answerVisit", visitId: visit.id, choice: "quiet_hours" });
    expect(s.ordinances).toEqual(["quiet_hours"]);
    expect(modifiers(s).noiseFactor).toBe(0.5);
    hours(s, 1);
    expect(s.happiness.pools.find((p) => p.roomId === dorm.id)!.factors.noise).toBeCloseTo(noise / 2);
  });

  it("an unanswered visitor leaves after two days, unhappy", () => {
    const s = noisyDorm();
    hours(s, 1);
    const visit = s.office.waiting.find((v) => v.kind === "noise_complaint")!;
    const before = s.notables.find((n) => n.id === visit.notableId)!.loyalty;
    hours(s, 2 * 24);
    expect(s.office.waiting.some((v) => v.id === visit.id)).toBe(false);
    expect(s.notables.find((n) => n.id === visit.notableId)!.loyalty).toBe(before - 10);
  });
});

describe("clinic demand", () => {
  it("comes on day 4 when there's no clinic", () => {
    const s = rich();
    hours(s, 4 * 24 - 2);
    expect(s.office.waiting.some((v) => v.kind === "clinic_demand")).toBe(false);
    hours(s, 3);
    expect(s.office.waiting.some((v) => v.kind === "clinic_demand")).toBe(true);
  });

  it("doesn't come when there's already a clinic", () => {
    const s = rich();
    build(s, "clinic", ring(1, 1, 2));
    hours(s, 5 * 24);
    expect(s.office.waiting.some((v) => v.kind === "clinic_demand")).toBe(false);
  });
});

describe("ordinances", () => {
  it("are limited by the admin office's slots", () => {
    const s = rich();
    expect(applyCommand(s, { type: "setOrdinance", id: "water_rationing", enacted: true })).toEqual({ ok: true });
    expect(applyCommand(s, { type: "setOrdinance", id: "ration_cards", enacted: true })).toMatchObject({ ok: false });
    build(s, "admin_office", ring(1, 1, 3, 2));
    step(s, config); // the office needs staff before it counts
    expect(applyCommand(s, { type: "setOrdinance", id: "ration_cards", enacted: true })).toEqual({ ok: true });
  });

  it("water rationing cuts water use by a quarter", () => {
    const a = rich();
    const b = rich();
    applyCommand(b, { type: "setOrdinance", id: "water_rationing", enacted: true });
    hours(a, 24);
    hours(b, 24);
    const usedA = 240 - a.resources.water!;
    const usedB = 240 - b.resources.water!;
    expect(usedB).toBeCloseTo(usedA * 0.75, 0);
  });
});

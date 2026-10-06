import { describe, expect, it } from "vitest";
import { flows } from "../src/bridge/charts";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { averageFlows, LABELS, record } from "../src/sim/ledger";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { river } from "../src/view/flows";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

function colony(): SimState {
  const s = createInitialState(config);
  for (const [room, at] of [
    ["galley", ring(1, 1, 2)],
    ["restroom", ring(1, 1, 3)],
    ["life_support", ring(1, 2, 3, 4)],
  ] as const) {
    const r = applyCommand(s, { type: "build", room, at });
    if (!r.ok) throw new Error(`${room}: ${r.reason}`);
    const c = applyCommand(s, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
    if (!c.ok) throw new Error(`${room}: ${c.reason}`);
  }
  return s;
}

describe("flow ledger", () => {
  it("conserves every resource: in − out = change in stock, over a whole day", () => {
    const s = colony();
    for (let i = 0; i < config.ticksPerDay; i++) step(s, config); // settle into day 2
    const before = { ...s.resources };
    for (let i = 0; i < config.ticksPerDay; i++) step(s, config);
    const day = s.ledger.days.at(-1)!;
    for (const [id, f] of Object.entries(day)) {
      const change = (s.resources[id] ?? 0) - (before[id] ?? 0);
      expect(sum(f.in) - sum(f.out), id).toBeCloseTo(change, 6);
    }
  });

  it("names where things come from and go", () => {
    const s = colony();
    for (let i = 0; i < 4 * config.ticksPerDay; i++) step(s, config);
    const f = averageFlows(s, config);
    expect(Object.keys(f.o2!.in)).toContain("Life support");
    expect(Object.keys(f.o2!.out)).toContain(LABELS.colonists);
    expect(Object.keys(f.grayWater!.in)).toContain(LABELS.restrooms);
    expect(Object.keys(f.rock!.in)).toContain(LABELS.digging);
    expect(Object.keys(f.rations!.in)).toContain(LABELS.earth);
    expect(Object.keys(f.rations!.out)).toContain("Galley");
  });

  it("averages over the last few complete days", () => {
    const s = colony();
    for (let i = 0; i < 10 * config.ticksPerDay; i++) step(s, config);
    expect(s.ledger.days).toHaveLength(config.economy.ledgerDays);
    // 20 colonists breathe 20 oxygen a day.
    expect(averageFlows(s, config).o2!.out[LABELS.colonists]).toBeCloseTo(20, 0);
  });
});

describe("two-step flows", () => {
  it("keeps where a use went next, averaged, for the web panel and the bridge", () => {
    const s = colony();
    for (let day = 0; day < 2; day++) {
      record(s, "water", "out", "Electrolyzer", 6, { then: "Air for new space" });
      record(s, "water", "out", "Electrolyzer", 2, { then: "Replacing breathed air" });
      for (let i = 0; i < config.ticksPerDay; i++) step(s, config);
    }
    const f = averageFlows(s, config);
    expect(f.water!.then!["Electrolyzer"]!["Air for new space"]).toBeCloseTo(6, 6);
    expect(f.water!.out["Electrolyzer"]).toBeCloseTo(8, 6);

    const rv = river("water", f.water);
    expect(rv.thens["Electrolyzer"]!.map(([label]) => label)).toEqual(["Air for new space", "Replacing breathed air"]);
    expect(Object.keys(rv.thens)).toEqual(["Electrolyzer"]); // other uses don't say

    const out = flows(s, "water").rivers[0]!.outs.find((o) => o.label === "Electrolyzer")!;
    expect(out.then!.map((t) => t.value)).toEqual([expect.closeTo(6, 6), expect.closeTo(2, 6)]);
  });
});

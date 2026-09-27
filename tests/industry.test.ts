import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import type { DepositKind } from "../src/sim/mapgeo";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function hole(deposits: DepositKind[]): SimState {
  const s = createInitialState(config, { holeId: 1, name: "Test", site: null, deposits, seed: 1 });
  s.drill.active = false;
  // Within storage limits, so rooms don't idle for lack of space.
  Object.assign(s.resources, { metal: 100, brick: 150, rock: 150, machinery: 30, electronics: 20, ore: 100, silica: 100, wafers: 10 });
  return s;
}

describe("regional industry", () => {
  it("a smelter needs an ore site", () => {
    expect(applyCommand(hole(["ice", "silica"]), { type: "build", room: "smelter", at: ring(1, 1, 1, 4) })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Needs a site on ore/),
    });
    expect(applyCommand(hole(["ice", "ore"]), { type: "build", room: "smelter", at: ring(1, 1, 1, 4) })).toMatchObject({ ok: true });
  });

  it("the smelter turns ore into metal", () => {
    const s = hole(["ore"]);
    applyCommand(s, { type: "build", room: "smelter", at: ring(1, 1, 1, 4) });
    const ore = s.resources.ore!;
    const metal = s.resources.metal!;
    for (let i = 0; i < config.ticksPerDay; i++) step(s, config);
    // Ore 6 → metal 3 a day, a little under at the start while staffing settles.
    expect(ore - s.resources.ore!).toBeGreaterThan(5);
    expect(s.resources.metal! - metal).toBeGreaterThan(2.5);
  });

  it("silica becomes wafers, and wafers with metal become electronics", () => {
    const s = hole(["silica"]);
    applyCommand(s, { type: "build", room: "silicon_refinery", at: ring(1, 1, 1, 4) });
    applyCommand(s, { type: "build", room: "electronics_fab", at: ring(1, 1, 5, 2) });
    const e0 = s.resources.electronics!;
    for (let i = 0; i < 2 * config.ticksPerDay; i++) step(s, config);
    // About 1 a day once the refinery's wafers flow.
    expect(s.resources.electronics! - e0).toBeGreaterThan(1.3);
  });

  it("rooms without a site need can go anywhere", () => {
    expect(applyCommand(hole([]), { type: "build", room: "machine_shop", at: ring(1, 1, 1, 2) })).toMatchObject({ ok: true });
  });
});

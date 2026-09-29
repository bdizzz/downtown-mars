import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { holeGates, setAdults, stepUnlocks } from "../src/sim/people";
import { roomDef } from "../src/sim/rooms";
import { createInitialState } from "../src/sim/state";
import { allRock } from "./worlds";

const SLOTS = { S: 1, M: 2 } as const;
const perSlot = (id: string) => roomDef(id).houses! / SLOTS[roomDef(id).size as "S" | "M"];
const ownComfort = (id: string) => roomDef(id).effects.filter((e) => e.residentsOnly && e.type === "comfort").reduce((n, e) => n + e.strength, 0);

describe("apartments", () => {
  it("house fewer per slot than bunks, and the finer the tier the fewer and the comfier", () => {
    const tiers = [["bunk_dorm"], ["studio", "apartment"], ["flat", "family_apartment"], ["suite", "residence"]];
    for (let t = 1; t < tiers.length; t++) {
      for (const id of tiers[t]!) {
        for (const lower of tiers[t - 1]!) {
          expect(perSlot(id), `${id} vs ${lower}`).toBeLessThan(perSlot(lower));
          if (roomDef(id).size === roomDef(lower).size) expect(ownComfort(id), `${id} vs ${lower}`).toBeGreaterThan(ownComfort(lower));
        }
      }
    }
    // Each small (S) home is cozier than the M home of its tier.
    for (const [s, m] of [["studio", "apartment"], ["flat", "family_apartment"], ["suite", "residence"]]) expect(ownComfort(s!)).toBeGreaterThan(ownComfort(m!));
  });

  it("wait for the hole to grow: studios at 50 colonists, flats at 200, suites at 1,000", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    allRock(s.layout);
    Object.assign(s.resources, { rock: 500, brick: 500, metal: 500, electronics: 500 });
    const at = { kind: "ring" as const, floor: 1, ring: 1, slot: 3, w: 1, d: 1 };
    const refused = applyCommand(s, { type: "build", room: "studio", at });
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.reason).toMatch(/50 colonists/);
    setAdults(s, 60, config);
    s.tick = config.ticksPerDay * 3;
    stepUnlocks(s, config);
    expect(holeGates(s)).toContain("basicHomes");
    expect(holeGates(s)).not.toContain("standardHomes");
    expect(applyCommand(s, { type: "build", room: "studio", at }).ok).toBe(true);
    expect(applyCommand(s, { type: "build", room: "suite", at: { ...at, slot: 5 } }).ok).toBe(false);
  });
});

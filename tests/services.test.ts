import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { assignNearest } from "../src/sim/amenities";
import { careCoverage, homeCare } from "../src/sim/care";
import { stepsBetween } from "../src/sim/paths";
import { roomDef } from "../src/sim/rooms";
import { updateHappiness } from "../src/sim/happiness";
import { setAdults } from "../src/sim/people";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// Milestone 11, step 7: clinic, school and elder-care places go to the homes
// nearest them first, within reach on foot.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const settle = (s: SimState) => {
  step(s, config);
  updateHappiness(s, config, true);
  updateHappiness(s, config, true);
};

describe("sharing out places, nearest first", () => {
  it("fills the nearest home first, and sends the rest to the next service in reach", () => {
    const walks: Record<number, Map<number, number>> = {
      1: new Map([[10, 10], [11, 50]]),
      2: new Map([[10, 20], [11, 30]]),
      3: new Map([[10, 200]]),
    };
    const { got, gave } = assignNearest(
      [
        { id: 1, need: 30 },
        { id: 2, need: 30 },
        { id: 3, need: 10 },
      ],
      [
        { id: 10, capacity: 40, reachM: 100 },
        { id: 11, capacity: 20, reachM: 100 },
      ],
      (id) => walks[id]!,
    );
    expect(got.get(1)).toBe(30); // nearest to 10, all of it
    expect(got.get(2)).toBe(30); // 10 from service 10, then 20 from service 11
    expect(got.get(3)).toBeUndefined(); // service 10 is out of its reach
    expect(gave.get(10)).toBe(40);
    expect(gave.get(11)).toBe(20);
  });
});

describe("clinic care within reach", () => {
  it("covers a home within the clinic's reach on foot, not one further off", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60, electronics: 60 });
    setAdults(s, 52, config);
    const near = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    const clinic = build(s, "clinic", ring(1, 1, 3));
    const far = build(s, "bunk_dorm", ring(1, 1, 6, 2));
    applyCommand(s, { type: "consoleFinish" });
    const dNear = stepsBetween(s.layout, near, clinic)!;
    const dFar = stepsBetween(s.layout, far, clinic)!;
    expect(dNear).toBeLessThan(dFar);
    // A clinic whose reach falls between the two.
    const def = roomDef("clinic");
    const was = def.reach;
    def.reach = (dNear + dFar) / 2;
    try {
      settle(s);
      expect(homeCare(s, near).care).toBe(1);
      expect(homeCare(s, far).care).toBe(0);
      // The hole's share counts people out of reach as without care.
      expect(careCoverage(s)).toBeLessThan(1);
    } finally {
      def.reach = was;
    }
  });
});

import { describe, expect, it } from "vitest";
import furniture from "../data/furniture.json";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { homeFactors, updateHappiness } from "../src/sim/happiness";
import { stepsBetween } from "../src/sim/paths";
import { setAdults } from "../src/sim/people";
import type { Location } from "../src/sim/placement";
import { roomDef, roomDefs } from "../src/sim/rooms";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { withinReachRows } from "../src/view/roomPanel";

// T-006: restrooms are an amenity by walking distance. Places go to the homes
// nearest first, within reach; homes with their own bathroom need none. Going
// without costs comfort, and only very poor coverage costs health.

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
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;
const restroomRow = (s: SimState, id: number) => withinReachRows(makeSnapshot(s, config), room(s, id)).find((r) => r.k === "Restroom");

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60, electronics: 60, glass: 100 });
  return s;
}

describe("restrooms within reach", () => {
  it("covers a home within reach on foot and not one further off, and the far one feels it", () => {
    const s = hole();
    setAdults(s, 52, config);
    const near = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    const wc = build(s, "restroom", ring(1, 1, 3));
    const far = build(s, "bunk_dorm", ring(1, 1, 6, 2));
    applyCommand(s, { type: "consoleFinish" });
    const dNear = stepsBetween(s.layout, near, wc)!;
    const dFar = stepsBetween(s.layout, far, wc)!;
    expect(dNear).toBeLessThan(dFar);
    // A big restroom whose reach falls between the two, and no lift from being near it.
    const def = roomDef("restroom");
    const was = { reach: def.reach, amenity: def.amenity, sanitation: def.sanitation };
    def.reach = (dNear + dFar) / 2;
    def.amenity = { comfort: 0, reach: def.reach };
    def.sanitation = 100;
    try {
      settle(s);
      expect(s.population.sanitationByHome?.[near]).toBe(1);
      expect(s.population.sanitationByHome?.[far]).toBe(0);
      expect(s.population.sanitation).toBeLessThan(1);
      const cNear = homeFactors(s, room(s, near), config).comfort;
      const cFar = homeFactors(s, room(s, far), config).comfort;
      expect(cNear - cFar).toBeGreaterThan(config.happiness.noRestroomComfort * 0.5);
      // The far home's panel says why.
      expect(restroomRow(s, far)).toMatchObject({ warn: true, text: expect.stringMatching(/without one/) });
      expect(restroomRow(s, near)?.warn).toBe(false);
    } finally {
      Object.assign(def, was);
    }
  });

  it("counts a home with its own bathroom as covered, with no restroom anywhere", () => {
    const s = hole();
    setAdults(s, 30, config);
    s.unlocks = [...(s.unlocks ?? []), "basicHomes"];
    const studio = build(s, "studio", ring(1, 1, 1));
    applyCommand(s, { type: "consoleFinish" });
    settle(s);
    expect(s.population.sanitationByHome?.[studio]).toBe(1);
    expect(restroomRow(s, studio)?.text).toBe("its own bathroom");
  });

  it("gives the homes that furnish a bathroom pod their own bathroom", () => {
    const rooms = (furniture as { rooms: Record<string, string[]> }).rooms;
    for (const def of roomDefs) {
      if (!def.houses || !rooms[def.id]) continue;
      expect(!!def.ownBathroom, def.id).toBe(rooms[def.id]!.includes("bathroom_pod"));
    }
  });
});

describe("restrooms and health", () => {
  function healthAfter(sanitation: number): number {
    const s = hole();
    setAdults(s, 30, config);
    applyCommand(s, { type: "consoleFinish" });
    s.population.health = 80;
    for (let i = 0; i < 20; i++) {
      s.population.sanitation = sanitation;
      step(s, config);
    }
    return s.population.health;
  }

  it("costs health only when under half the people have a restroom", () => {
    expect(healthAfter(0.6)).toBe(healthAfter(1));
    expect(healthAfter(0.25)).toBeLessThan(healthAfter(0.6));
    expect(healthAfter(0)).toBeLessThan(healthAfter(0.25));
  });
});

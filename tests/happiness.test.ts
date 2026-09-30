import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { productivity, shaftView, updateHappiness } from "../src/sim/happiness";
import { galleryEdges } from "../src/sim/edges";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// No Earth drops or digging noise in the numbers.
const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function withRooms(rooms: [string, Location][]): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.resources.metal = 500;
  s.resources.rock = 500;
  s.resources.brick = 500;
  s.resources.machinery = 50;
  s.resources.electronics = 50;
  for (const [room, at] of rooms) {
    const r = applyCommand(s, { type: "build", room, at });
    if (!r.ok) throw new Error(`${room}: ${r.reason}`);
    const c = applyCommand(s, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
    if (!c.ok) throw new Error(`${room}: ${c.reason}`);
  }
  updateHappiness(s, config, true);
  return s;
}
const pool = (s: SimState, type: string) => {
  const room = s.layout.rooms.find((r) => r.type === type)!;
  return s.happiness.pools.find((p) => p.roomId === room.id)!;
};

describe("happiness", () => {
  it("starts a little above the productivity threshold in the pod", () => {
    const s = createInitialState(config);
    expect(s.happiness.pools).toHaveLength(1);
    expect(s.happiness.average).toBeGreaterThanOrEqual(50);
    expect(s.happiness.productivity).toBe(1);
  });

  it("a dorm next to life support is less happy than one across the ring", () => {
    const near = withRooms([["life_support", ring(1, 1, 1, 4)], ["bunk_dorm", ring(1, 1, 5, 2)]]);
    const far = withRooms([["life_support", ring(1, 1, 1, 4)], ["bunk_dorm", ring(1, 1, 6, 2)]]);
    expect(pool(near, "bunk_dorm").factors.noise).toBeLessThan(pool(far, "bunk_dorm").factors.noise);
    expect(pool(near, "bunk_dorm").target).toBeLessThan(pool(far, "bunk_dorm").target);
  });

  it("a clinic nearby lifts health", () => {
    const without = withRooms([["bunk_dorm", ring(1, 1, 1, 2)]]);
    const withClinic = withRooms([["bunk_dorm", ring(1, 1, 1, 2)], ["clinic", ring(1, 1, 3)]]);
    step(withClinic, config); // let the clinic get staff
    updateHappiness(withClinic, config, true);
    expect(pool(withClinic, "bunk_dorm").factors.health).toBeGreaterThan(pool(without, "bunk_dorm").factors.health);
  });

  it("ring 1 homes get the shaft view: in full through their own windows, partly through a gallery tube", () => {
    const s = withRooms([
      ["bunk_dorm", ring(1, 1, 1, 2)],
      ["bunk_dorm", ring(1, 2, 3, 2)],
    ]);
    const dorms = () => s.happiness.pools.filter((p) => s.layout.rooms.find((r) => r.id === p.roomId)!.type === "bunk_dorm");
    // Floor 1 starts with its gallery all the way round: the view is through the tube.
    let [inner, outer] = dorms();
    expect(inner!.factors.comfort - outer!.factors.comfort).toBeCloseTo(config.happiness.galleryViewComfort);
    // Take the tube away from in front of one of its two cells: halfway between.
    const home = s.layout.rooms.find((r) => r.id === inner!.roomId)!;
    delete s.layout.corridors[galleryEdges(s.layout.hole, 1)[home.cells[0]!.slot]!.id];
    updateHappiness(s, config, true);
    [inner, outer] = dorms();
    expect(inner!.factors.comfort - outer!.factors.comfort).toBeCloseTo((config.happiness.shaftViewComfort + config.happiness.galleryViewComfort) / 2);
    expect(shaftView(s.layout, home, config)).toBeCloseTo((config.happiness.shaftViewComfort + config.happiness.galleryViewComfort) / 2);
  });

  it("colonists move into the best homes first", () => {
    const s = withRooms([["bunk_dorm", ring(1, 1, 1, 2)]]);
    const total = s.happiness.pools.reduce((n, p) => n + p.residents, 0);
    expect(total).toBe(20);
    const best = [...s.happiness.pools].sort((a, b) => b.target - a.target)[0]!;
    expect(best.residents).toBe(Math.min(best.capacity, 20));
  });

  it("eases toward a new target instead of jumping", () => {
    const s = withRooms([["bunk_dorm", ring(1, 1, 5, 2)]]);
    const before = pool(s, "bunk_dorm").happiness;
    applyCommand(s, { type: "build", room: "life_support", at: ring(1, 1, 1, 4) });
    for (let i = 0; i < config.happiness.updateEveryTicks; i++) step(s, config);
    const p = pool(s, "bunk_dorm");
    expect(p.happiness).toBeLessThan(before);
    expect(p.happiness).toBeGreaterThan(p.target);
  });

  it("low happiness slows rooms down", () => {
    expect(productivity(80, config)).toBe(1);
    expect(productivity(25, config)).toBeCloseTo(0.875);
    expect(productivity(0, config)).toBe(config.happiness.productivityAtZero);
  });
});

import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { rockPerFloor, ticksToDig } from "../src/sim/digging";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1) => ({ kind: "ring" as const, floor, ring: r, slot, w, d });
const run = (s: ReturnType<typeof createInitialState>, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s, config);
};

describe("digging", () => {
  it("starts with one floor and the drill on floor 2", () => {
    const s = createInitialState(config);
    expect(s.layout.hole.floors).toBe(1);
    expect(makeSnapshot(s, config).drill).toMatchObject({ active: true, floor: 2, progress: 0 });
  });

  it("deeper floors take longer", () => {
    expect(ticksToDig(3, config)).toBeGreaterThan(ticksToDig(2, config));
    expect(ticksToDig(2, config)).toBe(config.digging.ticksForFirstFloor);
  });

  it("finishes floor 2 after the right number of ticks and yields its rock", () => {
    const s = createInitialState(config);
    const needed = ticksToDig(2, config);
    run(s, needed - 1);
    expect(s.layout.hole.floors).toBe(1);
    run(s, 1);
    expect(s.layout.hole.floors).toBe(2);
    expect(s.resources.rock).toBeCloseTo(rockPerFloor(s, config));
    expect(makeSnapshot(s, config).drill).toMatchObject({ floor: 3, progress: 0 });
  });

  it("stops when paused", () => {
    const s = createInitialState(config);
    applyCommand(s, { type: "setDrill", active: false });
    run(s, 50);
    expect(s.drill.progress).toBe(0);
    expect(s.resources.rock ?? 0).toBe(0);
  });

  it("blueprints on the floor being dug switch on when it's done", () => {
    const s = createInitialState(config);
    expect(applyCommand(s, { type: "build", room: "clinic", at: ring(2, 1, 3) })).toEqual({ ok: true });
    expect(applyCommand(s, { type: "build", room: "clinic", at: ring(3, 1, 3) })).toMatchObject({ ok: false });
    const clinic = () => s.layout.rooms.find((r) => r.type === "clinic")!;
    expect(clinic().planned).toBe(true);
    run(s, ticksToDig(2, config));
    expect(clinic().planned).toBe(false);
  });
});

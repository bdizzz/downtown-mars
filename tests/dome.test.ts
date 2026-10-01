import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { computeEffects, effectAt } from "../src/sim/effects";
import { setRoomWindows, shaftBorders, windowComfort } from "../src/sim/windows";
import { ensureFloors, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { stepsBetween } from "../src/sim/paths";
import { tubeRuns } from "../src/view/gallery";
import { construction } from "../src/sim/construction";

// Milestone 12: the shaft dome, a hole's end goal.

const ring = (
  floor: number,
  r: number,
  slot: number,
  w = 1,
  d = 1,
): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  ensureFloors(s.layout);
  Object.assign(s.resources, {
    rock: 900,
    brick: 300,
    metal: 400,
    machinery: 60,
    electronics: 60,
    glass: 300,
  });
  for (const r of s.layout.rooms)
    if (r.type === "landing_pod")
      r.allocation = { ...(r.allocation ?? {}), glass: 300, metal: 400 };
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const finish = (s: SimState) => applyCommand(s, { type: "consoleFinish" });

describe("the shaft dome", () => {
  it("waits for its population and its materials, then goes into the construction queue; cancelling gives it all back", () => {
    const s = hole();
    construction.instant = false;
    try {
      expect(applyCommand(s, { type: "buildDome" })).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/Unlocks at 300/),
      });
      s.unlocks = ["dome"];
      const glass = s.resources.glass!;
      expect(applyCommand(s, { type: "buildDome" }).ok).toBe(true);
      expect(s.resources.glass!).toBe(glass - config.dome.cost.glass!);
      expect(applyCommand(s, { type: "buildDome" })).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/already being built/),
      });
      const job = s.construction.queue.find((j) => j.kind === "dome")!;
      expect(job.work).toBe(config.dome.workHours);
      expect(applyCommand(s, { type: "cancelJob", jobId: job.id }).ok).toBe(
        true,
      );
      expect(s.resources.glass!).toBe(glass);
    } finally {
      construction.instant = true;
    }
  });

  it("once built, makes every floor's gallery open walkway, the shaft an atrium, and the air fresher", () => {
    const s = hole();
    s.unlocks = ["dome"];
    build(s, "stairwell", ring(1, 1, 8));
    const a = build(s, "galley", ring(2, 1, 1));
    const b = build(s, "clinic", ring(2, 1, 5));
    finish(s);
    // Floor 2 has no tubes: neither room is connected, and they can't reach each other.
    expect(s.layout.rooms.find((r) => r.id === a)!.connected).toBe(false);
    expect(stepsBetween(s.layout, a, b)).toBeNull();
    const clinic = s.layout.rooms.find((r) => r.id === b)!;
    setRoomWindows(clinic, shaftBorders(s.layout, clinic), true);
    const view = windowComfort(s.layout, clinic, config);
    const air = effectAt(computeEffects(s.layout), "airQuality", {
      floor: 2,
      ring: 3,
      slot: 0,
    });
    expect(applyCommand(s, { type: "buildDome" }).ok).toBe(true);
    finish(s);
    expect(s.layout.domed).toBe(true);
    expect(s.layout.rooms.find((r) => r.id === a)!.connected).toBe(true);
    expect(stepsBetween(s.layout, a, b)).not.toBeNull();
    expect(
      windowComfort(
        s.layout,
        s.layout.rooms.find((r) => r.id === b)!,
        config,
      ),
    ).toBeCloseTo(view + config.dome.atriumComfort);
    expect(
      effectAt(computeEffects(s.layout), "airQuality", {
        floor: 2,
        ring: 3,
        slot: 0,
      }),
    ).toBeCloseTo(air + config.dome.air);
    expect(tubeRuns(s.layout).every((r) => r.full)).toBe(true);
    expect(s.messages.some((m) => m.text.includes("dome"))).toBe(true);
  });

  it("keeps storms from driving more dust through the airlock", () => {
    const s = hole();
    s.unlocks = ["dome"];
    applyCommand(s, { type: "buildDome" });
    finish(s);
    applyCommand(s, { type: "consoleStorm", days: 1, inDays: 0 });
    for (let i = 0; i < config.ticksPerDay / 2; i++) step(s, config);
    expect(s.effects.dust).toBe(1);
  });
});

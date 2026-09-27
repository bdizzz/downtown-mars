import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { deserialize, SAVE_VERSION, serialize, summarize } from "../src/sim/save";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";

const run = (s: ReturnType<typeof createInitialState>, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s, config);
};

describe("saves", () => {
  it("round-trip: a loaded game continues exactly as the original would", () => {
    const a = createInitialState(config);
    applyCommand(a, { type: "build", room: "galley", at: { kind: "ring", floor: 1, ring: 1, slot: 2, w: 1, d: 1 } });
    run(a, 900); // past the first drop, so RNG, messages and notables have moved
    const loaded = deserialize(serialize(a));
    expect(loaded.ok).toBe(true);
    const b = loaded.ok ? loaded.state : a;
    run(a, 600);
    run(b, 600);
    expect(serialize(b)).toEqual(serialize(a));
  });

  it("rebuilds the effect field rather than storing it", () => {
    const s = createInitialState(config);
    applyCommand(s, { type: "build", room: "clinic", at: { kind: "ring", floor: 1, ring: 1, slot: 2, w: 1, d: 1 } });
    expect(serialize(s)).not.toContain('"field"');
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state.effects.field.health![0]![0]![2]).toBe(2);
  });

  it("refuses garbage, other games and other versions", () => {
    expect(deserialize("not json")).toMatchObject({ ok: false });
    expect(deserialize('{"game":"other"}')).toMatchObject({ ok: false });
    const s = serialize(createInitialState(config)).replace(`"version":${SAVE_VERSION}`, '"version":999');
    expect(deserialize(s)).toMatchObject({ ok: false, reason: expect.stringMatching(/different version/) });
  });

  it("refuses rooms this build doesn't know", () => {
    const s = serialize(createInitialState(config)).replace('"type":"landing_pad"', '"type":"space_elevator"');
    expect(deserialize(s)).toMatchObject({ ok: false, reason: expect.stringMatching(/space_elevator/) });
  });

  it("summarizes for the load menu", () => {
    const s = createInitialState(config);
    run(s, config.ticksPerDay * 2);
    expect(summarize(s, config)).toEqual({ day: 3, population: 20, floors: 2 });
  });
});

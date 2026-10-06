import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { deserialize, SAVE_VERSION, serialize, summarize } from "../src/sim/save";
import { createWorld, type World } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) stepWorld(w, config);
};
const first = (w: World) => w.holes[0]!;

/** An old single-hole save file, as versions 1 and 2 wrote them. */
function oldSave(w: World, version: 1 | 2): string {
  const { effects: _e, holeId: _i, name: _n, site: _s, ...hole } = first(w);
  const state: Record<string, unknown> = { ...hole };
  if (version === 1) delete state.ledger;
  return JSON.stringify({ game: "downtown-mars", version, state });
}

describe("saves", () => {
  it("round-trip: a loaded world continues exactly as the original would", () => {
    const a = createWorld(config);
    applyCommand(first(a), { type: "build", room: "galley", at: { kind: "ring", floor: 1, ring: 1, slot: 2, w: 1, d: 1 } });
    run(a, 900); // past the first drop, so RNG, messages and notables have moved
    const loaded = deserialize(serialize(a));
    expect(loaded.ok).toBe(true);
    const b = loaded.ok ? loaded.world : a;
    run(a, 600);
    run(b, 600);
    expect(serialize(b)).toEqual(serialize(a));
  });

  it("rebuilds each hole's effect field rather than storing it", () => {
    const w = createWorld(config);
    applyCommand(first(w), { type: "consoleFinish" });
    applyCommand(first(w), { type: "consoleResources", atLeast: { rock: 100, metal: 50, machinery: 10 } });
    expect(applyCommand(first(w), { type: "build", room: "concrete_plant", at: { kind: "ring", floor: 1, ring: 1, slot: 2, w: 2, d: 1 } }).ok).toBe(true);
    applyCommand(first(w), { type: "consoleFinish" });
    expect(serialize(w)).not.toContain('"field"');
    const loaded = deserialize(serialize(w));
    expect(loaded.ok && first(loaded.world).effects.field.noise![0]![0]![2]).toBe(-2);
  });

  it("refuses garbage, other games and other versions", () => {
    expect(deserialize("not json")).toMatchObject({ ok: false });
    expect(deserialize('{"game":"other"}')).toMatchObject({ ok: false });
    const s = serialize(createWorld(config)).replace(`"version":${SAVE_VERSION}`, '"version":999');
    expect(deserialize(s)).toMatchObject({ ok: false, reason: expect.stringMatching(/different version/) });
  });

  it("upgrades a v2 single-hole save into a world of one hole and plays on", () => {
    const w = createWorld(config);
    run(w, 300);
    const loaded = deserialize(oldSave(w, 2));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.world.holes).toHaveLength(1);
      expect(first(loaded.world)).toMatchObject({ holeId: 1, name: "Bradbury", site: null });
      expect(loaded.world.tick).toBe(300);
      expect(() => run(loaded.world, 300)).not.toThrow();
    }
  });

  it("upgrades a v1 save (no flow ledger) all the way", () => {
    const w = createWorld(config);
    run(w, 50);
    const loaded = deserialize(oldSave(w, 1));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(first(loaded.world).ledger).toEqual({ current: {}, days: [] });
      expect(() => run(loaded.world, 300)).not.toThrow();
    }
  });

  it("upgrades a v18 save's black water to tailings, everywhere it's kept", () => {
    const w = createWorld(config);
    run(w, 300);
    const json = serialize(w)
      .replace(`"version":${SAVE_VERSION}`, '"version":18')
      .replace('"resources":{', '"resources":{"blackWater":12,')
      .replace('"current":{', '"current":{"blackWater":{"in":{"Restrooms":3},"out":{}},');
    const loaded = deserialize(json);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      const h = first(loaded.world);
      expect(h.resources.tailings).toBe(12);
      expect(h.resources).not.toHaveProperty("blackWater");
      expect(h.ledger.current.tailings?.in.Restrooms).toBe(3);
      expect(() => run(loaded.world, 300)).not.toThrow();
    }
  });

  it("refuses rooms this build doesn't know", () => {
    const s = serialize(createWorld(config)).replace('"type":"landing_pad"', '"type":"space_elevator"');
    expect(deserialize(s)).toMatchObject({ ok: false, reason: expect.stringMatching(/space_elevator/) });
  });

  it("summarizes the whole world for the load menu", () => {
    const w = createWorld(config);
    run(w, config.ticksPerDay * 4); // the drill takes 3 days for floor 2
    expect(summarize(w, config)).toEqual({ day: 5, population: 20, floors: 2, holes: 1 });
  });
});

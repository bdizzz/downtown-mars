import { afterEach, describe, expect, it } from "vitest";
import configJson from "../data/config.json";
import conditionJson from "../data/condition.json";
import constructionJson from "../data/construction.json";
import corridorsJson from "../data/corridors.json";
import eventsJson from "../data/events.json";
import materialsJson from "../data/materials.json";
import roomsJson from "../data/rooms.json";
import { config } from "../src/sim/config";
import { CONDITION } from "../src/sim/condition";
import { missingCost, siteRefusal } from "../src/sim/costs";
import { DIFFICULTY, factor, knobValues, LEVELS, setDifficulty, currentDifficulty, type Knob } from "../src/sim/difficulty";
import { ticksToDig } from "../src/sim/digging";
import { roomDef, roomDefs } from "../src/sim/rooms";
import { construction } from "../src/sim/construction";
import { corridors } from "../src/sim/corridors";
import { eventData } from "../src/sim/events";
import { MATERIALS } from "../src/sim/materials";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { createSimHost } from "../src/worker/host";
import type { FromWorker } from "../src/worker/protocol";

// Difficulty (F-014, T-122): easy, normal and hard as multipliers on the data.

// The data as written, copied before any test scales it (the imports are the very objects difficulty.ts rescales).
const WRITTEN: Record<string, unknown> = structuredClone({
  config: configJson,
  condition: conditionJson,
  construction: constructionJson,
  corridors: corridorsJson,
  events: eventsJson,
  materials: materialsJson,
  rooms: roomsJson,
});
const json = (name: string) => WRITTEN[name];
const KNOBS = Object.keys(DIFFICULTY.factors.normal) as Knob[];

afterEach(() => setDifficulty("normal"));

describe("difficulty (T-122)", () => {
  it("has the three levels, normal all 1×, and every knob for each", () => {
    expect(LEVELS).toEqual(["easy", "normal", "hard"]);
    for (const k of KNOBS) expect(factor("normal", k)).toBe(1);
    for (const l of LEVELS) expect(Object.keys(DIFFICULTY.factors[l]).sort()).toEqual([...KNOBS].sort());
  });

  it("every knob reaches some number in the data", () => {
    for (const k of KNOBS) expect(knobValues(k).length, k).toBeGreaterThan(0);
  });

  it("normal is the data as written, even after another level", () => {
    setDifficulty("hard");
    setDifficulty("easy");
    setDifficulty("normal");
    const loaded: Record<string, unknown> = { config, condition: CONDITION, construction, corridors, events: eventData, materials: MATERIALS, rooms: { rooms: roomDefs } };
    for (const [name, data] of Object.entries(loaded)) {
      const written = json(name) as Record<string, unknown>;
      // (The tests' setup turns on instant construction; that isn't difficulty's.)
      for (const key of Object.keys(written).filter((k) => k !== "_note" && !(name === "construction" && k === "instant"))) expect((data as Record<string, unknown>)[key], `${name}.${key}`).toEqual(written[key]);
    }
    for (const k of KNOBS) for (const v of knobValues(k)) expect(v.now).toBe(v.base);
  });

  it("easy and hard move each knob its own way", () => {
    for (const level of ["easy", "hard"] as const) {
      setDifficulty(level);
      for (const k of KNOBS) {
        const f = factor(level, k);
        for (const { base, now } of knobValues(k)) {
          if (f > 1) expect(Math.abs(now), `${level} ${k}`).toBeGreaterThanOrEqual(Math.abs(base));
          if (f < 1) expect(Math.abs(now), `${level} ${k}`).toBeLessThanOrEqual(Math.abs(base));
        }
        // And most of them actually change (whole numbers can round back to where they were).
        const moved = knobValues(k).filter((v) => v.now !== v.base).length;
        if (f !== 1) expect(moved, `${level} ${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("scales what the game reads: costs, digging, decay, unlocks, the landing stock", () => {
    const metal = roomDef("galley").cost.metal ?? 0;
    const dig = ticksToDig(3, config);
    const decay = CONDITION.decayPerDay;
    const water = createWorld(config, 7).holes[0]!.resources.water!;
    const luxury = config.unlocks.homes.luxury;

    const hard = createWorld(config, 7, "hard");
    expect(hard.difficulty).toBe("hard");
    expect(roomDef("galley").cost.metal).toBe(Math.round(metal * factor("hard", "buildCost")));
    expect(ticksToDig(3, config)).toBeGreaterThan(dig);
    expect(CONDITION.decayPerDay).toBeCloseTo(decay * factor("hard", "decay"));
    expect(hard.holes[0]!.resources.water).toBe(Math.round(water * factor("hard", "startingStock")));
    expect(siteRefusal("suite", [])).toContain(`${Math.round(luxury * factor("hard", "unlocks"))} colonists`);
    // Hard: no colonists from Earth for a dwindling hole (T-161).
    expect(config.earth.rescue.chance).toBe(0);

    createWorld(config, 7, "easy");
    expect(roomDef("galley").cost.metal).toBeLessThan(metal);
    expect(missingCost({ metal: Math.round(metal * factor("easy", "buildCost")), ...Object.fromEntries(Object.entries(roomDef("galley").cost).filter(([id]) => id !== "metal")) }, "galley")).toBeNull();

    createWorld(config, 7);
    expect(roomDef("galley").cost.metal).toBe(metal);
    expect(ticksToDig(3, config)).toBe(dig);
  });

  it("easy and hard games run (a smoke run of a few days each)", () => {
    for (const level of ["easy", "hard"] as const) {
      const world = createWorld(config, 11, level);
      for (let t = 0; t < config.ticksPerDay * 5; t++) stepWorld(world, config);
      expect(world.holes[0]!.population.count, level).toBeGreaterThan(0);
    }
  });

  it("is saved with the game, and loading brings it back", () => {
    const hard = deserialize(serialize(createWorld(config, 3, "hard")));
    expect(hard.ok && hard.world.difficulty).toBe("hard");
    // Older saves have none: normal.
    const normal = deserialize(serialize(createWorld(config, 3)));
    expect(normal.ok && normal.world.difficulty).toBeUndefined();
  });

  it("the host makes a new game at the level asked for and tells the views", () => {
    const replies: FromWorker[] = [];
    const host = createSimHost((m) => replies.push(m));
    host.onMessage({ type: "newGame", id: 1, difficulty: "hard" });
    expect(currentDifficulty()).toBe("hard");
    const snap = replies.filter((m) => m.type === "snapshot").at(-1);
    expect(snap?.type === "snapshot" && snap.snapshot.difficulty).toBe("hard");
    host.onMessage({ type: "save", id: 2 });
    const saved = replies.find((m) => m.type === "saved");
    host.onMessage({ type: "newGame", id: 3 });
    expect(currentDifficulty()).toBe("normal");
    host.onMessage({ type: "load", id: 4, data: saved?.type === "saved" ? saved.data : "" });
    expect(currentDifficulty()).toBe("hard");
  });
});

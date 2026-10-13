import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { setAdults } from "../src/sim/people";
import { createInitialState } from "../src/sim/state";
import { deserialize, FAILED_SAVE, serialize, summarize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import type { HoleSummary } from "../src/sim/snapshot";
import { nextFailureCard } from "../src/view/failure";

// T-162: a hole fails when it stays empty; the game is over when every hole has.

const emptyTicks = config.failure.emptyDays * config.ticksPerDay;
const run = (w: ReturnType<typeof createWorld>, n: number) => {
  for (let i = 0; i < n; i++) stepWorld(w, config);
};

function twoHoles() {
  const w = createWorld(config);
  const second = createInitialState(config, { holeId: 2, name: "Gale", site: { lat: 0, lon: 10 }, deposits: [], seed: 7 });
  w.holes.push(second);
  w.nextHoleId = 3;
  return w;
}

describe("a hole failing", () => {
  it("doesn't fail on a short dip to nobody", () => {
    const w = createWorld(config);
    const hole = w.holes[0]!;
    run(w, 5);
    setAdults(hole, 0, config);
    run(w, emptyTicks - 5);
    setAdults(hole, 3, config);
    run(w, emptyTicks);
    expect(hole.failed).toBeUndefined();
    expect(hole.emptySince).toBeUndefined();
  });

  it("fails once it stays empty, remembering its peak, and the game ends with its last hole", () => {
    const w = createWorld(config);
    const hole = w.holes[0]!;
    run(w, 10);
    const peak = hole.population.count;
    setAdults(hole, 0, config);
    run(w, emptyTicks + 1);
    expect(hole.failed).toMatchObject({ peak });
    expect(hole.messages.at(-1)?.text).toMatch(/Bradbury has failed/);
    expect(w.over).toBeDefined();
    // Time stops.
    const tick = w.tick;
    run(w, 10);
    expect(w.tick).toBe(tick);
  });

  it("loses one hole while the others go on", () => {
    const w = twoHoles();
    setAdults(w.holes[1]!, 0, config);
    run(w, emptyTicks + 1);
    expect(w.holes[1]!.failed).toBeDefined();
    expect(w.holes[0]!.failed).toBeUndefined();
    expect(w.over).toBeUndefined();
    setAdults(w.holes[0]!, 0, config);
    run(w, emptyTicks + 1);
    expect(w.over).toBeDefined();
  });

  it("keeps a failed game's save, marked failed, but won't load it to play on", () => {
    const w = createWorld(config);
    setAdults(w.holes[0]!, 0, config);
    run(w, emptyTicks + 1);
    expect(summarize(w, config).failed).toBe(true);
    expect(deserialize(serialize(w))).toEqual({ ok: false, reason: FAILED_SAVE });
    expect(summarize(createWorld(config), config).failed).toBeUndefined();
  });
});

describe("the failure cards", () => {
  const hole = (id: number, name: string, failed?: HoleSummary["failed"]) => ({ id, name, failed }) as HoleSummary;

  it("show a lost hole once, then the game-over card when every hole has failed", () => {
    const holes = [hole(1, "Bradbury"), hole(2, "Gale", { days: 30, peak: 42 })];
    const lost = nextFailureCard(holes, false, new Set())!;
    expect(lost).toMatchObject({ kind: "lost", holeId: 2, title: "Gale has failed", button: "Carry on" });
    expect(lost.paragraphs[1]!.join("")).toBe("It lasted 2 years 6 months, and at its peak 42 people lived there.");
    expect(nextFailureCard(holes, false, new Set([2]))).toBeNull();

    const over = nextFailureCard([hole(1, "Bradbury", { days: 14, peak: 31 }), holes[1]!], true, new Set([2]))!;
    expect(over).toMatchObject({ kind: "over", title: "The colony has failed", button: "Back to the start screen" });
    expect(over.paragraphs.map((p) => p.join("")).join(" ")).toMatch(/Bradbury lasted 1 year 2 months, with 31 people at its peak/);
  });

  it("names the hole when it was the only one", () => {
    const over = nextFailureCard([hole(1, "Bradbury", { days: 5, peak: 20 })], true, new Set())!;
    expect(over.title).toBe("Bradbury has failed");
  });
});

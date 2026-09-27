import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { culture, cultureGap, cultureTarget, loadFactor, relation, stepCulture, tier } from "../src/sim/culture";
import { travelTicks } from "../src/sim/founding";
import { record } from "../src/sim/ledger";
import { addRoute } from "../src/sim/rovers";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { twoHoles } from "./worlds";

const day = config.ticksPerDay;

describe("culture targets", () => {
  it("full employment pulls toward Work, idleness toward Leisure", () => {
    const h = createWorld(config).holes[0]!;
    h.workforce = { total: 20, employed: 20 };
    expect(cultureTarget(h, config).work).toBeLessThan(-0.5);
    h.workforce = { total: 20, employed: 0 };
    expect(cultureTarget(h, config).work).toBeGreaterThan(0.5);
  });

  it("ordinances push their way", () => {
    const h = createWorld(config).holes[0]!;
    const free = cultureTarget(h, config).order;
    h.ordinances = ["water_rationing", "ration_cards"];
    expect(cultureTarget(h, config).order).toBeCloseTo(free - 0.8);
  });

  it("living on Earth's drops feels Earthly; making your own feels Martian", () => {
    const h = createWorld(config).holes[0]!;
    record(h, "metal", "in", "Earth drops", 50);
    expect(cultureTarget(h, config).identity).toBeCloseTo(-culture.target.identitySpan);
    h.ledger.current = {};
    record(h, "metal", "in", "Smelter", 50);
    expect(cultureTarget(h, config).identity).toBeCloseTo(culture.target.identitySpan);
  });

  it("trading by rover opens a hole up; none leaves it insular", () => {
    const h = createWorld(config).holes[0]!;
    record(h, "metal", "in", "Smelter", 50);
    expect(cultureTarget(h, config).openness).toBeCloseTo(culture.target.insularBase);
    record(h, "metal", "out", "Rover to Gale", 50);
    expect(cultureTarget(h, config).openness).toBeLessThan(-0.5);
  });
});

describe("drift", () => {
  it("turns slowly toward the target, like a big ship", () => {
    const w = createWorld(config);
    const h = w.holes[0]!;
    h.ordinances = ["water_rationing", "ration_cards"];
    const start = h.culture.order;
    const target = cultureTarget(h, config).order;
    stepCulture(w, config);
    const moved = h.culture.order - start;
    expect(Math.sign(moved)).toBe(Math.sign(target - start));
    expect(Math.abs(moved)).toBeCloseTo(Math.abs(target - start) * culture.driftPerDay);
  });
});

describe("a new hole", () => {
  it("brings its parent's culture, and they start fond of each other", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    expect(gale!.parentHoleId).toBe(home!.holeId);
    expect(cultureGap(home!.culture, gale!.culture)).toBeLessThan(0.1);
    expect(tier(relation(w, gale!.holeId, home!.holeId).opinion)).toBe("Friendly");
    expect(relation(w, home!.holeId, gale!.holeId).opinion).toBeGreaterThan(0);
  });
});

describe("opinion", () => {
  it("rises toward a hole that gives more than it gets, and falls the other way (after the child's grace)", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    w.relations = {};
    gale!.foundedTick = -1e9; // grown up: no grace
    relation(w, home!.holeId, gale!.holeId).given = 200;
    stepCulture(w, config);
    expect(relation(w, gale!.holeId, home!.holeId).opinion).toBeGreaterThan(2);
    expect(relation(w, home!.holeId, gale!.holeId).opinion).toBeLessThan(-2);
  });

  it("doesn't hold early aid against a young child", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    w.relations = {};
    relation(w, home!.holeId, gale!.holeId).given = 200;
    stepCulture(w, config);
    expect(relation(w, home!.holeId, gale!.holeId).opinion).toBeGreaterThanOrEqual(0);
  });

  it("sours between holes that live very differently, and heals toward neutral", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    w.relations = {};
    home!.culture = { work: -1, order: -1, identity: -1, openness: -1 };
    gale!.culture = { work: 1, order: 1, identity: 1, openness: 1 };
    stepCulture(w, config);
    expect(relation(w, home!.holeId, gale!.holeId).opinion).toBeLessThan(-5);
    gale!.culture = { ...home!.culture };
    const r = relation(w, home!.holeId, gale!.holeId);
    r.opinion = -50;
    stepCulture(w, config);
    expect(r.opinion).toBeGreaterThan(-50);
  });

  it("announces a change of heart", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    relation(w, gale!.holeId, home!.holeId).opinion = 20.5;
    home!.culture = { work: -1, order: -1, identity: -1, openness: -1 };
    gale!.culture = { work: 1, order: 1, identity: 1, openness: 1 };
    stepCulture(w, config);
    expect(gale!.messages.at(-1)?.text).toMatch(/Gale now feels neutral toward Bradbury/);
  });
});

describe("opinion and trade", () => {
  it("friends load more, the wary less, and the hostile not at all", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    const r = relation(w, home!.holeId, gale!.holeId);
    r.opinion = 80;
    expect(loadFactor(w, home!, gale!)).toBeCloseTo(1.2);
    r.opinion = -40;
    expect(loadFactor(w, home!, gale!)).toBeCloseTo(0.9);
    r.opinion = -80;
    expect(loadFactor(w, home!, gale!)).toBe(0);
    addRoute(w, home!.holeId, gale!.holeId, "metal", 20);
    home!.culture = { work: -1, order: -1, identity: -1, openness: -1 };
    gale!.culture = { work: 1, order: 1, identity: 1, openness: 1 };
    for (let i = 0; i < 10; i++) stepWorld(w, config);
    expect(w.routes[0]!.phase).toBe("loading");
  });

  it("deliveries are remembered and pull the two cultures together", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    home!.culture = { work: -1, order: -1, identity: -1, openness: -1 };
    gale!.culture = { work: 1, order: 1, identity: 1, openness: 1 };
    addRoute(w, home!.holeId, gale!.holeId, "metal", 20);
    const gap = cultureGap(home!.culture, gale!.culture);
    const leg = travelTicks(home!.site!, gale!.site!, config);
    for (let i = 0; i < leg + 2; i++) stepWorld(w, config);
    expect(cultureGap(home!.culture, gale!.culture)).toBeLessThan(gap);
    expect(relation(w, home!.holeId, gale!.holeId).given).toBeGreaterThan(0);
  });

  it("culture and opinion survive a save", () => {
    const w = twoHoles();
    for (let i = 0; i < 2 * day; i++) stepWorld(w, config);
    const loaded = deserialize(serialize(w));
    expect(loaded.ok && loaded.world.relations).toEqual(w.relations);
    expect(loaded.ok && loaded.world.holes[1]!.culture).toEqual(w.holes[1]!.culture);
  });
});

import { describe, expect, it } from "vitest";
import raw from "../data/newsletter.json";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { newsBuilt, newsOutcome, stepNewsletter } from "../src/sim/newsletter";
import { deserialize, serialize } from "../src/sim/save";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";
import { unreadIssue, writeNewsletter } from "../src/view/newsletter";

// #424: The Hole Truth, a monthly newsletter from the month's facts.

const day = config.ticksPerDay;

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  return s;
}

/** Run the newsletter alone through to the next month's turn. */
function turnMonth(s: SimState): void {
  const start = s.newsletter?.next ?? 1;
  for (let i = 0; i < day + 1 && (s.newsletter?.next ?? 1) === start; i++) {
    s.tick += 1;
    stepNewsletter(s, config);
  }
}

describe("newsletter", () => {
  it("starts counting at the first tick and publishes an issue when the month turns", () => {
    const s = hole();
    stepNewsletter(s, config);
    expect(s.newsletter?.issues).toEqual([]);
    turnMonth(s);
    expect(s.newsletter!.issues).toHaveLength(1);
    expect(s.newsletter!.issues[0]!.no).toBe(1);
  });

  it("reports what happened in the month: births, rooms, outcomes", () => {
    const s = hole();
    stepNewsletter(s, config);
    s.population.born = 1;
    newsBuilt(s, "galley");
    newsBuilt(s, "galley");
    newsOutcome(s, "The crew of the Dawn Treader are safe.");
    turnMonth(s);
    const i = s.newsletter!.issues[0]!;
    expect(i.born).toBe(1);
    expect(i.bornEver).toBe(1);
    expect(i.built).toEqual({ galley: 2 });
    expect(i.outcomes).toEqual(["The crew of the Dawn Treader are safe."]);
    const n = writeNewsletter(i);
    // The first birth leads, with a named baby.
    expect(n.lead.kicker).toBe(raw.stories.firstBirth.kicker);
    expect(n.lead.text).not.toMatch(/\{\w+\}/);
    expect(n.stories.some((st) => st.text.includes("galleys"))).toBe(true);
    expect(n.stories.some((st) => st.text === "The crew of the Dawn Treader are safe.")).toBe(true);
  });

  it("a quiet month still has a story", () => {
    const s = hole();
    stepNewsletter(s, config);
    turnMonth(s);
    const n = writeNewsletter(s.newsletter!.issues[0]!);
    expect(n.lead.text.length).toBeGreaterThan(0);
    expect(n.name).toBe("The Hole Truth");
  });

  it("reads the same every time, and fills every placeholder", () => {
    const s = hole();
    stepNewsletter(s, config);
    for (let m = 0; m < 6; m++) {
      s.population.born = (s.population.born ?? 0) + m;
      s.population.passedAway = (s.population.passedAway ?? 0) + (m % 2);
      if (m === 3) s.newsletter!.mark.arrivals = 4;
      turnMonth(s);
    }
    for (const i of s.newsletter!.issues) {
      const a = writeNewsletter(i);
      expect(writeNewsletter(i)).toEqual(a);
      const all = [a.lead, ...a.stories].map((x) => x.head + x.text).join(" ") + a.letters.map((l) => l.intro + l.quote).join(" ") + a.notices.join(" ") + a.fluff.map((x) => x.head + x.text).join(" ");
      expect(all).not.toMatch(/\{\w+\}/);
    }
  });

  it("a quiet month that's a hard one doesn't pretend all's well", () => {
    const n = writeNewsletter({ ...blank(), health: 10 });
    expect(raw.stories.quiet.rough).toContain(n.lead.text);
  });

  it("has fun sections too: the neighbour of the month, and more on a quiet month, all filled in", () => {
    const featured = { name: "Mei Tanaka", role: "scientist", traits: ["Cautious", "Martian-born"] };
    const busy = writeNewsletter({ ...blank(), born: 2, bornEver: 5, featured });
    expect(busy.fluff[0]!.kicker).toBe(raw.fluff.profile.kicker);
    expect(busy.fluff[0]!.text).toContain(raw.fluff.profile.traits.Cautious);
    expect(busy.fluff).toHaveLength(1 + raw.fluffPerIssue);
    const quiet = writeNewsletter({ ...blank(), featured });
    expect(quiet.fluff).toHaveLength(1 + raw.fluffQuiet);
    expect(new Set(quiet.fluff.map((f) => f.kicker)).size).toBe(quiet.fluff.length);
    expect(quiet.notices).toHaveLength(raw.notices);
    // Many seeds: every section and notice comes up, with nothing left unfilled.
    const seen = new Set<string>();
    for (let seed = 1; seed < 400; seed++) {
      const n = writeNewsletter({ ...blank(), seed, featured });
      for (const f of n.fluff) {
        seen.add(f.kicker);
        expect(f.text).not.toMatch(/\{\w+\}/);
      }
    }
    expect(seen.size).toBe(Object.keys(raw.fluff).length);
  });

  it("every grumble and praise template fills", () => {
    for (const cause of Object.keys(raw.grumble.causes)) {
      const issue = { ...blank(), grumble: { name: "Ana Ruiz", role: "worker", trait: "Hothead", cause: `happiness:${cause}` } };
      const n = writeNewsletter(issue);
      expect(n.letters[0]!.intro).toContain("Ana Ruiz");
      expect(n.letters[0]!.quote).toBe(raw.grumble.causes[cause as keyof typeof raw.grumble.causes][0]);
    }
  });

  it("keeps a limited run of back issues, and the read mark survives a save", () => {
    const w = createWorld(config, 42);
    const s = w.holes[0]!;
    s.drill.active = false;
    stepNewsletter(s, config);
    for (let m = 0; m < raw.keep + 3; m++) turnMonth(s);
    expect(s.newsletter!.issues).toHaveLength(raw.keep);
    expect(s.newsletter!.issues.at(-1)!.no).toBe(raw.keep + 3);
    expect(unreadIssue(makeSnapshot(s, config))?.no).toBe(raw.keep + 3);
    applyCommand(s, { type: "readNewsletter", no: raw.keep + 3 });
    const back = deserialize(serialize(w));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(unreadIssue(makeSnapshot(back.world.holes[0]!, config))).toBeNull();
  });

  it("runs as part of the sim's tick", () => {
    const s = hole();
    for (let t = 0; t < day * 3; t++) step(s, config);
    expect(s.newsletter!.issues.length).toBeGreaterThanOrEqual(2);
  });
});

function blank() {
  return {
    no: 1, day: 3, hole: "Bradbury", seed: 42, population: 10, change: 0, happiness: 60, health: 100,
    born: 0, bornEver: 0, passedAway: 0, grownUp: 0, arrivals: 0, built: {}, floors: 0, depth: 3,
    finds: [], milestones: [], festival: false, storm: false, outcomes: [], newNotables: [], grumble: null, praise: null,
  };
}

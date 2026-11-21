import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { peoplePage, personView, PAGE_SIZE } from "../src/sim/personView";
import { addPeopleAt } from "../src/sim/people";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { personCard } from "../src/view/personCard";

// One person at a time (#528): their card and the people list, asked of the worker, never in the snapshot.

function grown() {
  const s = createInitialState(config);
  s.drill.active = false;
  for (let i = 0; i < 2 * config.ticksPerDay; i++) step(s, config);
  return s;
}

describe("a person's card", () => {
  it("names who they are, where they sleep and work, and their family here", () => {
    const s = grown();
    const c = s.colonists!;
    const i = c.partner.findIndex((p) => p >= 0);
    const p = personView(s, config, c.id[i]!)!;
    expect(p.name).toMatch(/^\S+ \S+$/);
    expect(p.age).toBeGreaterThanOrEqual(20);
    expect(p.stage).toBe("adult");
    expect(p.traits).toHaveLength(2);
    expect(p.home?.name).toMatch(/\(F\d\)|\(surface\)/);
    expect(p.family.find((f) => f.relation === "partner")?.id).toBe(c.partner[i]);
    const card = personCard(p);
    expect(card.facts.map((f) => f.label)).toEqual(["Home", "Work", "Walks", "Traits", "Happiness"]);
    expect(card.family[0]!.text).toMatch(/partner$/);
    expect(card.needs).toHaveLength(3);
  });

  it("is null for someone who isn't here", () => {
    expect(personView(grown(), config, 999)).toBeNull();
  });
});

describe("the people list", () => {
  it("pages, filters, searches and sorts", () => {
    const s = grown();
    addPeopleAt(s, "child", 70, config, 1e9);
    const all = peoplePage(s, config, { sort: "happiness", filter: "all", search: "", offset: 0 });
    expect(all.total).toBe(s.population.count);
    expect(all.rows).toHaveLength(Math.min(PAGE_SIZE, all.total));
    for (let k = 1; k < all.rows.length; k++) expect(all.rows[k]!.happiness).toBeGreaterThanOrEqual(all.rows[k - 1]!.happiness);
    const next = peoplePage(s, config, { sort: "happiness", filter: "all", search: "", offset: PAGE_SIZE });
    expect(next.rows[0]!.id).not.toBe(all.rows[0]!.id);
    const kids = peoplePage(s, config, { sort: "age", filter: "children", search: "", offset: 0 });
    expect(kids.total).toBe(70);
    const name = all.rows[0]!.name.split(" ")[1]!.toLowerCase();
    const found = peoplePage(s, config, { sort: "name", filter: "all", search: name, offset: 0 });
    expect(found.rows.every((r) => r.name.toLowerCase().includes(name))).toBe(true);
  });

  it("the walkers are real people, at most 60, and the same all day", () => {
    const s = grown();
    const ids = makeSnapshot(s, config).walkers;
    expect(ids.length).toBe(Math.min(60, s.population.count));
    for (const id of ids) expect(s.colonists!.id).toContain(id);
    step(s, config);
    expect(makeSnapshot(s, config).walkers).toEqual(ids);
  });
});

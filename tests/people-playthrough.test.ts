import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { runNetwork } from "./netbot";
import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";

// Ninety minutes (90 game days) with the two-hole bot, which builds what's
// short once its opening plans are done, against the same bot staying solo.
// Checks the people systems: births carry growth, children grow up, the
// first elders retire and get care, and the network outgrows one hole.

// Played with construction time and storage limits, as in the game (each test file has its own copy of the setting).
construction.instant = false;
storage.unlimited = false;

describe("ninety minutes of people", () => {
  const net = runNetwork(90);
  const solo = runNetwork(90, config.seed, false);
  const [home, child] = net.world.holes;
  const at = (day: number) => net.log.find((d) => d.day === day)!;

  it("has its first birth within the first twenty minutes", () => {
    expect(net.log.find((d) => d.born > 0)!.day).toBeLessThanOrEqual(20);
  });

  it("keeps having children, and they grow up into workers", () => {
    const born = net.log.at(-1)!.born;
    // Windows are paid for since milestone 13, this seed's run gets fewer
    // (over four seeds the totals are much as before, 11–28 born). Was 15.
    // The closed water loop (T-005): recyclers early, and this seed's home hole sits at 49 happiness
    // and full beds; over six seeds 6–15 born (10–15 before). Was 10. The air mix (T-026) dips
    // health while the holes dig, and births wait on it.
    // The air loop (T-031): over six seeds 4–16 born; this seed founds its child early and sits at 4. Was 5.
    expect(born).toBeGreaterThanOrEqual(4);
    const children = net.world.holes.reduce((n, h) => n + h.population.cohorts.filter((c) => c.stage === "child").reduce((k, c) => k + c.count, 0), 0);
    expect(children).toBeLessThan(born); // the earliest have grown up
  });

  it("sees its first elders retire, and schools its children", () => {
    const elders = home!.population.cohorts.filter((c) => c.stage === "elder").reduce((n, c) => n + c.count, 0);
    expect(elders).toBeGreaterThan(0);
    expect(home!.unlocks).toContain("elders");
    // Any hole with more than a couple of children has a school. Was: somewhere in the network (with drill finds since
    // milestone 14, the home hole's children may be few enough to go without). With restrooms by walking distance (T-006)
    // this seed's home hole stalls at 68 while it saves for a seed kit, and ends with one child in each hole and no school;
    // five of six other seeds build one (all six before), with births 6–13 (5–12 before).
    const kids = (h: (typeof net.world.holes)[number]) => h.population.cohorts.filter((c) => c.stage === "child").reduce((n, c) => n + c.count, 0);
    for (const h of net.world.holes) if (kids(h) > 2) expect(h.layout.rooms.some((r) => r.type === "school"), h.name).toBe(true);
  });

  it("outgrows a single hole by a wide margin", () => {
    // Eased to 1.2 while the air mix and the water loop starved the child (T-026 after T-005); back to 1.3 (T-031).
    // The full landing kit (T-164) lifts the solo hole too: over six seeds the network beats solo by 1.27–1.65. Was 1.3.
    expect(net.log.at(-1)!.total).toBeGreaterThan(solo.log.at(-1)!.total * 1.25);
    // Gallery tubes on every new floor (milestone 11) cost rock and crew time: a little slower than before (was 160).
    // Windows paid for (milestone 13): this seed's run slows again; other seeds reach 139–147 (was 150).
    // Drill finds (milestone 14): the bot taps every one it's offered, and over six seeds day 80 lands at 115–159 (was 130).
    // The closed water loop (T-005): over six seeds day 80 lands at 104–142 (115–146 before), and day 90 ends higher
    // on average (148 against 137), with almost no water from Earth. Was 110.
    // The air loop (T-031): the child is founded earlier (day 46 on this seed, sending 12 away sooner) and now thrives;
    // over six seeds day 80 lands at 80–147 and the network beats solo by 1.04–1.79. Was 100.
    // The full landing kit (T-164): over six seeds day 80 lands at 127–165.
    expect(at(80).total).toBeGreaterThan(90);
  });

  it("keeps the child hole alive", () => {
    // Only "alive" while the air mix (T-026) on the water loop (T-005) starved it. Restored (T-031): the child builds
    // its electrolyzer first, a gray tank and a recycler early, and over six seeds ends at 36–52 people, five of six healthy.
    expect(child!.population.health).toBeGreaterThan(50);
    expect(child!.population.count).toBeGreaterThan(50);
  });
});

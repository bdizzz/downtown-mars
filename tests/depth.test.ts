import { describe, expect, it } from "vitest";
import raw from "../data/events.json";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { canDig, stepDigging, ticksToDig } from "../src/sim/digging";
import { depthData, depthOf, drillStopped, isCapped, repairCost, rollDepth, scrapReturn } from "../src/sim/depth";
import { eventsOf, NEVER, stepEvents } from "../src/sim/events";
import { kitGoods } from "../src/sim/founding";
import { hasReached, trackNetworkMilestones } from "../src/sim/milestones";
import { network } from "../src/sim/network";
import { holeGates } from "../src/sim/people";
import { deserialize, serialize } from "../src/sim/save";
import { makeSnapshot as snapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { createWorld } from "../src/sim/world";

// #390: every hole's hidden depth. Soft limits on the way down, a hard floor at the bottom.

const day = config.ticksPerDay;

/** A fresh hole whose limits are these (shallowest first; the last is the hard one). */
function hole(limits: { floor: number; event: string; soft: boolean; lead?: number }[] = [], stock = 500): SimState {
  const s = createInitialState(config);
  for (const id of ["machinery", "metal", "electronics", "meals"]) s.resources[id] = stock;
  if (limits.length) s.depth = { limits: limits.map((l) => ({ lead: 1, ...l })) };
  eventsOf(s).found.push("first"); // past the first floor's sure find
  return s;
}

/** Finish the floor the drill is on. Discoveries are cleared away; limit cards stay. */
function digFloor(s: SimState): void {
  s.drill.progress = ticksToDig(s.layout.hole.floors + 1, config) - 0.5;
  stepDigging(s, config);
  const ev = eventsOf(s);
  ev.pending = ev.pending.filter((e) => e.kind === "capping" || (raw.events.find((d) => d.id === e.kind) as { limit?: string } | undefined)?.limit);
}

/** Dig until the drill stops (or the floor count is reached). */
function digTo(s: SimState, floors = 99): void {
  while (s.layout.hole.floors < floors && canDig(s, config)) digFloor(s);
}

const pending = (s: SimState) => eventsOf(s).pending;
const answer = (s: SimState, kind: string, choice: string) =>
  applyCommand(s, { type: "answerEvent", eventId: pending(s).find((e) => e.kind === kind)!.id, choice });

describe("rolling the limits", () => {
  it("rolls a hard limit of 5 to 20 floors, the first hole at least 8, with one or two soft limits above it", () => {
    const softs = new Set<number>();
    for (let seed = 1; seed < 400; seed++) {
      for (const holeId of [1, 2, 7]) {
        const d = rollDepth(seed, holeId, [], 1, config);
        const hard = d.limits.at(-1)!;
        expect(hard.soft).toBe(false);
        expect(hard.floor).toBeGreaterThanOrEqual(holeId === 1 ? depthData.firstHoleMin : depthData.hard[0]);
        expect(hard.floor).toBeLessThanOrEqual(depthData.hard[1]);
        const soft = d.limits.filter((l) => l.soft);
        expect(soft.length).toBeGreaterThanOrEqual(1);
        expect(soft.length).toBeLessThanOrEqual(2);
        softs.add(soft.length);
        for (const l of soft) {
          expect(l.floor).toBeGreaterThanOrEqual(depthData.softMin);
          expect(l.floor).toBeLessThan(hard.floor);
        }
        // Shallowest first, all different, and every omen comes after floor 1.
        expect(d.limits.map((l) => l.floor)).toEqual([...new Set(d.limits.map((l) => l.floor))].sort((a, b) => a - b));
        for (const l of d.limits) expect(l.floor - l.lead).toBeGreaterThanOrEqual(2);
      }
    }
    expect(softs).toEqual(new Set([1, 2]));
  });

  it("is the same for the same seed, and every hole has its own", () => {
    expect(rollDepth(9, 2, [], 1, config)).toEqual(rollDepth(9, 2, [], 1, config));
    const hards = new Set(Array.from({ length: 30 }, (_, i) => rollDepth(9, i + 2, [], 1, config).limits.at(-1)!.floor));
    expect(hards.size).toBeGreaterThan(5);
  });

  it("a new game's first hole has its limits, kept in the save and left out of the snapshot", () => {
    const world = createWorld(config, 77);
    const h = world.holes[0]!;
    expect(h.depth!.limits.at(-1)!.floor).toBeGreaterThanOrEqual(8);
    const back = deserialize(serialize(world));
    expect(back.ok && back.world.holes[0]!.depth).toEqual(h.depth);
    const snap = JSON.stringify(snapshot(h, config));
    expect(snap).not.toContain('"limits"');
    expect(snap).not.toContain(`"hard"`);
  });

  it("an older save rolls its limits on load, all below what it's dug", () => {
    const s = createInitialState(config);
    s.depth = undefined;
    s.layout.hole.floors = 14;
    const d = depthOf(s, config);
    for (const l of d.limits) expect(l.floor).toBeGreaterThan(14);
    expect(d.limits.at(-1)!.soft).toBe(false);
  });
});

describe("soft limits", () => {
  it("the drill digs the limit's floor, then stops, and the card waits with no timer", () => {
    const s = hole([{ floor: 4, event: "drill_breakdown", soft: true }, { floor: 9, event: "fault_line", soft: false }]);
    digTo(s);
    expect(s.layout.hole.floors).toBe(4);
    expect(drillStopped(s)).toBe("held");
    expect(canDig(s, config)).toBe(false);
    const card = pending(s).find((e) => e.kind === "drill_breakdown")!;
    expect(card.expiresTick).toBe(NEVER);
    // Months go by: the card's still there, and the drill hasn't moved.
    for (let t = 0; t < 30 * day; t += 10) {
      s.tick += 10;
      stepEvents(s, config);
    }
    expect(pending(s).some((e) => e.kind === "drill_breakdown")).toBe(true);
    expect(s.layout.hole.floors).toBe(4);
    expect(snapshot(s, config).events.pending.find((e) => e.kind === "drill_breakdown")!.waits).toBe(true);
  });

  it("paying the repair digs on past it, to the next limit", () => {
    const s = hole([{ floor: 4, event: "hard_basalt", soft: true }, { floor: 7, event: "fault_line", soft: false }]);
    digTo(s);
    const metal = s.resources.metal!;
    expect(answer(s, "hard_basalt", "go").ok).toBe(true);
    expect(s.resources.metal).toBe(metal - repairCost().metal!);
    expect(drillStopped(s)).toBeNull();
    digTo(s);
    expect(s.layout.hole.floors).toBe(7);
    expect(pending(s).some((e) => e.kind === "fault_line")).toBe(true);
  });

  it("the repair costs about a quarter of the drill, and can't be picked without it", () => {
    for (const [id, v] of Object.entries(depthData.drill)) expect(repairCost()[id]).toBe(Math.ceil(v * depthData.repairShare));
    const s = hole([{ floor: 3, event: "groundwater", soft: true }, { floor: 6, event: "fault_line", soft: false }], 0);
    digTo(s);
    const card = snapshot(s, config).events.pending.find((e) => e.kind === "groundwater")!;
    expect(card.choices.find((c) => c.id === "go")!.refusal).toMatch(/Needs/);
    expect(card.choices.find((c) => c.id === "go")!.hint).toContain(`${repairCost().metal} metal`);
    expect(answer(s, "groundwater", "go").ok).toBe(false);
    expect(drillStopped(s)).toBe("held");
  });

  it("stopping scraps the drill for half its materials and caps the hole for good", () => {
    const s = hole([{ floor: 3, event: "tremors", soft: true }, { floor: 8, event: "fault_line", soft: false }]);
    digTo(s);
    const metal = s.resources.metal!;
    expect(answer(s, "tremors", "scrap").ok).toBe(true);
    expect(s.resources.metal).toBe(metal + scrapReturn().metal!);
    expect(scrapReturn().metal).toBe(Math.floor(depthData.drill.metal! * depthData.scrapShare));
    expect(isCapped(s)).toBe(true);
    expect(s.depth!.capped).toMatchObject({ floors: 3, ending: "tremors" });
    // Never again.
    expect(applyCommand(s, { type: "setDrill", active: true }).ok).toBe(false);
    digTo(s);
    expect(s.layout.hole.floors).toBe(3);
    expect(applyCommand(s, { type: "stopDrilling" }).ok).toBe(false);
  });
});

describe("the hard limit", () => {
  it("the drill can't go past it, and the place gives the reason", () => {
    const s = hole([{ floor: 5, event: "deep_reservoir", soft: false }]);
    s.deposits = s.deposits.filter((d) => d !== "aquifer");
    digTo(s);
    expect(s.layout.hole.floors).toBe(5);
    expect(drillStopped(s)).toBe("held");
    expect(answer(s, "deep_reservoir", "repurpose").ok).toBe(true);
    expect(s.deposits).toContain("aquifer");
    expect(isCapped(s)).toBe(true);
    expect(snapshot(s, config).drill.capped!.name).toBe("the reservoir hole");
  });

  it("the geothermal pocket unlocks the geothermal plant, and it's the only way to", () => {
    const s = hole([{ floor: 4, event: "geothermal_pocket", soft: false }]);
    expect(holeGates(s)).not.toContain("geothermal");
    digTo(s);
    expect(answer(s, "geothermal_pocket", "repurpose").ok).toBe(true);
    expect(holeGates(s)).toContain("geothermal");
    const unlocking = (raw.events as { id: string; choices: { unlock?: string }[] }[]).filter((e) => e.choices.some((c) => c.unlock === "geothermal"));
    expect(unlocking.map((e) => e.id)).toEqual(["geothermal_pocket"]);
  });

  it("an old magma chamber opens a cavern to build in; deconstructing gives half the drill back", () => {
    const s = hole([{ floor: 4, event: "magma_chamber", soft: false }]);
    digTo(s);
    const card = pending(s).find((e) => e.kind === "magma_chamber")!;
    expect(card.cells).toHaveLength(depthData.magmaCells);
    expect(answer(s, "magma_chamber", "repurpose").ok).toBe(true);
    expect(isCapped(s)).toBe(true);
    const t = hole([{ floor: 4, event: "brine_lake", soft: false }]);
    digTo(t);
    const machinery = t.resources.machinery!;
    expect(answer(t, "brine_lake", "scrap").ok).toBe(true);
    expect(t.resources.machinery).toBe(machinery + scrapReturn().machinery!);
  });

  it("a fault line offers nothing but the drill back", () => {
    const s = hole([{ floor: 4, event: "fault_line", soft: false }]);
    digTo(s);
    const ids = pending(s).find((e) => e.kind === "fault_line") && raw.events.find((e) => e.id === "fault_line")!.choices.map((c) => c.id);
    expect(ids).toEqual(["scrap", "crate"]);
  });
});

describe("omens", () => {
  it("come a floor or two before each limit, and never elsewhere", () => {
    const s = hole([
      { floor: 5, event: "hard_basalt", soft: true, lead: 2 },
      { floor: 9, event: "geothermal_pocket", soft: false, lead: 1 },
    ]);
    const omens = new Set(Object.values(depthData.omens).flatMap((p) => p.map((o) => o.text)));
    const seen: number[] = [];
    let at = s.messages.length;
    while (canDig(s, config) || drillStopped(s) === "held") {
      if (drillStopped(s) === "held") {
        const card = pending(s).find((e) => e.kind === "hard_basalt");
        if (!card) break;
        answer(s, "hard_basalt", "go");
      }
      digFloor(s);
      for (const m of s.messages.slice(at)) if (omens.has(m.text)) seen.push(s.layout.hole.floors);
      at = s.messages.length;
    }
    expect(seen).toEqual([3, 8]);
    expect(depthData.omens.hard_basalt!.map((o) => o.text)).toContain(s.messages.find((m) => omens.has(m.text))!.text);
  });

  it("a tremor shakes the rig and the camera", () => {
    const s = hole([{ floor: 4, event: "tremors", soft: true }, { floor: 8, event: "fault_line", soft: false }]);
    depthData.omens.tremors!.forEach((o) => expect(o.tremor).toBe(true));
    digTo(s, 3);
    const v = snapshot(s, config).drill;
    expect(v.tremorTick).not.toBeNull();
    expect(v.omenTick).toBe(v.tremorTick);
    expect(v.struckTick).toBe(v.tremorTick);
  });
});

describe("stopping by choice", () => {
  it("asks first; keeping on changes nothing, capping is for good", () => {
    const s = hole([{ floor: 9, event: "fault_line", soft: false }]);
    expect(applyCommand(s, { type: "stopDrilling" }).ok).toBe(true);
    expect(applyCommand(s, { type: "stopDrilling" }).ok).toBe(false); // one card at a time
    expect(answer(s, "stop_drilling", "keep").ok).toBe(true);
    expect(isCapped(s)).toBe(false);
    applyCommand(s, { type: "stopDrilling" });
    expect(answer(s, "stop_drilling", "scrap").ok).toBe(true);
    expect(s.depth!.capped!.ending).toBe("stopped");
    expect(snapshot(s, config).drill.stopped).toBe("capped");
  });
});

describe("the capping ceremony", () => {
  it("proposes a celebration with the plaque, and the hole takes its name from how it ended", () => {
    const s = hole([{ floor: 4, event: "geothermal_pocket", soft: false }]);
    digTo(s);
    answer(s, "geothermal_pocket", "repurpose");
    const card = pending(s).find((e) => e.kind === "capping")!;
    expect(card.title).toBe("The capping of the geothermal hole");
    expect(card.text).toContain(`${s.name}, the geothermal hole: 4 floors deep`);
    const happy = eventsOf(s).moods.length;
    expect(answer(s, "capping", "festival").ok).toBe(true);
    expect(eventsOf(s).festival).toBeDefined();
    expect(eventsOf(s).moods.length).toBeGreaterThan(happy);
  });
});

describe("a crated drill (#411)", () => {
  it("takes the drill's share off the next seed kit gathered there, once", () => {
    const s = hole([{ floor: 3, event: "hard_basalt", soft: true }, { floor: 6, event: "fault_line", soft: false }]);
    digTo(s);
    const full = kitGoods(s);
    expect(full).toEqual(network.seedKit.goods);
    answer(s, "hard_basalt", "crate");
    expect(s.depth!.crates).toBe(1);
    const less = kitGoods(s);
    for (const [id, v] of Object.entries(network.seedKit.goods)) expect(less[id] ?? 0).toBe(Math.max(0, v - (depthData.drill[id] ?? 0)));
    expect(snapshot(s, config).kit.crates).toBe(1);

  });
});

describe("holes capped milestones (#413)", () => {
  it("are reached once for the whole network, in the hole that got it there", () => {
    const a = hole();
    const b = hole();
    b.holeId = 2;
    trackNetworkMilestones([a, b], config);
    expect(hasReached(a, "holes_capped_1") || hasReached(b, "holes_capped_1")).toBe(false);
    b.depth = { limits: [], capped: { tick: 10, floors: 6, ending: "stopped" } };
    trackNetworkMilestones([a, b], config);
    expect(hasReached(b, "holes_capped_1")).toBe(true);
    expect(hasReached(a, "holes_capped_1")).toBe(false);
    a.depth = { limits: [], capped: { tick: 20, floors: 9, ending: "fault_line" } };
    trackNetworkMilestones([a, b], config);
    expect(hasReached(a, "holes_capped_1")).toBe(false); // already reached in b
    expect(hasReached(a, "holes_capped_3")).toBe(false);
  });
});

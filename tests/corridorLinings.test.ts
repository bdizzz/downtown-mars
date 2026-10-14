import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { finishAll, queueView, stepConstruction } from "../src/sim/construction";
import { finishDef } from "../src/sim/corridors";
import { galleryEdges } from "../src/sim/edges";
import { corridorRefitPlan, liningOf, wallStep } from "../src/sim/materials";
import { createInitialState, type SimState } from "../src/sim/state";
import { withConstructionTime } from "./worlds";

// Corridor linings (T-142): corridors take the same linings as rooms, refitted
// through the construction queue at a quarter of a room cell per 10 m segment.
// Marscrete joins the list, between bare rock and brick, for rooms too.

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, marscrete: 500, glass: 100, machinery: 500, electronics: 500, water: 2000, rations: 2000 });
  return s;
}

/** Two 10 m corridors through the rock of ring 2, built. */
const EDGES = ["R1.2.4", "R1.2.6"];
function withCorridors(finish = "rock"): SimState {
  const s = hole();
  const r = applyCommand(s, { type: "drawCorridors", edges: EDGES, finish });
  if (!r.ok) throw new Error(r.reason);
  finishAll(s, config);
  return s;
}
const refit = (s: SimState, edges: string[], material: string, finish = "base") => applyCommand(s, { type: "refitCorridors", edges, material, finish });
const job = (s: SimState) => s.construction?.queue.find((j) => j.kind === "reline");
function finishJob(s: SimState) {
  for (let i = 0; i < 100 * config.ticksPerDay && job(s); i++) stepConstruction(s, config);
}

describe("corridor refit pricing", () => {
  it("prices a 10 m segment as a quarter of a room cell", () => {
    const s = withCorridors();
    const brick = corridorRefitPlan(s.layout, "R1.2.4", wallStep("brick", "base"), config)!;
    // Brick 8 and 3 h a cell: brick 2 and 45 minutes a segment, as drawing one in brick costs.
    expect(brick.cost).toEqual({ brick: 2 });
    expect(brick.work).toBeCloseTo(0.75);
    expect(corridorRefitPlan(s.layout, "R1.2.4", wallStep("rock", "base"), config)).toBeNull();
  });

  it("salvages part of a drawn brick corridor's lining when it comes out", () => {
    const s = withCorridors("brick");
    const plan = corridorRefitPlan(s.layout, "R1.2.4", wallStep("metal", "base"), config)!;
    expect(plan.cost).toEqual({ metal: 1.5 });
    expect(plan.salvage).toEqual({ brick: 1 });
  });

  it("names a fine lining, and fills it in at its base finish's cost", () => {
    expect(finishDef("brick_fine")).toMatchObject({ name: "Patterned brick", cost: finishDef("brick").cost, color: finishDef("brick").color });
    expect(finishDef("marscrete_fine").name).toBe("Polished marscrete");
  });
});

describe("the refitCorridors command", () => {
  withConstructionTime();

  it("charges on commit, queues one job, and lines the corridors when done", () => {
    const s = withCorridors();
    const brick = s.resources.brick!;
    expect(refit(s, EDGES, "brick", "fine").ok).toBe(true);
    // Brick 12 a cell for patterned brick from rock: 3 a segment.
    expect(s.resources.brick).toBe(brick - 6);
    expect(s.layout.corridors["R1.2.4"]).toBe("rock");
    expect(s.layout.corridorsRelining).toMatchObject({ "R1.2.4": job(s)!.id, "R1.2.6": job(s)!.id });
    expect(queueView(s).jobs.find((j) => j.kind === "reline")).toMatchObject({ lead: "Refit", label: "Refit 2 corridor segments in patterned brick" });
    finishJob(s);
    expect(s.layout.corridors["R1.2.4"]).toBe("brick_fine");
    expect(s.layout.corridors["R1.2.6"]).toBe("brick_fine");
    expect(s.layout.corridorsRelining).toEqual({});
    expect(s.messages.at(-1)?.text).toBe("2 corridor segments refitted in patterned brick.");
  });

  it("refuses the gallery tube, segments already in it or being refitted, and what it can't afford", () => {
    const s = withCorridors();
    const tube = galleryEdges(s.layout.hole, 1)[0]!.id;
    expect(refit(s, [tube], "brick")).toEqual({ ok: false, reason: "A gallery tube is glass: it can't be lined" });
    expect(refit(s, EDGES, "rock")).toEqual({ ok: false, reason: "It's bare rock already" });
    expect(refit(s, ["R1.2.4"], "brick").ok).toBe(true);
    expect(refit(s, ["R1.2.4"], "metal")).toEqual({ ok: false, reason: "Already being refitted" });
    s.resources.metal = 1;
    expect(refit(s, ["R1.2.6"], "metal").ok).toBe(false);
  });

  it("refunds a cancelled refit, and leaves the lining", () => {
    const s = withCorridors();
    const brick = s.resources.brick!;
    refit(s, EDGES, "brick");
    expect(applyCommand(s, { type: "cancelJob", jobId: job(s)!.id }).ok).toBe(true);
    expect(s.resources.brick).toBe(brick);
    expect(s.layout.corridors["R1.2.4"]).toBe("rock");
    expect(s.layout.corridorsRelining).toEqual({});
  });

  it("drops a segment being filled in from its refit, refunding just that one", () => {
    const s = withCorridors();
    refit(s, EDGES, "brick");
    const brick = s.resources.brick!;
    expect(applyCommand(s, { type: "removeCorridors", edges: ["R1.2.4"] }).ok).toBe(true);
    expect(s.resources.brick).toBe(brick + 2);
    expect(job(s)!.edges).toEqual(["R1.2.6"]);
    expect(job(s)!.paid).toEqual({ brick: 2 });
    finishJob(s);
    expect(s.layout.corridors["R1.2.6"]).toBe("brick");
  });

  it("strips a lined corridor back to bare rock, salvaging half its brick", () => {
    const s = withCorridors("brick");
    const brick = s.resources.brick!;
    expect(refit(s, ["R1.2.4"], "rock").ok).toBe(true);
    expect(queueView(s).jobs.find((j) => j.kind === "reline")?.label).toBe("Strip 1 corridor segment back to bare rock");
    finishJob(s);
    expect(s.layout.corridors["R1.2.4"]).toBe("rock");
    expect(s.resources.brick).toBe(brick + 1);
  });
});

describe("marscrete linings", () => {
  it("sits between smoothed rock and brick, and rooms can be refitted in it", () => {
    const s = hole();
    const r = applyCommand(s, { type: "build", room: "bunk_dorm", at: { kind: "ring", floor: 1, ring: 1, slot: 3, w: 2, d: 1 } });
    if (!r.ok) throw new Error(r.reason);
    finishAll(s, config);
    const marscrete = s.resources.marscrete!;
    expect(applyCommand(s, { type: "upgradeRoom", roomId: r.roomId!, material: "marscrete", finish: "fine" }).ok).toBe(true);
    // Marscrete 12 and polished 4 more, a cell, for 2 cells.
    expect(s.resources.marscrete).toBe(marscrete - 32);
    const dorm = s.layout.rooms.find((x) => x.id === r.roomId)!;
    expect(liningOf(dorm).name).toBe("Polished marscrete");
    const comfort = (m: string, f = "base") => wallStep(m, f).comfort;
    expect(comfort("marscrete")).toBeGreaterThanOrEqual(comfort("rock", "fine"));
    expect(comfort("marscrete", "fine")).toBeLessThan(comfort("brick"));
  });
});

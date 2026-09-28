import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { corridorRefusal, corridors, routeToRoom } from "../src/sim/corridors";
import { edgeById, outsideEdges } from "../src/sim/edges";
import { computeEffects, effectAt } from "../src/sim/effects";
import { checkPlacement, type Location } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { createWorld } from "../src/sim/world";
import { allRock } from "./worlds";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function rich(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 400, brick: 200, metal: 200, marscrete: 100, machinery: 50, electronics: 50 });
  // Clear the landing kit's battery out of ring 1 so the slots are free.
  const battery = s.layout.rooms.find((r) => r.type === "battery_bank")!;
  applyCommand(s, { type: "demolish", roomId: battery.id });
  // These tests are about corridors through rock: no empty space to walk through.
  allRock(s.layout);
  return s;
}
function build(s: SimState, room: string, at: Location) {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return s.layout.rooms.find((x) => x.id === r.roomId)!;
}
const draw = (s: SimState, edges: string[], finish = "rock") => applyCommand(s, { type: "drawCorridors", edges, finish });

describe("where corridors can go", () => {
  it("along any border in the dug floors and unlocked rings, but not through the middle of a room", () => {
    const s = rich();
    build(s, "bunk_dorm", ring(1, 1, 0, 2)); // slots 0–1 of ring 1
    expect(corridorRefusal(s.layout, "R1.1.0")).toBeNull(); // dorm | rock
    expect(corridorRefusal(s.layout, "R1.1.1")).toBe("That's the middle of a room");
    expect(corridorRefusal(s.layout, "R1.1.5")).toBeNull(); // rock on both sides: fine
    expect(corridorRefusal(s.layout, "R1.4.0")).toMatch(/reinforcement/); // a locked ring
    expect(corridorRefusal(s.layout, `A1.${s.layout.hole.unlockedRings}.0/1`)).toMatch(/reinforcement/); // the edge of the unlocked rings
    expect(corridorRefusal(s.layout, "R9.1.0")).toMatch(/isn't dug/);
    draw(s, ["R1.1.0"]);
    expect(corridorRefusal(s.layout, "R1.1.0")).toBe("Already a corridor");
  });

  it("costs its finish by length, and costs the same again to fill in", () => {
    const s = rich();
    build(s, "bunk_dorm", ring(1, 1, 0, 2));
    const brick = s.resources.brick!;
    expect(draw(s, ["R1.1.0"], "brick").ok).toBe(true);
    const cost = corridors.finishes.find((f) => f.id === "brick")!.cost.brick!; // a radial edge is 10 m
    expect(s.resources.brick).toBeCloseTo(brick - cost);
    expect(s.layout.corridors["R1.1.0"]).toBe("brick");
    expect(s.ledger.current.brick?.out.Corridors).toBeCloseTo(cost);
    applyCommand(s, { type: "removeCorridors", edges: ["R1.1.0"] });
    expect(s.resources.brick).toBeCloseTo(brick - 2 * cost); // rebuilding the walls costs as much again
    expect(s.layout.corridors["R1.1.0"]).toBeUndefined();
    // And it needs the materials to do it.
    draw(s, ["R1.1.0"], "brick");
    s.resources.brick = 0;
    expect(applyCommand(s, { type: "removeCorridors", edges: ["R1.1.0"] })).toMatchObject({ ok: false, reason: expect.stringMatching(/Needs .* brick/) });
    expect(s.layout.corridors["R1.1.0"]).toBe("brick");
  });

  it("refuses what it can't afford", () => {
    const s = rich();
    build(s, "bunk_dorm", ring(1, 1, 0, 2));
    s.resources.metal = 0;
    expect(draw(s, ["R1.1.0"], "metal")).toMatchObject({ ok: false, reason: expect.stringMatching(/Needs .* metal/) });
  });
});

describe("access", () => {
  it("ring 1 rooms open onto the gallery; deeper rooms need a linked corridor", () => {
    const s = rich();
    const galley = build(s, "galley", ring(1, 1, 0));
    const dorm = build(s, "bunk_dorm", ring(1, 2, 0, 2));
    expect(galley.connected).toBe(true);
    expect(dorm.connected).toBe(false);
    // A spoke beside the galley reaches the gallery; an arc along the dorm's inner side joins it.
    draw(s, ["R1.1.0"]);
    expect(s.layout.corridorLinked?.["R1.1.0"]).toBe(true);
    const inner = outsideEdges(s.layout.hole, dorm.cells).find((e) => e.kind === "arc" && e.circle === 1 && e.a0 === 0)!;
    draw(s, [inner.id]);
    expect(s.layout.rooms.find((r) => r.id === dorm.id)!.connected).toBe(true);
  });

  it("a corridor that doesn't reach the shaft isn't linked", () => {
    const s = rich();
    const dorm = build(s, "bunk_dorm", ring(1, 2, 4, 2));
    const e = outsideEdges(s.layout.hole, dorm.cells).find((x) => x.kind === "arc" && x.circle === 2)!;
    draw(s, [e.id]);
    expect(s.layout.corridorLinked?.[e.id]).toBe(false);
    expect(s.layout.rooms.find((r) => r.id === dorm.id)!.connected).toBe(false);
  });

  it("removing a corridor strands what was behind it", () => {
    const s = rich();
    build(s, "galley", ring(1, 1, 0));
    const dorm = build(s, "bunk_dorm", ring(1, 2, 0, 2));
    expect(applyCommand(s, { type: "connectRoom", roomId: dorm.id, finish: "rock" }).ok).toBe(true);
    expect(s.layout.rooms.find((r) => r.id === dorm.id)!.connected).toBe(true);
    applyCommand(s, { type: "removeCorridors", edges: Object.keys(s.layout.corridors) });
    expect(s.layout.rooms.find((r) => r.id === dorm.id)!.connected).toBe(false);
  });

  it("a public room counts every side as a corridor", () => {
    const s = rich();
    build(s, "small_plaza", ring(1, 1, 0, 2));
    const dorm = build(s, "bunk_dorm", ring(1, 2, 0, 2)); // right behind the plaza
    expect(dorm.connected).toBe(true);
    expect(Object.keys(s.layout.corridors)).toHaveLength(0);
  });

  it("corridors on the floor being dug don't link until it's dug", () => {
    const s = rich();
    const f = s.layout.hole.floors + 1;
    build(s, "galley", ring(f, 1, 0));
    draw(s, [`R${f}.1.0`]);
    expect(s.layout.corridorLinked?.[`R${f}.1.0`]).toBe(false);
  });
});

describe("connecting a room", () => {
  it("finds the shortest route along rooms and draws it", () => {
    const s = rich();
    build(s, "galley", ring(1, 1, 0));
    build(s, "restroom", ring(1, 1, 1));
    const ls = build(s, "life_support", ring(1, 2, 0, 4));
    const route = routeToRoom(s.layout, ls, config)!;
    expect(route.length).toBeGreaterThan(0);
    expect(route.length).toBeLessThanOrEqual(2);
    expect(applyCommand(s, { type: "connectRoom", roomId: ls.id, finish: "marscrete" }).ok).toBe(true);
    expect(s.layout.rooms.find((r) => r.id === ls.id)!.connected).toBe(true);
    expect(Object.values(s.layout.corridors).every((f) => f === "marscrete")).toBe(true);
  });

  it("digs through rock to reach a room with nothing around it", () => {
    const s = rich();
    const far = build(s, "clinic", ring(1, 3, 0)); // rock all the way in
    const route = routeToRoom(s.layout, far, config)!;
    expect(route.length).toBeGreaterThan(1);
    expect(applyCommand(s, { type: "connectRoom", roomId: far.id, finish: "rock" }).ok).toBe(true);
    expect(s.layout.rooms.find((r) => r.id === far.id)!.connected).toBe(true);
  });

  it("uses existing corridors for free", () => {
    const s = rich();
    build(s, "galley", ring(1, 1, 0));
    const a = build(s, "bunk_dorm", ring(1, 2, 0, 2));
    applyCommand(s, { type: "connectRoom", roomId: a.id, finish: "rock" });
    const before = Object.keys(s.layout.corridors).length;
    const b = build(s, "clinic", ring(1, 2, 2)); // next to the first dorm
    const route = routeToRoom(s.layout, s.layout.rooms.find((r) => r.id === b.id)!, config)!;
    expect(route.length).toBeLessThanOrEqual(3);
    expect(before).toBeGreaterThan(0);
  });
});

describe("corridors and effects", () => {
  it("a corridor between two rooms soaks up noise; health still passes", () => {
    const s = rich();
    build(s, "life_support", ring(1, 1, 0, 4)); // noise −2 r2, slots 0–3
    build(s, "bunk_dorm", ring(1, 1, 4, 2));
    build(s, "clinic", ring(1, 1, 6)); // health +2 r2
    const before = effectAt(computeEffects(s.layout), "noise", { floor: 1, ring: 1, slot: 4 });
    draw(s, ["R1.1.4"]); // between the life support and the dorm
    const after = computeEffects(s.layout);
    expect(before).toBeLessThan(0);
    expect(Math.abs(effectAt(after, "noise", { floor: 1, ring: 1, slot: 4 }))).toBeLessThan(Math.abs(before));
    draw(s, ["R1.1.6"]); // between the dorm and the clinic
    expect(effectAt(computeEffects(s.layout), "health", { floor: 1, ring: 1, slot: 5 })).toBeGreaterThan(0);
  });
});

describe("old saves", () => {
  it("turn corridor rooms into corridors along their borders", () => {
    const w = createWorld(config);
    const file = JSON.parse(serialize(w));
    file.version = 11;
    const layout = file.state.holes[0].layout;
    delete layout.corridors;
    // A ring-1 corridor room at slot 1, and a dorm behind it in ring 2 that it served.
    const id = layout.nextRoomId++;
    layout.rooms.push({ id, type: "corridor", at: ring(1, 1, 1), cells: [{ floor: 1, ring: 1, slot: 1 }], surfaceCells: [], connected: true, planned: false, priority: "normal" });
    layout.grid[0][0][1] = id;
    const dormId = layout.nextRoomId++;
    const dormCells = [{ floor: 1, ring: 2, slot: 1 }, { floor: 1, ring: 2, slot: 2 }];
    layout.rooms.push({ id: dormId, type: "bunk_dorm", at: ring(1, 2, 1, 2), cells: dormCells, surfaceCells: [], connected: true, planned: false, priority: "normal" });
    for (const c of dormCells) layout.grid[0][1][c.slot] = dormId;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const l = loaded.world.holes[0]!.layout;
    expect(l.rooms.some((r) => r.type === "corridor")).toBe(false);
    expect(l.grid[0]![0]![1]).toBe(0);
    expect(Object.keys(l.corridors).length).toBeGreaterThan(0);
    expect(Object.keys(l.corridors).every((e) => edgeById(l.hole, e))).toBe(true);
    expect(l.rooms.find((r) => r.id === dormId)!.connected).toBe(true);
  });
});

describe("stairs", () => {
  it("a stairwell spans two floors, and its sides are walkable on both", () => {
    const s = rich();
    s.layout.hole.floors = 2; // floor 2 dug
    const grid = s.layout.grid;
    while (grid.length < 3) grid.push(s.layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
    // A stairwell in ring 1 on floors 1–2: on floor 1 it opens onto the gallery.
    const stairs = build(s, "stairwell", ring(1, 1, 4));
    expect(new Set(stairs.cells.map((c) => c.floor))).toEqual(new Set([1, 2]));
    // On floor 2, a dorm in ring 2 right behind the stairwell's floor-2 cell.
    const dorm = build(s, "bunk_dorm", ring(2, 2, 4, 2));
    // The stairwell's floor-2 sides count as corridors, so the dorm behind it is connected.
    expect(s.layout.rooms.find((r) => r.id === dorm.id)!.connected).toBe(true);
    // A stairwell whose lower floor isn't dug yet is refused.
    expect(applyCommand(s, { type: "build", room: "stairwell", at: ring(3, 1, 0) })).toMatchObject({ ok: false, reason: "The floor below (floor 4) isn't excavated yet" });
  });

  it("a stairwell deep in the rock links two floors' corridors", () => {
    const s = rich();
    s.layout.hole.floors = 2;
    while (s.layout.grid.length < 3) s.layout.grid.push(s.layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
    // Floor 1: galley on the gallery, a dorm behind it connected by corridor, stairs behind the dorm's neighbour.
    build(s, "galley", ring(1, 1, 0));
    const stairs = build(s, "stairwell", ring(1, 2, 0));
    expect(applyCommand(s, { type: "connectRoom", roomId: stairs.id, finish: "rock" }).ok).toBe(true);
    // Floor 2: a clinic next to the stairwell's floor-2 cell, no corridor on floor 2 at all.
    const clinic = build(s, "clinic", ring(2, 2, 1));
    expect(s.layout.rooms.find((r) => r.id === clinic.id)!.connected).toBe(true);
  });
});

describe("stacking stairs and elevators", () => {
  /** A hole with floors 1–4 dug. */
  function deep(): SimState {
    const s = rich();
    s.layout.hole.floors = 4;
    while (s.layout.grid.length < 5) s.layout.grid.push(s.layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
    return s;
  }
  const stairsAt = (s: SimState) => s.layout.rooms.filter((r) => r.type === "stairwell");

  it("a stair piece needs the floor below dug, and free", () => {
    const s = deep();
    expect(checkPlacement(s.layout, "stairwell", ring(4, 1, 0))).toMatchObject({ ok: false, reason: "The floor below (floor 5) isn't excavated yet" });
    build(s, "galley", ring(3, 1, 0));
    expect(checkPlacement(s.layout, "stairwell", ring(2, 1, 0))).toMatchObject({ ok: false, reason: "Floor 3 below: overlaps Galley" });
  });

  it("chains: a piece on the bottom of existing stairs extends them into one room", () => {
    const s = deep();
    const first = build(s, "stairwell", ring(1, 1, 3)); // floors 1–2
    const check = checkPlacement(s.layout, "stairwell", ring(2, 1, 3));
    expect(check).toMatchObject({ ok: true, merges: [first.id], note: "Extend stairs to cover floors 1–3" });
    const rock = s.resources.rock!;
    const r = applyCommand(s, { type: "build", room: "stairwell", at: ring(2, 1, 3) });
    expect(r).toEqual({ ok: true }); // no undo for an extension
    expect(s.resources.rock).toBe(rock - 8);
    expect(stairsAt(s)).toHaveLength(1);
    expect(new Set(stairsAt(s)[0]!.cells.map((c) => c.floor))).toEqual(new Set([1, 2, 3]));
    // Demolishing refunds half of every piece.
    const probe = JSON.parse(JSON.stringify(s)) as SimState;
    const before = probe.resources.rock!;
    applyCommand(probe, { type: "demolish", roomId: stairsAt(probe)[0]!.id });
    expect(probe.resources.rock).toBe(before + 8); // two pieces × 8 × half
    // Placing on its top floor again adds nothing.
    expect(checkPlacement(s.layout, "stairwell", ring(1, 1, 3))).toMatchObject({ ok: false, reason: "Already stairs here" });
  });

  it("a piece meeting a stack end to end joins it", () => {
    const s = deep();
    build(s, "stairwell", ring(1, 1, 3)); // 1–2
    expect(checkPlacement(s.layout, "stairwell", ring(3, 1, 3))).toMatchObject({ ok: true, note: "Extend stairs to cover floors 1–4" });
    build(s, "stairwell", ring(3, 1, 3));
    expect(stairsAt(s)).toHaveLength(1);
    expect(new Set(stairsAt(s)[0]!.cells.map((c) => c.floor))).toEqual(new Set([1, 2, 3, 4]));
  });

  it("only stacks with its own kind, in the same spot", () => {
    const s = deep();
    build(s, "stairwell", ring(1, 1, 3));
    expect(checkPlacement(s.layout, "elevator", ring(2, 1, 3))).toMatchObject({ ok: false, reason: "Overlaps Stairwell" });
  });

  it("an elevator stacks up to its limit", () => {
    const s = rich();
    s.layout.hole.floors = 12;
    while (s.layout.grid.length < 13) s.layout.grid.push(s.layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
    Object.assign(s.resources, { metal: 500, machinery: 50 });
    for (let f = 1; f <= 7; f++) expect(applyCommand(s, { type: "build", room: "elevator", at: ring(f, 1, 5) }).ok).toBe(true);
    const lift = s.layout.rooms.filter((r) => r.type === "elevator");
    expect(lift).toHaveLength(1);
    expect(new Set(lift[0]!.cells.map((c) => c.floor)).size).toBe(8);
    expect(checkPlacement(s.layout, "elevator", ring(8, 1, 5))).toMatchObject({ ok: false, reason: "Elevator can span at most 8 floors" });
  });
});

describe("placing a room over corridors", () => {
  it("reports the corridors it would fill in, and needs confirming", () => {
    const s = rich();
    draw(s, ["R1.1.3"]); // a spoke between ring-1 slots 2 and 3
    const check = checkPlacement(s.layout, "bunk_dorm", ring(1, 1, 2, 2)); // slots 2–3: the spoke is inside it
    expect(check).toMatchObject({ ok: true, destroys: ["R1.1.3"] });
    expect(applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 2, 2) })).toMatchObject({ ok: false, reason: expect.stringMatching(/fill in 1 corridor segment/) });
    expect(applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 2, 2), confirmed: true }).ok).toBe(true);
    expect(s.layout.corridors["R1.1.3"]).toBeUndefined();
  });

  it("a corridor only along its outside isn't touched", () => {
    const s = rich();
    draw(s, ["R1.1.2"]);
    expect(checkPlacement(s.layout, "bunk_dorm", ring(1, 1, 2, 2))).not.toHaveProperty("destroys");
  });

  it("flags what filling them in would cut off", () => {
    const s = rich();
    // A spoke at slot 3 out to ring 2, then along to a clinic in ring 2 behind slot 3.
    const clinic = build(s, "clinic", ring(1, 2, 3));
    draw(s, ["R1.1.3", "A1.1.1/3"]);
    expect(s.layout.rooms.find((r) => r.id === clinic.id)!.connected).toBe(true);
    const check = checkPlacement(s.layout, "bunk_dorm", ring(1, 1, 2, 2));
    expect(check).toMatchObject({ ok: true, destroys: ["R1.1.3"], strands: { rooms: [clinic.id], corridors: ["A1.1.1/3"] } });
  });
});

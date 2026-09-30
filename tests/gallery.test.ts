import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { corridors, corridorCost, floorLinked, strandedBy } from "../src/sim/corridors";
import { edgeById, galleryEdges } from "../src/sim/edges";
import { ensureFloors, type Location } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { createWorld } from "../src/sim/world";

// Milestone 11, step 1: the gallery is built, like corridors. Along the shaft
// wall a corridor is always a gallery tube; floor 1 starts with one all the
// way round, and other floors get theirs as the player lays it.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function deep(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 500, brick: 200, metal: 200, machinery: 50, electronics: 50 });
  return s;
}
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return s.layout.rooms.find((x) => x.id === r.roomId)!;
};

describe("the gallery", () => {
  it("comes built all the way round floor 1, and only floor 1", () => {
    const s = createInitialState(config);
    const f1 = galleryEdges(s.layout.hole, 1);
    expect(f1.every((e) => s.layout.corridors[e.id] === "gallery")).toBe(true);
    expect(f1.every((e) => s.layout.corridorLinked?.[e.id])).toBe(true);
    expect(galleryEdges(s.layout.hole, 2).some((e) => s.layout.corridors[e.id])).toBe(false);
  });

  it("links ring-1 rooms along it, and taking it away strands them", () => {
    const s = deep();
    expect(build(s, "galley", ring(1, 1, 3)).connected).toBe(true);
    // Floor 2 is rock but for what's built: a room two slots from the stairs, joined by tubes.
    build(s, "stairwell", ring(1, 1, 5));
    const galley = build(s, "galley", ring(2, 1, 3));
    const tubes = galleryEdges(s.layout.hole, 2).slice(3, 6).map((e) => e.id);
    expect(applyCommand(s, { type: "drawCorridors", edges: tubes, finish: "rock" }).ok).toBe(true);
    applyCommand(s, { type: "consoleFinish" });
    expect(s.layout.rooms.find((r) => r.id === galley.id)!.connected).toBe(true);
    expect(strandedBy(s.layout, tubes).rooms).toContain(galley.id);
  });

  it("is always a gallery tube along the shaft wall, whatever finish is asked for, at its own cost", () => {
    const s = deep();
    build(s, "stairwell", ring(1, 1, 5));
    expect(floorLinked(s.layout, 2)).toBe(true);
    const e = galleryEdges(s.layout.hole, 2)[4]!;
    expect(corridorCost(s.layout.hole, e, "metal", config)).not.toHaveProperty("metal");
    expect(Object.keys(corridorCost(s.layout.hole, e, "metal", config))).toEqual(Object.keys(corridors.gallery.cost));
    expect(applyCommand(s, { type: "drawCorridors", edges: [e.id], finish: "metal" }).ok).toBe(true);
    expect(s.layout.corridors[e.id]).toBe("gallery");
    expect(edgeById(s.layout.hole, e.id)).toEqual(e);
  });

  it("gets drawn by Connect along the shaft wall on a new floor", () => {
    const s = deep();
    build(s, "stairwell", ring(1, 1, 5));
    const galley = build(s, "galley", ring(2, 1, 2));
    expect(galley.connected).toBe(false);
    expect(applyCommand(s, { type: "connectRoom", roomId: galley.id, finish: "rock" }).ok).toBe(true);
    applyCommand(s, { type: "consoleFinish" });
    expect(s.layout.rooms.find((r) => r.id === galley.id)!.connected).toBe(true);
  });

  it("old saves get a gallery on every floor", () => {
    const w = createWorld(config, 7);
    const hole = w.holes[0]!;
    hole.layout.hole.floors = 3;
    ensureFloors(hole.layout);
    const old = JSON.parse(serialize(w));
    old.version = 15;
    for (const h of old.state.holes) for (const id of Object.keys(h.layout.corridors)) if (/^A\d+\.0\./.test(id)) delete h.layout.corridors[id];
    const back = deserialize(JSON.stringify(old));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const layout = back.world.holes[0]!.layout;
    for (let f = 1; f <= 3; f++) expect(galleryEdges(layout.hole, f).every((e) => layout.corridors[e.id] === "gallery"), `floor ${f}`).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { corridors } from "../src/sim/corridors";
import { deadEnds } from "../src/sim/deadEnds";
import { arcAt, radialEdge } from "../src/sim/edges";
import { createHole } from "../src/sim/geometry";
import { createLayout, ensureFloors, placeRoom, roomAt, type Location } from "../src/sim/placement";
import { stepsBetween } from "../src/sim/paths";
import { createInitialState, type SimState } from "../src/sim/state";
import { DOOR, doorways } from "../src/view/doors";
import { regionAt, step } from "../src/view/walk";
import { allRock } from "./worlds";

// T-022: a corridor that runs up to a room's wall and stops there is a way in.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const TAU = Math.PI * 2;

function site(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60, electronics: 60 });
  allRock(s.layout);
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
function draw(s: SimState, ids: string[]): void {
  const r = applyCommand(s, { type: "drawCorridors", edges: ids, finish: "rock" });
  if (!r.ok) throw new Error(r.reason);
  applyCommand(s, { type: "consoleFinish" });
}
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;

/**
 * On floor 1: from the gallery, a spoke out through rings 1 and 2 (paired: they have the
 * same slots) that stops at circle 2, at ring-2 slot boundary `index`.
 */
function spokeTo(s: SimState, index: number): string {
  const h = s.layout.hole;
  const spoke = radialEdge(h, 1, 2, index).id;
  draw(s, [radialEdge(h, 1, 1, index).id, spoke]);
  return spoke;
}
/** Ring 3 (18 slots in the starter hole) at its inner face, circle 2. */
const circle2 = (s: SimState) => s.layout.hole.shaftRadiusM + 2 * config.geometry.roomDepthM;

describe("a corridor dead-ending on a room's wall", () => {
  // A wide ring-3 room, slots 4–7 of 18 (turns 2/9 to 4/9). Ring 2's boundary 3 of 9 (turn 1/3) is
  // in the middle of its inner wall, where its cells 5 and 6 meet.
  it("connects the room, and the walking graph reaches it", () => {
    const s = site();
    const clinic = build(s, "clinic", ring(1, 1, 7));
    const depot = build(s, "depot", ring(1, 3, 4, 4));
    applyCommand(s, { type: "consoleFinish" });
    expect(room(s, depot).connected).toBe(false);
    const spoke = spokeTo(s, 3);
    expect(deadEnds(s.layout, room(s, depot).cells).map((d) => d.corridor)).toEqual([spoke]);
    expect(room(s, depot).connected).toBe(true);
    expect(stepsBetween(s.layout, depot, clinic)).not.toBeNull();
  });

  it("gets a door where the corridor ends, in one cell's curved wall, and you can walk in through it", () => {
    const s = site();
    const depot = build(s, "depot", ring(1, 3, 4, 4));
    spokeTo(s, 3);
    const doors = doorways(s.layout, room(s, depot));
    expect(doors).toHaveLength(1);
    const door = doors[0]!;
    expect(door.side).toBe("inner");
    // Off the cells' boundary (the 3D view cuts each cell's wall on its own), but inside the corridor's mouth.
    const off = Math.abs(door.angle - TAU / 3) * circle2(s);
    expect(off).toBeGreaterThanOrEqual(DOOR.width / 2 + corridors.door.frameM - 1e-6);
    expect(off + DOOR.width / 2).toBeLessThanOrEqual(corridors.widthM / 2 + 1e-6);
    // From the spoke's middle in ring 2, straight out through the door.
    const a = door.angle;
    const r0 = s.layout.hole.shaftRadiusM + 15;
    let [x, z] = [r0 * Math.cos(a), r0 * Math.sin(a)];
    for (let i = 0; i < 80; i++) [x, z] = step(s.layout, 1, x, z, 0.1 * Math.cos(a), 0.1 * Math.sin(a));
    expect(regionAt(s.layout, 1, x, z)).toBe(`room:${depot}`);
  });

  it("is only the way in when nothing better is: a corridor along a wall wins", () => {
    const s = site();
    const depot = build(s, "depot", ring(1, 3, 4, 4));
    spokeTo(s, 3);
    // Round circle 2 from the spoke's end, along the room's inner wall.
    const along = arcAt(s.layout.hole, 1, 2, 0.3)!.id;
    draw(s, [along]);
    const [door] = doorways(s.layout, room(s, depot));
    expect(door!.edge).toBe(along);
  });

  it("isn't a way in at a room's corner", () => {
    const s = site();
    // Ring 3 slots 6–9 start at 6/18 = 1/3, just where the spoke ends.
    const depot = build(s, "depot", ring(1, 3, 6, 4));
    spokeTo(s, 3);
    expect(deadEnds(s.layout, room(s, depot).cells)).toEqual([]);
    expect(room(s, depot).connected).toBe(false);
    expect(doorways(s.layout, room(s, depot))).toEqual([]);
  });

  it("works on a side wall too: a curved corridor running into a deep room's side", () => {
    const s = site();
    const h = s.layout.hole;
    // Rings 2–3, from ring 2 slot 4 (turn 4/9). A corridor round circle 2 from the spoke at 1/3 ends on its side.
    const depot = build(s, "depot", ring(1, 2, 4, 2, 2));
    spokeTo(s, 3);
    const run = [arcAt(h, 1, 2, 0.36)!.id, arcAt(h, 1, 2, 0.42)!.id];
    draw(s, run);
    const r = room(s, depot);
    expect(deadEnds(s.layout, r.cells).map((d) => d.corridor)).toEqual([run[1]]);
    expect(r.connected).toBe(true);
    const [door] = doorways(s.layout, r);
    expect(door!.side).toBe("left");
    // Off the boundary between the room's ring-2 and ring-3 cells, inside the corridor's mouth.
    const off = Math.abs(door!.r - circle2(s));
    expect(off).toBeGreaterThanOrEqual(DOOR.width / 2 + corridors.door.frameM - 1e-6);
    expect(off + DOOR.width / 2).toBeLessThanOrEqual(corridors.widthM / 2 + 1e-6);
    expect(roomAt(s.layout, door!.cell)!.id).toBe(depot);
  });

  it("slides the door away from a corner close by, keeping its opening a metre clear", () => {
    // Unpaired rings (9, 16, 22): ring 2's boundary 3/16 = 0.1875 is about 1.07 m from ring 3's 4/22 = 0.1818.
    const l = createLayout(createHole(10, 1, 3, { ...config.geometry, pairedRings: false }));
    const id = placeRoom(l, "depot", ring(1, 3, 4, 4)).id!;
    l.corridors[radialEdge(l.hole, 1, 2, 3).id] = "rock";
    const [door] = doorways(l, l.rooms.find((r) => r.id === id)!);
    const r = l.hole.shaftRadiusM + 2 * config.geometry.roomDepthM;
    expect(door!.side).toBe("inner");
    expect((door!.angle - (4 / 22) * TAU) * r - DOOR.width / 2).toBeGreaterThanOrEqual(corridors.door.cornerClearM - 1e-6);
    expect(Math.abs(door!.angle - (3 / 16) * TAU) * r + DOOR.width / 2).toBeLessThanOrEqual(corridors.widthM / 2 + 1e-6);
  });

  it("keeps every door's opening a metre from the room's corners", () => {
    // Unpaired rings cut circle 1 into short pieces: a corridor along one by a corner slides its door along.
    const l = createLayout(createHole(10, 1, 3, { ...config.geometry, pairedRings: false }));
    const id = placeRoom(l, "depot", ring(1, 2, 5, 4)).id!;
    const r = l.rooms.find((x) => x.id === id)!;
    // Ring 2 slots 5–8 of 16: the inner wall's first piece, 2.6 m from the corner at 5/16 to ring 1's 3/9.
    const first = arcAt(l.hole, 1, 1, 5 / 16 + 1e-6)!;
    l.corridors[first.id] = "rock";
    const rr = l.hole.shaftRadiusM + config.geometry.roomDepthM;
    expect((first.a1 - first.a0) * TAU * rr).toBeCloseTo(2.62, 1);
    const [door] = doorways(l, r);
    expect(door!.edge).toBe(first.id);
    // Its middle would leave the opening 0.66 m from the corner; slid along, it's a metre clear, and still on its piece.
    expect((door!.angle - (5 / 16) * TAU) * rr - DOOR.width / 2).toBeGreaterThanOrEqual(corridors.door.cornerClearM - 1e-6);
    expect(door!.angle + door!.half).toBeLessThanOrEqual(first.a1 * TAU + 1e-9);
  });
});

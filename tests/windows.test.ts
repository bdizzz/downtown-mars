import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { galleryEdges, radialEdge } from "../src/sim/edges";
import { ensureFloors, type Location } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { createWorld } from "../src/sim/world";
import { glazedWalls, roomForWindows, roomSide, shaftBorders, wallOf, windowComfort, windowCost } from "../src/sim/windows";
import { corridorStripGeometry, openingsOf } from "../src/render3d/rooms3d";
import { frameOf } from "../src/view/furnish";
import { corridorCommand, edgeHoverFor } from "../src/view/interaction";

// Milestone 13, step 2: windows as an upgrade.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function site(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60, electronics: 60 });
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const roomOf = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;
const glaze = (s: SimState, id: number, edge: string, on = true) => {
  const room = roomOf(s, id);
  const edges = (wallOf(s.layout, room, edge) ?? []).map((e) => e.id);
  return applyCommand(s, { type: "setWindows", roomId: id, edges, on });
};

describe("windows", () => {
  it("rooms start with none: no view, no glass", () => {
    const s = site();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    expect(roomOf(s, dorm).windows).toBeUndefined();
    expect(windowComfort(s.layout, roomOf(s, dorm))).toBe(0);
    expect(openingsOf(s.layout, roomOf(s, dorm))!.windows.size).toBe(0);
  });

  it("go in a whole wall at a time, facing the shaft, for their price", () => {
    const s = site();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    const tube = galleryEdges(s.layout.hole, 1)[1]!.id;
    const wall = wallOf(s.layout, roomOf(s, dorm), tube)!;
    expect(wall.map((e) => e.id).sort()).toEqual(shaftBorders(s.layout, roomOf(s, dorm)).sort());
    const glass = s.resources.glass!;
    expect(glaze(s, dorm, tube).ok).toBe(true);
    expect(s.resources.glass).toBeCloseTo(glass - windowCost(s.layout, wall).glass!);
    expect(roomOf(s, dorm).windows).toHaveLength(2);
    // Behind floor 1's tubes: the view through them. The 3D view cuts the glass.
    expect(windowComfort(s.layout, roomOf(s, dorm))).toBeCloseTo(config.windows.view.tube);
    expect(openingsOf(s.layout, roomOf(s, dorm))!.windows.size).toBe(2);
    // A wall that's glazed already: nothing to do. Taking them out is free.
    expect(glaze(s, dorm, tube).ok).toBe(false);
    const after = s.resources.glass!;
    expect(glaze(s, dorm, tube, false).ok).toBe(true);
    expect(roomOf(s, dorm).windows).toBeUndefined();
    expect(s.resources.glass).toBe(after);
  });

  it("need glass: none in stock, none put in", () => {
    const s = site();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    s.resources.glass = 0;
    const r = glaze(s, dorm, galleryEdges(s.layout.hole, 1)[1]!.id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/glass/);
  });

  it("only where there's something across: a corridor or a plaza, not rock; never in a walk-through room", () => {
    const s = site();
    const lab = build(s, "bunk_dorm", ring(1, 2, 3, 2));
    const side = radialEdge(s.layout.hole, 1, 2, 3).id;
    // Rock along its left side: refused.
    expect(glaze(s, lab, side).ok).toBe(false);
    applyCommand(s, { type: "drawCorridors", edges: [side], finish: "rock" });
    applyCommand(s, { type: "consoleFinish" });
    expect(glaze(s, lab, side).ok).toBe(true);
    expect(glazedWalls(s.layout, roomOf(s, lab)).map((w) => w.across)).toEqual(["corridor"]);
    expect(windowComfort(s.layout, roomOf(s, lab))).toBeCloseTo(config.windows.view.corridor);
    // A plaza on its other side: a better view, and the extra wall counts a little.
    const plaza = build(s, "tiny_plaza", ring(1, 2, 5));
    applyCommand(s, { type: "consoleFinish" });
    const right = radialEdge(s.layout.hole, 1, 2, 5).id;
    expect(glaze(s, lab, right).ok).toBe(true);
    expect(windowComfort(s.layout, roomOf(s, lab))).toBeCloseTo(config.windows.view.public + config.windows.extraWall);
    // The plaza itself is open: no windows for it, and its border goes to the dorm.
    expect(applyCommand(s, { type: "setWindows", roomId: plaza, edges: [right], on: true }).ok).toBe(false);
    expect(roomForWindows(s.layout, right, { floor: 1, ring: 2, slot: 5 })?.id).toBe(lab);
    // Fill the corridor in: those windows go blind (no view, no glass), the plaza's stay.
    applyCommand(s, { type: "removeCorridors", edges: [side] });
    applyCommand(s, { type: "consoleFinish" });
    expect(glazedWalls(s.layout, roomOf(s, lab)).map((w) => w.across)).toEqual(["public"]);
    expect(windowComfort(s.layout, roomOf(s, lab))).toBeCloseTo(config.windows.view.public);
  });

  it("keep furniture off the glass: a glazed wall isn't solid", () => {
    const s = site();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    expect(frameOf(s.layout, roomOf(s, dorm))!.solid.front).toBe(true);
    glaze(s, dorm, galleryEdges(s.layout.hole, 1)[1]!.id);
    expect(frameOf(s.layout, roomOf(s, dorm))!.solid.front).toBe(false);
  });

  it("the tool lights up the whole wall under the pointer, and a click glazes it", () => {
    const s = site();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    const tool = { kind: "corridor" as const, finish: "rock", erase: false, windows: true };
    const tube = galleryEdges(s.layout.hole, 1)[2]!;
    const pick = { kind: "slot" as const, floor: 1, ring: 1, slot: 2, locked: false, digging: false, angle: 0 };
    const info = edgeHoverFor(s.layout, s.resources, tool, pick, tube, false);
    expect(info.edge!.refusal).toBeNull();
    expect(info.edge!.windows!.edges.sort()).toEqual(shaftBorders(s.layout, roomOf(s, dorm)).sort());
    expect(info.edge!.windows!.comfort).toBeCloseTo(config.windows.view.tube);
    const cmd = corridorCommand(tool, info.edge)!;
    expect(cmd).toMatchObject({ type: "setWindows", roomId: dorm, on: true });
    expect(applyCommand(s, cmd).ok).toBe(true);
    // Shift: take them out again.
    const out = edgeHoverFor(s.layout, s.resources, tool, pick, tube, true);
    expect(out.edge!.refusal).toBeNull();
    expect(applyCommand(s, corridorCommand(tool, out.edge)!).ok).toBe(true);
    expect(roomOf(s, dorm).windows).toBeUndefined();
    // Over rock: refused, with a reason.
    const rock = radialEdge(s.layout.hole, 1, 1, 3); // its right side: nothing built across
    expect(edgeHoverFor(s.layout, s.resources, tool, pick, rock, false).edge!.refusal).toMatch(/Nothing to look out on/);
  });

  it("old saves get the landing kit's glass, and the pod room to keep it", () => {
    const w = createWorld(config, 42);
    const old = JSON.parse(serialize(w));
    old.version = 17;
    for (const h of old.state.holes) {
      h.resources.glass = 0;
      const pod = h.layout.rooms.find((r: { type: string }) => r.type === "landing_pod");
      delete pod.allocation.glass;
    }
    const back = deserialize(JSON.stringify(old));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    for (const h of back.world.holes) {
      expect(h.resources.glass).toBe(config.startingStock.glass);
      expect(h.layout.rooms.find((r) => r.type === "landing_pod")!.allocation!.glass).toBe(config.startingStock.glass);
    }
  });

  it("old saves keep the shaft windows they had", () => {
    const w = createWorld(config, 42);
    const hole = w.holes[0]!;
    const dorm = build(hole, "bunk_dorm", ring(1, 1, 2, 2));
    const old = JSON.parse(serialize(w));
    old.version = 16;
    for (const h of old.state.holes) for (const r of h.layout.rooms) delete r.windows;
    const back = deserialize(JSON.stringify(old));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const room = back.world.holes[0]!.layout.rooms.find((r) => r.id === dorm)!;
    expect(room.windows?.sort()).toEqual(shaftBorders(back.world.holes[0]!.layout, room).sort());
    // Not the entrance (it's walk-through).
    expect(back.world.holes[0]!.layout.rooms.find((r) => r.type === "entrance")!.windows).toBeUndefined();
  });

  it("the hover ghost covers only the glazed room's half of the corridor", () => {
    const s = site();
    const room = roomOf(s, build(s, "bunk_dorm", ring(1, 1, 1, 2)));
    const hole = s.layout.hole;
    // Its side walls: the room is past the left one, before the right one; the shaft wall is outside it.
    const left = radialEdge(hole, 1, 1, 1);
    const right = radialEdge(hole, 1, 1, 3);
    const shaft = galleryEdges(hole, 1).find((e) => roomSide(s.layout, room, e) !== null)!;
    expect(roomSide(s.layout, room, left)).toBe(1);
    expect(roomSide(s.layout, room, right)).toBe(0);
    expect(roomSide(s.layout, room, shaft)).toBe(1);
    expect(roomSide(s.layout, room, radialEdge(hole, 1, 1, 5))).toBeNull();
    // Strips: the half toward the room, half as wide.
    const radii = (side?: 0 | 1): [number, number] => {
      const a = corridorStripGeometry(s.layout, shaft, 0, side).getAttribute("position").array;
      const r: number[] = [];
      for (let i = 0; i < a.length; i += 3) r.push(Math.hypot(a[i]!, a[i + 2]!));
      return [Math.min(...r), Math.max(...r)];
    };
    const [lo, hi] = radii();
    const mid = (lo + hi) / 2;
    expect(radii(1)[0]).toBeCloseTo(mid, 5);
    expect(radii(1)[1]).toBeCloseTo(hi, 5);
    expect(radii(0)[1]).toBeCloseTo(mid, 5);
    // Along a spoke: side 1 lies at larger angles than the border.
    const turnOf = (side: 0 | 1) => {
      const a = corridorStripGeometry(s.layout, left, 0, side).getAttribute("position").array;
      let sum = 0;
      for (let i = 0; i < a.length; i += 3) sum += Math.atan2(a[i + 2]!, a[i]!);
      return sum / (a.length / 3);
    };
    expect(turnOf(1)).toBeGreaterThan(left.turn * 2 * Math.PI);
    expect(turnOf(0)).toBeLessThan(left.turn * 2 * Math.PI);
  });
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom } from "../src/sim/placement";
import { furnish } from "../src/view/furnish";
import { furnitureGroup } from "../src/render3d/rooms3d";
import { occupied, People, spotsOf, type RoomSpots } from "../src/render3d/people3d";

function room(type: string, w = 1) {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));
  const r = placeRoom(layout, type, { kind: "ring", floor: 1, ring: 2, slot: 3, w, d: 1 });
  if (!r.ok) throw new Error(r.reason);
  const rm = layout.rooms.find((x) => x.id === r.id)!;
  const fitted = furnish(layout, rm);
  return { layout, rm, fitted, spots: furnitureGroup(layout, rm, fitted, "#6f93bd").userData.people as RoomSpots };
}

describe("colonists in 3D", () => {
  it("find seats, beds and work posts in the furniture", () => {
    const dorm = room("bunk_dorm", 2);
    expect(dorm.spots.spots.filter((s) => s.kind === "bed").length).toBeGreaterThanOrEqual(8);
    expect(dorm.spots.social).toBe(true);
    const galley = room("galley");
    expect(galley.spots.spots.some((s) => s.kind === "post")).toBe(true);
    // Seats and beds sit up off the floor; posts stand on it.
    for (const s of spotsOf(dorm.fitted)) expect(s.y).toBeGreaterThan(dorm.fitted[0]!.y - 0.1);
  });

  it("sleep at night, work their posts as staffed, and sit about by day", () => {
    const dorm = room("bunk_dorm", 2).spots;
    const galley = room("galley").spots;
    const beds = dorm.spots.filter((s) => s.kind === "bed").length;
    const at = (hour: number, staff: number, pop: number) => occupied([dorm, galley], hour, (id) => (id === galley.roomId ? staff : 0), pop);
    const night = at(2, 0, 100);
    expect(night.filter((p) => p.spot.kind === "bed")).toHaveLength(beds);
    const day = at(12, 0, 100);
    expect(day.filter((p) => p.spot.kind === "bed").length).toBeLessThan(beds / 2);
    // Staff at their posts, in the room's colour; no more than there are posts.
    const posts = galley.spots.filter((s) => s.kind === "post").length;
    const worked = at(12, 1, 100).filter((p) => p.spot.kind === "post");
    expect(worked).toHaveLength(1);
    expect(worked[0]!.clothes).toBe(new THREE.Color(galley.accent).getHex());
    expect(at(12, 99, 100).filter((p) => p.spot.kind === "post")).toHaveLength(posts);
    // The same hour, the same people.
    expect(at(12, 1, 100)).toEqual(at(12, 1, 100));
  });

  it("place figures: walkers on the galleries, and sitters, sleepers and workers in rooms, hidden above a chosen floor", () => {
    const dorm = room("bunk_dorm", 2);
    const people = new People();
    people.sync(dorm.layout.hole, 30);
    const who = occupied([dorm.spots], 2, () => 0, 100);
    people.setRooms(who);
    expect(people.shown.stand).toBe(10 + who.length);
    people.setTopFloor(2);
    expect(people.shown.stand).toBeLessThan(10 + who.length);
    // A sleeper lies flat: its body is wider than it is tall.
    const lone = new People();
    lone.setRooms([who[0]!]);
    const mesh = lone.group.children[0] as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const box = mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox!);
    const b = box.clone().applyMatrix4(m);
    expect(b.max.y - b.min.y).toBeLessThan(0.5);
    expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeGreaterThan(1.3);
  });
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Layout, type Location } from "../src/sim/placement";
import { FIT, fit, frameOf, furnish, isFlat, type Template } from "../src/view/furnish";
import { furniture, isMounted, itemDef } from "../src/view/furniture";
import { furnitureGroup } from "../src/render3d/rooms3d";
import { obstacles } from "../src/view/walk";
import { setRoomWindows, shaftBorders } from "../src/sim/windows";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
function room(layout: Layout, type: string, at: Location) {
  const r = placeRoom(layout, type, at);
  if (!r.ok) throw new Error(r.reason);
  return layout.rooms.find((x) => x.id === r.id)!;
}

describe("wall hangings", () => {
  it("every room has something to hang, and it all fits under the ceiling", () => {
    for (const [type, ids] of Object.entries(furniture.rooms)) expect(ids.some(isMounted), type).toBe(true);
    for (const [id, def] of Object.entries(furniture.items)) if (def.mount) expect(def.mount + def.size[2], id).toBeLessThanOrEqual(3.6);
  });

  it("hang flat on the wall at their height, over low things but never behind tall ones", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const r = room(layout, "flat", ring(1, 2, 3));
    const frame = frameOf(layout, r)!;
    const t: Template = [
      { item: "bed", wall: "back", y: 0.1, turn: -90 },
      { item: "wardrobe", wall: "back", x: 3, y: 0.05 },
      { item: "painting", wall: "back" },
      { item: "painting", wall: "back", x: 3 },
    ];
    const f = fit(frame, t);
    const hung = f.filter((x) => isMounted(x.item));
    // Over the bed, yes; behind the wardrobe, no.
    expect(hung.map((x) => x.placement)).toEqual([2]);
    const p = hung[0]!;
    expect(p.y).toBeCloseTo(frame.y + FIT.lift + itemDef("painting").mount!, 6);
    // Its back is just off the wall, which stands the fitting gap beyond the fitted floor.
    const back = Math.max(...p.corners.map(([x, z]) => Math.hypot(x, z)));
    expect(back).toBeGreaterThan(frame.rOut + FIT.wallGap - FIT.hangingOff - 0.02);
    expect(back).toBeLessThanOrEqual(frame.rOut + FIT.wallGap);
  });

  it("share a stretch of wall one above the other, but not side by side at one height", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const frame = frameOf(layout, room(layout, "flat", ring(1, 2, 3)))!;
    // A vent high over a painting: both hang.
    expect(fit(frame, [{ item: "painting", wall: "back" }, { item: "air_vent", wall: "back" }])).toHaveLength(2);
    // Two paintings in the same place: only the first.
    expect(fit(frame, [{ item: "painting", wall: "back" }, { item: "poster", wall: "back" }])).toHaveLength(1);
  });

  it("go only on solid walls: not a glazed one, nor a public room's open sides", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const t: Template = [{ item: "poster", wall: "front" }];
    const front = room(layout, "flat", ring(1, 1, 3));
    expect(fit(frameOf(layout, front)!, t)).toHaveLength(1);
    setRoomWindows(front, shaftBorders(layout, front), true);
    expect(fit(frameOf(layout, front)!, t)).toEqual([]);
    expect(fit(frameOf(layout, room(layout, "flat", ring(1, 2, 3)))!, t)).toHaveLength(1);
    // A plaza on the gallery has no front wall at all.
    expect(fit(frameOf(layout, room(layout, "tiny_plaza", ring(1, 1, 6)))!, t)).toEqual([]);
  });

  it("don't block walking, and carry their wall's tag so they vanish with it", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const r = room(layout, "school", ring(1, 2, 3, 2));
    const frame = frameOf(layout, r)!;
    const f = fit(frame, [{ item: "mars_map", wall: "left" }]);
    expect(f).toHaveLength(1);
    const g = furnitureGroup(layout, r, f, "#6f93bd");
    const mesh = g.children[0] as THREE.Mesh;
    const wall = mesh.geometry.getAttribute("aWall");
    const hang = mesh.geometry.getAttribute("aHang");
    expect(wall && hang).toBeTruthy();
    // Its tag points into the room: from the point on the wall toward the item.
    const [nx, nz, ax, az] = [wall!.getX(0), wall!.getY(0), hang!.getX(0), hang!.getY(0)];
    expect(nx * (f[0]!.x - ax) + nz * (f[0]!.z - az)).toBeGreaterThan(0);
    // Walking into the room, you pass under hangings: only what stands on the floor is in the way.
    const all = furnish(layout, r);
    expect(all.some((x) => isMounted(x.item))).toBe(true);
    expect(obstacles(layout, 1)).toHaveLength(all.filter((x) => !isMounted(x.item) && !isFlat(x.item)).length);
  });
});

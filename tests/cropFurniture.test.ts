import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom } from "../src/sim/placement";
import { furnish } from "../src/view/furnish";
import { cropDefs } from "../src/sim/resources";
import { isItem } from "../src/view/furniture";

describe("farm furniture shows the crop", () => {
  it("swaps planters and racks for the crop's, in the same places", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(layout, "farm", { kind: "ring", floor: 1, ring: 2, slot: 0, w: 4, d: 1 });
    const room = layout.rooms.find((x) => x.id === (r as { id: number }).id)!;
    room.crop = "leafyGreens";
    const greens = furnish(layout, room);
    expect(greens.some((f) => f.item === "planter_bed")).toBe(true);
    room.crop = "wheat";
    const wheat = furnish(layout, room);
    expect(wheat.map((f) => f.item)).toContain("planter_bed_wheat");
    expect(wheat.map((f) => f.item)).not.toContain("planter_bed");
    expect(wheat.map((f) => [f.x, f.z])).toEqual(greens.map((f) => [f.x, f.z]));
  });

  it("has a planter and a rack for every crop", () => {
    for (const c of cropDefs) {
      const suffix = c.id === "leafyGreens" ? "" : `_${c.id}`;
      expect(isItem(`planter_bed${suffix}`), c.id).toBe(true);
      expect(isItem(`hydroponic_rack${suffix}`), c.id).toBe(true);
    }
  });
});

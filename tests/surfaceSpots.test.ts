import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom } from "../src/sim/placement";
import { roomDefs } from "../src/sim/rooms";
import { surfaceSpots } from "../src/view/interaction";

// T-107: the surface spots a surface room in hand could go on, tinted in build mode.
const layout = () => createLayout(createHole(10, 3, 3, config.geometry));
const wide = roomDefs.find((r) => r.size === "surface" && (r.surfaceSlots ?? 1) === 2)!;

describe("surfaceSpots", () => {
  it("is every slot on an empty surface, and nothing for a room inside the hole", () => {
    const l = layout();
    expect(surfaceSpots(l, "solar_array")).toEqual([...Array(l.surface.length).keys()]);
    expect(surfaceSpots(l, "clinic")).toEqual([]);
  });

  it("leaves out taken slots, and gaps too narrow for a wide room", () => {
    const l = layout();
    // Taken: 0–1 and 3–4, leaving slot 2 alone between them.
    expect(placeRoom(l, wide.id, { kind: "surface", slot: 0 }).ok).toBe(true);
    expect(placeRoom(l, wide.id, { kind: "surface", slot: 3 }).ok).toBe(true);
    expect(surfaceSpots(l, "solar_array")).toContain(2);
    const spots = surfaceSpots(l, wide.id);
    expect(spots).not.toContain(2);
    for (const s of [0, 1, 3, 4]) expect(spots).not.toContain(s);
    expect(spots).toContain(5);
  });
});

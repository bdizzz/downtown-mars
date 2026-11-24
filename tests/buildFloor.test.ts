import { describe, expect, it } from "vitest";
import { floorFor, floorWant } from "../src/ui/buildFloor";

// The view follows the room in hand (#597).

const surface = floorWant({ kind: "build", room: "solar_array", shape: [1, 1] });
const below = floorWant({ kind: "build", room: "bunk_dorm", shape: [1, 1] });

describe("build tool floor", () => {
  it("sorts tools by where they build", () => {
    expect(surface).toBe("surface");
    expect(below).toBe("below");
    expect(floorWant({ kind: "corridor", finish: "rock", erase: false })).toBe("below");
    expect(floorWant({ kind: "demolish" })).toBe(null);
    expect(floorWant(null)).toBe(null);
  });

  it("takes an underground view up to the surface for a surface room", () => {
    expect(floorFor(surface, 3, 3, false)).toBe(null);
    expect(floorFor(surface, null, 3, false)).toBeUndefined();
  });

  it("takes the surface down to the last floor viewed, else floor 1", () => {
    expect(floorFor(below, null, 4, false)).toBe(4);
    expect(floorFor(below, null, null, false)).toBe(1);
    expect(floorFor(below, 2, 4, false)).toBeUndefined();
  });

  it("never goes up in the plan view, which has no surface", () => {
    expect(floorFor(surface, 2, 2, true)).toBeUndefined();
  });

  it("leaves the view alone for tools that work anywhere", () => {
    expect(floorFor(null, 2, 2, false)).toBeUndefined();
    expect(floorFor(null, null, 2, false)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { roomDefs as ROOMS } from "../src/sim/rooms";
import { roomCard } from "../src/view/roomCard";

// Every room explains itself in one sentence on the build menu's card (#571).

describe("room blurbs", () => {
  it("every room has a one-sentence blurb", () => {
    for (const def of ROOMS) {
      expect(def.blurb, def.id).toMatch(/^[A-Z].*\.$/);
      expect(def.blurb.match(/[.!?](\s|$)/g)?.length ?? 0, `${def.id}: one sentence`).toBe(1);
      expect(def.blurb.length, def.id).toBeLessThanOrEqual(140);
    }
  });

  it("the room card carries it, for the web and the Godot viewer", () => {
    const farm = ROOMS.find((d) => d.id === "farm")!;
    expect(roomCard(farm, {}).blurb).toBe(farm.blurb);
  });
});

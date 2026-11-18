import { describe, expect, it } from "vitest";
import { haloEffect, placementLegend } from "../src/view/interaction";

// What the placement colours mean (#438): the legend names the same effect the halo draws.
describe("placement legend", () => {
  it("names the bad effect a galley spreads in red", () => {
    expect(haloEffect("galley")).toEqual({ type: "smell", strength: -1 });
    expect(placementLegend("galley")).toBe("Green: fits · Red round it: the smell it spreads");
  });
  it("names a good effect in green, and follows the colour-blind palette", () => {
    expect(placementLegend("park")).toMatch(/^Green: fits · Green round it: the (comfort|air) it spreads$/);
    expect(placementLegend("galley", true)).toBe("Green: fits · Orange round it: the smell it spreads");
    expect(placementLegend("park", true)).toMatch(/Blue round it/);
  });
});

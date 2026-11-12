import { describe, expect, it } from "vitest";
import { roomDefs, roomFamilies } from "../src/sim/rooms";
import { BUILD_GROUPS, buildTiles, CATEGORY_ORDER, groupOf, variantLabel } from "../src/view/buildCatalog";

describe("the build rail's catalogue", () => {
  const buildable = roomDefs.filter((d) => d.buildable);

  it("puts every category in exactly one group", () => {
    const grouped = BUILD_GROUPS.flatMap((g) => g.categories);
    expect([...grouped].sort()).toEqual([...CATEGORY_ORDER].sort());
    for (const d of buildable) expect(groupOf(d.category), d.id).toBeDefined();
  });

  it("names every family, and keeps each within one category", () => {
    for (const d of roomDefs.filter((r) => r.family)) {
      expect(roomFamilies[d.family!], d.id).toBeTruthy();
      expect(d.buildable, d.id).toBe(true);
    }
    for (const t of buildTiles(buildable)) expect(new Set(t.members.map((m) => m.category)).size, t.id).toBe(1);
  });

  it("shows a family as one tile, and every room on exactly one", () => {
    const tiles = buildTiles(buildable);
    expect(tiles.flatMap((t) => t.members.map((m) => m.id)).sort()).toEqual(buildable.map((d) => d.id).sort());
    const storage = tiles.find((t) => t.id === "storage")!;
    expect(storage.name).toBe("Storage");
    expect(storage.members.map((m) => m.id)).toEqual(["storeroom", "warehouse", "depot"]);
    expect(tiles.length).toBeLessThan(buildable.length);
  });

  it("labels a family's members apart: by size when they differ, else by name", () => {
    for (const t of buildTiles(buildable).filter((x) => x.members.length > 1)) {
      const labels = t.members.map((m) => variantLabel(t, m));
      expect(new Set(labels).size, t.id).toBe(labels.length);
    }
  });

  it("shows a family with one member revealed as that room", () => {
    const [tile] = buildTiles(buildable.filter((d) => d.id === "warehouse"));
    expect(tile!.name).toBe("Warehouse");
  });
});

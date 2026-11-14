import { describe, expect, it } from "vitest";
import { roomDefs, roomFamilies } from "../src/sim/rooms";
import { BUILD_GROUPS, buildTiles, CATEGORY_ORDER, groupOf, groupOfRoom, RAIL_SECTIONS, ROOM_SECTION, sectionOf, surfaceOnly, variantLabel } from "../src/view/buildCatalog";

describe("the build rail's catalogue", () => {
  const buildable = roomDefs.filter((d) => d.buildable);

  it("puts every category and rail section in exactly one group, and every room in one", () => {
    const grouped = BUILD_GROUPS.flatMap((g) => g.sections);
    expect(new Set(grouped).size).toBe(grouped.length);
    for (const s of grouped) expect([...CATEGORY_ORDER, ...Object.keys(RAIL_SECTIONS)], s).toContain(s);
    for (const d of buildable) expect(groupOfRoom(d), d.id).toBeDefined();
    for (const s of Object.values(ROOM_SECTION)) expect(groupOf(s), s).toBeDefined();
  });

  it("splits eating from growing, puts water with the utilities and services with the community (#454)", () => {
    const groupFor = (id: string) => groupOfRoom(buildable.find((d) => d.id === id)!)!.id;
    expect(groupFor("farm")).toBe("food");
    expect(groupFor("galley")).toBe("food");
    expect(sectionOf(buildable.find((d) => d.id === "galley")!)).toBe("meals");
    expect(sectionOf(buildable.find((d) => d.id === "farm")!)).toBe("food");
    expect(groupFor("water_tank")).toBe("utilities");
    expect(groupFor("maintenance")).toBe("community");
    expect(groupFor("restroom")).toBe("homes");
    expect(sectionOf(buildable.find((d) => d.id === "admin_office")!)).toBe("services");
    expect(BUILD_GROUPS.find((g) => g.id === "community")!.sections[0]).toBe("services");
    expect(BUILD_GROUPS.find((g) => g.id === "utilities")!.sections[0]).toBe("power");
    expect(buildable.filter(surfaceOnly).map((d) => d.id)).toContain("solar_array");
  });

  it("names every family, and keeps each within one category", () => {
    for (const d of roomDefs.filter((r) => r.family)) {
      expect(roomFamilies[d.family!], d.id).toBeTruthy();
      expect(d.buildable, d.id).toBe(true);
    }
    for (const t of buildTiles(buildable)) expect(new Set(t.members.map((m) => sectionOf(m))).size, t.id).toBe(1);
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

import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type RoomInstance } from "../src/sim/placement";
import { cropDef } from "../src/sim/resources";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { cropStage, cropStagesKey, furnish, GROWTH, growsCrop, stageScale } from "../src/view/furnish";
import { furnitureMeshes } from "../src/render3d/furniture3d";
import { barItems, varietyNote } from "../src/view/hudItems";
import { cropOptions, harvestInfo, panelModel } from "../src/view/roomPanel";

// The views of harvest cycles and food variety (#378, #379, #380, #381, #383).

function farm(crop: string): { layout: ReturnType<typeof createLayout>; room: RoomInstance } {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));
  const r = placeRoom(layout, "farm", { kind: "ring", floor: 1, ring: 2, slot: 0, w: 4, d: 1 });
  const room = layout.rooms.find((x) => x.id === (r as { id: number }).id)!;
  room.crop = crop;
  return { layout, room };
}

const vertices = (g: { children: unknown[] }) =>
  (g.children as { geometry: { getAttribute: (n: string) => { count: number } } }[]).reduce((n, m) => n + m.geometry.getAttribute("position").count, 0);

describe("crop growth stages in 3D (#379)", () => {
  it("follow the harvest counter, from freshly planted to ready", () => {
    const { room } = farm("wheat");
    const grow = cropDef("wheat").growMonths;
    expect(cropStage(room)).toBe(0);
    const at = (share: number) => {
      room.growth = { days: share * grow, banked: 0 };
      return GROWTH.stages[cropStage(room)]!.id;
    };
    expect([0.05, 0.2, 0.5, 0.8, 0.95].map(at)).toEqual(["planted", "sprouts", "modest", "full", "ready"]);
  });

  it("put the stage on the farm's planters and racks only", () => {
    const { layout, room } = farm("potatoes");
    room.growth = { days: 0.5, banked: 0 };
    const fitted = furnish(layout, room);
    const planters = fitted.filter((f) => growsCrop(f.item));
    expect(planters.length).toBeGreaterThan(0);
    expect(planters.every((f) => f.stage === cropStage(room))).toBe(true);
    expect(fitted.filter((f) => !growsCrop(f.item)).every((f) => f.stage === undefined)).toBe(true);
  });

  it("grow the plants and show the produce only when it's ready", () => {
    expect(stageScale("leaf", 0)).toBe(0);
    expect(stageScale("leaf", 1)).toBeCloseTo(0.3);
    expect(stageScale("potato", 3)).toBe(0);
    expect(stageScale("potato", 4)).toBe(1);
    expect(stageScale("panel", 0)).toBe(1);
    expect(stageScale("leaf", undefined)).toBe(1);
    const at = (stage: number) => vertices(furnitureMeshes([{ item: "planter_bed_potatoes", x: 0, y: 0, z: 0, turn: 0, stage }], "#888888"));
    expect(at(0)).toBeLessThan(at(3));
    expect(at(3)).toBeLessThan(at(4));
    expect(at(4)).toBe(vertices(furnitureMeshes([{ item: "planter_bed_potatoes", x: 0, y: 0, z: 0, turn: 0 }], "#888888")));
  });

  it("change the rebuild key only when a farm changes stage", () => {
    const { layout, room } = farm("wheat");
    room.growth = { days: 0.1, banked: 0 };
    const key = cropStagesKey(layout);
    room.growth.days = 0.2;
    expect(cropStagesKey(layout)).toBe(key);
    room.growth.days = 1.5;
    expect(cropStagesKey(layout)).not.toBe(key);
  });
});

describe("the farm's panel and the crop picker (#378)", () => {
  it("shows the next harvest's progress, size and when it comes", () => {
    const s = createInitialState(config);
    const r = applyCommand(s, { type: "build", room: "farm", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 4, d: 1 } });
    expect(r.ok).toBe(true);
    const room = s.layout.rooms.at(-1)!;
    room.building = false;
    room.growth = { days: 1.25, banked: 15 };
    const h = harvestInfo(room)!;
    expect(h.share).toBeCloseTo(0.5);
    // 15 so far, 15 to come at the same pace, and potatoes' bonus.
    expect(h.text).toMatch(/^About 32 raw food in 1\.3 months, all at once/);
    const chip = panelModel(makeSnapshot(s, config), room).headline.find((c) => c.label === "Next harvest")!;
    expect(chip.value).toBe("50%");
    expect(chip.meter).toEqual({ value: 0.5, max: 1 });
    // Half the pace so far: a smaller harvest, and it says so.
    room.growth = { days: 1.25, banked: 7.5 };
    expect(harvestInfo(room)!.slowed).toBe(true);
    expect(harvestInfo(room)!.text).toMatch(/slowed/);
  });

  it("lists each crop's harvest and grow time", () => {
    const { room } = farm("potatoes");
    const options = cropOptions(room);
    expect(options.find((o) => o.id === "hemp")!.label).toBe("Fiber hemp (fiber): 29 every 4 months");
    expect(options.find((o) => o.id === "leafyGreens")!.label).toBe("Leafy greens (produce): 11 every 1.5 months");
  });
});

describe("food by type and variety in the top bar (#380, #381, #383)", () => {
  it("lists raw food by kind in its tooltip, and the variety under meals", () => {
    const s = createInitialState(config);
    s.resources.rawFood = 40;
    s.food = { types: { potatoes: 30, wheat: 10 }, meals: [0, 0, 0, 0], eaten: [0, 2, 18, 0] };
    const snap = makeSnapshot(s, config);
    const food = barItems(snap)[2]!;
    const raw = food.find((i) => i.id === "res:rawFood")!;
    expect(raw.notes).toContain("By kind: Potatoes: 30 · Wheat: 10");
    expect(varietyNote(snap)).toBe("Food variety: Good (meals this past month: 10% average, 90% good), +0.5 comfort");
    expect(food.find((i) => i.id === "res:food")!.notes).toContain(varietyNote(snap));
  });
});

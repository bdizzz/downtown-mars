import { beforeEach, describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { checkPlacement, createLayout, footprint, placeRoom, type Layout, type Location } from "../src/sim/placement";
import { roomDefs } from "../src/sim/rooms";
import { createInitialState } from "../src/sim/state";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const hole = () => createHole(10, 3, 3, config.geometry);

describe("room data", () => {
  it("every room has a valid size and shape", () => {
    for (const r of roomDefs) {
      expect(["S", "M", "L", "surface"]).toContain(r.size);
      if (r.size === "surface") expect(r.surfaceSlots).toBeGreaterThan(0);
      else expect(config.shapes[r.size as "S" | "M" | "L"]?.length).toBeGreaterThan(0);
    }
  });
});

describe("footprint", () => {
  it("a wide room covers w slots in one ring, wrapping", () => {
    expect(footprint(hole(), 1, 1, 7, 4, 1).map((c) => c.slot)).toEqual([7, 8, 0, 1]);
  });

  it("a deep room widens into a wedge in the outer ring", () => {
    // Ring 1 slots 0–1 span 0°–80°; ring 2 slot centres at 11.25°, 33.75°, 56.25°, 78.75°.
    const cells = footprint(hole(), 1, 1, 0, 2, 2);
    expect(cells.filter((c) => c.ring === 1).map((c) => c.slot)).toEqual([0, 1]);
    expect(cells.filter((c) => c.ring === 2).map((c) => c.slot)).toEqual([0, 1, 2, 3]);
  });

  it("neighbouring deep rooms never claim the same outer slot", () => {
    const a = footprint(hole(), 1, 1, 0, 2, 2);
    const b = footprint(hole(), 1, 1, 2, 2, 2);
    const key = (c: { ring: number; slot: number }) => `${c.ring}:${c.slot}`;
    const shared = a.map(key).filter((k) => b.map(key).includes(k));
    expect(shared).toEqual([]);
  });
});

describe("placement rules", () => {
  let layout: Layout;
  beforeEach(() => {
    layout = createLayout(hole());
  });

  it("ring 1 rooms open onto the gallery", () => {
    expect(checkPlacement(layout, "bunk_dorm", ring(1, 1, 0, 2)).ok).toBe(true);
  });

  it("ring 2 needs a corridor", () => {
    expect(checkPlacement(layout, "bunk_dorm", ring(1, 2, 0, 2))).toMatchObject({ ok: false, reason: "Needs a corridor or the shaft gallery" });
    placeRoom(layout, "corridor", ring(1, 1, 0));
    expect(checkPlacement(layout, "bunk_dorm", ring(1, 2, 0, 2)).ok).toBe(true);
  });

  it("a spoke of corridors reaches ring 3", () => {
    placeRoom(layout, "corridor", ring(1, 1, 0));
    placeRoom(layout, "corridor", ring(1, 2, 0));
    expect(checkPlacement(layout, "clinic", ring(1, 3, 1)).ok).toBe(true);
  });

  it("rejects overlaps, locked rings, undug floors and bad shapes", () => {
    placeRoom(layout, "galley", ring(1, 1, 3));
    expect(checkPlacement(layout, "clinic", ring(1, 1, 3))).toMatchObject({ ok: false, reason: "Overlaps Galley" });
    expect(checkPlacement(layout, "clinic", ring(1, 4, 0))).toMatchObject({ ok: false, reason: "Ring 4+ needs reinforcement frames" });
    expect(checkPlacement(layout, "farm", ring(1, 2, 0, 2, 3))).toMatchObject({ ok: false });
    expect(checkPlacement(layout, "clinic", ring(5, 1, 0))).toMatchObject({ ok: false, reason: "That floor isn't dug yet" });
    expect(checkPlacement(layout, "bunk_dorm", ring(1, 1, 0, 1, 2))).toMatchObject({ ok: false, reason: "Bunk dorm can't be 1×2" });
  });

  it("surface rooms go on the surface only", () => {
    expect(checkPlacement(layout, "solar_array", ring(1, 1, 0))).toMatchObject({ ok: false });
    expect(checkPlacement(layout, "clinic", { kind: "surface", slot: 0 })).toMatchObject({ ok: false });
    expect(checkPlacement(layout, "solar_array", { kind: "surface", slot: 11 }).ok).toBe(true);
  });

  it("demolishing a corridor strands the rooms behind it", () => {
    const c = placeRoom(layout, "corridor", ring(1, 1, 0));
    placeRoom(layout, "bunk_dorm", ring(1, 2, 0, 2));
    expect(layout.rooms.find((r) => r.type === "bunk_dorm")!.connected).toBe(true);
    applyCommand({ tick: 0, rngState: 0, layout, drill: { active: false, progress: 0 }, resources: {} }, { type: "demolish", roomId: c.id! });
    expect(layout.rooms.find((r) => r.type === "bunk_dorm")!.connected).toBe(false);
  });
});

describe("starting state", () => {
  it("places the landing kit", () => {
    const s = createInitialState(config);
    expect(s.layout.rooms.map((r) => r.type).sort()).toEqual(["battery_bank", "landing_pad", "landing_pod", "solar_array"]);
  });

  it("the landing pod can't be demolished", () => {
    const s = createInitialState(config);
    const pod = s.layout.rooms.find((r) => r.type === "landing_pod")!;
    expect(applyCommand(s, { type: "demolish", roomId: pod.id })).toMatchObject({ ok: false });
  });
});

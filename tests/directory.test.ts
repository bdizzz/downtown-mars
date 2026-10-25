import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { directory, directoryCategories, NO_FILTER } from "../src/view/directory";

// The floor directory (Charts → Directory, T-149).

const fresh = () => createInitialState(config);
const ids = (floors: ReturnType<typeof directory>) => floors.flatMap((f) => f.rooms.map((r) => r.id));

describe("the floor directory (T-149)", () => {
  it("lists every room once, the surface first and then down the floors", () => {
    const st = fresh();
    const floors = directory(makeSnapshot(st, config));
    expect(floors.map((f) => f.floor)).toEqual([null, 1]);
    expect(ids(floors).sort()).toEqual(st.layout.rooms.map((r) => r.id).sort());
  });

  it("filters by kind of room, by name and to rooms with problems", () => {
    const st = fresh();
    const s = makeSnapshot(st, config);
    expect(directoryCategories(s).map((c) => c.id)).toContain("power");
    const power = directory(s, { ...NO_FILTER, category: "power" });
    expect(power.flatMap((f) => f.rooms.map((r) => r.name)).sort()).toEqual(["Battery bank", "Solar array"]);
    expect(ids(directory(s, { ...NO_FILTER, text: "BATTERY" }))).toEqual([st.layout.rooms.find((r) => r.type === "battery_bank")!.id]);
    expect(directory(s, { ...NO_FILTER, problems: true })).toEqual([]);
  });

  it("dots worn rooms and rooms being built, and finds renamed rooms by their own name", () => {
    const st = fresh();
    const battery = st.layout.rooms.find((r) => r.type === "battery_bank")!;
    battery.condition = 0.4;
    battery.name = "Big cell";
    const pod = st.layout.rooms.find((r) => r.type === "landing_pod")!;
    pod.building = true;
    const s = makeSnapshot(st, config);
    const rows = directory(s).flatMap((f) => f.rooms);
    expect(rows.find((r) => r.id === battery.id)).toMatchObject({ name: "Big cell", status: "worn" });
    expect(rows.find((r) => r.id === pod.id)!.status).toBe("building");
    expect(ids(directory(s, { ...NO_FILTER, problems: true }))).toEqual([battery.id]);
    expect(ids(directory(s, { ...NO_FILTER, text: "big" }))).toEqual([battery.id]);
  });
});

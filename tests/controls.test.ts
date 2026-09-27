import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";

/** A hole on ore with a smelter and a machine shop, well stocked. */
function industrial() {
  const s = createInitialState(config, { holeId: 1, name: "Bradbury", site: null, deposits: ["ore"], seed: 1 });
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  Object.assign(s.resources, { metal: 100, machinery: 20, electronics: 20, ore: 100 });
  const shop = applyCommand(s, { type: "build", room: "machine_shop", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 2, d: 1 } });
  if (!shop.ok) throw new Error(shop.reason);
  return { s, shop: shop.roomId! };
}

describe("room controls", () => {
  it("a paused room takes no staff and makes nothing", () => {
    const { s, shop } = industrial();
    step(s, config);
    expect(s.roomStatus[shop]!.staff).toBeGreaterThan(0);
    expect(applyCommand(s, { type: "setRoomControl", roomId: shop, paused: true }).ok).toBe(true);
    const machinery = s.resources.machinery!;
    for (let i = 0; i < 50; i++) step(s, config);
    expect(s.roomStatus[shop]).toMatchObject({ staff: 0, rate: 0, limit: "paused" });
    expect(s.resources.machinery).toBe(machinery);
    applyCommand(s, { type: "setRoomControl", roomId: shop, paused: false });
    step(s, config);
    expect(s.roomStatus[shop]!.rate).toBeGreaterThan(0);
  });

  it("'stop at' stands a room down while its output is stocked, then picks up again", () => {
    const { s, shop } = industrial();
    expect(applyCommand(s, { type: "setRoomControl", roomId: shop, stopAt: 25 }).ok).toBe(true);
    step(s, config);
    expect(s.roomStatus[shop]!.rate).toBeGreaterThan(0); // 20 machinery: under the line
    s.resources.machinery = 30;
    step(s, config);
    expect(s.roomStatus[shop]).toMatchObject({ staff: 0, limit: "stocked:machinery" });
    const metal = s.resources.metal!;
    step(s, config);
    expect(s.resources.metal).toBe(metal); // no metal eaten while standing by
    s.resources.machinery = 10;
    step(s, config);
    expect(s.roomStatus[shop]!.rate).toBeGreaterThan(0);
    applyCommand(s, { type: "setRoomControl", roomId: shop, stopAt: null });
    expect(s.layout.rooms.find((r) => r.id === shop)!.stopAt).toBeUndefined();
  });

  it("refuses 'stop at' on a room with nothing to stock", () => {
    const s = createInitialState(config);
    const dorm = applyCommand(s, { type: "build", room: "bunk_dorm", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 2, d: 1 } });
    expect(applyCommand(s, { type: "setRoomControl", roomId: dorm.ok ? dorm.roomId! : 0, stopAt: 10 }).ok).toBe(false);
  });

  it("a staging bay stands idle, crew free, until you ask for a kit", () => {
    const { s } = industrial();
    Object.assign(s.resources, { metal: 150, brick: 60 });
    const bay = applyCommand(s, { type: "build", room: "staging_bay", at: { kind: "ring", floor: 1, ring: 1, slot: 3, w: 4, d: 1 } });
    if (!bay.ok) throw new Error(bay.reason);
    for (let i = 0; i < 50; i++) step(s, config);
    expect(s.roomStatus[bay.roomId!]).toMatchObject({ staff: 0, limit: "kit" });
    expect(Object.values(s.kit).reduce((a, b) => a + b, 0)).toBe(0);
    applyCommand(s, { type: "setGathering", gathering: true });
    for (let i = 0; i < 50; i++) step(s, config);
    expect(s.roomStatus[bay.roomId!]!.staff).toBeGreaterThan(0); // filling itself is tested with the world step (founding)
  });
});

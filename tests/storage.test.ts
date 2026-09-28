import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { capacities } from "../src/sim/economy";
import type { Location } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { isStorable, roomFill, storageCaps } from "../src/sim/storage";
import { createWorld } from "../src/sim/world";
import { withStorage } from "./worlds";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const pod = (s: SimState) => s.layout.rooms.find((r) => r.type === "landing_pod")!;

describe("storage", () => {
  withStorage();

  it("dry goods need storage; water, air and power keep their own", () => {
    expect(isStorable("metal")).toBe(true);
    expect(isStorable("rations")).toBe(true);
    expect(isStorable("water")).toBe(false);
    expect(isStorable("o2")).toBe(false);
    expect(isStorable("power")).toBe(false);
  });

  it("a new colony's landing pod holds its starting stock, with room to spare", () => {
    const s = createInitialState(config);
    const caps = capacities(s, config);
    for (const [id, amount] of Object.entries(config.startingStock)) {
      if (isStorable(id)) expect(caps[id], id).toBeGreaterThanOrEqual(amount);
    }
    expect(caps.ore).toBe(0); // nothing set aside for ore yet
  });

  it("a storage room holds nothing until space is allocated, then adds to the hole's capacity", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    const r = applyCommand(s, { type: "build", room: "warehouse", at: ring(1, 1, 2, 2) });
    expect(r.ok).toBe(true);
    const warehouse = s.layout.rooms.find((x) => x.id === (r.ok ? r.roomId : 0))!;
    const metal = storageCaps(s).metal!;
    expect(applyCommand(s, { type: "setAllocation", roomId: warehouse.id, allocation: { metal: 120, brick: 80 } }).ok).toBe(true);
    expect(storageCaps(s).metal).toBe(metal + 120);
    expect(storageCaps(s).brick).toBeGreaterThanOrEqual(80);
  });

  it("can't allocate more than it holds, or goods that don't go there", () => {
    const s = createInitialState(config);
    const r = applyCommand(s, { type: "build", room: "storeroom", at: ring(1, 1, 2) });
    const id = r.ok ? r.roomId! : 0;
    expect(applyCommand(s, { type: "setAllocation", roomId: id, allocation: { metal: 100 } })).toMatchObject({ ok: false, reason: "It only holds 90" });
    expect(applyCommand(s, { type: "setAllocation", roomId: id, allocation: { water: 10 } }).ok).toBe(false);
    expect(applyCommand(s, { type: "setAllocation", roomId: pod(s).id, allocation: { metal: 400 } }).ok).toBe(true);
  });

  it("what doesn't fit is lost", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    s.resources.metal = 500;
    step(s, config);
    expect(s.resources.metal).toBe(storageCaps(s).metal);
    expect(s.ledger.current.metal?.out.Overflow).toBeGreaterThan(0);
  });

  it("shows how full each room is", () => {
    const s = createInitialState(config);
    s.resources.rations = 60; // half of the pod's 120
    expect(roomFill(s, pod(s)).byGood.rations).toBeCloseTo(60);
  });

  it("old saves keep what they could hold, in the landing pod", () => {
    const w = createWorld(config);
    const file = JSON.parse(serialize(w));
    file.version = 13;
    const p = file.state.holes[0].layout.rooms.find((r: { type: string }) => r.type === "landing_pod");
    delete p.allocation;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const caps = storageCaps(loaded.world.holes[0]!);
    expect(caps.rock).toBe(400);
    expect(caps.metal).toBe(200);
  });
});

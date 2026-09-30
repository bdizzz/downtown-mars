import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { computeEffects, effectAt, effectOnRoom } from "../src/sim/effects";
import { homeFactors } from "../src/sim/happiness";
import type { Location } from "../src/sim/placement";

// Air quality: a neighbor effect with a baseline that goes stale ring by ring
// away from the shaft. Industry fouls it, ventilation hubs and parks freshen it,
// and it's felt at home as health.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const byRing = config.effects.airQualityByRing;

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.unlocks = ["brickworks", "leisure", "recycling", "hospital"];
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 500, electronics: 500 });
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;

describe("air quality", () => {
  it("goes stale ring by ring away from the shaft", () => {
    const s = hole();
    const field = computeEffects(s.layout);
    for (let r = 1; r <= s.layout.hole.unlockedRings; r++) expect(effectAt(field, "airQuality", { floor: 1, ring: r, slot: 0 })).toBe(byRing[r - 1]);
  });

  it("a ventilation hub freshens the air around it, through corridors too", () => {
    const s = hole();
    const cell = { floor: 1, ring: 3, slot: 4 };
    const before = effectAt(computeEffects(s.layout), "airQuality", cell);
    build(s, "ventilation_hub", ring(1, 2, 3));
    const after = effectAt(computeEffects(s.layout), "airQuality", cell);
    expect(after).toBeGreaterThan(before);
  });

  it("industry fouls it, a park freshens it", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    const base = effectOnRoom(computeEffects(s.layout), "airQuality", room(s, dorm));
    build(s, "concrete_plant", ring(1, 1, 5, 2));
    const fouled = effectOnRoom(computeEffects(s.layout), "airQuality", room(s, dorm));
    expect(fouled).toBeLessThan(base);
    build(s, "park", ring(1, 1, 1, 2));
    expect(effectOnRoom(computeEffects(s.layout), "airQuality", room(s, dorm))).toBeGreaterThan(fouled);
  });

  it("is felt at home as health", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    step(s, config);
    const fresh = homeFactors(s, room(s, dorm), config).health;
    build(s, "brickworks", ring(1, 1, 5, 2));
    step(s, config);
    expect(homeFactors(s, room(s, dorm), config).health).toBeLessThan(fresh);
    build(s, "ventilation_hub", ring(1, 1, 2));
    step(s, config);
    expect(homeFactors(s, room(s, dorm), config).health).toBeGreaterThanOrEqual(fresh);
  });
});

import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { computeEffects, dustNow, effectAt, effectOnRoom } from "../src/sim/effects";
import { homeFactors } from "../src/sim/happiness";
import { ensureFloors, type Location } from "../src/sim/placement";
import { galleryEdges } from "../src/sim/edges";

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
    for (let r = 1; r <= s.layout.hole.unlockedRings; r++) expect(effectAt(field, "airQuality", { floor: 1, ring: r, slot: 4 })).toBe(byRing[r - 1]);
  });

  it("a ventilation hub freshens the rooms along the network from it, not through walls", () => {
    const s = hole();
    s.layout.hole.floors = 2;
    ensureFloors(s.layout);
    // Floor 2 is rock but for what's built: a dorm some way along a gallery tube from the hub,
    // and a clinic right behind the hub, walled off from it with no way round.
    const hub = build(s, "ventilation_hub", ring(2, 1, 1));
    const dorm = build(s, "bunk_dorm", ring(2, 1, 4, 2));
    const behind = build(s, "clinic", ring(2, 2, 1));
    const tubes = galleryEdges(s.layout.hole, 2).slice(1, 6).map((e) => e.id);
    expect(applyCommand(s, { type: "drawCorridors", edges: tubes, finish: "rock" }).ok).toBe(true);
    applyCommand(s, { type: "consoleFinish" });
    const field = computeEffects(s.layout);
    expect(effectOnRoom(field, "airQuality", room(s, hub))).toBeCloseTo(2);
    expect(effectOnRoom(field, "airQuality", room(s, dorm))).toBeGreaterThan(0);
    expect(effectOnRoom(field, "airQuality", room(s, behind))).toBe(byRing[1]);
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

describe("dust through the airlock", () => {
  it("fouls the air of the rooms along the network from the entrance, worse in a dust storm", () => {
    const s = hole();
    const near = build(s, "galley", ring(1, 1, 1)); // beside the entrance
    applyCommand(s, { type: "consoleFinish" });
    const clear = effectOnRoom(computeEffects(s.layout, dustNow(0)), "airQuality", room(s, near));
    const storm = effectOnRoom(computeEffects(s.layout, dustNow(1)), "airQuality", room(s, near));
    expect(clear).toBeLessThan(0);
    expect(storm).toBeCloseTo(clear * config.effects.dust.stormFactor, 5);
  });

  it("rebuilds the effect field as a storm blows, and again when it's over", () => {
    const s = hole();
    applyCommand(s, { type: "consoleStorm", days: 1, inDays: 0 });
    for (let i = 0; i < config.ticksPerDay / 2; i++) step(s, config);
    expect(s.effects.dust).toBeGreaterThan(1);
    applyCommand(s, { type: "consoleStorm", days: 0 });
    step(s, config);
    expect(s.effects.dust).toBe(1);
  });
});

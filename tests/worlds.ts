import { afterAll, beforeAll } from "vitest";
import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { foundHole } from "../src/sim/founding";
import { createWorld, type World } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { setAdults } from "../src/sim/people";
import { recomputeAccess, type Layout } from "../src/sim/placement";

const site = { lat: -5, lon: 140 };

/** Two holes, the first with a rover depot and plenty of metal. */
export function twoHoles(): World {
  const w = createWorld(config, 42);
  const home = w.holes[0]!;
  home.drill.active = false;
  home.earth.nextDropTick = 1e9;
  setAdults(home, 40, config);
  w.mapUnlocked = true;
  home.kit = { ...(home.kit ?? {}) };
  // Skip the staging: hand the kit over directly.
  const r = applyCommand(home, { type: "build", room: "staging_bay", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 4, d: 1 } });
  if (!r.ok) throw new Error(r.reason);
  Object.assign(home.kit, { o2: 60, machinery: 6, electronics: 4, metal: 40, brick: 20, rations: 80, water: 160, soil: 20 });
  const f = foundHole(w, config, home.holeId, site);
  if (!f.ok) throw new Error(f.reason);
  const arrive = w.convoys[0]!.arriveTick;
  while (w.tick < arrive) stepWorld(w, config);
  home.resources.metal = 150;
  home.resources.machinery = 20;
  const d = applyCommand(home, { type: "build", room: "rover_depot", at: { kind: "surface", slot: 8 } });
  if (!d.ok) throw new Error(d.reason);
  return w;
}

/** Run a block of tests with construction taking time (the setup file makes it instant for the rest). */
export function withConstructionTime(): void {
  beforeAll(() => {
    construction.instant = false;
  });
  afterAll(() => {
    construction.instant = true;
  });
}

/** Run a block of tests with real storage limits (the setup file lifts them for the rest). */
export function withStorage(): void {
  beforeAll(() => {
    storage.unlimited = false;
  });
  afterAll(() => {
    storage.unlimited = true;
  });
}

/** Every cell without a room back to solid rock (no empty space to walk through). */
export function allRock(layout: Layout): void {
  layout.open = layout.open?.map((floor, f) => floor.map((ring, ri) => ring.map((_, slot) => (layout.grid[f]?.[ri]?.[slot] ? 1 : 0))));
  recomputeAccess(layout);
}

/**
 * Ring 1 of floor 1 cleared of the landing kit (entrance included), with an
 * old-style open shaft linking every floor instead: for tests about corridors
 * and rooms, not about getting in and out.
 */
export function clearRingOne(layout: Layout): void {
  for (const r of layout.rooms.filter((x) => x.at.kind === "ring" && x.cells.some((c) => c.floor === 1 && c.ring === 1))) {
    for (const c of r.cells) layout.grid[c.floor - 1]![c.ring - 1]![c.slot] = 0;
    layout.rooms = layout.rooms.filter((x) => x !== r);
  }
  layout.openShaft = true;
  recomputeAccess(layout);
}

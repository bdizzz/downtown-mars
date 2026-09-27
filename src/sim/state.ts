import type { SimConfig } from "./config";
import { createHole } from "./geometry";
import { createLayout, placeRoom, type Layout } from "./placement";
import { roomDef } from "./rooms";

export interface SimState {
  tick: number;
  rngState: number;
  layout: Layout;
}

export function createInitialState(cfg: SimConfig): SimState {
  const h = cfg.starterHole;
  const layout = createLayout(createHole(h.shaftRadiusM, h.floors, h.unlockedRings, cfg.geometry), cfg);

  for (const k of cfg.landingKit.surface) {
    must(placeRoom(layout, k.room, { kind: "surface", slot: k.slot }, cfg), k.room);
  }
  for (const k of cfg.landingKit.ring) {
    const [w, d] = cfg.shapes[roomDef(k.room).size as keyof SimConfig["shapes"]]![0]!;
    must(placeRoom(layout, k.room, { kind: "ring", floor: k.floor, ring: k.ring, slot: k.slot, w, d }, cfg), k.room);
  }
  layout.version = 0;
  return { tick: 0, rngState: cfg.seed >>> 0, layout };
}

function must(result: { ok: boolean; reason?: string }, what: string): void {
  if (!result.ok) throw new Error(`landing kit: can't place ${what}: ${result.reason}`);
}

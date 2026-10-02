import type { SimState } from "../sim/state";
import { RING_D, openShaftRadius } from "../render3d/cylinder";
import { WALKER_RADIUS, FURNITURE_CLEARANCE, flights, obstacles, regionAt } from "../view/walk";

// A floor's walking map for the Godot viewer: the web's walk rules (view/walk.ts) sampled on a
// grid, so Godot can walk a colonist's way (in rooms through their doors, along corridors and the
// gallery tubes, round furniture, up and down stairs) without a copy of every rule. Each cell holds
// the region at its centre (rock and the open shaft are 0; then indexes into `regions`, the web's
// "open", "room:<id>" and "door:<id>"), run-length encoded; furniture's footprints and the stairs'
// flights go as they are.

/** Metres per cell: fine enough for doorways (a walker's width short of a door's). */
const CELL = 0.15;

export interface WalkMapMessage {
  type: "walkmap";
  floor: number;
  holeId: number;
  layoutVersion: number;
  /** The grid: `size` cells across from -half to +half metres on x and z, `cell` metres each. */
  size: number;
  half: number;
  cell: number;
  regions: string[];
  /** Run-length pairs [count, region index], row by row (z outer, x inner), as uint16, base64. */
  runs: string;
  /** Furniture footprints standing on the floor: corners [x, z] each. */
  obstacles: [number, number][][];
  /** Flights of stairs on this floor, climbing to the one above: foot, up, across, length, half its width. */
  flights: { foot: [number, number]; up: [number, number]; across: [number, number]; length: number; half: number }[];
  walkerRadius: number;
  furnitureClearance: number;
  buildMs: number;
}

export function walkMap(state: SimState, floor: number): WalkMapMessage {
  const t0 = performance.now();
  const layout = state.layout;
  const hole = layout.hole;
  const inner = openShaftRadius(hole);
  const half = hole.shaftRadiusM + hole.unlockedRings * RING_D + 1;
  const size = Math.ceil((2 * half) / CELL);
  const regions = ["", "open"];
  const index = new Map<string, number>([["open", 1]]);
  const runs: number[] = [];
  let value = -1;
  let count = 0;
  const push = (v: number) => {
    if (v === value && count < 65535) count++;
    else {
      if (count) runs.push(count, value);
      value = v;
      count = 1;
    }
  };
  for (let j = 0; j < size; j++) {
    const z = -half + (j + 0.5) * CELL;
    for (let i = 0; i < size; i++) {
      const x = -half + (i + 0.5) * CELL;
      const r = Math.hypot(x, z);
      if (r < inner || r > half) {
        push(0);
        continue;
      }
      const region = regionAt(layout, floor, x, z);
      if (region === null) {
        push(0);
        continue;
      }
      let k = index.get(region);
      if (k === undefined) {
        k = regions.push(region) - 1;
        index.set(region, k);
      }
      push(k);
    }
  }
  if (count) runs.push(count, value);
  return {
    type: "walkmap",
    floor,
    holeId: state.holeId,
    layoutVersion: layout.version,
    size,
    half,
    cell: CELL,
    regions,
    runs: Buffer.from(new Uint16Array(runs).buffer).toString("base64"),
    obstacles: obstacles(layout, floor).map((o) => o.corners),
    flights: flights(layout, floor),
    walkerRadius: WALKER_RADIUS,
    furnitureClearance: FURNITURE_CLEARANCE,
    buildMs: performance.now() - t0,
  };
}

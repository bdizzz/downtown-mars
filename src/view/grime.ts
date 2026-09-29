import type { EffectField } from "../sim/effects";
import type { RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";

// Wear and grime: rooms get grubbier as they age, and faster where they're
// noisy or smelly (their own cells' neighbour effects) or heavy industry.
// Purely cosmetic. Levels are whole steps, so rooms share materials and the
// 3D view only rebuilds when a room crosses into the next.

export const GRIME = {
  /** Days for age alone to bring a room to its fullest wear. */
  fullAfterDays: 60,
  /** How much each adds, at most: age, noise and smell (at the worst effect, -3), heavy industry. */
  age: 0.55,
  noise: 0.2,
  smell: 0.3,
  industry: 0.25,
  /** Levels, including 0 (spotless). */
  levels: 4,
};

const HEAVY = new Set(["industry", "power", "air", "water"]);

/** A room's wear, as a whole level from 0 (spotless) to GRIME.levels - 1. */
export function grimeLevel(room: RoomInstance, tick: number, ticksPerDay: number, field: EffectField | undefined): number {
  if (room.planned || room.building || !room.cells.length) return 0;
  // The landing kit (no built tick) has been here since the start.
  const days = Math.max(0, tick - (room.builtTick ?? 0)) / ticksPerDay;
  let g = GRIME.age * Math.min(1, days / GRIME.fullAfterDays);
  const worst = (type: string) => {
    const grid = field?.[type];
    if (!grid) return 0;
    const vals = room.cells.map((c) => grid[c.floor - 1]?.[c.ring - 1]?.[c.slot] ?? 0);
    return Math.max(0, -Math.min(...vals)) / 3;
  };
  g += GRIME.noise * worst("noise") + GRIME.smell * worst("smell");
  if (HEAVY.has(roomDef(room.type).category)) g += GRIME.industry * Math.min(1, days / 10);
  return Math.max(0, Math.min(GRIME.levels - 1, Math.floor(Math.min(1, g) * GRIME.levels)));
}

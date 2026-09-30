import { hasCondition } from "../sim/condition";
import type { RoomInstance } from "../sim/placement";

// The condition overlay's colours: a room at 100% is green, at 50% amber, at
// 0% red. Quantised into steps, so the views can group rooms by colour.

const STOPS = [
  [0, 0xd9453a],
  [0.5, 0xe6b33c],
  [1, 0x5fb35a],
] as const;
export const CONDITION_STEPS = 10;
export const CONDITION_ALPHA = 0.55;

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t));
  return (out[0]! << 16) | (out[1]! << 8) | out[2]!;
}

/** The colour for a condition (0..1), in steps. */
export function conditionColor(condition: number): number {
  const c = Math.round(Math.max(0, Math.min(1, condition)) * CONDITION_STEPS) / CONDITION_STEPS;
  for (let i = 1; i < STOPS.length; i++) {
    const [c0, col0] = STOPS[i - 1]!;
    const [c1, col1] = STOPS[i]!;
    if (c <= c1) return mix(col0, col1, (c - c0) / (c1 - c0));
  }
  return STOPS.at(-1)![1];
}

/** Rooms shown on the condition overlay, with their colours. */
export function conditionTints(rooms: RoomInstance[]): { room: RoomInstance; color: number }[] {
  return rooms.filter((r) => !r.planned && !r.building && hasCondition(r)).map((room) => ({ room, color: conditionColor(room.condition ?? 1) }));
}

/** A key that changes when the overlay's colours would. */
export function conditionKey(rooms: RoomInstance[]): string {
  return conditionTints(rooms)
    .map((t) => `${t.room.id}:${t.color}`)
    .join(",");
}

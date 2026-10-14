import type { SimState } from "./state";

// Where this tick's goods were made, so storage can put them in the room
// nearest to it (storage.ts). Kept beside the state, not in it: it's only
// for the tick, and never saved.

const made = new WeakMap<SimState, Map<string, Map<number, number>>>();

/** `amount` of a good was made in (or brought up by) this room this tick. */
export function noteMade(state: SimState, id: string, amount: number, roomId: number | undefined): void {
  if (roomId === undefined || !(amount > 0)) return;
  let byGood = made.get(state);
  if (!byGood) made.set(state, (byGood = new Map()));
  let byRoom = byGood.get(id);
  if (!byRoom) byGood.set(id, (byRoom = new Map()));
  byRoom.set(roomId, (byRoom.get(roomId) ?? 0) + amount);
}

/** What was made where since the last call, and forget it. */
export function takeMade(state: SimState): Map<string, Map<number, number>> {
  const out = made.get(state) ?? new Map<string, Map<number, number>>();
  made.delete(state);
  return out;
}

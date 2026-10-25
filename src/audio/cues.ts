import raw from "../../data/sounds.json";
import type { Message } from "../sim/messages";
import type { Snapshot } from "../sim/snapshot";
import { play, type Sfx } from "./sound";

// One place that maps what happens in the game to what it sounds like (data/sounds.json).
// The sim stays silent: happenings come from the player's commands and from the snapshot.

export type Happening = keyof typeof raw.happenings;

interface MessageRule {
  startsWith?: string;
  includes?: string;
  kind?: Message["kind"];
  is: Happening;
}

const HAPPENINGS = raw.happenings as Record<Happening, Sfx | null>;
const MESSAGE_RULES = raw.messages as MessageRule[];
const HUM_ROOMS = new Set(raw.hum.rooms);

/** Play what a happening sounds like, if anything. */
export function cue(h: Happening): void {
  const sfx = HAPPENINGS[h];
  if (sfx) play(sfx);
}

/** A message's happening: the first rule it fits. */
export function messageHappening(m: Message): Happening | null {
  const rule = MESSAGE_RULES.find((r) => (!r.startsWith || m.text.startsWith(r.startsWith)) && (!r.includes || m.text.includes(r.includes)) && (!r.kind || m.kind === r.kind));
  return rule?.is ?? null;
}

/** What the snapshot was last time, to tell what's new. */
export interface Heard {
  gameId: number;
  lastMessageTick: number;
  floors: number;
}

export function heard(s: Snapshot): Heard {
  return { gameId: s.gameId, lastMessageTick: s.messages.at(-1)?.tick ?? -1, floors: s.layout.hole.floors };
}

/** What happened since `before`: none for a new or loaded game, so old events aren't replayed. */
export function happeningsSince(before: Heard | null, s: Snapshot): Happening[] {
  if (!before || before.gameId !== s.gameId) return [];
  const out: Happening[] = [];
  for (const m of s.messages) {
    if (m.tick <= before.lastMessageTick) continue;
    const h = messageHappening(m);
    if (h) out.push(h);
  }
  if (s.layout.hole.floors > before.floors) out.push("floorDug");
  return out;
}

/** How many of the humming rooms are built. */
export function humMachines(s: Snapshot | null): number {
  return s?.layout.rooms.filter((r) => HUM_ROOMS.has(r.type) && !r.planned).length ?? 0;
}

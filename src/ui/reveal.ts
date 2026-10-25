import type { GuideState } from "../sim/state";
import { guideStep } from "./guided";

// What of the interface shows (F-007, T-084). Outside the guided tutorial, everything. In it, only
// what its steps have unlocked so far (SimState.guide.unlocked): the rest isn't rendered at all, and
// its keys do nothing. What the current step has just unlocked glows as it appears ("fresh").
//
// Ids, as the guided steps in data/tutorial.json name them; "<kind>:*" unlocks every one of a kind:
//   hud:<id>      the top bar (view/hudItems.ts HUD_IDS; the menu always shows), hud:resources the
//                 resource grid, hud:floors the floor picker
//   mode:<id>     the dock's modes: build, view, map, charts
//   room:<id>     a room in the build palette (its category shows once one of its rooms does)
//   tool:<id>     corridors, demolish, linings; and in the corridor tool, bulkhead, windows, refit
//   view:<id>     the View strip's parts: cameras, 2d, see (walls down, room colours, flows)
//   overlay:<id>  an overlay (noise, smell, health, comfort, airQuality, happiness, condition)
//   chart:<id>    a Charts button (people, trends, flows, network, construction, ...)

export interface Reveal {
  /** Whether everything shows (not guided). */
  all: boolean;
  shown: (id: string) => boolean;
  /** Just unlocked by the step the guide is on: it glows as it appears. */
  fresh: (id: string) => boolean;
}

export const SHOW_ALL: Reveal = { all: true, shown: () => true, fresh: () => false };

const has = (set: Set<string>, id: string) => set.has(id) || set.has(`${id.slice(0, id.indexOf(":"))}:*`);

export function revealFor(guide: GuideState | null | undefined): Reveal {
  // Past its last step, the guide has shown everything it means to.
  if (!guide || !guideStep(guide)) return SHOW_ALL;
  const unlocked = new Set(guide.unlocked);
  const now = new Set(guideStep(guide)?.unlocks ?? []);
  return {
    all: false,
    shown: (id) => has(unlocked, id),
    fresh: (id) => has(now, id),
  };
}

/** The class an element gets as it's revealed: " fresh" for a gentle glow, else nothing. */
export const freshClass = (r: Reveal, id: string) => (r.fresh(id) ? " fresh" : "");

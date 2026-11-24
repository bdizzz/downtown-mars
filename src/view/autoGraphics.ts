// Automatic graphics (#591): pick the preset that suits the machine from the frame rate. On the
// title, a demo floor that stays slow drops an exact preset straight to Low; anywhere, Low or Medium
// running steadily at the display's own cap steps up one preset, then watches: if the step turns out
// slow it steps back and never raises again. Pure: the readings come from view/fps.ts, the numbers
// from data/settings.json ("fps.auto"), and the caller keeps the state and acts on the answer.

import settings from "../../data/settings.json";
import type { Preset } from "./graphics";

export const AUTO = settings.fps.auto;
const LOW = settings.fps.low;
const SECONDS = settings.fps.seconds;

/** What's remembered between sessions (in the settings). */
export interface AutoGraphicsMemory {
  /** The preset auto-adjust last set, so a later change of the player's own can be told apart. */
  set: Preset | null;
  /** A raise turned out slow, or the player changed the graphics after an auto change: no more raising. */
  noRaise: boolean;
}

export const DEFAULT_AUTO_MEMORY: AutoGraphicsMemory = { set: null, noRaise: false };

export function cleanAutoMemory(raw: unknown): AutoGraphicsMemory {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AutoGraphicsMemory>;
  return { set: r.set === "low" || r.set === "medium" || r.set === "high" ? r.set : null, noRaise: r.noRaise === true };
}

export interface AutoInput {
  /** One reading a second, oldest first (fpsHistory()). */
  history: readonly number[];
  /** How many of the latest readings came after the last graphics change (older ones were drawn at other settings). */
  fresh: number;
  /** The current graphics, as a preset; "custom" is left alone. */
  preset: Preset | "custom";
  /** On the title screen, over its demo floor. */
  onTitle: boolean;
  noRaise: boolean;
  /** Just raised from this preset, and still watching how it goes (null otherwise). */
  watching: Preset | null;
}

export type AutoAction =
  | { kind: "lower"; to: Preset }
  | { kind: "raise"; to: Preset }
  /** The raise was too much: back to where it was, and no more raising. */
  | { kind: "back"; to: Preset };

const UP: Record<Preset, Preset | null> = { low: "medium", medium: "high", high: null };

/** The display's cap: the highest reading seen (requestAnimationFrame never runs faster than the screen). */
export function displayCap(h: readonly number[]): number {
  return h.reduce((m, v) => Math.max(m, v), 0);
}

/** The reading a share `q` of the way up the sorted readings (0 the slowest, 0.5 the middle). */
function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

/** What to do now, if anything. */
export function decideAutoGraphics(i: AutoInput): AutoAction | null {
  if (i.preset === "custom") return null;
  const fresh = i.history.slice(i.history.length - Math.min(Math.max(0, i.fresh), i.history.length));
  const cap = displayCap(i.history);
  if (i.watching) {
    if (fresh.length >= SECONDS && quantile(fresh.slice(-SECONDS), 0.5) < AUTO.fallBack * cap) return { kind: "back", to: i.watching };
    return null;
  }
  if (i.onTitle && i.preset !== "low" && fresh.length >= AUTO.titleSeconds && Math.max(...fresh.slice(-AUTO.titleSeconds)) < LOW) return { kind: "lower", to: "low" };
  const up = UP[i.preset];
  if (up && !i.noRaise && cap >= AUTO.minCap && fresh.length >= AUTO.raiseSeconds && quantile(fresh.slice(-AUTO.raiseSeconds), 0.1) >= AUTO.nearCap * cap) return { kind: "raise", to: up };
  return null;
}

const NAMES: Record<Preset, string> = { low: "Low", medium: "Medium", high: "High" };

/** The toast for each change. */
export function autoGraphicsToast(a: AutoAction, from: Preset): string {
  if (a.kind === "lower") return "Graphics turned down to Low for better performance on this machine. You can raise them in Settings.";
  if (a.kind === "raise") return `Graphics raised to ${NAMES[a.to]}: this machine has room to spare. You can change them in Settings.`;
  return `Graphics back to ${NAMES[a.to]}: ${NAMES[from]} was too much for this machine. They won't be raised again automatically.`;
}

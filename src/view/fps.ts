// The frame rate, kept for the graphics settings (#391): the 3D view reports every frame it
// draws, this turns them into one reading a second and keeps the last couple of minutes, so
// Settings can chart it and say when it has been low for a while. Pure: no DOM, no clock of its
// own (callers pass the time), so tests can feed it frames.

import settings from "../../data/settings.json";

// The numbers are in data/settings.json ("fps"), shared with Godot (Fps.cs).

/** Seconds of history kept. */
export const FPS_HISTORY = settings.fps.history;

/** "Consistently low": the middle reading of the last `seconds` is under `below`. */
export const LOW_FPS = { below: settings.fps.low, seconds: settings.fps.seconds };

/** So slow the game itself speaks up (a card over the game, not just the settings): the same stretch, under this. */
export const VERY_LOW_FPS = settings.fps.veryLow;

/** A gap this long between frames (a hidden tab, a stall while loading) isn't slowness: that second is dropped. */
const GAP_MS = 1000;

let history: number[] = [];
let bucketStart = -1;
let frames = 0;
let lastFrame = -1;
const listeners = new Set<() => void>();

/** The 3D view calls this once per frame with the time in milliseconds (performance.now()). */
export function recordFrame(now: number): void {
  if (lastFrame >= 0 && now - lastFrame > GAP_MS) {
    // Paused, hidden or stalled: start a fresh second rather than reading it as 1 fps.
    bucketStart = now;
    frames = 0;
  }
  lastFrame = now;
  if (bucketStart < 0) {
    bucketStart = now;
    frames = 0;
    return;
  }
  frames++;
  const elapsed = now - bucketStart;
  if (elapsed < 1000) return;
  history.push(Math.round((frames * 1000) / elapsed));
  if (history.length > FPS_HISTORY) history = history.slice(-FPS_HISTORY);
  bucketStart = now;
  frames = 0;
  for (const l of listeners) l();
}

/** One reading a second, oldest first, up to FPS_HISTORY of them. */
export function fpsHistory(): readonly number[] {
  return history;
}

/** Call back when a new reading comes in; returns the way to stop. */
export function onFps(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Forget everything (a new game, or tests). */
export function resetFps(): void {
  history = [];
  bucketStart = -1;
  frames = 0;
  lastFrame = -1;
  for (const l of listeners) l();
}

/** The middle of the last `seconds` readings (null with fewer than that: not enough to say). */
export function recentFps(h: readonly number[] = history, seconds = LOW_FPS.seconds): number | null {
  if (h.length < seconds) return null;
  const last = h.slice(-seconds).sort((a, b) => a - b);
  return last[Math.floor(last.length / 2)]!;
}

/** Has it been consistently low: the last LOW_FPS.seconds readings' middle is under LOW_FPS.below. */
export function isLowFps(h: readonly number[] = history, below = LOW_FPS.below): boolean {
  const r = recentFps(h);
  return r !== null && r < below;
}

/** Has it been under VERY_LOW_FPS for the whole stretch (by its middle reading). */
export function isVeryLowFps(h: readonly number[] = history): boolean {
  return isLowFps(h, VERY_LOW_FPS);
}

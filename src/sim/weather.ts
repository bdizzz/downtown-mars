import type { SimConfig } from "./config";
import { postMessage } from "./messages";
import type { SimState } from "./state";

// The weather: dust storms. One may be forecast any day (after the first
// few), a few days ahead; it blows for a day or more, cutting what solar
// arrays make. Whether a storm comes is decided by a hash of the hole and the
// day, not the hole's random stream, so weather never changes anything else's luck.

export interface WeatherState {
  /** The storm forecast or blowing: the ticks it starts and ends. */
  storm?: { start: number; end: number; started?: boolean };
}

/** A deterministic 0..1 for this hole on this day (and a salt, for more than one draw). */
function roll(state: SimState, day: number, salt: number): number {
  let h = state.holeId * 2654435761 + day * 40503 + salt * 97;
  for (const ch of state.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function stepWeather(state: SimState, cfg: SimConfig): void {
  const w = cfg.weather.dustStorm;
  const tpd = cfg.ticksPerDay;
  state.weather ??= {};
  const ws = state.weather;
  const storm = ws.storm;
  if (storm) {
    if (!storm.started && state.tick >= storm.start) {
      storm.started = true;
      postMessage(state, cfg, "A dust storm has blown in: the solar arrays are making much less.", "warn");
    }
    if (state.tick >= storm.end) {
      ws.storm = undefined;
      postMessage(state, cfg, "The dust storm has passed.", "good");
    }
    return;
  }
  // Once a day, a chance of a storm on the way.
  if (state.tick % tpd !== 0) return;
  const day = state.tick / tpd;
  if (day < w.earliestDay || roll(state, day, 0) >= w.chancePerDay) return;
  const between = ([a, b]: [number, number], r: number) => a + (b - a) * r;
  const start = state.tick + Math.round(between(w.warningDays, roll(state, day, 1)) * tpd);
  const end = start + Math.round(between(w.lastsDays, roll(state, day, 2)) * tpd);
  ws.storm = { start, end };
  const days = Math.round((start - state.tick) / tpd);
  postMessage(state, cfg, `Dust storm forecast in about ${days} days: charge the batteries, and expect little from the solar arrays while it blows.`, "warn");
}

/** How hard the storm is blowing now: 0 (clear) to 1, building and clearing over the ramp. */
export function stormLevel(state: SimState, cfg: SimConfig): number {
  const s = state.weather?.storm;
  if (!s || state.tick < s.start || state.tick >= s.end) return 0;
  const ramp = Math.max(1, (cfg.weather.dustStorm.rampHours / 24) * cfg.ticksPerDay);
  return Math.min(1, (state.tick - s.start) / ramp, (s.end - state.tick) / ramp);
}

/** Days until a forecast storm arrives, or null (none coming, or already here). */
export function stormDue(state: SimState, cfg: SimConfig): number | null {
  const s = state.weather?.storm;
  return s && state.tick < s.start ? (s.start - state.tick) / cfg.ticksPerDay : null;
}

/** What a room makes while the storm blows: its share of normal. */
export function stormOutput(state: SimState, cfg: SimConfig, roomType: string): number {
  const w = cfg.weather.dustStorm;
  if (!w.affects.includes(roomType)) return 1;
  const level = stormLevel(state, cfg);
  return 1 - (1 - w.output) * level;
}

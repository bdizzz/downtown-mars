import mapData from "../../data/mars-map.json";
import { gameTime } from "./clock";
import type { SimConfig } from "./config";
import { elevationAt } from "./map";
import { postMessage } from "./messages";
import type { SimState } from "./state";

// The weather: day and night, and dust storms. Solar arrays make nothing by night, and ease up to
// full output through the dawn and back down through dusk (`daylight`).
//
// Dust storms: one may be forecast any day (after the first
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
  // Once a day, a chance of a storm on the way; none while the guided tutorial's start is calm.
  if (state.tick % tpd !== 0 || state.guide?.calm) return;
  const day = state.tick / tpd;
  if (day < w.earliestDay || roll(state, day, 0) >= w.chancePerDay) return;
  const between = ([a, b]: [number, number], r: number) => a + (b - a) * r;
  const start = state.tick + Math.round(between(w.warningDays, roll(state, day, 1)) * tpd);
  const end = start + Math.round(between(w.lastsDays, roll(state, day, 2)) * tpd);
  ws.storm = { start, end };
  const days = Math.round((start - state.tick) / tpd);
  postMessage(state, cfg, `Dust storm forecast in about ${days} ${days === 1 ? "month" : "months"}: charge the batteries, and expect little from the solar arrays while it blows.`, "warn");
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

/**
 * The sun's share of full strength at an hour of the day (0..24): 0 by night, 1 through most of the
 * day, and a half-cosine S-curve through the twilight centred on sunrise and on sunset. A flattened
 * sine: over a whole day it averages (sunset − sunrise) / 24.
 */
export function daylightAt(hour: number, cfg: SimConfig): number {
  const d = cfg.weather.daylight;
  const half = d.twilightHours / 2;
  const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));
  const h = ((hour % 24) + 24) % 24;
  return Math.min(ease((h - d.sunrise + half) / d.twilightHours), ease((d.sunset + half - h) / d.twilightHours));
}

const hourOf = (state: SimState, cfg: SimConfig) => gameTime(state.tick, cfg).dayFraction * 24;

/** The sun's share of full strength now. */
export function daylight(state: SimState, cfg: SimConfig): number {
  return daylightAt(hourOf(state, cfg), cfg);
}

/** What a room makes in this light: its share of full output (1 for rooms that don't run on the sun). */
export function daylightOutput(state: SimState, cfg: SimConfig, roomType: string): number {
  return cfg.weather.daylight.affects.includes(roomType) ? daylight(state, cfg) : 1;
}

/** Days until the arrays are back at full strength (the end of the dawn), or 0 while they are. */
export function fullSunIn(state: SimState, cfg: SimConfig): number {
  if (daylight(state, cfg) >= 1) return 0;
  const d = cfg.weather.daylight;
  const full = d.sunrise + d.twilightHours / 2;
  return ((((full - hourOf(state, cfg)) % 24) + 24) % 24) / 24;
}

/** The local weather report outside a hole (T-074): flavour only, it changes nothing in the sim. */
export interface WeatherReport {
  /** Where: the site's latitude (degrees, north positive), longitude (east positive), and height above the datum (km). */
  lat: number;
  lon: number;
  elevationKm: number;
  /** The air now, and today's high and low, °C. */
  tempC: number;
  highC: number;
  lowC: number;
  pressureMbar: number;
  /** The wind's speed (m/s) and the compass bearing it blows from (degrees, 0 north). */
  windMs: number;
  windFrom: number;
  /** Dust opacity, τ: about 0.5 on a clear day, several in a storm. */
  tau: number;
  /** Sunrise and sunset (hours) and the sun's height at noon (degrees): the equinox, so no seasons. */
  sunrise: number;
  sunset: number;
  noonSunDeg: number;
}

/** The report for this hole now: from its latitude and height, the time of day, and the storm. */
export function weatherReport(state: SimState, cfg: SimConfig): WeatherReport {
  const r = cfg.weather.report;
  const d = cfg.weather.daylight;
  const lat = state.site?.lat ?? mapData.sky.defaultLatitude;
  const lon = state.site?.lon ?? 0;
  const elevationKm = state.site ? elevationAt(state.site.lat, state.site.lon) / 1000 : 0;
  const storm = stormLevel(state, cfg);
  const hour = hourOf(state, cfg);
  const day = gameTime(state.tick, cfg).day;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
  const wrap = (h: number) => ((h % 24) + 24) % 24;

  // Highs and lows: the equator's toward the poles', colder with height, the swing narrowed by dust.
  const sun = Math.cos((lat * Math.PI) / 180);
  const cooling = r.coolingPerKmC * elevationKm;
  const frost = (t: number) => Math.max(r.frostPointC, t);
  const highC = frost(lerp(r.poleHighC, r.equatorHighC, sun) - cooling - r.stormHighDropC * storm);
  const lowC = Math.min(highC, frost(lerp(r.poleLowC, r.equatorLowC, sun) - cooling + r.stormLowRiseC * storm));
  // Coldest at sunrise, warming to the warmest hour, then cooling slowly through the night.
  const rising = r.warmestHour - d.sunrise;
  const sinceDawn = wrap(hour - d.sunrise);
  const tempC = sinceDawn <= rising ? lerp(lowC, highC, ease(sinceDawn / rising)) : lerp(highC, lowC, ease((sinceDawn - rising) / (24 - rising)));

  const thin = Math.exp(-elevationKm / r.scaleHeightKm);
  const tide = 1 + r.tideShare * Math.cos(((hour - r.tidePeakHour) / 24) * 2 * Math.PI);
  const pressureMbar = r.datumPressureMbar * thin * tide;

  // The wind: calm by night, gusting up through the afternoon to the day's peak; a gale in a storm.
  const peak = lerp(r.afternoonWindMs[0], r.afternoonWindMs[1], roll(state, day, 10));
  const daySpan = d.sunset - d.sunrise + d.twilightHours;
  const gust = sinceDawn < daySpan ? Math.sin((Math.PI * sinceDawn) / daySpan) : 0;
  const windMs = lerp(r.calmWindMs + (peak - r.calmWindMs) * gust, r.stormWindMs, storm);
  const windFrom = Math.floor(roll(state, day, 11) * 8) * 45;

  // Dust: a little different each day, thinner high up where the air is thin.
  const clear = lerp(r.clearTau[0], r.clearTau[1], roll(state, day, 12)) * Math.min(1, thin);
  const tau = lerp(clear, r.stormTau, storm);

  return { lat, lon, elevationKm, tempC, highC, lowC, pressureMbar, windMs, windFrom, tau, sunrise: d.sunrise, sunset: d.sunset, noonSunDeg: 90 - Math.abs(lat) };
}

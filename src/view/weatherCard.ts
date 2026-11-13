import { formatTemperature } from "./temperature";
import type { Snapshot } from "../sim/snapshot";
import type { WeatherReport } from "../sim/weather";
import { monthsText } from "./months";

// The local weather report (T-074) as words: the top bar's chip (the air outside now) and the card
// it opens. Flavour only: inside the hole it's always shirt-sleeve warm. Shared by the web's Hud and
// the Godot viewer's (through the bridge).

/** Dust opacity (τ) up to each of these reads as that sky; above the last, a dust storm. */
const SKIES: [number, string][] = [
  [0.5, "Clear"],
  [1, "Hazy"],
  [2.5, "Dusty"],
];
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

export interface WeatherCard {
  /** The chip: the air outside now. */
  chip: { text: string; tip: string };
  title: string;
  /** Where: "22.5°N 48.0°W · 2.1 km below the datum". */
  place: string;
  rows: { label: string; value: string }[];
  note: string;
}

/** "−44 °F" (or °C, by the player's setting), with a real minus sign. */
export const degrees = (c: number) => formatTemperature(c);

const clock = (hour: number) => `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;

export function skyOf(tau: number): string {
  return SKIES.find(([upTo]) => tau <= upTo)?.[1] ?? "Dust storm";
}

function placeText(r: WeatherReport): string {
  const lat = `${Math.abs(r.lat).toFixed(1)}°${r.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(r.lon).toFixed(1)}°${r.lon >= 0 ? "E" : "W"}`;
  const km = Math.abs(r.elevationKm).toFixed(1);
  const height = Math.abs(r.elevationKm) < 0.05 ? "at the datum" : `${km} km ${r.elevationKm > 0 ? "above" : "below"} the datum`;
  return `${lat} ${lon} · ${height}`;
}

export function weatherCard(s: Snapshot, holeName = s.holeName): WeatherCard {
  const w = s.weather;
  const r = w.report;
  const sky = w.storm > 0 ? "Dust storm" : skyOf(r.tau);
  const storm = w.storm > 0 ? "Blowing now" : w.dueInDays !== null ? `Due in ${monthsText(w.dueInDays, true)}` : "None forecast";
  const wind = r.windMs < 1 ? "Still" : `${Math.round(r.windMs)} m/s from the ${COMPASS[Math.round(r.windFrom / 45) % 8]}`;
  return {
    chip: { text: degrees(r.tempC), tip: `Outside ${holeName}: ${degrees(r.tempC)}, ${sky.toLowerCase()}. Click for the weather report` },
    title: `Weather outside ${holeName}`,
    place: placeText(r),
    rows: [
      { label: "Air", value: `${degrees(r.tempC)} (high ${degrees(r.highC)}, low ${degrees(r.lowC)})` },
      { label: "Sky", value: `${sky}, dust τ ${r.tau.toFixed(1)}` },
      { label: "Wind", value: wind },
      { label: "Pressure", value: `${r.pressureMbar.toFixed(1)} mbar` },
      { label: "Sun", value: `Up ${clock(r.sunrise)}, down ${clock(r.sunset)}; ${Math.round(r.noonSunDeg)}° high at noon` },
      { label: "Storm", value: storm },
    ],
    note: "Outside only: inside the hole it's always shirt-sleeve warm.",
  };
}

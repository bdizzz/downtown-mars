// Temperatures for the views (#393): the sim keeps °C; the player reads °F
// (the default) or °C, by the Temperatures setting. Shared by the web UI and
// the bridge, so the Godot viewer's text matches (it shows °F until it has the
// setting). Also the overlay's colours: cold blue, comfortable green, hot red.

export type TemperatureUnits = "F" | "C";

let units: TemperatureUnits = "F";

/** The player's choice, set by the UI from its settings. */
export function setTemperatureUnits(u: TemperatureUnits): void {
  units = u;
}

export function temperatureUnits(): TemperatureUnits {
  return units;
}

/** °C as the player reads it: "65 °F" or "18 °C". */
export function formatTemperature(celsius: number, u: TemperatureUnits = units): string {
  return `${Math.round(inUnits(celsius, u))} °${u}`;
}

/** °C in the player's units, as a number. */
export function inUnits(celsius: number, u: TemperatureUnits = units): number {
  return u === "F" ? (celsius * 9) / 5 + 32 : celsius;
}

/** The player's units back to °C. */
export function fromUnits(v: number, u: TemperatureUnits = units): number {
  return u === "F" ? ((v - 32) * 5) / 9 : v;
}

/** A change in temperature (a heater's lift), as the player reads it: "+22 °F". */
export function formatTemperatureChange(celsius: number, u: TemperatureUnits = units): string {
  const v = u === "F" ? (celsius * 9) / 5 : celsius;
  return `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))} °${u}`;
}

/** Comfortable: from the 60s °F to below 80 °F (the comfort bands' boost, config temperature.comfort). */
export const COMFORT_LOW_C = 15.6;
export const COMFORT_HIGH_C = 26.7;

export const TEMPERATURE_COLORS = { cold: 0x4a8fe0, comfortable: 0x5cbf6a, hot: 0xe0573a };

/** The overlay's tint for a floor's temperature: colder bluer, hotter redder, comfortable a light green. */
export function temperatureTint(celsius: number): { color: number; alpha: number } {
  if (celsius < COMFORT_LOW_C) return { color: TEMPERATURE_COLORS.cold, alpha: 0.2 + Math.min(1, (COMFORT_LOW_C - celsius) / 15) * 0.45 };
  if (celsius >= COMFORT_HIGH_C) return { color: TEMPERATURE_COLORS.hot, alpha: 0.2 + Math.min(1, (celsius - COMFORT_HIGH_C) / 10) * 0.45 };
  return { color: TEMPERATURE_COLORS.comfortable, alpha: 0.18 };
}

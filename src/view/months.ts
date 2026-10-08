// A game day is shown to the player as a month (T-021): labels only, the sim still counts days.
// Long spans read as time elapsed, like an age: month 45 is "year 3, month 9" (45 = 3 × 12 + 9).
// Shared by the web UI and the bridge; Godot's clock mirrors monthLabel (godot/src/Months.cs).

export const MONTHS_A_YEAR = 12;

/** The game's date for a day count (1, 2, …): "Month 9", "Year 3, month 9", or "Year 1" on the dot. */
export function monthLabel(day: number): string {
  const y = Math.floor(day / MONTHS_A_YEAR);
  const m = day % MONTHS_A_YEAR;
  if (y === 0) return `Month ${m}`;
  return m === 0 ? `Year ${y}` : `Year ${y}, month ${m}`;
}

/** The short form for a chart axis: "M9", "Y3 M9". */
export function monthShort(day: number): string {
  const y = Math.floor(day / MONTHS_A_YEAR);
  const m = day % MONTHS_A_YEAR;
  return y === 0 ? `M${m}` : m === 0 ? `Y${y}` : `Y${y} M${m}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * A span of game days as months: "1 month", "2.5 months" (one decimal when asked and under a year),
 * and from a year up, whole years and months: "3 years 4 months", "1 year".
 */
export function monthsText(days: number, decimals = false): string {
  if (days >= MONTHS_A_YEAR) {
    const total = Math.round(days);
    const y = Math.floor(total / MONTHS_A_YEAR);
    const m = total % MONTHS_A_YEAR;
    return m === 0 ? plural(y, "year") : `${plural(y, "year")} ${plural(m, "month")}`;
  }
  const n = decimals ? Math.round(days * 10) / 10 : Math.round(days);
  return `${n} ${n === 1 ? "month" : "months"}`;
}

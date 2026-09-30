import { resourceDef } from "../sim/resources";

export const resName = (id: string) => resourceDef(id).name;

/** 12.4 → "12", 0.35 → "0.4": whole numbers unless small. */
export function num(v: number): string {
  const a = Math.abs(v);
  return a >= 10 || a === 0 ? Math.round(v).toString() : v.toFixed(1);
}

export function signed(v: number): string {
  return `${v >= 0 ? "+" : "−"}${num(Math.abs(v))}`;
}

/** Days until a stock runs out at its current rate, or null if it isn't falling. */
export function daysLeft(stock: number, ratePerDay: number): number | null {
  return ratePerDay < -0.01 ? stock / -ratePerDay : null;
}

/** Game hours as "40 min", "5 h" or "2.5 days". */
export function hoursText(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 36) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}

/** 1st, 2nd, 3rd, 4th... */
export function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${tail}`;
}

/** How the hole's diners are seated: "all 40 seated", or how many eat on the go. */
export function dining(s: { population: { count: number; served?: number; seats?: number } }): string {
  const served = s.population.served ?? 1;
  const seats = Math.round(s.population.seats ?? 0);
  if (s.population.count === 0) return `${seats} seats`;
  if (served >= 0.999) return `${seats} seats: everyone has one`;
  return `${seats} seats: ${Math.round((1 - served) * 100)}% eat on the go, and comfort is down (a canteen or galley seats more)`;
}

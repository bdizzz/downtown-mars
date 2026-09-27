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

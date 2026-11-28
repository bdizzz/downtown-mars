import { config } from "../sim/config";
import type { PowerFlow } from "../sim/economy";
import { num } from "../ui/format";

/** The share of what goes into a battery that's lost charging it, as words ("half"). */
export function chargingLoss(): string {
  const lost = 1 - config.economy.batteryEfficiency;
  return lost === 0.5 ? "half" : `${Math.round(lost * 100)}%`;
}

/** One line on where the spare solar goes (#609), or null when nothing is spare. Shared by the Power cell and the battery's panel. */
export function chargingNote(p: PowerFlow, full: boolean): string | null {
  const spare = p.made - p.used;
  if (spare <= 0.01) return null;
  if (p.chargeRate <= 0) return `${num(spare)} a month spare, with no battery bank to take it`;
  if (full) return `Battery full: ${num(spare)} a month spare goes to waste`;
  const capped = spare > p.chargeRate + 0.01 ? `; the batteries take only ${num(p.chargeRate)}` : "";
  return `Charging ${num(p.charging)} a month of ${num(spare)} spare${capped}, ${chargingLoss()} lost to charging`;
}

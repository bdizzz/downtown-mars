import type { SimConfig } from "./config";

export interface GameTime {
  day: number; // starts at 1
  hour: number;
  minute: number;
  dayFraction: number; // 0..1 through the current day
}

export function gameTime(tick: number, cfg: Pick<SimConfig, "ticksPerDay" | "startHour">): GameTime {
  const offset = (cfg.startHour / 24) * cfg.ticksPerDay;
  const t = tick + offset;
  const dayFraction = (t % cfg.ticksPerDay) / cfg.ticksPerDay;
  const minutesIntoDay = Math.floor(dayFraction * 24 * 60);
  return {
    day: Math.floor(t / cfg.ticksPerDay) + 1,
    hour: Math.floor(minutesIntoDay / 60),
    minute: minutesIntoDay % 60,
    dayFraction,
  };
}

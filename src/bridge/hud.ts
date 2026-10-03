import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { points, seriesMeta } from "../ui/trends";
import { barItems, topExtras, type BarItem, type TopExtras } from "../view/hudItems";

// The top of the Godot viewer's screen, as the web's (view/hudItems.ts): the resource bar's items,
// each with its tooltip and the lines of its two-day sparkline, and the drill, storm and supply drop.

export interface HudMessage {
  type: "hud";
  groups: (BarItem & { spark: { label: string; color: string; dashed: boolean; values: number[] }[]; span: string })[][];
  extras: TopExtras;
  /** People waiting at the office. */
  officeWaiting: number;
}

/** "Last 2 days", or "Last 5 hours" early on, for a span of ticks. */
function spanText(ticks: number): string {
  const hours = (ticks * 24) / config.ticksPerDay;
  return hours >= 24 ? `Last ${Math.round(hours / 24)} ${Math.round(hours / 24) === 1 ? "day" : "days"}` : `Last ${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function hudMessage(s: Snapshot): HudMessage {
  const h = s.history;
  return {
    type: "hud",
    groups: barItems(s).map((group) =>
      group.map((item) => {
        const meta = seriesMeta(item.trend);
        const spark = meta && h ? meta.lines.map((l) => ({ label: l.label, color: l.color, dashed: !!l.dashed, values: points(h, l.id, "2d", config.ticksPerDay).values.map(r2) })) : [];
        const n = spark[0]?.values.length ?? 0;
        return { ...item, spark, span: n > 1 ? spanText((n - 1) * (h?.every ?? 10)) : "" };
      }),
    ),
    extras: topExtras(s),
    officeWaiting: s.office.waiting.length,
  };
}

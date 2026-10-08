import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { points, seriesMeta } from "../ui/trends";
import { barItems, needs, topExtras, type BarItem, type Need, type TopExtras } from "../view/hudItems";
import { ICONS, iconSvg, type IconId } from "../view/icons";
import { monthsText } from "../view/months";

// The top of the Godot viewer's screen, as the web's (view/hudItems.ts): the resource grid's cells,
// each with its tooltip and the lines of its two-day sparkline, what needs you first, and the drill
// and supply drop. The icons (view/icons.ts) go once, when the viewer connects.

export interface HudMessage {
  type: "hud";
  groups: (BarItem & { spark: { label: string; color: string; dashed: boolean; values: number[] }[]; span: string })[][];
  extras: TopExtras;
  /** What needs you first, trouble first. */
  needs: Need[];
  /** People waiting at the office. */
  officeWaiting: number;
}

/** "Last 2 months", or "Last 5 hours" early on, for a span of ticks. */
function spanText(ticks: number): string {
  const hours = (ticks * 24) / config.ticksPerDay;
  return hours >= 24 ? `Last ${monthsText(hours / 24)}` : `Last ${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function hudMessage(s: Snapshot): HudMessage {
  const h = s.history;
  const groups = barItems(s);
  return {
    type: "hud",
    groups: groups.map((group) =>
      group.map((item) => {
        const meta = seriesMeta(item.trend);
        const spark = meta && h ? meta.lines.map((l) => ({ label: l.label, color: l.color, dashed: !!l.dashed, values: points(h, l.id, "2d", config.ticksPerDay).values.map(r2) })) : [];
        const n = spark[0]?.values.length ?? 0;
        return { ...item, spark, span: n > 1 ? spanText((n - 1) * (h?.every ?? 10)) : "" };
      }),
    ),
    extras: topExtras(s),
    needs: needs(s, groups.flat()),
    officeWaiting: s.office.waiting.length,
  };
}

/** Every icon as an SVG drawn in white, for the viewer to rasterize and tint. */
export function iconsMessage(): { type: "icons"; icons: Record<string, string> } {
  return { type: "icons", icons: Object.fromEntries((Object.keys(ICONS) as IconId[]).map((id) => [id, iconSvg(id)])) };
}

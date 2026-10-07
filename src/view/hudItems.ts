import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { isStorable } from "../sim/storage";
import { daysLeft, num, resName, signed } from "../ui/format";

// The top of the screen as data: the resource bar's items (what each shows, whether it's a worry, and
// its tooltip's title and notes) and the top bar's drill, storm and supply-drop. Shared by the web's
// ResourceBar and Hud and the Godot viewer's HUD (through the bridge).

// The stocks a player watches, left to right: life, then food, then materials.
const LIFE = ["o2", "water", "meals"] as const;
const FOOD = ["rations", "rawFood", "soil"] as const;
const MATERIALS = ["rock", "brick", "metal", "machinery", "electronics"] as const;
/** Shown only where there's some: they come from the ground under certain sites. */
const REGIONAL = ["ore", "silica"] as const;
/** Shown once there's some: made later in the game. */
const LATER = ["glass", "fiber"] as const;
const WARN_DAYS = 2;
/** Storage this full, with more coming in, shows as full. */
const FULL_AT = 0.97;

export interface BarItem {
  /** The Trends series it opens (and its tooltip's sparkline). */
  trend: string;
  label: string;
  value: string;
  /** A small figure after the value: a rate (neg or pos), health, or the afterglow. */
  rate?: { text: string; tone: "neg" | "pos" | "glow" | "" };
  warn: boolean;
  full: boolean;
  title: string;
  notes: string[];
}

function stock(id: string, s: Snapshot): BarItem {
  const v = s.resources[id] ?? 0;
  const cap = s.capacities[id] ?? 0;
  const rate = s.rates[id] ?? 0;
  const left = daysLeft(v, rate);
  // Dry goods: storage may be full (what arrives is lost) or missing altogether.
  const stored = isStorable(id) && Number.isFinite(cap);
  const full = stored && cap > 0 && v >= cap * FULL_AT && rate > 0;
  const none = stored && cap <= 0;
  return {
    trend: id,
    label: resName(id),
    value: num(v),
    ...(Math.abs(rate) >= 0.05 ? { rate: { text: signed(rate), tone: rate < 0 ? ("neg" as const) : ("pos" as const) } } : {}),
    warn: left !== null && left < WARN_DAYS,
    full: full || (none && rate > 0),
    title: resName(id),
    notes: [`${num(v)} of ${num(cap)} · ${signed(rate)} a day`, ...(left !== null ? [`Runs out in ${left.toFixed(1)} days`] : []), ...(!stored ? [] : none ? ["No storage set aside for it"] : full ? ["Storage full: more is lost"] : [])],
  };
}

/** "38 adults, 4 children, 2 elders", leaving out stages nobody is in yet. */
function stagesText(st: { child: number; adult: number; elder: number }): string {
  const parts = [
    [st.adult, "adult", "adults"],
    [st.child, "child", "children"],
    [st.elder, "elder", "elders"],
  ] as const;
  return (
    parts
      .filter(([n]) => n > 0)
      .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
      .join(", ") || "nobody"
  );
}

/** The resource bar, in its groups: the colony, life, food, materials. */
export function barItems(s: Snapshot): BarItem[][] {
  const { made, used } = s.power;
  const co2 = s.resources.co2 ?? 0;
  const pop = s.population;
  const glow = s.afterglow.points >= 0.5;
  const colony: BarItem[] = [
    {
      trend: "population",
      label: "Colonists",
      value: `${pop.count}/${s.beds}`,
      rate: { text: `♥ ${Math.round(pop.health)}`, tone: "" },
      warn: pop.health < 70,
      full: false,
      title: "Colonists",
      notes: [`${pop.count} in ${s.beds} beds: ${stagesText(s.stages)}`, `Health ${Math.round(pop.health)}, from oxygen, water, meals, sanitation and CO2`],
    },
    {
      trend: "happiness",
      label: "Happy",
      value: String(Math.round(s.happiness.average)),
      ...(glow ? { rate: { text: `✦${Math.round(s.afterglow.points)}`, tone: "glow" as const } } : {}),
      warn: s.happiness.productivity < 1,
      full: false,
      title: "Happiness",
      notes: [
        "The average, across every home",
        ...(glow ? [`+${Math.round(s.afterglow.points)} afterglow: the thrill of arrival, gone in ${Math.ceil(s.afterglow.daysLeft)} days`] : []),
        ...(s.happiness.productivity < 1 ? [`Rooms at ${Math.round(s.happiness.productivity * 100)}% from low morale`] : []),
        ...(s.happiness.homeless ? [`${s.happiness.homeless} homeless`] : []),
      ],
    },
    {
      trend: "condition",
      label: "Condition",
      value: `${Math.round(s.maintenance.overall * 100)}%`,
      warn: s.maintenance.overall < 0.5,
      full: false,
      title: "Condition",
      notes: ["Every room's, weighted by size", "Below 50% rooms get people down; below 30% they slow (Charts → Maintenance)"],
    },
    { trend: "employed", label: "Workers", value: `${s.workforce.employed}/${s.workforce.total}`, warn: false, full: false, title: "Workers", notes: [`${s.workforce.employed} of ${s.workforce.total} adults employed`] },
    {
      trend: "power:flow",
      label: "Power",
      value: `${num(used)}/${num(made)}`,
      warn: used > made + 0.01,
      full: false,
      title: "Power",
      notes: [`Made ${num(made)}, used ${num(used)} a day`, `Battery ${num(s.resources.power ?? 0)} of ${num(s.capacities.power ?? 0)}`],
    },
  ];
  const life = [...LIFE.map((id) => stock(id, s)), { trend: "co2", label: "CO2", value: num(co2), warn: co2 > 60, full: false, title: "CO2", notes: [`${num(co2)} in the air; above 100 harms health`] }];
  const food = FOOD.map((id) => stock(id, s));
  const materials = [
    ...MATERIALS.map((id) => stock(id, s)),
    ...REGIONAL.filter((id) => (s.resources[id] ?? 0) > 0 || s.holeDeposits.includes(id)).map((id) => stock(id, s)),
    ...LATER.filter((id) => (s.resources[id] ?? 0) > 0).map((id) => stock(id, s)),
  ];
  return [colony, life, food, materials];
}

/** Game-time estimate, e.g. "~1.2 days" or "~5 h". */
export function gameDuration(ticks: number): string {
  const days = ticks / config.ticksPerDay;
  return days >= 1 ? `~${days.toFixed(1)} days` : `~${Math.ceil(days * 24)} h`;
}

export interface TopExtras {
  /** The drill: the floor it's on and how far, with a pause button; or at its deepest. */
  drill: { text: string; tip: string; active: boolean; canPause: boolean } | null;
  /** A dust storm blowing, or coming. */
  storm: { text: string; tip: string } | null;
  /** The next Earth supply drop. */
  drop: { text: string; warn: boolean };
}

export function topExtras(s: Snapshot): TopExtras {
  const d = s.drill;
  return {
    drill: d.floor ? { text: `⛏ F${d.floor} ${Math.floor(d.progress * 100)}%`, tip: `${gameDuration(d.ticksLeft)} left`, active: d.active, canPause: true } : { text: "⛏ Max depth", tip: "", active: false, canPause: false },
    storm:
      s.weather.storm > 0 || s.weather.dueInDays !== null
        ? {
            text: s.weather.storm > 0 ? "🌪 Storm" : `🌪 in ${s.weather.dueInDays!.toFixed(1)}d`,
            tip: s.weather.storm > 0 ? "A dust storm is blowing: the solar arrays make less" : "A dust storm is coming: it will cut what the solar arrays make",
          }
        : null,
    drop: { text: s.earth.waiting ? "🚀 Drop waiting: pad needs staff and power" : `🚀 Drop in ${gameDuration(s.earth.ticksToDrop)}`, warn: s.earth.waiting },
  };
}

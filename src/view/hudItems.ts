import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { isStorable } from "../sim/storage";
import { daysLeft, num, resName, signed } from "../ui/format";
import { monthsText } from "./months";

// The top of the screen as data: the resource bar's items (what each shows, whether it's a worry, and
// its tooltip's title and notes) and the top bar's drill, storm and supply-drop. Shared by the web's
// ResourceBar and Hud and the Godot viewer's HUD (through the bridge).

// The stocks a player watches, left to right: life, then food, then materials.
const LIFE = ["water", "meals"] as const;
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
    notes: [`${num(v)} of ${num(cap)} · ${signed(rate)} a month`, ...(left !== null ? [`Runs out in ${monthsText(left, true)}`] : []), ...(!stored ? [] : none ? ["No storage set aside for it"] : full ? ["Storage full: more is lost"] : [])],
  };
}

/** A % of the air: one decimal, or two for small amounts (CO2). */
export function airPctText(v: number): string {
  return `${v < 1 ? v.toFixed(2) : v.toFixed(1)}%`;
}

/** The air as a mix (sim/air.ts): O2 and CO2 as % of the living volume, with their bands. */
function airItems(s: Snapshot): BarItem[] {
  const a = config.air;
  const { volume, o2Pct, co2Pct } = s.air;
  const units = volume * a.unitsPerM3;
  const pctRate = (id: string) => (units > 0 ? ((s.rates[id] ?? 0) / units) * 100 : 0);
  const o2Rate = pctRate("o2");
  const rate = (r: number) => (Math.abs(r) >= 0.05 ? { rate: { text: `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`, tone: r < 0 ? ("neg" as const) : ("pos" as const) } } : {});
  const o2Band =
    o2Pct < a.o2VeryLow
      ? `Very low: below ${a.o2VeryLow}% health falls fast`
      : o2Pct < a.o2Low
        ? `Low: below ${a.o2Low}% health falls`
        : o2Pct > a.o2High
          ? `High: above ${a.o2High}% is a fire risk`
          : `Comfortable (${a.o2Low}–${a.o2High}%); life support aims for ${a.o2Target}%`;
  return [
    {
      trend: "o2Pct",
      label: "Air",
      value: `${airPctText(o2Pct)} O2`,
      ...rate(o2Rate),
      warn: o2Pct < a.o2Low || o2Pct > a.o2High,
      full: false,
      title: "Air: oxygen",
      notes: [
        o2Band,
        `${num(s.resources.o2 ?? 0)} O2 in ${num(volume)} m³ of living space · ${signed(o2Rate)} points a month`,
        "Digging dilutes the air: the same oxygen over more space",
      ],
    },
    {
      trend: "co2Pct",
      label: "CO2",
      value: airPctText(co2Pct),
      warn: co2Pct > a.co2Harmful,
      full: false,
      title: "Air: CO2",
      notes: [
        co2Pct > a.co2Dangerous ? `Dangerous: above ${a.co2Dangerous}% health falls fast` : co2Pct > a.co2Harmful ? `Harmful: above ${a.co2Harmful}% health falls` : `Fine below ${a.co2Harmful}%; life support scrubs it down to ${a.co2Floor}%`,
        `${num(s.resources.co2 ?? 0)} CO2 in the air, breathed out 1:1 for the oxygen breathed in`,
      ],
    },
  ];
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
      notes: [`${pop.count} in ${s.beds} beds: ${stagesText(s.stages)}`, `Health ${Math.round(pop.health)}, from the air's oxygen and CO2, water, meals and sanitation`],
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
        ...(glow ? [`+${Math.round(s.afterglow.points)} afterglow: the thrill of arrival, gone in ${monthsText(Math.ceil(s.afterglow.daysLeft))}`] : []),
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
      notes: [`Made ${num(made)}, used ${num(used)} a month`, `Battery ${num(s.resources.power ?? 0)} of ${num(s.capacities.power ?? 0)}`],
    },
  ];
  const air = airItems(s);
  const life = [air[0]!, ...LIFE.map((id) => stock(id, s)), air[1]!];
  const food = FOOD.map((id) => stock(id, s));
  const materials = [
    ...MATERIALS.map((id) => stock(id, s)),
    ...REGIONAL.filter((id) => (s.resources[id] ?? 0) > 0 || s.holeDeposits.includes(id)).map((id) => stock(id, s)),
    ...LATER.filter((id) => (s.resources[id] ?? 0) > 0).map((id) => stock(id, s)),
  ];
  return [colony, life, food, materials];
}

/** Game-time estimate, e.g. "~1.2 months" or "~5 h". */
export function gameDuration(ticks: number): string {
  const days = ticks / config.ticksPerDay;
  return days >= 1 ? `~${monthsText(days, true)}` : `~${Math.ceil(days * 24)} h`;
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

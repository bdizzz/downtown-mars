import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { CONDITION } from "../sim/condition";
import { isStorable } from "../sim/storage";
import { daysLeft, hoursText, num, resName, signed } from "../ui/format";
import { monthsText } from "./months";
import { isIcon, type IconId } from "./icons";

// The top of the screen as data: the resource grid's cells (icon, value, trend arrow, how worried to
// be, and the tooltip's title and notes), what needs you first, and the top bar's drill and
// supply drop. Shared by the web's ResourceBar and Hud and the Godot viewer's HUD (through the bridge).
// Every element has a stable id (HUD_IDS, and "res:<trend>" for the cells), for the tutorial to
// point at and hide or reveal.

// The stocks a player watches, left to right: life, then food, then materials. Meals and Earth
// rations share one cell (EATING): what matters is how much there is to eat.
const LIFE = ["water"] as const;
const EATING = ["meals", "rations"] as const;
const FOOD = ["rawFood", "soil"] as const;
const MATERIALS = ["rock", "brick", "metal", "machinery", "electronics"] as const;
/** Shown only where there's some: they come from the ground under certain sites. */
const REGIONAL = ["ore", "silica"] as const;
/** Shown once there's some: made later in the game. */
const LATER = ["glass", "fiber"] as const;
/** Runs out in under this many days: a worry (amber); under BAD_DAYS, trouble (red). */
const WARN_DAYS = 2;
const BAD_DAYS = 0.5;
/** Health below these: a worry, then trouble (the Trends chart marks the first). */
const HEALTH_WARN = 70;
const HEALTH_BAD = 50;
/** Less than this left reads as none. */
const EMPTY = 0.05;
/** Storage this full, with more coming in, shows as full. */
const FULL_AT = 0.97;
/** A rate this small shows no arrow. */
const STEADY = 0.05;
/** At most this many things in the "needs you" slot; the rest wait behind a "+N". */
export const NEEDS_SHOWN = 3;
/** The grid's sections, in barItems' order. */
export const GROUPS = ["Colony", "Life", "Food", "Materials"] as const;

/** The top bar's elements, by their stable ids (the cells are "res:<trend>"). */
export const HUD_IDS = ["menu", "hole", "clock", "speed", "needs", "drill", "drop", "office", "resources"] as const;
export type HudId = (typeof HUD_IDS)[number];

/** How a cell reads: fine, a worry (amber), trouble (red), or storage full (blue). */
export type Level = "ok" | "warn" | "bad" | "full";

export interface BarItem {
  /** Its stable id, "res:<trend>". */
  id: string;
  icon: IconId;
  /** The Trends series it opens (and its tooltip's sparkline). */
  trend: string;
  /** Its name, for the tooltip, screen readers and the "needs you" slot. */
  label: string;
  value: string;
  /** Rising or falling, for the tiny arrow. */
  dir?: "up" | "down";
  /** A small figure after the value: the afterglow. */
  sub?: { text: string; tone: "glow" };
  level: Level;
  /** What the "needs you" slot says when it's a worry or trouble: "Water out in 1.2 months". */
  alert?: string;
  title: string;
  notes: string[];
}

const dirOf = (rate: number): { dir?: "up" | "down" } => (Math.abs(rate) >= STEADY ? { dir: rate > 0 ? "up" : "down" } : {});

function stockLevel(left: number | null, full: boolean): Level {
  return left !== null && left < BAD_DAYS ? "bad" : left !== null && left < WARN_DAYS ? "warn" : full ? "full" : "ok";
}

/** What runs out, said in the "needs you" slot: "Out of water", "Water out in 5 h". */
const runsOut = (name: string, v: number, left: number) => (v < EMPTY ? `Out of ${name.toLowerCase()}` : `${name} out in ${hoursText(left * 24)}`);

function stock(id: string, s: Snapshot): BarItem {
  const v = s.resources[id] ?? 0;
  const cap = s.capacities[id] ?? 0;
  const rate = s.rates[id] ?? 0;
  const left = daysLeft(v, rate);
  // Dry goods: storage may be full (what arrives is lost) or missing altogether.
  const stored = isStorable(id) && Number.isFinite(cap);
  const full = stored && cap > 0 && v >= cap * FULL_AT && rate > 0;
  const none = stored && cap <= 0;
  const level = stockLevel(left, full || (none && rate > 0));
  return {
    id: `res:${id}`,
    icon: isIcon(id) ? id : "rock",
    trend: id,
    label: resName(id),
    value: num(v),
    ...dirOf(rate),
    level,
    ...(left !== null && (level === "warn" || level === "bad") ? { alert: runsOut(resName(id), v, left) } : {}),
    title: resName(id),
    notes: [`${num(v)} of ${num(cap)} · ${signed(rate)} a month`, ...(left !== null ? [v < EMPTY ? "None left" : `Runs out in ${hoursText(left * 24)}`] : []), ...(!stored ? [] : none ? ["No storage set aside for it"] : full ? ["Storage full: more is lost"] : [])],
  };
}

/**
 * Meals and Earth rations as one cell: their sum, and when that runs out; each on its own in the
 * tooltip. People eat only meals (kitchens cook rations in place of raw food), so meals running out
 * is trouble whatever the rations say.
 */
function eating(s: Snapshot): BarItem {
  const parts = EATING.map((id) => stock(id, s));
  const v = EATING.reduce((n, id) => n + (s.resources[id] ?? 0), 0);
  const rate = EATING.reduce((n, id) => n + (s.rates[id] ?? 0), 0);
  const left = daysLeft(v, rate);
  const meals = parts[0]!;
  const mealsOut = meals.level === "bad";
  const level = mealsOut ? "bad" : stockLevel(left, parts.some((p) => p.level === "full"));
  const name = "Meals and rations";
  const alert = mealsOut && (left === null || left >= BAD_DAYS) ? (meals.alert ?? "Out of meals") + ": cook the rations" : left !== null && (level === "warn" || level === "bad") ? runsOut("Food", v, left) : undefined;
  return {
    id: "res:food",
    icon: "meals",
    trend: "food",
    label: name,
    value: num(v),
    ...dirOf(rate),
    level,
    ...(alert ? { alert } : {}),
    title: name,
    notes: [
      `${num(v)} to eat · ${signed(rate)} a month${left !== null ? ` · ${v < EMPTY ? "none left" : `runs out in ${hoursText(left * 24)}`}` : ""}`,
      ...parts.map((p) => `${p.label}: ${p.notes[0]}${p.level === "full" ? " (storage full)" : ""}`),
      "People eat meals; kitchens cook rations into meals when raw food runs short",
    ],
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
  const o2Level: Level = o2Pct < a.o2VeryLow ? "bad" : o2Pct < a.o2Low || o2Pct > a.o2High ? "warn" : "ok";
  const co2Level: Level = co2Pct > a.co2Dangerous ? "bad" : co2Pct > a.co2Harmful ? "warn" : "ok";
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
      id: "res:o2Pct",
      icon: "o2",
      trend: "o2Pct",
      label: "Oxygen",
      value: airPctText(o2Pct),
      ...dirOf(o2Rate),
      level: o2Level,
      ...(o2Level !== "ok" ? { alert: o2Pct > a.o2High ? `Fire risk: oxygen at ${airPctText(o2Pct)}` : `Oxygen low: ${airPctText(o2Pct)}` } : {}),
      title: "Air: oxygen",
      notes: [
        o2Band,
        `${num(s.resources.o2 ?? 0)} O2 in ${num(volume)} m³ of living space · ${signed(o2Rate)} points a month`,
        "Digging dilutes the air: the same oxygen over more space",
      ],
    },
    {
      id: "res:co2Pct",
      icon: "co2",
      trend: "co2Pct",
      label: "CO2",
      value: airPctText(co2Pct),
      ...dirOf(pctRate("co2")),
      level: co2Level,
      ...(co2Level !== "ok" ? { alert: `CO2 ${co2Level === "bad" ? "dangerous" : "harmful"}: ${airPctText(co2Pct)}` } : {}),
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

/** The resource grid, in its groups: the colony, life, food, materials. */
export function barItems(s: Snapshot): BarItem[][] {
  const { made, used } = s.power;
  const pop = s.population;
  const health = Math.round(pop.health);
  const glow = s.afterglow.points >= 0.5;
  const healthLevel: Level = health < HEALTH_BAD ? "bad" : health < HEALTH_WARN ? "warn" : "ok";
  const condition = s.maintenance.overall;
  const conditionLevel: Level = condition < CONDITION.wornBelow ? "bad" : condition < CONDITION.unhappyBelow ? "warn" : "ok";
  const short = used > made + 0.01;
  const battery = s.resources.power ?? 0;
  const powerLevel: Level = !short ? "ok" : battery < 0.5 ? "bad" : "warn";
  const homeless = s.happiness.homeless;
  const colony: BarItem[] = [
    {
      id: "res:population",
      icon: "colonists",
      trend: "population",
      label: "Colonists",
      value: `${pop.count}/${s.beds}`,
      level: homeless ? "warn" : "ok",
      ...(homeless ? { alert: `${homeless} homeless` } : {}),
      title: "Colonists",
      notes: [`${pop.count} in ${s.beds} beds: ${stagesText(s.stages)}`, ...(homeless ? [`${homeless} homeless: build homes`] : [])],
    },
    {
      id: "res:health",
      icon: "health",
      trend: "health",
      label: "Health",
      value: String(health),
      level: healthLevel,
      ...(healthLevel !== "ok" ? { alert: `Health ${health}` } : {}),
      title: "Health",
      notes: [`The average, out of 100; below ${HEALTH_WARN} it's a worry`, "From the air's oxygen and CO2, water, meals and sanitation"],
    },
    {
      id: "res:happiness",
      icon: "happiness",
      trend: "happiness",
      label: "Happiness",
      value: String(Math.round(s.happiness.average)),
      ...(glow ? { sub: { text: `✦${Math.round(s.afterglow.points)}`, tone: "glow" as const } } : {}),
      level: s.happiness.productivity < 1 ? "warn" : "ok",
      ...(s.happiness.productivity < 1 ? { alert: `Morale: rooms at ${Math.round(s.happiness.productivity * 100)}%` } : {}),
      title: "Happiness",
      notes: [
        "The average, across every home",
        ...(glow ? [`+${Math.round(s.afterglow.points)} afterglow: the thrill of arrival, gone in ${monthsText(Math.ceil(s.afterglow.daysLeft))}`] : []),
        ...(s.happiness.productivity < 1 ? [`Rooms at ${Math.round(s.happiness.productivity * 100)}% from low morale`] : []),
      ],
    },
    {
      id: "res:condition",
      icon: "condition",
      trend: "condition",
      label: "Condition",
      value: `${Math.round(condition * 100)}%`,
      level: conditionLevel,
      ...(conditionLevel !== "ok" ? { alert: `Condition ${Math.round(condition * 100)}%` } : {}),
      title: "Condition",
      notes: [
        "Every room's, weighted by size",
        `Below ${Math.round(CONDITION.unhappyBelow * 100)}% rooms get people down; below ${Math.round(CONDITION.wornBelow * 100)}% they slow (Charts → Maintenance)`,
      ],
    },
    {
      id: "res:employed",
      icon: "workers",
      trend: "employed",
      label: "Workers",
      value: `${s.workforce.employed}/${s.workforce.total}`,
      level: "ok",
      title: "Workers",
      notes: [`${s.workforce.employed} of ${s.workforce.total} adults employed`],
    },
    {
      id: "res:power:flow",
      icon: "power",
      trend: "power:flow",
      label: "Power",
      value: `${num(used)}/${num(made)}`,
      level: powerLevel,
      ...(short ? { alert: powerLevel === "bad" ? "Power short, battery flat" : "Power short: on battery" } : {}),
      title: "Power",
      notes: [`Used ${num(used)} of ${num(made)} made a month`, `Battery ${num(battery)} of ${num(s.capacities.power ?? 0)}`],
    },
  ];
  const air = airItems(s);
  const life = [air[0]!, ...LIFE.map((id) => stock(id, s)), air[1]!];
  const food = [eating(s), ...FOOD.map((id) => stock(id, s))];
  const materials = [
    ...MATERIALS.map((id) => stock(id, s)),
    ...REGIONAL.filter((id) => (s.resources[id] ?? 0) > 0 || s.holeDeposits.includes(id)).map((id) => stock(id, s)),
    ...LATER.filter((id) => (s.resources[id] ?? 0) > 0).map((id) => stock(id, s)),
  ];
  return [colony, life, food, materials];
}

/** Something that needs the player: trouble (red) or a worry (amber), and what clicking it opens. */
export interface Need {
  id: string;
  icon: IconId;
  text: string;
  tip: string;
  level: "warn" | "bad";
  /** A Trends series, or the office. */
  open: { trend: string } | { office: true } | null;
}

/**
 * What needs you first: every cell in trouble or a worry, a storm, a drop the pad can't land, and
 * people waiting at the office. Trouble first, then in the grid's order. Empty when all is well.
 */
export function needs(s: Snapshot, items = barItems(s).flat()): Need[] {
  const out: Need[] = [];
  for (const i of items)
    if (i.alert && (i.level === "warn" || i.level === "bad")) out.push({ id: i.id, icon: i.icon, text: i.alert, tip: i.notes.join(" · "), level: i.level, open: { trend: i.trend } });
  const w = s.weather;
  if (w.storm > 0) out.push({ id: "storm", icon: "storm", text: "Dust storm", tip: "A dust storm is blowing: the solar arrays make less", level: "warn", open: null });
  else if (w.dueInDays !== null)
    out.push({ id: "storm", icon: "storm", text: `Storm in ${monthsText(w.dueInDays, true)}`, tip: "A dust storm is coming: it will cut what the solar arrays make", level: "warn", open: null });
  if (s.earth.waiting) out.push({ id: "drop", icon: "drop", text: "Drop waiting", tip: "A supply drop is waiting: the landing pad needs staff and power", level: "warn", open: null });
  const waiting = s.office.waiting.length;
  if (waiting) out.push({ id: "office", icon: "office", text: `${waiting} at the office`, tip: `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting to see you`, level: "warn", open: { office: true } });
  return [...out.filter((n) => n.level === "bad"), ...out.filter((n) => n.level === "warn")];
}

/** Game-time estimate, e.g. "~1.2 months" or "~5 h". */
export function gameDuration(ticks: number): string {
  const days = ticks / config.ticksPerDay;
  return days >= 1 ? `~${monthsText(days, true)}` : `~${Math.ceil(days * 24)} h`;
}

export interface TopExtras {
  /** The drill: the floor it's on and how far, with a pause button; or at its deepest. */
  drill: { text: string; tip: string; active: boolean; canPause: boolean };
  /** The next Earth supply drop. */
  drop: { text: string; tip: string; warn: boolean };
}

export function topExtras(s: Snapshot): TopExtras {
  const d = s.drill;
  return {
    drill: d.floor
      ? { text: `F${d.floor} ${Math.floor(d.progress * 100)}%`, tip: `The drill, on floor ${d.floor}: ${gameDuration(d.ticksLeft)} left${d.active ? "" : " (paused)"}`, active: d.active, canPause: true }
      : { text: "Max", tip: "The drill is at its deepest", active: false, canPause: false },
    drop: s.earth.waiting
      ? { text: "Waiting", tip: "A supply drop is waiting: the landing pad needs staff and power", warn: true }
      : { text: gameDuration(s.earth.ticksToDrop), tip: `The next Earth supply drop, in ${gameDuration(s.earth.ticksToDrop)}`, warn: false },
  };
}

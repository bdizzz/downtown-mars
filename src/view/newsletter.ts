import raw from "../../data/newsletter.json";
import notables from "../../data/notables.json";
import { milestoneDef } from "../sim/milestones";
import type { NewsIssue, NewsVoice } from "../sim/newsletter";
import { hash01 } from "../sim/people";
import { roomDef } from "../sim/rooms";
import { monthLabel } from "./months";
import type { PortraitPerson } from "./portrait";

// The Hole Truth (#424): one month's facts (sim/newsletter.ts) written up as a newsletter from the
// templates in data/newsletter.json. The issue's own seed rolls the dice, so it reads the same every
// time it's opened. Shared by the web's card (ui/Newsletter.tsx) and the Godot viewer's.

interface StoryDef {
  kicker: string;
  head: string[];
  text?: string[];
  /** A quiet month that's a hard one. */
  rough?: string[];
  one?: string[];
  many?: string[];
}
/** A section that's just for fun: items picked by the dice, some with a byline. */
interface FluffDef {
  kicker: string;
  items?: string[];
  by?: string[];
  crops?: string[];
  /** The neighbour of the month. */
  intro?: string[];
  traits?: Record<string, string>;
  outro?: string[];
  spots?: string[];
}
interface VoiceDef {
  kicker: string;
  intro: string[];
  causes: Record<string, string[]>;
  default: string[];
}

const DATA = raw as unknown as {
  name: string;
  taglines: string[];
  price: string;
  printed: string;
  weather: { storm: string; clear: string };
  order: string[];
  stories: Record<string, StoryDef>;
  grumble: VoiceDef;
  praise: VoiceDef;
  finds: Record<string, string>;
  fillers: string[];
  notices: number;
  fluffPerIssue: number;
  fluffQuiet: number;
  jobs: string[];
  fluff: Record<string, FluffDef>;
  sign: string[];
  numbers: string[];
  roughBelow: number;
};

export const NEWSLETTER_NAME = DATA.name;

export interface NewsStory {
  /** The section it's in ("Births", "What the drill found"). */
  kicker: string;
  /** Empty for an event's outcome, which is told in the game's own words. */
  head: string;
  text: string;
  /** Whose photo runs beside it (the neighbour of the month). */
  who?: PortraitPerson;
}

export interface NewsLetter {
  kicker: string;
  /** Who's writing ("Ana Ruiz, organizer, writes in:"). */
  intro: string;
  quote: string;
}

export interface Newsletter {
  name: string;
  tagline: string;
  /** "No. 4 · Month 4". */
  dateline: string;
  /** The masthead's ears and the strip under it. */
  hole: string;
  population: number;
  /** The weather ear: "Dust storm" or "Clear, dusty". */
  weather: string;
  price: string;
  printed: string;
  /** The month's biggest story. */
  lead: NewsStory;
  /** The rest, briefly. */
  stories: NewsStory[];
  letters: NewsLetter[];
  /** Just for fun, not news: the neighbour of the month, sports, the stars, galley gossip… */
  fluff: NewsStory[];
  /** Small notices at the bottom. */
  notices: string[];
  sign: string;
}

type Vars = Record<string, string | number>;

function fill(text: string, v: Vars): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
}

const words = (n: number) => DATA.numbers[n] ?? String(n);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string) => (s.length > 1 && s[1] === s[1]!.toLowerCase() ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** "a galley, two homes and a clinic". */
function roomList(built: Record<string, number>): string {
  const parts = Object.entries(built).map(([type, n]) => {
    const name = lower(roomDef(type).name);
    return n === 1 ? `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}` : `${words(n)} ${name.endsWith("s") ? name : `${name}s`}`;
  });
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** Write up an issue. */
export function writeNewsletter(issue: NewsIssue): Newsletter {
  let salt = 0;
  const pick = <T>(list: T[]): T => list[Math.floor(hash01(issue.seed, ++salt) * list.length)]!;
  const baby = pick(notables.firstNames);
  const family = pick(notables.lastNames);
  const firstBuilt = Object.keys(issue.built)[0];
  const builtCount = Object.values(issue.built).reduce((s, n) => s + n, 0);
  const vars: Vars = {
    hole: issue.hole,
    pop: issue.population,
    happy: issue.happiness,
    floor: issue.depth,
    baby,
    family,
    room: firstBuilt ? lower(roomDef(firstBuilt).name) : "",
    rooms: roomList(issue.built),
  };
  const firstBirth = issue.born > 0 && issue.bornEver === issue.born;
  const milestones = issue.milestones.map((id) => milestoneDef(id)?.title ?? id).filter((t) => !(firstBirth && t === milestoneDef("first_birth")?.title));
  const counts: Record<string, number> = {
    firstBirth: firstBirth ? 1 : 0,
    births: firstBirth ? 0 : issue.born,
    arrivals: issue.arrivals,
    passings: issue.passedAway,
    grownUp: issue.grownUp,
    floors: issue.floors,
    rooms: builtCount,
    find: issue.finds.length,
    milestone: milestones.length,
    festival: issue.festival ? 1 : 0,
    storm: issue.storm ? 1 : 0,
    outcome: issue.outcomes.length,
    notables: issue.newNotables.length,
  };
  const stories: NewsStory[] = [];
  for (const id of DATA.order) {
    const n = counts[id] ?? 0;
    if (!n) continue;
    const def = DATA.stories[id]!;
    const v: Vars = { ...vars, n, N: capital(words(n)), w: words(n) };
    if (id === "find") {
      v.find = DATA.finds[issue.finds[0]!] ?? "something";
    }
    if (id === "milestone") v.milestone = milestones.join(" and ");
    if (id === "notables") v.name = issue.newNotables[0]!;
    if (id === "outcome") {
      // The game's own words for how things turned out, one story each.
      for (const text of issue.outcomes) stories.push({ kicker: def.kicker, head: "", text });
      continue;
    }
    const texts = (n === 1 ? def.one : def.many) ?? def.text ?? [];
    stories.push({ kicker: def.kicker, head: capital(fill(pick(def.head), v)), text: fill(pick(texts), v) });
  }
  if (!stories.length) {
    const q = DATA.stories.quiet!;
    const rough = Math.min(issue.health ?? 100, issue.happiness) < DATA.roughBelow;
    const head = rough ? `A hard month in ${issue.hole}` : fill(pick(q.head), vars);
    stories.push({ kicker: q.kicker, head, text: fill(pick(rough ? q.rough! : q.text!), vars) });
  }
  const letters: NewsLetter[] = [];
  const letter = (who: NewsVoice | null, def: VoiceDef) => {
    if (!who) return;
    const cause = who.cause.split(":")[1] ?? "";
    const v: Vars = { ...vars, name: who.name, role: who.role, trait: who.trait };
    letters.push({ kicker: def.kicker, intro: fill(pick(def.intro), v), quote: fill(pick(def.causes[cause] ?? def.default), v) });
  };
  letter(issue.grumble, DATA.grumble);
  letter(issue.praise, DATA.praise);
  return {
    name: DATA.name,
    // Its own die, so the rest of the issue reads as it did before taglines rotated.
    tagline: DATA.taglines[Math.floor(hash01(issue.seed, 7777) * DATA.taglines.length)]!,
    dateline: `No. ${issue.no} · ${monthLabel(issue.day)}`,
    hole: issue.hole,
    population: issue.population,
    weather: issue.storm ? DATA.weather.storm : DATA.weather.clear,
    price: DATA.price,
    printed: DATA.printed,
    lead: stories[0]!,
    stories: stories.slice(1),
    letters,
    fluff: writeFluff(issue, stories.length === 1 && !issue.outcomes.length && stories[0]!.kicker === DATA.stories.quiet!.kicker, pick),
    notices: pickSome(DATA.fillers, DATA.notices, pick),
    sign: pick(DATA.sign),
  };
}

/** n different items from a list, by the dice. */
function pickSome<T>(list: T[], n: number, pick: <U>(l: U[]) => U): T[] {
  const left = [...list];
  const out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(left.indexOf(pick(left)), 1)[0]!);
  return out;
}

/** The fun sections: the neighbour of the month (when there's one), then a few others, more on a quiet month. */
function writeFluff(issue: NewsIssue, quiet: boolean, pick: <U>(l: U[]) => U): NewsStory[] {
  const F = DATA.fluff;
  const out: NewsStory[] = [];
  const floors = Math.max(2, issue.depth);
  const a = 1 + Math.floor(pick([...Array(floors).keys()]));
  let b = 1 + Math.floor(pick([...Array(floors).keys()]));
  if (b === a) b = (a % floors) + 1;
  const hi = 60 + Math.floor(pick([...Array(60).keys()]));
  const v: Vars = {
    hole: issue.hole,
    name: `${pick(notables.firstNames)} ${pick(notables.lastNames)}`,
    job: pick(DATA.jobs),
    a,
    b,
    x: hi,
    y: hi - 1 - Math.floor(pick([...Array(30).keys()])),
    w: words(2 + Math.floor(pick([0, 1, 2, 3]))),
  };
  const f = issue.featured;
  const p = F.profile;
  if (f && p) {
    const v2: Vars = { ...v, name: f.name, role: f.role, spot: pick(p.spots ?? [""]) };
    const traits = f.traits.map((t) => p.traits?.[t]).filter((t): t is string => !!t);
    out.push({ kicker: p.kicker, head: f.name, who: f, text: [fill(pick(p.intro ?? []), v2), ...traits, fill(pick(p.outro ?? []), v2)].join(" ") });
  }
  const want = (quiet ? DATA.fluffQuiet : DATA.fluffPerIssue) + (out.length ? 0 : 1);
  for (const id of pickSome(Object.keys(F).filter((k) => k !== "profile"), want, pick)) {
    const def = F[id]!;
    const v2: Vars = { ...v, crop: pick(def.crops ?? [""]) };
    let text = fill(pick(def.items ?? []), v2);
    if (def.by) text += ` (${fill(pick(def.by), v2)})`;
    out.push({ kicker: def.kicker, head: "", text });
  }
  return out;
}

/** The issue whose card should open by itself now: the latest, if it hasn't been read. */
export function unreadIssue(s: { newsletter: { issues: NewsIssue[]; read: number } }): NewsIssue | null {
  const latest = s.newsletter.issues.at(-1);
  return latest && latest.no > s.newsletter.read ? latest : null;
}

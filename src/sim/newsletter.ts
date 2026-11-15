import raw from "../../data/newsletter.json";
import { gameTime } from "./clock";
import type { SimConfig } from "./config";
import { hash01 } from "./people";
import type { SimState } from "./state";

// The Hole Truth (#424): the colony's monthly newsletter. Through the month the sim keeps a small
// tally (rooms opened, newcomers, how events turned out) and a mark of its counters at the month's
// start (born, passed away, grown up, finds, milestones); when the month turns, the difference is
// that month's issue: plain facts, with the people it names picked here so they stay the same in
// the save. The words are the view's (view/newsletter.ts, from data/newsletter.json), shared by
// the web's card and the Godot viewer's.

/** A notable the issue quotes: who they are, and what about. */
export interface NewsVoice {
  name: string;
  role: string;
  trait: string;
  /** The happiness cause they're on about (data/diagnosis.json), "happiness:noise". */
  cause: string;
}

/** One month's facts. */
export interface NewsIssue {
  /** Issue number, from 1 for the hole's first. */
  no: number;
  /** The month it covers (gameTime day): from publishHour that day to publishHour the next. */
  day: number;
  hole: string;
  /** For the view's dice: the same words every time this issue is read. */
  seed: number;
  population: number;
  /** People more (or fewer) than at the month's start. */
  change: number;
  happiness: number;
  /** The hole's health, 0..100. */
  health: number;
  born: number;
  /** Born here ever, after this month (1 means this month's was the first). */
  bornEver: number;
  passedAway: number;
  grownUp: number;
  arrivals: number;
  /** Rooms finished, by type. */
  built: Record<string, number>;
  /** Floors the drill finished. */
  floors: number;
  /** The deepest floor dug, after this month. */
  depth: number;
  /** What the drill struck (event ids). */
  finds: string[];
  /** Milestones reached (ids, data/milestones.json). */
  milestones: string[];
  festival: boolean;
  storm: boolean;
  /** How events turned out, as the game told it (already filled in). */
  outcomes: string[];
  /** Notables who joined. */
  newNotables: string[];
  /** A grumble, and a good word, when there's something to say. */
  grumble: NewsVoice | null;
  praise: NewsVoice | null;
  /** The neighbour of the month: a notable profiled for fun (absent in issues from before it). */
  featured?: { id: number; name: string; role: string; traits: string[] } | null;
}

/** The counters at the month's start, and what's been tallied since. */
interface NewsMark {
  day: number;
  tick: number;
  population: number;
  born: number;
  passedAway: number;
  grownUp: number;
  floors: number;
  found: number;
  notables: number[];
  arrivals: number;
  built: Record<string, number>;
  outcomes: string[];
}

export interface NewsletterState {
  mark: NewsMark;
  issues: NewsIssue[];
  next: number;
  /** The latest issue the player has read (its card closed). */
  read: number;
}

export const newsletterData = raw as unknown as {
  keep: number;
  /** The hour each issue comes out, the morning after its month ends. */
  publishHour: number;
  maxOutcomes: number;
  /** A cause must cost (or give) this many happiness points to be grumbled (or praised) about. */
  grumblePoints: number;
  praisePoints: number;
};

/**
 * The paper's month: the game's month, but turning at publishHour (6:00) rather than midnight, so the
 * paper comes out with the morning. A milestone keeps its calendar month, so one reached before 6:00
 * on a month's first day reads in the next issue.
 */
function paperDay(tick: number, cfg: SimConfig): number {
  return gameTime(Math.max(0, tick - Math.round((newsletterData.publishHour / 24) * cfg.ticksPerDay)), cfg).day;
}

function markNow(state: SimState, cfg: SimConfig): NewsMark {
  const pop = state.population;
  return {
    day: paperDay(state.tick, cfg),
    tick: state.tick,
    population: pop.count,
    born: pop.born ?? 0,
    passedAway: pop.passedAway ?? 0,
    grownUp: pop.grownUp ?? 0,
    floors: state.layout.hole.floors,
    found: state.events?.found.length ?? 0,
    notables: state.notables.map((n) => n.id),
    arrivals: 0,
    built: {},
    outcomes: [],
  };
}

/** Newcomers who settled here (from Earth, an event, migration). Before the first month starts, nothing. */
export function newsArrivals(state: SimState, n: number): void {
  if (state.newsletter && n > 0) state.newsletter.mark.arrivals += n;
}

/** A room finished. */
export function newsBuilt(state: SimState, type: string): void {
  const b = state.newsletter?.mark.built;
  if (b) b[type] = (b[type] ?? 0) + 1;
}

/** How an event turned out, in the game's words. */
export function newsOutcome(state: SimState, text: string): void {
  const m = state.newsletter?.mark;
  if (m && m.outcomes.length < newsletterData.maxOutcomes) m.outcomes.push(text);
}

/** A voice for a cause: a notable picked by the issue's dice (never the deputy, who writes it). */
function voice(state: SimState, seed: number, cause: string, salt: number): NewsVoice | null {
  const pool = state.notables.slice(1);
  if (!pool.length) return null;
  const n = pool[Math.floor(hash01(seed, salt) * pool.length)]!;
  return { name: n.name, role: n.role, trait: n.traits[Math.floor(hash01(seed, salt, 1) * n.traits.length)] ?? "", cause };
}

function writeIssue(state: SimState, cfg: SimConfig, nl: NewsletterState): NewsIssue {
  const m = nl.mark;
  const pop = state.population;
  const ev = state.events;
  const seed = Math.floor(hash01(state.holeId, m.day, nl.next) * 0x7fffffff);
  // What's said about the hole: its biggest pull down and lift (not the base, the afterglow or events).
  const points = Object.entries(state.happiness.points ?? {}).filter(([id]) => !["base", "afterglow", "events"].includes(id));
  points.sort((a, b) => a[1] - b[1]);
  const worst = points[0];
  const best = points.at(-1);
  const grumble = worst && worst[1] <= -newsletterData.grumblePoints ? voice(state, seed, `happiness:${worst[0]}`, 1) : null;
  let praise = best && best[1] >= newsletterData.praisePoints ? voice(state, seed, `happiness:${best[0]}`, 2) : null;
  if (praise && grumble && praise.name === grumble.name) praise = voice(state, seed, praise.cause, 3);
  if (praise && grumble && praise.name === grumble.name) praise = null;
  // The neighbour of the month: someone not already quoted (nor the deputy).
  const quoted = new Set([grumble?.name, praise?.name]);
  const others = state.notables.slice(1).filter((n) => !quoted.has(n.name));
  const pickFeatured = others[Math.floor(hash01(seed, 9) * others.length)];
  const featured = pickFeatured ? { id: pickFeatured.id, name: pickFeatured.name, role: pickFeatured.role, traits: [...pickFeatured.traits] } : null;
  const storm = state.weather?.storm;
  const festival = ev?.festival;
  return {
    no: nl.next,
    day: m.day,
    hole: state.name,
    seed,
    population: pop.count,
    change: pop.count - m.population,
    happiness: Math.round(state.happiness.average),
    health: Math.round(pop.health),
    born: (pop.born ?? 0) - m.born,
    bornEver: pop.born ?? 0,
    passedAway: (pop.passedAway ?? 0) - m.passedAway,
    grownUp: (pop.grownUp ?? 0) - m.grownUp,
    arrivals: m.arrivals,
    built: m.built,
    floors: Math.max(0, state.layout.hole.floors - m.floors),
    depth: state.layout.hole.floors,
    finds: (ev?.found ?? []).slice(m.found),
    milestones: (state.milestones ?? []).filter((r) => r.day !== null && r.day >= m.day && r.day < paperDay(state.tick, cfg)).map((r) => r.id),
    festival: !!festival && festival.startTick >= m.tick,
    storm: !!storm?.started && storm.start < state.tick && storm.end > m.tick,
    outcomes: m.outcomes,
    newNotables: state.notables.filter((n) => !m.notables.includes(n.id)).map((n) => n.name),
    grumble,
    praise,
    featured,
  };
}

/** Once a month turns: the month just gone becomes an issue, and the new one starts counting. */
export function stepNewsletter(state: SimState, cfg: SimConfig): void {
  if (state.failed) return;
  const today = paperDay(state.tick, cfg);
  const nl = state.newsletter;
  if (!nl) {
    state.newsletter = { mark: markNow(state, cfg), issues: [], next: 1, read: 0 };
    return;
  }
  if (today === nl.mark.day) return;
  // The guided tutorial's calm start has no news yet: the month just starts over.
  if (!state.guide?.calm) {
    nl.issues.push(writeIssue(state, cfg, nl));
    nl.next += 1;
    if (nl.issues.length > newsletterData.keep) nl.issues.shift();
  }
  nl.mark = markNow(state, cfg);
}

/** The player closed the issue's card: it won't open by itself again. */
export function readNewsletter(state: SimState, no: number): void {
  if (state.newsletter) state.newsletter.read = Math.max(state.newsletter.read, no);
}

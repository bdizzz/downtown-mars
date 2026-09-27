import raw from "../../data/culture.json";
import type { SimConfig } from "./config";
import { averageFlows } from "./ledger";
import { postMessage } from "./messages";
import { ordinanceDef } from "./ordinances";
import type { SimState } from "./state";
import type { World } from "./world";

// Each hole's culture turns slowly toward a target set by how it lives, and
// every pair of holes holds an opinion of each other, moved daily by
// fairness, similarity and decay (DESIGN.md, Cultural drift model).

export type Axis = "work" | "order" | "identity" | "openness";
export type Culture = Record<Axis, number>;

export const culture = raw as unknown as {
  axes: { id: Axis; left: string; right: string }[];
  start: Culture;
  target: {
    workSpan: number;
    freedomBase: number;
    identitySpan: number;
    identityGoods: string[];
    insularBase: number;
    openPerTradeShare: number;
  };
  goodsValue: Record<string, number>;
  driftPerDay: number;
  contactPullPerTrip: number;
  opinion: {
    childOfParent: number;
    parentOfChild: number;
    fairnessPerDay: number;
    fairnessScale: number;
    givenKeptPerDay: number;
    childGraceDays: number;
    similarityThreshold: number;
    similarityPerDay: number;
    decayPerDay: number;
    loadSwing: number;
    refuseBelow: number;
  };
  tiers: { min: number; name: string }[];
};

const AXES = culture.axes.map((a) => a.id);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How one hole sees another: an opinion, and the value it has sent that way lately. */
export interface Relation {
  opinion: number;
  /** Value delivered to the other hole, fading daily. */
  given: number;
}

const key = (from: number, to: number) => `${from}>${to}`;

export function relation(world: World, from: number, to: number): Relation {
  return (world.relations[key(from, to)] ??= { opinion: 0, given: 0 });
}

export function tier(opinion: number): string {
  return culture.tiers.find((t) => opinion >= t.min)?.name ?? culture.tiers[culture.tiers.length - 1]!.name;
}

export const valueOf = (resource: string, amount: number) => (culture.goodsValue[resource] ?? 1) * amount;

/** Where a hole's culture is heading, from how it lives now. */
export function cultureTarget(hole: SimState, cfg: SimConfig): Culture {
  const t = culture.target;
  const idle = hole.workforce.total > 0 ? 1 - hole.workforce.employed / hole.workforce.total : 0.5;
  const out: Culture = { work: (idle - 0.5) * t.workSpan, order: t.freedomBase, identity: 0, openness: t.insularBase };

  // Earth or Mars: where the goods come from. Trade: how much moves by rover.
  const flows = averageFlows(hole, cfg);
  let total = 0;
  let earth = 0;
  let traded = 0;
  for (const [res, f] of Object.entries(flows)) {
    for (const [label, v] of Object.entries(f.in)) {
      const value = valueOf(res, v);
      if (label.startsWith("Rover ")) traded += value;
      if (!t.identityGoods.includes(res)) continue;
      total += value;
      if (label === "Earth drops") earth += value;
    }
    for (const [label, v] of Object.entries(f.out)) if (label.startsWith("Rover ")) traded += valueOf(res, v);
  }
  out.identity = total > 0 ? t.identitySpan * (1 - (2 * earth) / total) : 0;
  out.openness = t.insularBase - t.openPerTradeShare * (total + traded > 0 ? traded / (total + traded) : 0);

  for (const id of hole.ordinances) {
    for (const [axis, v] of Object.entries(ordinanceDef(id).culture ?? {})) out[axis as Axis] += v;
  }
  for (const a of AXES) out[a] = clamp(out[a], -1, 1);
  return out;
}

/** Mean slider gap, 0 (identical) to 2 (opposite on everything). */
export function cultureGap(a: Culture, b: Culture): number {
  return AXES.reduce((s, x) => s + Math.abs(a[x] - b[x]), 0) / AXES.length;
}

/** A new hole: the volunteers bring their parent's culture, and the two start fond of each other. */
export function foundFrom(world: World, parent: SimState, child: SimState): void {
  child.culture = { ...parent.culture };
  child.parentHoleId = parent.holeId;
  child.foundedTick = world.tick;
  relation(world, child.holeId, parent.holeId).opinion = culture.opinion.childOfParent;
  relation(world, parent.holeId, child.holeId).opinion = culture.opinion.parentOfChild;
}

/** A rover delivered: the gift is remembered, and contact pulls the two cultures together. */
export function noteDelivery(world: World, from: SimState, to: SimState, resource: string, amount: number): void {
  relation(world, from.holeId, to.holeId).given += valueOf(resource, amount);
  const pull = culture.contactPullPerTrip;
  for (const a of AXES) {
    const d = to.culture[a] - from.culture[a];
    from.culture[a] += d * pull;
    to.culture[a] -= d * pull;
  }
}

/** How much more (or less) a hole loads for another, by how it feels about them. 0 means it refuses. */
export function loadFactor(world: World, from: SimState, to: SimState): number {
  const o = relation(world, from.holeId, to.holeId).opinion;
  if (o < culture.opinion.refuseBelow) return 0;
  return 1 + (o / 100) * culture.opinion.loadSwing;
}

/** Once a day: cultures drift, opinions move. */
export function stepCulture(world: World, cfg: SimConfig): void {
  for (const hole of world.holes) {
    const target = cultureTarget(hole, cfg);
    for (const a of AXES) hole.culture[a] += (target[a] - hole.culture[a]) * culture.driftPerDay;
  }
  const o = culture.opinion;
  for (const a of world.holes) {
    for (const b of world.holes) {
      if (a === b) continue;
      // a's opinion of b.
      const rel = relation(world, a.holeId, b.holeId);
      const back = relation(world, b.holeId, a.holeId);
      const before = tier(rel.opinion);
      let fairness = o.fairnessPerDay * Math.tanh((back.given - rel.given) / o.fairnessScale);
      // Early aid to a young child doesn't count against it.
      const young = b.parentHoleId === a.holeId && world.tick - b.foundedTick < o.childGraceDays * cfg.ticksPerDay;
      if (young) fairness = Math.max(0, fairness);
      const similarity = -o.similarityPerDay * Math.max(0, cultureGap(a.culture, b.culture) - o.similarityThreshold);
      const decay = -rel.opinion * o.decayPerDay;
      rel.opinion = clamp(rel.opinion + fairness + similarity + decay, -100, 100);
      const after = tier(rel.opinion);
      if (after !== before) {
        const warmer = culture.tiers.findIndex((t) => t.name === after) < culture.tiers.findIndex((t) => t.name === before);
        postMessage(a, cfg, `${a.name} now feels ${after.toLowerCase()} toward ${b.name}.`, warmer ? "good" : "warn");
      }
    }
  }
  // Gifts fade from memory, a little each day.
  for (const r of Object.values(world.relations)) r.given *= o.givenKeptPerDay;
}

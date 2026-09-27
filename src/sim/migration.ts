import type { SimConfig } from "./config";
import { culture as cultureCfg } from "./culture";
import { beds } from "./earth";
import { travelTicks } from "./founding";
import { postMessage } from "./messages";
import { ordinanceDef } from "./ordinances";
import { addCohorts, countStage, people, takeAdults, type Cohort } from "./people";
import type { SimState } from "./state";
import { holeById, type World } from "./world";

// Soft failure: colonists in an unhappy hole leave for a clearly happier one
// with room for them, a few at a time, rather than suffering in place. They
// travel at rover speed and bring their culture with them.

export interface Migration {
  fromHoleId: number;
  toHoleId: number;
  people: Cohort[];
  departTick: number;
  arriveTick: number;
}

export function closedBorders(hole: SimState): boolean {
  return hole.ordinances.some((id) => ordinanceDef(id).closedBorders);
}

const heads = (cs: Cohort[]) => cs.reduce((n, c) => n + c.count, 0);

/** Beds a hole has free, counting people already on their way there. */
function roomFor(world: World, hole: SimState): number {
  const inbound = world.migrations.filter((m) => m.toHoleId === hole.holeId).reduce((n, m) => n + heads(m.people), 0);
  return beds(hole) - hole.population.count - inbound;
}

/** Where colonists from this hole would go, if anywhere: the happiest hole with room that will have them. */
export function destination(world: World, from: SimState): SimState | null {
  const m = people.migration;
  if (!from.site || from.happiness.average >= m.leaveBelow) return null;
  const options = world.holes.filter(
    (h) =>
      h !== from &&
      h.site &&
      !closedBorders(h) &&
      h.happiness.average >= from.happiness.average + m.happierBy &&
      roomFor(world, h) > 0,
  );
  options.sort((a, b) => b.happiness.average - a.happiness.average || a.holeId - b.holeId);
  return options[0] ?? null;
}

/** Once a day: unhappy holes lose a few adults to happier ones. */
export function stepMigration(world: World, cfg: SimConfig): void {
  const m = people.migration;
  for (const from of world.holes) {
    const to = destination(world, from);
    if (!to) continue;
    const adults = countStage(from, "adult");
    const n = Math.min(m.maxPerDay, Math.ceil(adults * m.sharePerDay), roomFor(world, to), adults - m.minAdultsLeft);
    if (n <= 0) continue;
    const leaving = takeAdults(from, n);
    world.migrations.push({
      fromHoleId: from.holeId,
      toHoleId: to.holeId,
      people: leaving,
      departTick: world.tick,
      arriveTick: world.tick + travelTicks(from.site!, to.site!, cfg),
    });
    postMessage(from, cfg, `${n} ${n === 1 ? "colonist has" : "colonists have"} left for ${to.name}, looking for a happier life.`, "warn");
  }
}

/** Movers on the road arrive: they settle in, bringing a little of home's culture. */
export function stepArrivals(world: World, cfg: SimConfig): void {
  const arrived = world.migrations.filter((x) => world.tick >= x.arriveTick);
  if (!arrived.length) return;
  world.migrations = world.migrations.filter((x) => world.tick < x.arriveTick);
  for (const mv of arrived) {
    const to = holeById(world, mv.toHoleId);
    const from = holeById(world, mv.fromHoleId);
    if (!to) continue;
    const n = heads(mv.people);
    if (from) {
      const share = (n / Math.max(1, to.population.count + n)) * people.migration.culturePull;
      for (const a of cultureCfg.axes) to.culture[a.id] += (from.culture[a.id] - to.culture[a.id]) * share;
    }
    addCohorts(to, mv.people);
    postMessage(to, cfg, `${n} ${n === 1 ? "colonist has" : "colonists have"} arrived from ${from?.name ?? "another hole"} to settle here.`, "good");
  }
}

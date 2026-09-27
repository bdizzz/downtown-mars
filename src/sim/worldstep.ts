import type { SimConfig } from "./config";
import { stepConvoys, stepStaging } from "./founding";
import { postMessage } from "./messages";
import { network } from "./network";
import { stepRoutes } from "./rovers";
import { loadFactor, noteDelivery, stepCulture } from "./culture";
import { stepArrivals, stepMigration } from "./migration";
import { step } from "./step";
import { totalPopulation, type World } from "./world";

/**
 * Advance the whole world one tick: every hole in id order (so the world
 * stays deterministic), then what happens between holes.
 */
export function stepWorld(world: World, cfg: SimConfig): void {
  world.tick += 1;
  for (const hole of world.holes) {
    step(hole, cfg);
    stepStaging(hole, cfg);
  }
  stepConvoys(world, cfg);
  stepRoutes(
    world,
    cfg,
    (from, to) => loadFactor(world, from, to),
    (from, to, res, n) => noteDelivery(world, from, to, res, n),
  );
  stepArrivals(world, cfg);
  if (world.tick % cfg.ticksPerDay === 0) {
    stepCulture(world, cfg);
    stepMigration(world, cfg);
  }
  if (!world.mapUnlocked && totalPopulation(world) >= network.mapUnlockPopulation) {
    world.mapUnlocked = true;
    postMessage(world.holes[0]!, cfg, "The map is open: scout a site for a second hole. Somewhere with what this one lacks.", "good");
  }
}

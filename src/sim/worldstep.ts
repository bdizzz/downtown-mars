import type { SimConfig } from "./config";
import { stepConvoys, stepStaging } from "./founding";
import { postMessage } from "./messages";
import { network } from "./network";
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
  if (!world.mapUnlocked && totalPopulation(world) >= network.mapUnlockPopulation) {
    world.mapUnlocked = true;
    postMessage(world.holes[0]!, cfg, "The map is open: scout a site for a second hole. Somewhere with what this one lacks.", "good");
  }
}

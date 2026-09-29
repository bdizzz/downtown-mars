import type { SimConfig } from "./config";
import { stepDigging } from "./digging";
import { stepEarth } from "./earth";
import { stepWeather } from "./weather";
import { stepCondition } from "./condition";
import { stepEconomy, updateRates } from "./economy";
import { refreshEffects } from "./effects";
import { stepHappiness } from "./happiness";
import { stepLedger } from "./ledger";
import { stepVisits } from "./visits";
import { stepAging, stepGrief, stepUnlocks } from "./people";
import { stepBirths } from "./births";
import { stepConstruction } from "./construction";
import type { SimState } from "./state";

// Advance the simulation by one fixed tick. Mutates state in place.
export function step(state: SimState, cfg: SimConfig): void {
  state.tick += 1;
  const before = { ...state.resources };
  stepWeather(state, cfg);
  stepDigging(state, cfg);
  state.effects = refreshEffects(state.layout, state.effects);
  stepEconomy(state, cfg);
  stepCondition(state, cfg);
  stepConstruction(state, cfg);
  // Rates show the hole's own production and use, so measure before drops land.
  updateRates(state, before, cfg);
  stepEarth(state, cfg);
  stepAging(state, cfg);
  stepGrief(state, cfg);
  stepBirths(state, cfg);
  stepUnlocks(state, cfg);
  stepHappiness(state, cfg);
  stepVisits(state, cfg);
  stepLedger(state, cfg);
}

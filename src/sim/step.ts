import type { SimConfig } from "./config";
import { stepDigging } from "./digging";
import { stepEarth } from "./earth";
import { stepWeather, stormLevel } from "./weather";
import { stepCondition } from "./condition";
import { stepEconomy, updateRates } from "./economy";
import { dustNow, refreshEffects } from "./effects";
import { stepHappiness } from "./happiness";
import { stepLedger } from "./ledger";
import { stepVisits } from "./visits";
import { stepEvents } from "./events";
import { stepAging, stepGrief, stepUnlocks } from "./people";
import { stepBirths } from "./births";
import { stepConstruction } from "./construction";
import type { SimState } from "./state";

import { stepHistory } from "./history";

// Advance the simulation by one fixed tick. Mutates state in place.
export function step(state: SimState, cfg: SimConfig): void {
  state.tick += 1;
  const before = { ...state.resources };
  stepWeather(state, cfg);
  stepDigging(state, cfg);
  // A dust storm drives more dust through the airlocks (the dome's are better sealed).
  state.effects = refreshEffects(state.layout, state.effects, dustNow(state.layout.domed ? 0 : stormLevel(state, cfg)));
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
  stepEvents(state, cfg);
  stepLedger(state, cfg);
  stepHistory(state, cfg);
}

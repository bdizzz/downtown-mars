import { construction } from "../src/sim/construction";

// Most tests are about what rooms do, not how long they take to build: build
// everything at once. Tests of construction time, and the playthroughs, turn
// this off for themselves (see `withConstructionTime`).
construction.instant = true;

import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";

// Most tests are about what rooms do, not how long they take to build or
// where the goods are kept: build everything at once, and store without
// limit. Tests of construction time and storage, and the playthroughs, turn
// these off for themselves (see `withConstructionTime`, `withStorage`).
construction.instant = true;
storage.unlimited = true;

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../src/sim/config";
import { serialize, summarize } from "../src/sim/save";
import type { SimState } from "../src/sim/state";
import { runNetwork } from "../tests/netbot";

// The dev saves (T-013): the network bot on the default seed, saved at the
// end of a few days worth opening. Rerun after the game moves on (npm run saves),
// and check the moments still suit with --probe: past day 120 or so the bot's
// home hole runs short of water and declines, so "late" stops there, with both
// holes healthy.

const MOMENTS: Record<number, { name: string; what: string }> = {
  5: { name: "early", what: "the first rooms and corridors" },
  30: { name: "mid", what: "one hole, furnished, windows, a few events seen" },
  60: { name: "network", what: "two holes, a few days after founding, rovers running both ways" },
  120: { name: "late", what: "as big as the bots get while both holes are healthy" },
};

// --probe=<days>: write nothing, just print how each hole is doing every 5 days, to pick the moments.
const probe = Number(process.argv.find((a) => a.startsWith("--probe="))?.slice(8) ?? 0);
if (probe) {
  runNetwork(probe, config.seed, true, (world, day) => {
    if (day % 5 !== 0) return;
    const food = (h: SimState) => (h.resources.rations ?? 0) + (h.resources.meals ?? 0) + (h.resources.rawFood ?? 0);
    const holes = world.holes.map((h) => `${h.name} ${h.population.count} people, health ${Math.round(h.population.health)}, happy ${Math.round(h.happiness.average)}, water ${Math.round(h.resources.water ?? 0)}, food ${Math.round(food(h))}`);
    console.log(`day ${day}: ${holes.join(" | ")}`);
  });
  process.exit(0);
}

const out = resolve(process.cwd(), "public");
mkdirSync(out, { recursive: true });
const last = Math.max(...Object.keys(MOMENTS).map(Number));
runNetwork(last, config.seed, true, (world, day) => {
  const m = MOMENTS[day];
  if (!m) return;
  const file = resolve(out, `dev-save-${m.name}.json`);
  writeFileSync(file, serialize(world));
  const s = summarize(world, config);
  console.log(`public/dev-save-${m.name}.json: day ${s.day}, ${s.population} people, ${s.holes} hole${s.holes > 1 ? "s" : ""}, ${s.floors} floors (${m.what})`);
});

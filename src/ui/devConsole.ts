import type { CommandResult, SimCommand } from "../sim/commands";
import type { Snapshot } from "../sim/snapshot";
import { resourceDefs } from "../sim/resources";

// Testing helpers in the browser console, as `dm`: look at and change the
// active hole's resources, and unlock rooms that wait on a milestone, so a
// test game never gets stuck. Each goes to the simulation as a command, like
// any player action, and is recorded in the ledger as "Console".

interface Api {
  send: (command: SimCommand) => Promise<CommandResult>;
  advance: (days: number) => Promise<CommandResult>;
  snapshot: () => Snapshot | null;
}

type Amounts = Record<string, number>;

const HELP = `Downtown Mars console (the hole you're looking at):
  dm.resources()            what it has
  dm.give("metal", 50)      add some (or dm.give({ metal: 50, rock: 100 }))
  dm.take("water", 20)      take some away
  dm.set("rock", 500)       set an amount (or dm.set({ rock: 500, brick: 200 }))
  dm.fill(1000)             every stored resource (not power or waste) up to at least this much
  dm.unlock()               unlock every room that waits on a milestone (or dm.unlock("cargo"))
  dm.unlock("ore")          put a deposit under the hole: ice, aquifer, ore or silica
  dm.finish()               finish everything in the construction queue at once
  dm.showcase(10)           dig to 10 floors and fill rings 1–3 with built, furnished rooms (for looking at; not for playing)
  dm.skip(3)                run every hole ahead 3 days at once (up to 365)
  dm.wear(0.4)              every room's condition to 40% (dm.wear(0.2, roomId) for one room)
  dm.lining(12, "brick")     line room 12's walls: rock, brick or metal (dm.lining(12, "brick", "fine") for the finer finish; "rock" back to bare)
  dm.floor(12, "fibre_panels")  room 12's floor (dm.floor(12) back to matching the walls)
  dm.event("belt_ship")      raise an event now (aquifer, ore_vein, silica_bed, lava_tube, gas_pocket, microfossils, belt_ship)
  dm.storm(1)               a dust storm now, for a day (dm.storm(2, 3): in 3 days, for 2; dm.storm(0) clears it)
  dm.command({ ... })       send any simulation command, as the game would (see SimCommand in src/sim/commands.ts)`;

/** "metal", 50 or { metal: 50 }, as amounts. */
function amounts(what: string | Amounts, amount?: number): Amounts {
  return typeof what === "string" ? { [what]: amount ?? 0 } : what;
}

export function installConsole(api: Api): () => void {
  const run = async (command: SimCommand, done: string): Promise<string> => {
    const r = await api.send(command);
    const msg = r.ok ? done : `Couldn't: ${r.reason}`;
    console.log(msg);
    return msg;
  };
  const dm = {
    help(): void {
      console.log(HELP);
    },
    /** The latest snapshot, to look at. */
    snapshot() {
      return api.snapshot();
    },
    resources(): Amounts {
      const res = api.snapshot()?.resources ?? {};
      const out = Object.fromEntries(Object.entries(res).map(([id, v]) => [id, Math.round(v * 10) / 10]));
      console.table(out);
      return out;
    },
    give(what: string | Amounts, amount?: number) {
      const add = amounts(what, amount);
      return run({ type: "consoleResources", add }, `Added ${describe(add)}`);
    },
    take(what: string | Amounts, amount?: number) {
      const add = Object.fromEntries(Object.entries(amounts(what, amount)).map(([id, v]) => [id, -v]));
      return run({ type: "consoleResources", add }, `Took ${describe(amounts(what, amount))}`);
    },
    set(what: string | Amounts, amount?: number) {
      const set = amounts(what, amount);
      return run({ type: "consoleResources", set }, `Set ${describe(set)}`);
    },
    fill(amount = 1000) {
      const atLeast = Object.fromEntries(resourceDefs.filter((r) => !r.flow && !r.waste).map((r) => [r.id, amount]));
      return run({ type: "consoleResources", atLeast }, `Every stored resource is at least ${amount}`);
    },
    command(command: SimCommand) {
      return run(command, "Done");
    },
    wear(condition: number, roomId?: number) {
      return run({ type: "consoleWear", condition, roomId }, roomId === undefined ? `Every room at ${Math.round(condition * 100)}%` : `Room ${roomId} at ${Math.round(condition * 100)}%`);
    },
    lining(roomId: number, material: string, finish = "base") {
      return run({ type: "consoleLining", roomId, material, finish }, `Room ${roomId}: ${material}${finish === "fine" ? ", finely finished" : ""}`);
    },
    floor(roomId: number, flooring?: string) {
      return run({ type: "consoleLining", roomId, flooring: flooring ?? null }, `Room ${roomId}'s floor: ${flooring ?? "matches the walls"}`);
    },
    showcase(floors = 10) {
      return run({ type: "consoleShowcase", floors }, `Showcase: ${floors} floors`);
    },
    event(kind: string) {
      return run({ type: "consoleEvent", kind }, `Event: ${kind}`);
    },
    storm(days = 1, inDays = 0) {
      return run({ type: "consoleStorm", days, inDays }, days > 0 ? `Dust storm ${inDays ? `in ${inDays} days` : "now"}, for ${days} day${days === 1 ? "" : "s"}` : "Clear skies");
    },
    async skip(days = 1) {
      const r = await api.advance(days);
      const msg = r.ok ? `Skipped ${days} day${days === 1 ? "" : "s"}` : `Couldn't: ${r.reason}`;
      console.log(msg);
      return msg;
    },
    finish() {
      return run({ type: "consoleFinish" }, "Everything in the queue is built");
    },
    unlock(gate?: string) {
      return run({ type: "consoleUnlock", gate }, gate ? `Unlocked ${gate}` : "Unlocked everything that waits on a milestone");
    },
  };
  const w = window as unknown as { dm?: typeof dm };
  w.dm = dm;
  return () => {
    if (w.dm === dm) delete w.dm;
  };
}

function describe(a: Amounts): string {
  return Object.entries(a)
    .map(([id, v]) => `${v} ${id}`)
    .join(", ");
}

import { describe, expect, it } from "vitest";
import { applyCommand, type SimCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import type { Location } from "../src/sim/placement";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// A scripted first month, following DESIGN.md "First 30 minutes": the
// critical set on day 1, then tier 2 as drops and digging pay for it, then
// more homes and services as colonists arrive. The bot builds strictly in
// order, waiting until the next item fits and is affordable, and answers
// office visits sensibly. Run with PLAYTEST=1 to print a daily table.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const surface = (slot: number): Location => ({ kind: "surface", slot });

// Vitest runs in Node; the project has no Node types, so reach env via globalThis.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

type Plan = { room: string; at: Location; crop?: string };

const PLAN: Plan[] = [
  // Tier 1: the critical set on floor 1.
  { room: "corridor", at: ring(1, 1, 1) },
  { room: "galley", at: ring(1, 1, 2) },
  { room: "restroom", at: ring(1, 1, 3) },
  { room: "bunk_dorm", at: ring(1, 1, 4, 2) },
  { room: "water_tank", at: ring(1, 1, 6) },
  { room: "corridor", at: ring(1, 2, 2) },
  { room: "life_support", at: ring(1, 2, 3, 4) },
  // Tier 2: weaning off Earth, mostly on floor 2.
  { room: "farm", at: ring(2, 1, 0, 4), crop: "potatoes" },
  { room: "corridor", at: ring(2, 1, 4) },
  { room: "farm", at: ring(2, 1, 5, 4), crop: "soybeans" },
  { room: "solar_array", at: surface(5) },
  { room: "water_recycler", at: ring(2, 2, 8, 4) },
  { room: "clinic", at: ring(3, 1, 0) },
  { room: "admin_office", at: ring(1, 1, 7, 2) },
  // Growth: homes and services for arrivals, on floor 3.
  { room: "bunk_dorm", at: ring(3, 1, 1, 2) },
  { room: "galley", at: ring(3, 1, 3) },
  { room: "restroom", at: ring(3, 1, 4) },
  { room: "solar_array", at: surface(6) },
  { room: "corridor", at: ring(3, 1, 7) },
  { room: "life_support", at: ring(3, 2, 12, 4) },
  { room: "bunk_dorm", at: ring(3, 1, 5, 2) },
  { room: "restroom", at: ring(3, 1, 8) },
  { room: "solar_array", at: surface(7) },
  // Keep up as the hole passes 50: food, water storage, air, on floor 4.
  { room: "galley", at: ring(4, 1, 0) },
  { room: "water_tank", at: ring(4, 1, 1) },
  { room: "water_tank", at: ring(4, 1, 2) },
  { room: "corridor", at: ring(4, 1, 6) },
  { room: "life_support", at: ring(4, 2, 10, 4) },
  { room: "solar_array", at: surface(8) },
  { room: "bunk_dorm", at: ring(4, 1, 3, 2) },
  { room: "restroom", at: ring(4, 1, 5) },
];

const VISIT_ANSWERS: Record<string, string> = {
  noise_complaint: "quiet_hours",
  clinic_demand: "promise",
};

interface Day {
  day: number;
  pop: number;
  beds: number;
  health: number;
  happy: number;
  prod: number;
  o2: number;
  water: number;
  food: number;
  power: string;
  metal: number;
  rock: number;
  built: number;
  floors: number;
  co2: number;
  met: string;
  san: number;
  farms: string;
}

function run(days: number): { state: SimState; log: Day[]; builtAt: Record<number, number> } {
  const s = createInitialState(config);
  const log: Day[] = [];
  const builtAt: Record<number, number> = {};
  let next = 0;
  const cmd = (c: SimCommand) => applyCommand(s, c);

  for (let t = 0; t < days * config.ticksPerDay; t++) {
    // Once an hour, act like a player: build the next thing if possible, answer visitors.
    if (t % 10 === 0) {
      while (next < PLAN.length) {
        const p = PLAN[next]!;
        if (!cmd({ type: "build", room: p.room, at: p.at }).ok) break;
        const room = s.layout.rooms.at(-1)!;
        if (p.crop) cmd({ type: "setCrop", roomId: room.id, crop: p.crop });
        builtAt[next] = s.tick / config.ticksPerDay;
        next++;
      }
      for (const v of [...s.office.waiting]) {
        const choice = VISIT_ANSWERS[v.kind];
        if (choice && !cmd({ type: "answerVisit", visitId: v.id, choice }).ok) {
          cmd({ type: "answerVisit", visitId: v.id, choice: "promise" });
        }
      }
    }
    step(s, config);
    if (s.tick % config.ticksPerDay === 0) {
      const snap = makeSnapshot(s, config);
      const r = s.resources;
      log.push({
        day: s.tick / config.ticksPerDay,
        pop: s.population.count,
        beds: snap.beds,
        health: Math.round(s.population.health),
        happy: Math.round(s.happiness.average),
        prod: Math.round(s.happiness.productivity * 100),
        o2: Math.round(r.o2 ?? 0),
        water: Math.round(r.water ?? 0),
        food: Math.round((r.rations ?? 0) + (r.rawFood ?? 0) + (r.meals ?? 0)),
        power: `${snap.power.used.toFixed(0)}/${snap.power.made.toFixed(0)}`,
        metal: Math.round(r.metal ?? 0),
        rock: Math.round(r.rock ?? 0),
        built: next,
        floors: s.layout.hole.floors,
        co2: Math.round(r.co2 ?? 0),
        met: Object.entries(s.population.needsMet)
          .map(([k, v]) => `${k}:${v.toFixed(2)}`)
          .join(" "),
        san: Math.round(s.population.sanitation * 100),
        farms: s.layout.rooms
          .filter((r) => r.type === "farm")
          .map((r) => `${Math.round((s.roomStatus[r.id]?.rate ?? 0) * 100)}${s.roomStatus[r.id]?.limit ? ":" + s.roomStatus[r.id]!.limit : ""}${r.planned ? ":plan" : ""}`)
          .join(" "),
      });
    }
  }
  return { state: s, log, builtAt };
}

describe("first month playthrough", () => {
  const { state, log, builtAt } = run(30);
  if (env.PLAYTEST) {
    console.table(log);
    console.log("built on day:", Object.fromEntries(Object.entries(builtAt).map(([i, d]) => [`${i} ${PLAN[+i]!.room}`, d.toFixed(1)])));
    console.log("messages:", state.messages.map((m) => `d${(m.tick / config.ticksPerDay).toFixed(1)} ${m.text}`));
  }

  it("builds the critical set on day 1", () => {
    expect(builtAt[6]).toBeLessThan(1);
  });

  it("finishes tier 2 within about two weeks", () => {
    expect(builtAt[13]).toBeLessThan(15);
  });

  it("reaches about 50 colonists within the month", () => {
    expect(state.population.count).toBeGreaterThanOrEqual(45);
  });

  it("keeps everyone reasonably healthy", () => {
    expect(Math.min(...log.map((d) => d.health))).toBeGreaterThan(60);
  });

  it("keeps morale from collapsing", () => {
    expect(Math.min(...log.slice(5).map((d) => d.happy))).toBeGreaterThan(35);
  });
});

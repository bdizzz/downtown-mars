import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { relation } from "../src/sim/culture";
import { serialize } from "../src/sim/save";
import { runNetwork } from "./netbot";
import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";

// Plays the first hour (60 game days) across two holes with the scripted
// bot, and the same bot without founding, to check the network pays off.
// Run with PLAYTEST=1 (npm run playtest:net) to print a daily table.

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

// Played with construction time and storage limits, as in the game (each test file has its own copy of the setting).
construction.instant = false;
storage.unlimited = false;

describe("first hour, two holes", () => {
  const net = runNetwork(60);
  const solo = runNetwork(60, config.seed, false);
  const [home, child] = net.world.holes;
  const last = net.log.at(-1)!;
  if (env.PLAYTEST) {
    console.table(net.log);
    console.log(net.events);
    console.log("solo:", solo.log.filter((d) => d.day % 5 === 0).map((d) => `${d.day}:${d.total}`).join(" "));
  }

  it("opens the map around minute 20 and founds a second hole before minute 55", () => {
    expect(net.log.find((d) => d.total >= 50)!.day).toBeLessThanOrEqual(25);
    expect(net.foundedDay).not.toBeNull();
    // The drill slows past floor 3 (was before minute 50).
    expect(net.foundedDay!).toBeLessThan(55);
    expect(child).toBeDefined();
  });

  it("builds the child's critical set within a few days of arrival", () => {
    expect(net.childBuilt.length).toBeGreaterThanOrEqual(6);
    expect(net.childBuilt[5]! - net.foundedDay!).toBeLessThan(8);
  });

  it("keeps the child alive and growing", () => {
    // Founded later since the drill slowed past floor 3: fewer days to grow (was 20).
    expect(child!.population.count).toBeGreaterThanOrEqual(15);
    expect(Math.min(...net.log.filter((d) => d.childHealth > 0).map((d) => d.childHealth))).toBeGreaterThan(60);
    expect(last.childHappy).toBeGreaterThan(40);
  });

  it("moves goods both ways by rover", () => {
    expect(last.delivered).toBeGreaterThan(20);
    // The child sends what its digging brings up home: by the end of the hour its route is set up, at least
    // (founded later since the drill slowed past floor 3, its first load may still be loading).
    const fromChild = net.world.routes.filter((r) => r.fromHoleId === child!.holeId);
    expect(last.deliveredHome > 0 || fromChild.length > 0).toBe(true);
  });

  it("keeps pace with staying solo by the end of the hour, despite sending 12 away", () => {
    // Both players build what's short after their opening; the gap opens later (see people-playthrough).
    expect(last.total).toBeGreaterThan(solo.log.at(-1)!.total * 0.95);
  });

  // A whole second hour of play: past vitest's 5 s default on CI's slower runners.
  it("plays out identically every time", () => {
    const again = runNetwork(60);
    expect(serialize(again.world)).toEqual(serialize(net.world));
  }, 30_000);

  it("parent and child still get along", () => {
    expect(relation(net.world, child!.holeId, home!.holeId).opinion).toBeGreaterThan(20);
    expect(relation(net.world, home!.holeId, child!.holeId).opinion).toBeGreaterThan(-20);
  });
});

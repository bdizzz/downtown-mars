import { describe, expect, it } from "vitest";
import { deserialize, SAVE_VERSION } from "../src/sim/save";
import { DEV_GAMES } from "../src/ui/devGames";

// The dev saves in public/ (T-013) open in today's game. If one is behind
// SAVE_VERSION it still loads through migrations; `npm run saves` brings it current.

const files = import.meta.glob<string>("../public/dev-save-*.json", { query: "?raw", import: "default", eager: true });
const saves = Object.entries(files).map(([path, json]) => [path.split("/").pop()!, json] as const);

describe("dev saves", () => {
  it("there are four: early, mid, network and late", () => {
    expect(saves.map(([name]) => name).sort()).toEqual(["dev-save-early.json", "dev-save-late.json", "dev-save-mid.json", "dev-save-network.json"]);
  });
  it.each(saves)("%s loads", (_name, json) => {
    const r = deserialize(json);
    expect(r.ok ? "ok" : r.reason).toBe("ok");
    expect((JSON.parse(json) as { version: number }).version).toBeLessThanOrEqual(SAVE_VERSION);
  });
});

describe("the menu's dev games (#351)", () => {
  it("lists exactly the dev saves in public/", () => {
    expect(DEV_GAMES.map((g) => `dev-save-${g.name}.json`).sort()).toEqual(saves.map(([name]) => name).sort());
  });
});

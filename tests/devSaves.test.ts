import { describe, expect, it } from "vitest";
import { deserialize, SAVE_VERSION } from "../src/sim/save";
import { DEV_GAMES } from "../src/ui/devGames";
import { readFileSync } from "node:fs";
import { serialize } from "../src/sim/save";
import { stepWorld } from "../src/sim/worldstep";
import { config } from "../src/sim/config";
import { floorEdges } from "../src/sim/edges";

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

// The dev saves in public/ were made by slot (save v22). They load by angle (F-004): every room keeps
// the link it had, every corridor is an edge of its floor as it stands, and the game runs on.

describe("the dev saves, kept by slot, load by angle", () => {
  for (const name of ["early", "mid", "late", "network"]) {
    it(name, () => {
      const json = readFileSync(`public/dev-save-${name}.json`, "utf8");
      const saved = JSON.parse(json).state.holes as { layout: { rooms: { id: number; connected: boolean }[] } }[];
      const r = deserialize(json);
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      if (!r.ok) return;
      r.world.holes.forEach((h, i) => {
        const was = new Map(saved[i]!.layout.rooms.map((x) => [x.id, x.connected]));
        for (const room of h.layout.rooms) expect(room.connected, `${name}: ${room.type} #${room.id}`).toBe(was.get(room.id));
        for (let f = 1; f <= h.layout.hole.floors; f++) {
          const edges = new Set(floorEdges(h.layout, f).map((e) => e.id));
          const off = Object.keys(h.layout.corridors).filter((id) => id.startsWith(`A${f}.`) || id.startsWith(`R${f}.`)).filter((id) => !edges.has(id));
          expect(off, `${name} floor ${f}`).toEqual([]);
        }
      });
      for (let i = 0; i < 480; i++) stepWorld(r.world, config);
      expect(deserialize(serialize(r.world)).ok).toBe(true);
    }, 60_000);
  }
});

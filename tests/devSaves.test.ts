import { describe, expect, it } from "vitest";
import { deserialize, SAVE_VERSION } from "../src/sim/save";
import { DEV_GAMES } from "../src/ui/devGames";
import { readFileSync } from "node:fs";
import { serialize } from "../src/sim/save";
import { stepWorld } from "../src/sim/worldstep";
import { config } from "../src/sim/config";
import { floorEdges } from "../src/sim/edges";
import { areaAt, spanRange, targetArea } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";

// The dev saves in public/ (T-013) open in today's game. If one is behind
// SAVE_VERSION it still loads through migrations; `npm run saves` brings it current.

const files = import.meta.glob<string>("../public/dev-save-*.json", { query: "?raw", import: "default", eager: true });
const saves = Object.entries(files).map(([path, json]) => [path.split("/").pop()!, json] as const);

describe("dev saves", () => {
  it("there are five: early, mid, network and late (by slot), and area", () => {
    expect(saves.map(([name]) => name).sort()).toEqual(["dev-save-area.json", "dev-save-early.json", "dev-save-late.json", "dev-save-mid.json", "dev-save-network.json"]);
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

// The area dev game (tests/areabot.ts) is built by angle from the start: every room at its target area
// (within its leeway; fill rooms as stretched), wherever it sits, and narrower in angle the further out.

describe("the area dev game, built by area", () => {
  const json = readFileSync("public/dev-save-area.json", "utf8");
  const r = deserialize(json);
  if (!r.ok) throw new Error(r.reason);
  const hole = r.world.holes[0]!;
  const rings = hole.layout.rooms.flatMap((room) => (room.at.kind === "ring" ? [{ room, at: room.at }] : []));

  it("is saved at today's version, everything built and reached", () => {
    expect((JSON.parse(json) as { version: number }).version).toBe(SAVE_VERSION);
    expect(hole.layout.rooms.filter((x) => x.planned || !x.connected).map((x) => x.type)).toEqual([]);
  });

  it("every room is its target area, within its leeway, on whatever ring it's on", () => {
    const lee = config.placement.leeway;
    for (const { room, at } of rings) {
      if (roomDef(room.type).fill || roomDef(room.type).stacks) continue;
      const ratio = areaAt(hole.layout.hole, at) / targetArea(room.type);
      expect(ratio, `${room.type} on floor ${at.floor}, ring ${at.ring}`).toBeGreaterThanOrEqual(1 - lee);
      expect(ratio, `${room.type} on floor ${at.floor}, ring ${at.ring}`).toBeLessThanOrEqual(1 + lee);
    }
  });

  it("the same room on rings 1, 2 and 3: the same area, a smaller angle further out, round one middle", () => {
    for (const type of ["restroom", "galley"]) {
      const row = [1, 2, 3].map((ring) => rings.find((x) => x.room.type === type && x.at.floor === 3 && x.at.ring === ring)!.at);
      expect(row.map((at) => at.span)).toEqual([1, 2, 3].map((ring) => spanRange(hole.layout.hole, type, ring, 1).target));
      expect(row[0]!.span).toBeGreaterThan(row[1]!.span);
      expect(row[1]!.span).toBeGreaterThan(row[2]!.span);
      for (const at of row) expect(areaAt(hole.layout.hole, at)).toBeCloseTo(targetArea(type), -1);
      const middles = row.map((at) => at.start + at.span / 2);
      expect(Math.max(...middles) - Math.min(...middles)).toBeLessThanOrEqual(1);
    }
  });

  it("a farm two rings deep is the same 400 m² as one along a ring, in a narrower wedge", () => {
    const farms = rings.filter((x) => x.room.type === "farm").map((x) => x.at);
    const wide = farms.find((at) => at.depth === 1)!;
    const deep = farms.find((at) => at.depth === 2)!;
    expect(areaAt(hole.layout.hole, wide)).toBeCloseTo(400, -1);
    expect(areaAt(hole.layout.hole, deep)).toBeCloseTo(400, -1);
    expect(deep.span).toBeLessThan(wide.span);
  });

  it("a fill room takes the area it was stretched to", () => {
    const plaza = rings.find((x) => x.room.type === "tiny_plaza")!.at;
    expect(areaAt(hole.layout.hole, plaza) / targetArea("tiny_plaza")).toBeCloseTo(1.5, 1);
  });

  it("runs on", () => {
    for (let i = 0; i < 480; i++) stepWorld(r.world, config);
    expect(deserialize(serialize(r.world)).ok).toBe(true);
  }, 60_000);
});

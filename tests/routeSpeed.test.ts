import { describe, expect, it } from "vitest";
import { distancesFrom, type Paths } from "../src/sim/paths";

// #532: route searches are per room, never per person (docs/PLAN-PEOPLE.md,
// "Route searches"). A synthetic hole of 10,000 people, shaped like the one in
// scripts/bench-people.ts: floors of corridor loops joined by stairs, homes of
// 6 beds, workplaces of 4 staff and galleys of 20 seats hanging off them. A
// search from every workplace must stay inside a generous limit (about 5×
// today's), so only a big jump fails: a per-person search, or a slow queue.

const BEDS = 6;
const STAFF = 4;
const SEATS = 20;

/** A deterministic 0..1 stream. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x100000000;
}

/** The network of a hole of `people`, with its workplaces' room ids. */
function syntheticHole(people: number, seed: number): { paths: Paths; works: number[] } {
  const r = rng(seed);
  const counts = [Math.ceil(people / BEDS), Math.ceil((people * 0.6) / STAFF), Math.ceil(people / SEATS)];
  const rooms = counts[0]! + counts[1]! + counts[2]!;
  const corridors = Math.max(12, Math.round(rooms * 1.5));
  const floors = Math.max(1, Math.round(Math.sqrt(corridors / 30)));
  const perFloor = Math.ceil(corridors / floors);
  const paths: Paths = { nodes: new Map(), links: new Map(), byRoom: new Map(), byEdge: new Map(), splits: new Map() };
  const link = (a: string, b: string) => {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const list = paths.links.get(x) ?? [];
      list.push({ to: y, cost: 10, air: true });
      paths.links.set(x, list);
    }
  };
  const corridor = (f: number, i: number) => `c:${f}:${i}`;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < perFloor; i++) paths.nodes.set(corridor(f, i), { roomId: 0, floor: f, length: 10, through: true });
  }
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < perFloor; i++) {
      link(corridor(f, i), corridor(f, (i + 1) % perFloor));
      if (f + 1 < floors && i % 8 === 0) link(corridor(f, i), corridor(f + 1, i));
    }
  }
  const works: number[] = [];
  let id = 1;
  for (const [kind, count] of counts.entries()) {
    for (let i = 0; i < count; i++, id++) {
      const k = `r:${id}`;
      const at = Math.floor(r() * floors * perFloor);
      const f = Math.floor(at / perFloor);
      paths.nodes.set(k, { roomId: id, floor: f, length: 10, through: false });
      paths.byRoom.set(id, [k]);
      link(k, corridor(f, at % perFloor));
      if (kind === 1) works.push(id);
    }
  }
  return { paths, works };
}

/** The old search, a sorted array as its queue, for checking distances. */
function reference(paths: Paths, roomId: number): Map<number, number> {
  const dist = new Map<string, number>();
  const queue: [number, string][] = [];
  for (const k of paths.byRoom.get(roomId) ?? []) {
    dist.set(k, 0);
    queue.push([0, k]);
  }
  const out = new Map<number, number>();
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, k] = queue.shift()!;
    if (d > (dist.get(k) ?? Infinity)) continue;
    const node = paths.nodes.get(k)!;
    if (node.roomId && node.roomId !== roomId) {
      out.set(node.roomId, Math.min(out.get(node.roomId) ?? Infinity, d));
      if (!node.through) continue;
    }
    for (const l of paths.links.get(k) ?? []) {
      const nd = d + l.cost;
      if (nd >= (dist.get(l.to) ?? Infinity)) continue;
      dist.set(l.to, nd);
      queue.push([nd, l.to]);
    }
  }
  out.set(roomId, 0);
  return out;
}

describe("route searches at 10,000 people (#532)", () => {
  it("find the same distances as a plain sorted queue", () => {
    const { paths, works } = syntheticHole(1000, 7);
    for (const w of works.slice(0, 10)) expect(distancesFrom(paths, w, "walk")).toEqual(reference(paths, w));
  });

  it("run from every workplace inside a generous limit", () => {
    const { paths, works } = syntheticHole(10_000, 7);
    expect(works.length).toBe(1500);
    distancesFrom(paths, works[0]!, "walk"); // warm up
    const t0 = performance.now();
    for (const w of works) distancesFrom(paths, w, "walk");
    const ms = performance.now() - t0;
    // About 5× today's ~0.6 s on an Apple M4; the old queue (strings and a sorted array) took ~9 s.
    expect(ms).toBeLessThan(LIMIT_MS);
  });
});

const LIMIT_MS = 3000;

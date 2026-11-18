import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { config } from "../src/sim/config";
import { updateHappiness } from "../src/sim/happiness";
import { distancesFrom, pathsFor } from "../src/sim/paths";
import { walkFrom } from "../src/sim/amenities";
import { roomDef } from "../src/sim/rooms";
import { isActive } from "../src/sim/economy";
import { deserialize } from "../src/sim/save";

// Throwaway benchmark for the individual-colonists plan (#522, docs/PLAN-PEOPLE.md).
// Measures what tracking every person would cost: memory, CPU for the jobs it
// adds (assignment, swaps, monthly needs, routes) and save size, at 50, 1,000
// and 10,000 people a hole. Part A times the real path code on the dev saves;
// part B scales a synthetic hole of the same shape. Not part of the game.
// node scripts/bench-people.mjs

const time = (fn: () => void, reps = 1): number => {
  fn(); // warm up
  const t = performance.now();
  for (let i = 0; i < reps; i++) fn();
  return (performance.now() - t) / reps;
};
const ms = (v: number) => (v < 0.1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(0)) + " ms";
const kb = (b: number) => (b < 1024 * 1024 ? (b / 1024).toFixed(0) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB");

// ---------------------------------------------------------------- A. real holes
console.log("A. The dev saves, real code");
let nodesPerPerson = 0;
let linksPerNode = 0;
let samples = 0;
for (const name of ["mid", "late"]) {
  const loaded = deserialize(readFileSync(`public/dev-save-${name}.json`, "utf8"));
  if (!("world" in loaded) || !loaded.world) throw new Error(`can't load ${name}`);
  for (const h of loaded.world.holes) {
    const paths = pathsFor(h.layout);
    const links = [...paths.links.values()].reduce((n, l) => n + l.length, 0);
    const rooms = h.layout.rooms.filter(isActive);
    const homes = rooms.filter((r) => (roomDef(r.type).houses ?? 0) > 0);
    const everyRoom = time(() => {
      for (const r of rooms) distancesFrom(paths, r.id, "walk");
    }, 5);
    const happy = time(() => updateHappiness(h, config), 20);
    const walks = time(() => {
      for (const r of homes) walkFrom(h.layout, r.id);
    }, 20);
    nodesPerPerson += paths.nodes.size / h.population.count;
    linksPerNode += links / paths.nodes.size;
    samples++;
    console.log(
      `  ${name} ${h.name}: ${h.population.count} people, ${rooms.length} rooms (${homes.length} homes), ` +
        `${paths.nodes.size} path nodes, ${links} links. One route search ${ms(everyRoom / rooms.length)}, from every room ${ms(everyRoom)}; ` +
        `updateHappiness ${ms(happy)}; cached home walks ${ms(walks)}`,
    );
  }
}
nodesPerPerson /= samples;
linksPerNode /= samples;
console.log(`  → ${nodesPerPerson.toFixed(1)} path nodes a person, ${linksPerNode.toFixed(1)} links a node`);

// ------------------------------------------------------------ B. synthetic holes
// A hole of the same shape, grown: path nodes in proportion to people (as in
// the saves, damped: bigger holes pack people tighter), homes of ~6 beds,
// workplaces of ~4 staff, galleys of ~20 seats.
const BEDS = 6;
const STAFF = 4;
const SEATS = 20;

/** A deterministic 0..1 stream. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x100000000);
}

interface Graph {
  n: number;
  /** CSR adjacency. */
  start: Int32Array;
  to: Int32Array;
  cost: Float32Array;
  /** Room nodes: homes, workplaces, galleys. */
  homes: Int32Array;
  works: Int32Array;
  galleys: Int32Array;
}

/** Floors of rings: each floor a loop of corridor nodes, stairs every 8th node, rooms hanging off the loop. */
function makeHole(people: number, seed: number): Graph {
  const r = rng(seed);
  const homes = Math.ceil(people / BEDS);
  const works = Math.ceil((people * 0.6) / STAFF);
  const galleys = Math.ceil(people / SEATS);
  const rooms = homes + works + galleys;
  // The saves run ~nodesPerPerson nodes a person at 60 people; rooms are a third of nodes.
  const corridors = Math.max(12, Math.round(rooms * 1.5));
  const floors = Math.max(1, Math.round(Math.sqrt(corridors / 30)));
  const perFloor = Math.ceil(corridors / floors);
  const n = floors * perFloor + rooms;
  const adj: [number, number][][] = Array.from({ length: n }, () => []);
  const link = (a: number, b: number, c: number) => {
    adj[a]!.push([b, c]);
    adj[b]!.push([a, c]);
  };
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < perFloor; i++) {
      const a = f * perFloor + i;
      link(a, f * perFloor + ((i + 1) % perFloor), 10);
      if (f + 1 < floors && i % 8 === 0) link(a, (f + 1) * perFloor + i, 10);
    }
  }
  const kinds: Int32Array[] = [new Int32Array(homes), new Int32Array(works), new Int32Array(galleys)];
  let id = floors * perFloor;
  for (const [k, count] of [homes, works, galleys].entries()) {
    for (let i = 0; i < count; i++, id++) {
      kinds[k]![i] = id;
      link(id, Math.floor(r() * floors * perFloor), 10);
    }
  }
  const start = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i]! + adj[i]!.length;
  const to = new Int32Array(start[n]!);
  const cost = new Float32Array(start[n]!);
  for (let i = 0; i < n; i++) adj[i]!.forEach(([b, c], j) => ((to[start[i]! + j] = b), (cost[start[i]! + j] = c)));
  return { n, start, to, cost, homes: kinds[0]!, works: kinds[1]!, galleys: kinds[2]! };
}

/** Dijkstra with a binary heap; rooms (anything past the corridors) are ends, not ways through. */
function dijkstra(g: Graph, from: number, firstRoom: number, dist: Float32Array): void {
  dist.fill(Infinity);
  const heapD = new Float32Array(g.to.length + 1);
  const heapN = new Int32Array(g.to.length + 1);
  let size = 0;
  const push = (d: number, k: number) => {
    let i = size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapD[p]! <= d) break;
      heapD[i] = heapD[p]!;
      heapN[i] = heapN[p]!;
      i = p;
    }
    heapD[i] = d;
    heapN[i] = k;
  };
  const pop = (): number => {
    const top = heapN[0]!;
    const d = heapD[--size]!;
    const k = heapN[size]!;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= size) break;
      if (c + 1 < size && heapD[c + 1]! < heapD[c]!) c++;
      if (heapD[c]! >= d) break;
      heapD[i] = heapD[c]!;
      heapN[i] = heapN[c]!;
      i = c;
    }
    heapD[i] = d;
    heapN[i] = k;
    return top;
  };
  dist[from] = 0;
  push(0, from);
  while (size) {
    const d0 = heapD[0]!;
    const k = pop();
    if (d0 > dist[k]!) continue;
    if (k >= firstRoom && k !== from) continue;
    for (let e = g.start[k]!; e < g.start[k + 1]!; e++) {
      const nd = d0 + g.cost[e]!;
      const t = g.to[e]!;
      if (nd < dist[t]!) {
        dist[t] = nd;
        push(nd, t);
      }
    }
  }
}

/** The same search with paths.ts's queue: a sorted array, shifted from the front. */
function dijkstraSorted(g: Graph, from: number, firstRoom: number): void {
  const dist = new Map<number, number>([[from, 0]]);
  const queue: [number, number][] = [[0, from]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, k] = queue.shift()!;
    if (d > (dist.get(k) ?? Infinity)) continue;
    if (k >= firstRoom && k !== from) continue;
    for (let e = g.start[k]!; e < g.start[k + 1]!; e++) {
      const nd = d + g.cost[e]!;
      const t = g.to[e]!;
      if (nd < (dist.get(t) ?? Infinity)) {
        dist.set(t, nd);
        queue.push([nd, t]);
      }
    }
  }
}

/** Everyone a hole holds, as packed columns (the plan's "what each person holds"). */
function makePeople(n: number) {
  return {
    born: new Int32Array(n), // tick born (age and stage follow)
    until: new Int32Array(n), // tick of the next stage
    home: new Int32Array(n), // room id, or -1
    job: new Int32Array(n), // room id, or -1
    food: new Int32Array(n), // the galley they eat at, or -1
    household: new Int32Array(n),
    first: new Uint16Array(n), // name parts, indexes into the name pools
    last: new Uint16Array(n),
    stage: new Uint8Array(n),
    gen: new Uint8Array(n),
    traitA: new Uint8Array(n),
    traitB: new Uint8Array(n),
    comfort: new Int8Array(n), // −30..+30, tenths of a factor
    fed: new Int8Array(n),
    health: new Int8Array(n),
    happiness: new Uint8Array(n), // 0..100
    workM: new Uint16Array(n), // metres, home to work
    foodM: new Uint16Array(n), // metres, home to food
    gainDays: new Uint8Array(n), // days a swap would have helped them
    flags: new Uint8Array(n),
  };
}
type People = ReturnType<typeof makePeople>;
const bytesOf = (p: People) => Object.values(p).reduce((s, a) => s + a.byteLength, 0);

console.log("\nB. Synthetic holes (one hole each; times are one run on this machine)");
const rows: string[][] = [];
for (const N of [50, 1000, 10000]) {
  const g = makeHole(N, N);
  const firstRoom = g.homes[0]!;
  const dist = new Float32Array(g.n);
  const people = makePeople(N);
  const r = rng(7);

  // One route search, both ways.
  const heapOne = time(() => dijkstra(g, g.works[0]!, firstRoom, dist), N > 5000 ? 5 : 50);
  const sortedOne = time(() => dijkstraSorted(g, g.works[0]!, firstRoom), N > 5000 ? 1 : N > 500 ? 2 : 20);

  // Assignment from scratch: jobs by staffing order, then for each workplace a
  // route search and its staff into the nearest free beds. Galley per home: one search a galley.
  const workToHome: Float32Array[] = [];
  const assign = time(() => {
    const free = new Int32Array(g.n).fill(0);
    for (const h of g.homes) free[h] = BEDS;
    workToHome.length = 0;
    let p = 0;
    for (const w of g.works) {
      dijkstra(g, w, firstRoom, dist);
      const row = new Float32Array(g.homes.length);
      for (let i = 0; i < g.homes.length; i++) row[i] = dist[g.homes[i]!]!;
      workToHome.push(row);
      for (let s = 0; s < STAFF && p < N; s++, p++) {
        people.job[p] = w;
        // The nearest home with a free bed: a scan, not a sort.
        let best: number | undefined;
        for (let i = 0; i < row.length; i++) if (free[g.homes[i]!]! > 0 && (best === undefined || row[i]! < row[best]!)) best = i;
        people.home[p] = best === undefined ? -1 : g.homes[best]!;
        if (best !== undefined) free[g.homes[best]!]!--;
        people.workM[p] = best === undefined ? 0 : Math.min(65535, row[best]!);
      }
    }
    for (; p < N; p++) {
      people.job[p] = -1;
      people.home[p] = -1;
    }
    for (const gal of g.galleys) dijkstra(g, gal, firstRoom, dist);
  }, 1);

  // The daily swap check: each employed person looks at a few people living
  // nearer their work, and a pair where both would gain counts a day towards a swap.
  const homeIndex = new Int32Array(g.n).fill(-1);
  g.homes.forEach((h, i) => (homeIndex[h] = i));
  const workIndex = new Int32Array(g.n).fill(-1);
  g.works.forEach((w, i) => (workIndex[w] = i));
  const residents: number[][] = g.homes.length ? Array.from({ length: g.homes.length }, () => []) : [];
  for (let p = 0; p < N; p++) if (people.home[p]! >= 0) residents[homeIndex[people.home[p]!]!]!.push(p);
  const TRIES = 8;
  const swaps = time(() => {
    for (let p = 0; p < N; p++) {
      const w = people.job[p]!;
      if (w < 0 || people.home[p]! < 0) continue;
      const row = workToHome[workIndex[w]!]!;
      const mine = row[homeIndex[people.home[p]!]!]!;
      for (let t = 0; t < TRIES; t++) {
        const hi = Math.floor(r() * g.homes.length);
        if (row[hi]! >= mine) continue;
        const others = residents[hi]!;
        const q = others[Math.floor(r() * others.length)];
        if (q === undefined || people.job[q]! < 0) continue;
        const qrow = workToHome[workIndex[people.job[q]!]!]!;
        if (qrow[homeIndex[people.home[p]!]!]! < qrow[hi]!) {
          people.gainDays[p] = Math.min(255, people.gainDays[p]! + 1);
          break;
        }
      }
    }
  }, 20);

  // The monthly needs update: each person's comfort, food and health from their
  // own home, job and galley (per-room values worked out once, as now), their
  // commute and traits, eased into happiness.
  const roomComfort = new Float32Array(g.n).map(() => r() * 6 - 3);
  const roomHealth = new Float32Array(g.n).map(() => r() * 6 - 3);
  const needs = time(() => {
    for (let p = 0; p < N; p++) {
      const h = people.home[p]!;
      const j = people.job[p]!;
      const comfort = (h >= 0 ? roomComfort[h]! : -3) + (j >= 0 ? roomComfort[j]! * 0.3 : 0) - people.workM[p]! / 400;
      const health = (h >= 0 ? roomHealth[h]! : -1) + (people.traitA[p] === 3 ? 0.5 : 0);
      const fed = people.foodM[p]! > 200 ? -1 : 0;
      people.comfort[p] = Math.round(comfort * 10);
      people.health[p] = Math.round(health * 10);
      people.fed[p] = fed * 10;
      const target = Math.max(0, Math.min(100, 50 + 6 * comfort + 8 * health + 5 * fed));
      people.happiness[p] = Math.round(people.happiness[p]! + (target - people.happiness[p]!) * 0.25);
    }
  }, 50);

  // Walkers: sample 60 people and place each along their route.
  const walkers = time(() => {
    for (let i = 0; i < 60; i++) {
      const p = Math.floor(r() * N);
      void (people.workM[p]! * ((i * 0.37) % 1));
    }
  }, 1000);

  // The save: each column as a JSON array of numbers, and gzipped.
  for (let p = 0; p < N; p++) {
    people.born[p] = Math.floor(r() * 50000);
    people.until[p] = people.born[p]! + Math.floor(r() * 40000);
    people.household[p] = Math.floor(p / 3);
    people.first[p] = Math.floor(r() * 300);
    people.last[p] = Math.floor(r() * 300);
    people.traitA[p] = Math.floor(r() * 12);
    people.traitB[p] = Math.floor(r() * 12);
    people.happiness[p] = 40 + Math.floor(r() * 40);
  }
  const json = JSON.stringify(Object.fromEntries(Object.entries(people).map(([k, a]) => [k, Array.from(a as ArrayLike<number>)])));
  const gz = gzipSync(json).length;

  rows.push([
    String(N),
    String(g.n),
    kb(bytesOf(people)),
    ms(heapOne),
    Number.isNaN(sortedOne) ? "(minutes)" : ms(sortedOne),
    ms(assign),
    ms(swaps),
    ms(needs),
    ms(walkers),
    kb(g.works.length * g.homes.length * 2),
    `${kb(json.length)} (${kb(gz)} gzipped)`,
  ]);
}
const head = ["people", "path nodes", "memory", "route search (heap)", "route search (sorted array)", "assign all from scratch", "daily swap check", "monthly needs", "60 walkers", "work→home table (Uint16)", "save"];
console.log("| " + head.join(" | ") + " |");
console.log("| " + head.map(() => "---").join(" | ") + " |");
for (const r of rows) console.log("| " + r.join(" | ") + " |");

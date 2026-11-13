import { config } from "./config";
import { slotNotch, slotsToAngles } from "./geometry";

// Saves from before rooms went by angle (v24 and older; F-004, PLAN-M17) kept
// everything by slot: a room's cells, the grid of who holds each slot, what's
// dug, and edge ids as slot indices and fractions of a turn. This turns a
// saved hole into angles, once, before any other migration runs, so the rest
// of the sim only ever sees angles. Old rooms keep their exact angles, and so
// their old areas: nothing moves, no gaps open, every corridor still meets
// its room.

const N = config.geometry.notchesPerTurn;

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);

/** Where the old circle was cut: every slot boundary of the rings on either side, in notches. */
function oldCuts(ringSlots: number[], circle: number): number[] {
  const set = new Set<number>();
  for (const ring of [circle, circle + 1]) {
    const n = ringSlots[ring - 1];
    if (ring < 1 || !n) continue;
    for (let i = 0; i < n; i++) set.add(slotNotch(i, n, N));
  }
  return [...set].sort((a, b) => a - b);
}

/** An old edge id as a new one, or null if it isn't one. */
function edgeId(ringSlots: number[], id: string): string | null {
  const r = /^R(\d+)\.(\d+)\.(\d+)$/.exec(id);
  if (r) {
    const n = ringSlots[Number(r[2]) - 1];
    return n ? `R${r[1]}.${r[2]}.${slotNotch(Number(r[3]) % n, n, N) % N}` : null;
  }
  const a = /^A(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(id);
  if (!a) return null;
  const from = Math.round((Number(a[3]) / Number(a[4])) * N) % N;
  const cuts = oldCuts(ringSlots, Number(a[2]));
  const next = cuts.find((c) => c > from) ?? N;
  return `A${a[1]}.${a[2]}.${from}-${next}`;
}

/** Everything in a saved hole, with slots turned to angles: cells, ring locations, and edge ids wherever they are. */
function walk(ringSlots: number[], v: unknown): unknown {
  if (typeof v === "string") return edgeId(ringSlots, v) ?? v;
  if (Array.isArray(v)) return v.map((x) => walk(ringSlots, x));
  if (!isObj(v)) return v;
  // A ring location.
  if (v.kind === "ring" && typeof v.slot === "number" && typeof v.ring === "number") {
    const n = ringSlots[v.ring - 1] ?? 1;
    const { start, span } = slotsToAngles(v.slot, (v.w as number) ?? 1, n, N);
    return { kind: "ring", floor: v.floor, ring: v.ring, depth: (v.d as number) ?? 1, start, span };
  }
  // A cell.
  if (typeof v.floor === "number" && typeof v.ring === "number" && typeof v.slot === "number" && Object.keys(v).length === 3) {
    const n = ringSlots[v.ring - 1] ?? 1;
    const { start, span } = slotsToAngles(v.slot, 1, n, N);
    return { floor: v.floor, ring: v.ring, a0: start, a1: start + span };
  }
  const out: Raw = {};
  for (const [k, x] of Object.entries(v)) out[edgeId(ringSlots, k) ?? k] = walk(ringSlots, x);
  return out;
}

interface AngleCell {
  floor: number;
  ring: number;
  a0: number;
  a1: number;
}

/** One-slot cells joined up: on each floor and ring, each run of neighbours becomes one cell. */
function joinCells(cells: AngleCell[]): AngleCell[] {
  const groups = new Map<string, AngleCell[]>();
  for (const c of cells) {
    const k = `${c.floor}:${c.ring}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const out: AngleCell[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.a0 - b.a0);
    const runs: AngleCell[] = [];
    for (const c of list) {
      const last = runs.at(-1);
      if (last && last.a1 === c.a0) last.a1 = c.a1;
      else runs.push({ ...c });
    }
    // A run ending at the turn joins the one starting at 0.
    if (runs.length > 1 && runs[0]!.a0 === 0 && runs.at(-1)!.a1 === N) {
      const tail = runs.pop()!;
      const head = runs.shift()!;
      runs.push({ ...tail, a1: N + head.a1 });
    }
    out.push(...runs);
  }
  return out.sort((a, b) => a.floor - b.floor || a.ring - b.ring || a.a0 - b.a0);
}

/** What's dug, from a 0/1 per slot to merged ranges of notches. */
function openSpans(ringSlots: number[], open: unknown): unknown {
  if (!Array.isArray(open)) return open;
  return open.map((floor: number[][]) =>
    (floor ?? []).map((row, r) => {
      const n = ringSlots[r] ?? row.length;
      const spans: [number, number][] = [];
      row.forEach((v, slot) => {
        if (v !== 1) return;
        const a0 = slotNotch(slot, n, N);
        const a1 = slotNotch(slot + 1, n, N);
        const last = spans.at(-1);
        if (last && last[1] === a0) last[1] = a1;
        else spans.push([a0, a1]);
      });
      return spans;
    }),
  );
}

/** A saved hole from v24 or older, by angle. */
export function holeToAngles(hole: Raw): Raw {
  const layout = hole.layout as Raw | undefined;
  const ringSlots = (layout?.hole as { ringSlots?: number[] } | undefined)?.ringSlots;
  // Only a layout still kept by slot (its grid of who holds each slot) needs turning.
  if (!layout || !ringSlots || !Array.isArray(layout.grid)) return hole;
  const { grid: _grid, open, ...rest } = layout;
  const out = walk(ringSlots, { ...hole, layout: rest }) as Raw;
  const l = out.layout as Raw;
  l.open = openSpans(ringSlots, open);
  for (const room of (l.rooms as Raw[]) ?? []) {
    // The three empty rooms are one fill room now, "Empty space".
    if (room.type === "empty_room_m" || room.type === "empty_room_l") room.type = "empty_room_s";
    if (Array.isArray(room.cells)) room.cells = joinCells(room.cells as AngleCell[]);
    if (Array.isArray(room.pendingCells)) room.pendingCells = joinCells(room.pendingCells as AngleCell[]);
    if (Array.isArray(room.windows)) room.windows = [...new Set(room.windows as string[])].sort();
  }
  return out;
}

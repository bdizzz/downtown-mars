import { galleryEdges } from "../sim/edges";
import type { Layout } from "../sim/placement";

// Gallery tubes as runs: on each floor, the stretches of shaft wall where
// built tubes follow one another without a break. The 3D view's walkers
// stroll along them.

export interface TubeRun {
  floor: number;
  /** Start and end, in turns; end > start (it may pass 1 to wrap round past 0°). */
  t0: number;
  t1: number;
  /** All the way round the shaft: no ends to turn back at. */
  full: boolean;
}

/** Built (not still under construction) gallery tubes, merged into runs, floor by floor. */
export function tubeRuns(layout: Layout): TubeRun[] {
  const out: TubeRun[] = [];
  for (let floor = 1; floor <= layout.hole.floors; floor++) {
    const edges = galleryEdges(layout.hole, floor);
    const built = edges.map((e) => !!layout.corridors?.[e.id] && layout.corridorsBuilding?.[e.id] === undefined);
    if (built.every(Boolean)) {
      out.push({ floor, t0: 0, t1: 1, full: true });
      continue;
    }
    // Start just after a gap, so a run that wraps past 0° comes out whole.
    const n = edges.length;
    const gap = built.indexOf(false);
    if (gap < 0) continue;
    let run: { t0: number; t1: number } | null = null;
    for (let k = 1; k <= n; k++) {
      const i = (gap + k) % n;
      const e = edges[i]!;
      const wrap = gap + k >= n ? 1 : 0;
      if (built[i]) {
        if (run) run.t1 = e.a1 + wrap;
        else run = { t0: e.a0 + wrap, t1: e.a1 + wrap };
      } else if (run) {
        out.push({ floor, ...run, full: false });
        run = null;
      }
    }
    if (run) out.push({ floor, ...run, full: false });
  }
  return out;
}

/** Is there a gallery tube (built, or being built) along ring 1's slot on this floor? */
export function tubeAt(layout: Layout, floor: number, slot: number): boolean {
  const e = galleryEdges(layout.hole, floor)[slot];
  return !!e && !!layout.corridors?.[e.id];
}

/** The same, by angle (radians) round the shaft. */
export function tubeAtAngle(layout: Layout, floor: number, angle: number): boolean {
  const n = layout.hole.ringSlots[0]!;
  const turn = (((angle / (2 * Math.PI)) % 1) + 1) % 1;
  return tubeAt(layout, floor, Math.min(n - 1, Math.floor(turn * n)));
}

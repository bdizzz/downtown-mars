import type { Hole } from "../sim/geometry";
import type { Cell } from "../sim/placement";
import { floorSpan, ringRadii, slotAngles, TAU } from "../render3d/cylinder";

// A room's label, centred on its floor and fitted inside its walls (T-077).
// Labels face the camera, which turns and tilts but never rolls: a label's
// width stays level, and its height leans back as the camera looks down. So
// seen from any angle it stays within a circle of its half-diagonal round its
// centre, and no higher or lower than half its height. Fit that circle
// inside the room (allowing for a corridor down any side) and the label never
// crosses a wall. Shared by the web's sprites and, through the bridge, Godot's.

/** Sizes on the label's canvas, in pixels, and how big that draws: a one-line label is LINE_M tall. */
export const LABEL_PX = { font: 40, padX: 12, padY: 10, lineGap: 46 };
export const LINE_M = 1.1;
/** Kept clear of the walls, metres; and the smallest a label shrinks to before it shows only on hover. */
export const LABEL_FIT = { marginM: 0.2, minScale: 0.6 };
/**
 * Room kept over a label for its trouble badge (a small one, so the label stays high, over most furniture),
 * so the badge stays under the wall tops too.
 */
export const BADGE_M = 0.6;

/** Where a room's label goes: the middle of its floor area, and how much room it has there. */
export interface LabelSpot {
  x: number;
  z: number;
  /** Its floor's top and bottom (the walls reach the floor above). */
  y0: number;
  y1: number;
  /** From the centre to the nearest wall's inside face, assuming a corridor down every side, less the margin. */
  clearM: number;
}

/** A label as fitted: its lines, its size in metres, and whether it shows only while its room is hovered. */
export interface LabelFit {
  lines: string[];
  widthM: number;
  heightM: number;
  hoverOnly: boolean;
}

/** The label's spot in a room: its deepest floor (where its floor is), centred on the area all its rings share. */
export function labelSpot(hole: Hole, cells: Cell[], wallInM: number): LabelSpot | null {
  if (!cells.length) return null;
  const floor = Math.max(...cells.map((c) => c.floor));
  const here = cells.filter((c) => c.floor === floor);
  const rings = [...new Set(here.map((c) => c.ring))].sort((a, b) => a - b);
  // Angles relative to the first cell's middle, so a room across the seam doesn't wrap.
  const n0 = hole.ringSlots[here[0]!.ring - 1]!;
  const [f0, f1] = slotAngles(here[0]!.slot, n0);
  const ref = (f0 + f1) / 2;
  const rel = (a: number) => ((((a - ref) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
  const span = (ring: number): [number, number] => {
    const n = hole.ringSlots[ring - 1]!;
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of here) {
      if (c.ring !== ring) continue;
      const [s0, s1] = slotAngles(c.slot, n);
      const mid = rel((s0 + s1) / 2);
      lo = Math.min(lo, mid - (s1 - s0) / 2);
      hi = Math.max(hi, mid + (s1 - s0) / 2);
    }
    return [lo, hi];
  };
  // The angles every ring covers; an odd shape that shares none keeps to its inner ring.
  let a0 = Math.max(...rings.map((r) => span(r)[0]));
  let a1 = Math.min(...rings.map((r) => span(r)[1]));
  let inner = rings[0]!;
  let outer = rings.at(-1)!;
  if (a1 <= a0) {
    [a0, a1] = span(inner);
    outer = inner;
  } else {
    // Only the rings in an unbroken run out from the inner one.
    for (let i = 1; i < rings.length; i++)
      if (rings[i] !== rings[i - 1]! + 1) {
        outer = rings[i - 1]!;
        break;
      }
  }
  const r0 = ringRadii(hole, inner)[0];
  const r1 = ringRadii(hole, outer)[1];
  const r = (r0 + r1) / 2;
  const a = (a0 + a1) / 2;
  // To each radial side: the nearest point on it, from r0 out to r1.
  const toSide = (side: number) => {
    const phi = Math.abs(a - side);
    const along = Math.min(r1, Math.max(r0, r * Math.cos(phi)));
    return Math.hypot(r * Math.cos(phi) - along, r * Math.sin(phi));
  };
  const nearest = Math.min(r - r0, r1 - r, toSide(a0), toSide(a1));
  const [y0, y1] = floorSpan(floor);
  const turn = ref + a;
  return { x: r * Math.cos(turn), z: r * Math.sin(turn), y0, y1, clearM: nearest - wallInM - LABEL_FIT.marginM };
}

/** The label's lines, split once at the space nearest the middle (or kept whole when there's none). */
function wrapped(text: string): string[] | null {
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === " " && (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2))) best = i;
  return best > 0 ? [text.slice(0, best), text.slice(best + 1)] : null;
}

/** The canvas a label's lines take, in pixels. */
export function labelBox(lines: string[], measurePx: (line: string) => number): [number, number] {
  const w = Math.max(...lines.map(measurePx)) + 2 * LABEL_PX.padX;
  const h = LABEL_PX.font + 2 * LABEL_PX.padY + (lines.length - 1) * LABEL_PX.lineGap;
  return [w, h];
}

/**
 * Fit a label into its spot: whole at full size if it can be, then on two
 * lines, then shrunk (the better of the two) down to LABEL_FIT.minScale;
 * past that it shows whole, only while its room is hovered.
 */
export function fitLabel(text: string, measurePx: (line: string) => number, spot: Pick<LabelSpot, "clearM" | "y0" | "y1">): LabelFit {
  const perPx = LINE_M / (LABEL_PX.font + 2 * LABEL_PX.padY);
  const roomH = spot.y1 - spot.y0 - 2 * LABEL_FIT.marginM - BADGE_M;
  const options = [[text], wrapped(text)].filter((l): l is string[] => !!l);
  let best: LabelFit | null = null;
  let bestScale = 0;
  for (const lines of options) {
    const [w, h] = labelBox(lines, measurePx);
    const wM = w * perPx;
    const hM = h * perPx;
    const scale = Math.min(1, Math.max(0, spot.clearM) / (Math.hypot(wM, hM) / 2), roomH / hM);
    if (scale > bestScale + 1e-9) {
      best = { lines, widthM: wM * scale, heightM: hM * scale, hoverOnly: false };
      bestScale = scale;
    }
    if (scale >= 1) break;
  }
  if (best && bestScale >= LABEL_FIT.minScale) return best;
  const [w, h] = labelBox([text], measurePx);
  return { lines: [text], widthM: w * perPx, heightM: h * perPx, hoverOnly: true };
}

/** How high a fitted label's centre sits: as high as it goes, under its badge's room. */
export function labelY(spot: Pick<LabelSpot, "y1">, fit: Pick<LabelFit, "heightM">): number {
  return spot.y1 - LABEL_FIT.marginM - BADGE_M - fit.heightM / 2;
}

/** How far above a label's centre its trouble badge goes. */
export const badgeAbove = (labelHeightM: number) => labelHeightM / 2 + BADGE_M / 2;

/** A stand-in for measuring text where there's no canvas (the bridge, in Node): a little wide, to be safe. */
export const roughMeasure = (line: string) => [...line].length * LABEL_PX.font * 0.62;

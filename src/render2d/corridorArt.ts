import type { GraphicsContext } from "pixi.js";
import { finishDef } from "../sim/corridors";

// How a corridor's finish looks in 2D: a band in the finish's colour, with a
// pattern that tells them apart at a glance. Bare rock is speckled, marscrete
// has expansion joints, brick has laid courses, metal has floor grating and
// rails. Looks only: finishes don't change anything else (yet).

export const hex = (s: string) => parseInt(s.slice(1), 16);

/** A little noise that's stable for a position, so speckles don't dance on redraw. */
function jitter(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A straight band from (x, y), `len` long and `thick` wide, running along x
 * ("h") or along y ("v"), in a finish.
 */
export function corridorBand(g: GraphicsContext, x: number, y: number, len: number, thick: number, along: "h" | "v", finish: string, alpha = 1): void {
  const f = finishDef(finish);
  const fill = hex(f.color);
  const ink = hex(f.accent);
  const rect = along === "h" ? [x, y, len, thick] : [x, y, thick, len];
  g.rect(rect[0]!, rect[1]!, rect[2]!, rect[3]!).fill({ color: fill, alpha });
  // Points along the band: t runs down its length, u across it (0..thick).
  const at = (t: number, u: number): [number, number] => (along === "h" ? [x + t, y + u] : [x + u, y + t]);
  const cross = (t: number, width: number, a = 0.9) => {
    const [x0, y0] = at(t, 0);
    const [x1, y1] = at(t, thick);
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: ink, width, alpha: a * alpha });
  };
  const lengthwise = (u: number, width: number, a = 0.9) => {
    const [x0, y0] = at(0, u);
    const [x1, y1] = at(len, u);
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: ink, width, alpha: a * alpha });
  };
  if (f.id === "rock") {
    for (let t = 3; t < len - 2; t += 6) {
      const [px, py] = at(t + jitter(x + t, y) * 3, 2 + jitter(y + t, x) * (thick - 4));
      g.circle(px, py, 1 + jitter(px, py)).fill({ color: ink, alpha: 0.8 * alpha });
    }
  } else if (f.id === "marscrete") {
    for (let t = 14; t < len; t += 14) cross(t, 1, 0.7);
  } else if (f.id === "brick") {
    lengthwise(thick / 2, 1, 0.8);
    for (let t = 5, i = 0; t < len; t += 10, i++) {
      const [x0, y0] = at(t, i % 2 ? 0 : thick / 2);
      const [x1, y1] = at(t, i % 2 ? thick / 2 : thick);
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: ink, width: 1, alpha: 0.8 * alpha });
    }
  } else {
    for (let t = 2; t < len; t += 3) cross(t, 0.8, 0.45);
    lengthwise(1, 1.5);
    lengthwise(thick - 1, 1.5);
  }
}

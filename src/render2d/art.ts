import type { GraphicsContext } from "pixi.js";

// Code-drawn art: room glyphs and surface props. Everything is simple line
// work in one colour so it reads at small sizes and in both overlays.
// See docs/ART.md for the direction these placeholders stand in for.

/** Darken a colour toward black by t (0..1). */
export function shade(c: number, t: number): number {
  const ch = (s: number) => Math.round(((c >> s) & 0xff) * (1 - t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Lighten a colour toward white by t (0..1). */
export function tint(c: number, t: number): number {
  const ch = (s: number) => {
    const v = (c >> s) & 0xff;
    return Math.round(v + (255 - v) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

type Glyph = (g: GraphicsContext, cx: number, cy: number, s: number, color: number) => void;

const line = (w: number, color: number, alpha = 1) => ({ color, width: w, alpha, cap: "round" as const, join: "round" as const });

/** One icon per room type, drawn centred at (cx, cy) inside a box of size s. */
const GLYPHS: Record<string, Glyph> = {
  bunk_dorm: (g, cx, cy, s, c) => {
    // Two bunks.
    for (const dx of [-0.22, 0.22]) {
      const x = cx + dx * s;
      g.rect(x - s * 0.16, cy - s * 0.3, s * 0.32, s * 0.6).stroke(line(1.5, c));
      g.moveTo(x - s * 0.16, cy).lineTo(x + s * 0.16, cy).stroke(line(1.5, c));
    }
  },
  landing_pod: (g, cx, cy, s, c) => {
    g.moveTo(cx - s * 0.35, cy + s * 0.25).arc(cx, cy + s * 0.25, s * 0.35, Math.PI, 0).closePath().stroke(line(1.5, c));
    g.circle(cx, cy + s * 0.05, s * 0.08).stroke(line(1.5, c));
  },
  galley: (g, cx, cy, s, c) => {
    // A pot with steam.
    g.rect(cx - s * 0.25, cy - s * 0.02, s * 0.5, s * 0.3).stroke(line(1.5, c));
    g.moveTo(cx - s * 0.33, cy - s * 0.02).lineTo(cx + s * 0.33, cy - s * 0.02).stroke(line(1.5, c));
    for (const dx of [-0.1, 0.1]) {
      g.moveTo(cx + dx * s, cy - s * 0.12).quadraticCurveTo(cx + (dx + 0.07) * s, cy - s * 0.22, cx + dx * s, cy - s * 0.32).stroke(line(1.2, c, 0.8));
    }
  },
  farm: (g, cx, cy, s, c) => {
    // A sprout.
    g.moveTo(cx, cy + s * 0.3).lineTo(cx, cy - s * 0.1).stroke(line(1.5, c));
    g.ellipse(cx - s * 0.12, cy - s * 0.12, s * 0.12, s * 0.06).fill({ color: c, alpha: 0.8 });
    g.ellipse(cx + s * 0.12, cy - s * 0.2, s * 0.12, s * 0.06).fill({ color: c, alpha: 0.8 });
    g.moveTo(cx - s * 0.35, cy + s * 0.3).lineTo(cx + s * 0.35, cy + s * 0.3).stroke(line(1.5, c));
  },
  water_tank: (g, cx, cy, s, c) => {
    // A droplet.
    g.moveTo(cx, cy - s * 0.32).quadraticCurveTo(cx + s * 0.28, cy + s * 0.05, cx, cy + s * 0.3).quadraticCurveTo(cx - s * 0.28, cy + s * 0.05, cx, cy - s * 0.32).stroke(line(1.5, c));
  },
  water_recycler: (g, cx, cy, s, c) => {
    // Two arrows chasing each other.
    const r = s * 0.25;
    // Start each arc at its own first point, or Pixi joins it to the last path drawn.
    const arc = (from: number, to: number) =>
      g.moveTo(cx + Math.cos(from) * r, cy + Math.sin(from) * r).arc(cx, cy, r, from, to).stroke(line(1.5, c));
    arc(-Math.PI * 0.9, -Math.PI * 0.1);
    arc(Math.PI * 0.1, Math.PI * 0.9);
    g.moveTo(cx + r * 0.95, cy - r * 0.55).lineTo(cx + r * 0.95, cy - r * 0.05).lineTo(cx + r * 0.5, cy - r * 0.3).stroke(line(1.5, c));
    g.moveTo(cx - r * 0.95, cy + r * 0.55).lineTo(cx - r * 0.95, cy + r * 0.05).lineTo(cx - r * 0.5, cy + r * 0.3).stroke(line(1.5, c));
  },
  restroom: (g, cx, cy, s, c) => {
    // A basin and tap.
    g.moveTo(cx - s * 0.25, cy).lineTo(cx + s * 0.25, cy).quadraticCurveTo(cx + s * 0.22, cy + s * 0.28, cx, cy + s * 0.28).quadraticCurveTo(cx - s * 0.22, cy + s * 0.28, cx - s * 0.25, cy).stroke(line(1.5, c));
    g.moveTo(cx, cy - s * 0.02).lineTo(cx, cy - s * 0.25).lineTo(cx + s * 0.12, cy - s * 0.25).stroke(line(1.5, c));
  },
  life_support: (g, cx, cy, s, c) => {
    // A fan.
    g.circle(cx, cy, s * 0.32).stroke(line(1.5, c));
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      g.moveTo(cx, cy).quadraticCurveTo(cx + Math.cos(a + 0.6) * s * 0.3, cy + Math.sin(a + 0.6) * s * 0.3, cx + Math.cos(a) * s * 0.27, cy + Math.sin(a) * s * 0.27).stroke(line(1.5, c));
    }
  },
  clinic: (g, cx, cy, s, c) => {
    const a = s * 0.1;
    const b = s * 0.28;
    g.poly([cx - a, cy - b, cx + a, cy - b, cx + a, cy - a, cx + b, cy - a, cx + b, cy + a, cx + a, cy + a, cx + a, cy + b, cx - a, cy + b, cx - a, cy + a, cx - b, cy + a, cx - b, cy - a, cx - a, cy - a]).stroke(line(1.5, c));
  },
  composter: (g, cx, cy, s, c) => {
    // A sprout rising from a mound.
    g.moveTo(cx - s * 0.32, cy + s * 0.28).quadraticCurveTo(cx, cy + s * 0.02, cx + s * 0.32, cy + s * 0.28).closePath().stroke(line(1.5, c));
    g.moveTo(cx, cy + s * 0.12).lineTo(cx, cy - s * 0.18).stroke(line(1.5, c));
    g.moveTo(cx, cy - s * 0.08).quadraticCurveTo(cx - s * 0.2, cy - s * 0.12, cx - s * 0.2, cy - s * 0.3).quadraticCurveTo(cx - s * 0.04, cy - s * 0.26, cx, cy - s * 0.08).stroke(line(1.2, c));
    g.moveTo(cx, cy - s * 0.14).quadraticCurveTo(cx + s * 0.2, cy - s * 0.18, cx + s * 0.2, cy - s * 0.34).quadraticCurveTo(cx + s * 0.04, cy - s * 0.3, cx, cy - s * 0.14).stroke(line(1.2, c));
  },
  crypt: (g, cx, cy, s, c) => {
    // An arched doorway.
    g.moveTo(cx - s * 0.22, cy + s * 0.3).lineTo(cx - s * 0.22, cy - s * 0.06).arc(cx, cy - s * 0.06, s * 0.22, Math.PI, 0).lineTo(cx + s * 0.22, cy + s * 0.3).stroke(line(1.5, c));
    g.moveTo(cx - s * 0.32, cy + s * 0.3).lineTo(cx + s * 0.32, cy + s * 0.3).stroke(line(1.5, c));
  },
  school: (g, cx, cy, s, c) => {
    // An open book.
    g.moveTo(cx, cy - s * 0.18).lineTo(cx, cy + s * 0.24).stroke(line(1.5, c));
    g.moveTo(cx, cy - s * 0.18).quadraticCurveTo(cx - s * 0.16, cy - s * 0.26, cx - s * 0.32, cy - s * 0.18).lineTo(cx - s * 0.32, cy + s * 0.2).quadraticCurveTo(cx - s * 0.16, cy + s * 0.14, cx, cy + s * 0.24).stroke(line(1.5, c));
    g.moveTo(cx, cy - s * 0.18).quadraticCurveTo(cx + s * 0.16, cy - s * 0.26, cx + s * 0.32, cy - s * 0.18).lineTo(cx + s * 0.32, cy + s * 0.2).quadraticCurveTo(cx + s * 0.16, cy + s * 0.14, cx, cy + s * 0.24).stroke(line(1.5, c));
  },
  elder_care: (g, cx, cy, s, c) => {
    // A walking cane beside a small heart.
    g.moveTo(cx - s * 0.08, cy + s * 0.32).lineTo(cx - s * 0.08, cy - s * 0.16).quadraticCurveTo(cx - s * 0.08, cy - s * 0.3, cx - s * 0.22, cy - s * 0.3).stroke(line(1.8, c));
    const hx = cx + s * 0.16;
    const hy = cy - s * 0.02;
    const r = s * 0.08;
    g.moveTo(hx, hy + r * 2).lineTo(hx - r * 1.6, hy).arc(hx - r * 0.8, hy - r * 0.4, r, Math.PI * 0.8, Math.PI * 1.95).arc(hx + r * 0.8, hy - r * 0.4, r, Math.PI * 1.05, Math.PI * 0.2).lineTo(hx, hy + r * 2).stroke(line(1.4, c));
  },
  admin_office: (g, cx, cy, s, c) => {
    // A pediment and columns.
    g.moveTo(cx - s * 0.32, cy - s * 0.12).lineTo(cx, cy - s * 0.32).lineTo(cx + s * 0.32, cy - s * 0.12).closePath().stroke(line(1.5, c));
    for (const dx of [-0.2, 0, 0.2]) g.moveTo(cx + dx * s, cy - s * 0.08).lineTo(cx + dx * s, cy + s * 0.22).stroke(line(1.5, c));
    g.moveTo(cx - s * 0.32, cy + s * 0.28).lineTo(cx + s * 0.32, cy + s * 0.28).stroke(line(1.5, c));
  },
  deep_well_pump: (g, cx, cy, s, c) => {
    // A droplet rising from a pipe.
    g.moveTo(cx, cy + s * 0.32).lineTo(cx, cy - s * 0.02).stroke(line(1.5, c));
    g.moveTo(cx, cy - s * 0.32).quadraticCurveTo(cx + s * 0.18, cy - s * 0.1, cx, cy - s * 0.05).quadraticCurveTo(cx - s * 0.18, cy - s * 0.1, cx, cy - s * 0.32).stroke(line(1.5, c));
    g.moveTo(cx - s * 0.25, cy + s * 0.32).lineTo(cx + s * 0.25, cy + s * 0.32).stroke(line(1.5, c));
  },
  smelter: (g, cx, cy, s, c) => {
    // A crucible over a flame.
    g.moveTo(cx - s * 0.28, cy - s * 0.2).lineTo(cx - s * 0.2, cy + s * 0.08).lineTo(cx + s * 0.2, cy + s * 0.08).lineTo(cx + s * 0.28, cy - s * 0.2).stroke(line(1.5, c));
    g.moveTo(cx, cy + s * 0.34).quadraticCurveTo(cx + s * 0.14, cy + s * 0.22, cx, cy + s * 0.14).quadraticCurveTo(cx - s * 0.14, cy + s * 0.22, cx, cy + s * 0.34).stroke(line(1.2, c));
  },
  machine_shop: (g, cx, cy, s, c) => {
    // A gear.
    g.circle(cx, cy, s * 0.18).stroke(line(1.5, c));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * s * 0.18, cy + Math.sin(a) * s * 0.18).lineTo(cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3).stroke(line(2, c));
    }
  },
  silicon_refinery: (g, cx, cy, s, c) => {
    // A crystal.
    g.poly([cx, cy - s * 0.32, cx + s * 0.2, cy - s * 0.08, cx, cy + s * 0.32, cx - s * 0.2, cy - s * 0.08]).stroke(line(1.5, c));
    g.moveTo(cx - s * 0.2, cy - s * 0.08).lineTo(cx + s * 0.2, cy - s * 0.08).stroke(line(1.2, c));
  },
  electronics_fab: (g, cx, cy, s, c) => {
    // A chip.
    g.rect(cx - s * 0.18, cy - s * 0.18, s * 0.36, s * 0.36).stroke(line(1.5, c));
    for (const d of [-0.1, 0, 0.1]) {
      g.moveTo(cx + d * s, cy - s * 0.18).lineTo(cx + d * s, cy - s * 0.3);
      g.moveTo(cx + d * s, cy + s * 0.18).lineTo(cx + d * s, cy + s * 0.3);
      g.moveTo(cx - s * 0.18, cy + d * s).lineTo(cx - s * 0.3, cy + d * s);
      g.moveTo(cx + s * 0.18, cy + d * s).lineTo(cx + s * 0.3, cy + d * s);
    }
    g.stroke(line(1.2, c));
  },
  battery_bank: (g, cx, cy, s, c) => {
    g.rect(cx - s * 0.3, cy - s * 0.15, s * 0.55, s * 0.3).stroke(line(1.5, c));
    g.rect(cx + s * 0.25, cy - s * 0.07, s * 0.06, s * 0.14).fill(c);
    g.moveTo(cx - s * 0.05, cy - s * 0.1).lineTo(cx - s * 0.12, cy + s * 0.02).lineTo(cx, cy + s * 0.02).lineTo(cx - s * 0.07, cy + s * 0.12).stroke(line(1.2, c));
  },
};

export function drawGlyph(g: GraphicsContext, type: string, cx: number, cy: number, size: number, color: number): void {
  GLYPHS[type]?.(g, cx, cy, size, color);
}

// ---- surface props: drawn standing on the ground line at y ----

export function drawSolarArray(g: GraphicsContext, x: number, w: number, y: number, color: number): void {
  const panels = Math.max(2, Math.floor(w / 26));
  const pw = (w - 8) / panels;
  for (let i = 0; i < panels; i++) {
    const px = x + 4 + i * pw;
    g.moveTo(px + pw * 0.5, y).lineTo(px + pw * 0.5, y - 12).stroke(line(2, shade(color, 0.5)));
    g.poly([px + 2, y - 12, px + pw - 2, y - 20, px + pw - 2, y - 26, px + 2, y - 18]).fill(color).stroke(line(1, shade(color, 0.4)));
  }
}

export function drawLandingPad(g: GraphicsContext, x: number, w: number, y: number, color: number): void {
  g.rect(x + 4, y - 6, w - 8, 6).fill(shade(color, 0.3));
  g.ellipse(x + w / 2, y - 6, (w - 16) / 2, 5).fill(color).stroke(line(1, shade(color, 0.4)));
  const cx = x + w / 2;
  g.moveTo(cx - 6, y - 9).lineTo(cx - 6, y - 3).moveTo(cx + 6, y - 9).lineTo(cx + 6, y - 3).moveTo(cx - 6, y - 6).lineTo(cx + 6, y - 6).stroke(line(1.5, shade(color, 0.6)));
}

export function drawPod(g: GraphicsContext, x: number, w: number, y: number, color: number): void {
  const cx = x + w / 2;
  const r = Math.min(26, w / 2 - 6);
  g.moveTo(cx - r, y).arc(cx, y, r, Math.PI, 0).closePath().fill(color).stroke(line(1.5, shade(color, 0.45)));
  for (const dx of [-0.45, 0, 0.45]) g.circle(cx + dx * r, y - r * 0.45, 3).fill(tint(0x9fd2ff, 0.3));
  // The shaft hatch the pod sits beside.
  g.rect(cx + r + 2, y - 8, 10, 8).fill(shade(color, 0.35));
}

/** A low ridge of hills along the horizon, the same every run. */
export function drawHills(g: GraphicsContext, width: number, groundY: number, color: number): void {
  const pts: number[] = [0, groundY];
  for (let x = 0; x <= width; x += 24) {
    const h = 14 + 10 * Math.sin(x * 0.011) + 6 * Math.sin(x * 0.031 + 1.7) + 3 * Math.sin(x * 0.083 + 0.4);
    pts.push(x, groundY - h);
  }
  pts.push(width, groundY);
  g.poly(pts).fill(color);
}

/** Fixed star positions, visible as the sky darkens. */
export const STARS: [number, number, number][] = Array.from({ length: 70 }, (_, i) => {
  // A small deterministic scatter; no Math.random so it doesn't flicker.
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return [a - Math.floor(a), b - Math.floor(b), 0.6 + ((i * 7) % 5) * 0.25];
});

/** A low garage with two rovers parked beside it. */
export function drawRoverDepot(g: GraphicsContext, x: number, w: number, y: number, color: number): void {
  const gw = Math.min(w * 0.45, 60);
  g.rect(x + 4, y - 18, gw, 18).fill(shade(color, 0.6)).stroke(line(1, shade(color, 0.35)));
  g.rect(x + 4 + gw * 0.2, y - 12, gw * 0.6, 12).fill(shade(color, 0.3));
  const room = w - gw - 12;
  for (let i = 0; i < 2; i++) {
    const rx = x + gw + 10 + (i * room) / 2;
    const rw = Math.min(room / 2 - 6, 26);
    g.roundRect(rx, y - 13, rw, 8, 2).fill(color).stroke(line(1, shade(color, 0.4)));
    g.rect(rx + rw * 0.55, y - 17, rw * 0.35, 4).fill(tint(0x9fd2ff, 0.3));
    for (const wx of [0.2, 0.8]) g.circle(rx + rw * wx, y - 3, 3).fill(0x2a2220);
  }
}

import * as THREE from "three";
import retro from "../../data/retro.json";

// Retro looks for the 3D view (#503), an experiment behind ?look=snes or ?look=ps1.
// The look (look.ts) draws the scene and its effects into a small picture, then
// this repaints it the way old consoles did, and it's scaled up by a whole number
// with no smoothing, so every pixel is a crisp block:
//   snes  dark outlines where depth jumps or bends, then every pixel snapped to a
//         small Mars palette (nearest in OKLab), with ordered (Bayer) dithering
//         standing in for the gradients the palette can't hold.
//   ps1   15-bit colour (5 bits a channel) with the PlayStation's own 4x4 dither,
//         no outlines, and vertices snapped to a coarse screen grid (the wobble).
// Every number is live: the tuning panel (devtools/retroPanel.ts) changes
// `retroTuning`, and the look picks it up on the next frame. The labels are
// drawn afterwards at full resolution, so text stays readable.

export type RetroStyle = "snes" | "ps1";
export type RetroPattern = "off" | "bayer2" | "bayer4" | "bayer8" | "ps1";

export interface RetroTuning {
  /** CSS pixels per chunky pixel (rounded to whole screen pixels). */
  pixel: number;
  colours: "palette" | "bits";
  /** How many of the palette's colours to use, picked to spread out (paletteSubset). */
  paletteSize: number;
  /** Bits per channel, in "bits" mode. */
  bits: number;
  /** The dither's spread, in sRGB (0 to 1). */
  dither: number;
  pattern: RetroPattern;
  outlines: boolean;
  silhouette: number;
  crease: number;
  silhouetteDark: number;
  creaseDark: number;
  creaseRange: number;
  brightness: number;
  contrast: number;
  saturation: number;
  /** Vertex snapping steps across the screen's height (0 off); takes effect on reload. */
  wobble: number;
}

export const RETRO_PALETTE: readonly string[] = retro.palette;
export const RETRO_PRESETS = retro.presets as Record<RetroStyle, RetroTuning>;
export const PALETTE_MAX = 32;
const PATTERNS: RetroPattern[] = ["off", "bayer2", "bayer4", "bayer8", "ps1"];

const STORE = "dm.retroTuning";

/** The tuning in use, shared by the look and the panel; saved per browser so a reload keeps it. */
export const retroTuning: RetroTuning = { ...RETRO_PRESETS.snes };
const listeners = new Set<() => void>();

/** Start from a style's preset, or what was saved for it last time. */
export function initRetroTuning(style: RetroStyle): void {
  Object.assign(retroTuning, RETRO_PRESETS[style]);
  try {
    const saved = JSON.parse(localStorage.getItem(`${STORE}.${style}`) ?? "null") as Partial<RetroTuning> | null;
    if (saved) for (const k of Object.keys(retroTuning) as (keyof RetroTuning)[]) if (typeof saved[k] === typeof retroTuning[k]) (retroTuning as unknown as Record<string, unknown>)[k] = saved[k];
  } catch {
    // No storage: the preset it is.
  }
}

/** Change some of the tuning, save it, and tell the look. */
export function setRetroTuning(style: RetroStyle, change: Partial<RetroTuning>): void {
  Object.assign(retroTuning, change);
  try {
    localStorage.setItem(`${STORE}.${style}`, JSON.stringify(retroTuning));
  } catch {
    // Not saved; it still applies.
  }
  for (const f of listeners) f();
}

export function onRetroTuning(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** The retro style a page's address asks for (?look=snes or ?look=ps1), or null. */
export function retroStyleFrom(search: string): RetroStyle | null {
  const v = new URLSearchParams(search).get("look");
  return v === "snes" || v === "ps1" ? v : null;
}

/** The small picture for a screen at `scale` screen pixels a chunky pixel: just big enough to cover it. */
export function retroGrid(screenW: number, screenH: number, scale: number): { scale: number; w: number; h: number } {
  const s = Math.max(1, Math.round(scale));
  return { scale: s, w: Math.max(1, Math.ceil(screenW / s)), h: Math.max(1, Math.ceil(screenH / s)) };
}

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** A colour in OKLab (lightness, green–red, blue–yellow), where nearness matches what the eye sees. */
export function oklab(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  const r = srgbToLinear(((n >> 16) & 255) / 255);
  const g = srgbToLinear(((n >> 8) & 255) / 255);
  const b = srgbToLinear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * `n` of the palette's colours, spread as far apart as they go: the darkest, then
 * again and again the colour furthest (in OKLab) from those already picked.
 */
export function paletteSubset(palette: readonly string[], n: number): string[] {
  const labs = palette.map(oklab);
  const count = Math.max(1, Math.min(palette.length, Math.round(n)));
  let first = 0;
  labs.forEach((c, i) => c[0] < labs[first]![0] && (first = i));
  const picked = [first];
  const nearest = labs.map((c) => dist(c, labs[first]!));
  while (picked.length < count) {
    let far = -1;
    nearest.forEach((d, i) => !picked.includes(i) && (far < 0 || d > nearest[far]!) && (far = i));
    picked.push(far);
    labs.forEach((c, i) => (nearest[i] = Math.min(nearest[i]!, dist(c, labs[far]!))));
  }
  return picked.map((i) => palette[i]!);
}

function dist(a: number[], b: number[]): number {
  return (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** The repaint, at the small picture's size, on colour that's already tone mapped and in sRGB. */
export function retroShader() {
  return {
    name: "Retro",
    defines: { PALETTE_MAX },
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null as THREE.Texture | null },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 1000 },
      outlineOn: { value: 1 },
      outline: { value: new THREE.Vector4() },
      creaseRange: { value: 0 },
      grade: { value: new THREE.Vector3(1, 1, 1) },
      mode: { value: 0 },
      pattern: { value: 2 },
      dither: { value: 0 },
      bits: { value: 5 },
      paletteSize: { value: 0 },
      paletteLab: { value: Array.from({ length: PALETTE_MAX }, () => new THREE.Vector3()) },
      paletteRgb: { value: Array.from({ length: PALETTE_MAX }, () => new THREE.Vector3()) },
    },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform float outlineOn;
      uniform vec4 outline;
      uniform float creaseRange;
      uniform vec3 grade;
      uniform int mode;
      uniform int pattern;
      uniform float dither;
      uniform float bits;
      uniform int paletteSize;
      uniform vec3 paletteLab[PALETTE_MAX];
      uniform vec3 paletteRgb[PALETTE_MAX];
      varying vec2 vUv;

      float viewZ(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
      }

      // Ordered dither thresholds, 0 to 1, from Bayer matrices.
      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

      // The dither offset for this pixel, about -0.5 to 0.5.
      float threshold(vec2 px) {
        if (pattern == 1) return bayer2(px) - 0.5 + 1.0 / 8.0;
        if (pattern == 2) return bayer4(px) - 0.5 + 1.0 / 32.0;
        if (pattern == 3) return bayer8(px) - 0.5 + 1.0 / 128.0;
        if (pattern == 4) {
          // The PlayStation's table, in eighths of a step.
          const mat4 table = mat4(-4.0, 0.0, -3.0, 1.0, 2.0, -2.0, 3.0, -1.0, -3.0, 1.0, -4.0, 0.0, 3.0, -1.0, 2.0, -2.0);
          return table[int(mod(px.y, 4.0))][int(mod(px.x, 4.0))] / 8.0;
        }
        return 0.0;
      }

      vec3 toLinear(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
      }
      vec3 toOklab(vec3 c) {
        float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
        float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
        float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
        l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
        return vec3(
          0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
      }

      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 px = floor(vUv * resolution);

        // Brightness, contrast and saturation, before the colours are reduced.
        c *= grade.x;
        c = (c - 0.5) * grade.y + 0.5;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        c = clamp(mix(vec3(luma), c, grade.z), 0.0, 1.0);

        if (outlineOn > 0.5) {
          vec2 t = 1.0 / resolution;
          float zc = viewZ(vUv);
          if (zc < cameraFar * 0.98) {
            float zl = viewZ(vUv - vec2(t.x, 0.0)), zr = viewZ(vUv + vec2(t.x, 0.0));
            float zd = viewZ(vUv - vec2(0.0, t.y)), zu = viewZ(vUv + vec2(0.0, t.y));
            float far = max(max(zl, zr), max(zd, zu));
            float near = min(min(zl, zr), min(zd, zu));
            if ((far - zc) / zc > outline.x) {
              // The near side of a jump in depth: a silhouette.
              c *= outline.z;
            } else if (outline.y > 0.0 && (zc - near) / zc <= outline.x && zc < creaseRange) {
              // Where a surface bends: 1/depth is flat across a flat surface, so its curvature finds the creases.
              float ic = 1.0 / zc;
              float bend = (abs(1.0 / zl + 1.0 / zr - 2.0 * ic) + abs(1.0 / zd + 1.0 / zu - 2.0 * ic)) / ic;
              if (bend > outline.y) c *= outline.w;
            }
          }
        }

        c = clamp(c + threshold(px) * dither, 0.0, 1.0);
        if (mode == 1) {
          // So many bits a channel, rounded to the nearest level.
          float levels = exp2(bits) - 1.0;
          c = floor(c * levels + 0.5) / levels;
        } else if (paletteSize > 0) {
          vec3 lab = toOklab(toLinear(c));
          float best = 1e9;
          vec3 pick = c;
          for (int i = 0; i < PALETTE_MAX; i++) {
            if (i >= paletteSize) break;
            vec3 d = lab - paletteLab[i];
            float e = dot(d, d);
            if (e < best) { best = e; pick = paletteRgb[i]; }
          }
          c = pick;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  };
}

/** Set the repaint's uniforms from the tuning. */
export function applyRetroTuning(u: Record<string, THREE.IUniform>, t: RetroTuning): void {
  u.outlineOn!.value = t.outlines ? 1 : 0;
  (u.outline!.value as THREE.Vector4).set(t.silhouette, t.crease, t.silhouetteDark, t.creaseDark);
  u.creaseRange!.value = t.creaseRange;
  (u.grade!.value as THREE.Vector3).set(t.brightness, t.contrast, t.saturation);
  u.mode!.value = t.colours === "bits" ? 1 : 0;
  u.pattern!.value = Math.max(0, PATTERNS.indexOf(t.pattern));
  u.dither!.value = t.dither;
  u.bits!.value = t.bits;
  const colours = paletteSubset(RETRO_PALETTE, t.paletteSize);
  u.paletteSize!.value = colours.length;
  const labs = u.paletteLab!.value as THREE.Vector3[];
  const rgbs = u.paletteRgb!.value as THREE.Vector3[];
  colours.forEach((h, i) => {
    labs[i]!.set(...oklab(h));
    const n = parseInt(h, 16);
    rgbs[i]!.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  });
}

/** Scales the small picture up to the screen, each pixel a block of whole screen pixels. */
export const UpscaleShader = {
  name: "RetroUpscale",
  uniforms: { tDiffuse: { value: null }, uvScale: { value: new THREE.Vector2(1, 1) } },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uvScale;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(texture2D(tDiffuse, vUv * uvScale).rgb, 1.0);
    }`,
};

let wobbling = false;

/**
 * The PS1 wobble: every vertex snapped to a coarse grid on screen, so edges jitter
 * as the camera moves. Patched into three's shared vertex code, so it must run
 * before the scene's materials first compile (and it stays for the page's life).
 */
export function snapVertices(steps: number): void {
  if (steps <= 0 || wobbling) return;
  wobbling = true;
  const half = (steps / 2).toFixed(1);
  THREE.ShaderChunk.project_vertex += `
    gl_Position.xy = floor(gl_Position.xy / gl_Position.w * ${half} + 0.5) / ${half} * gl_Position.w;`;
}

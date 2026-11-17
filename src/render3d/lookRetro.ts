import * as THREE from "three";
import retro from "../../data/retro.json";

// Looks for the 3D view (#503), an experiment behind ?look=<preset> (snes, crt,
// ps1, n64, cel, painterly, blueprint, vector, ascii; data/retro.json). The look
// (look.ts) draws the scene and its usual effects into a small picture, then:
//   repaint  (at the small size) brush strokes (a Kuwahara filter), brightness,
//            contrast and saturation, distance fog, outlines from the depth, then
//            either the colours cut down (to a palette in OKLab, or so many bits a
//            channel) with an ordered dither, screen- or world-pinned, or, in
//            lines mode, only the edges in ink on paper, with a world grid;
//   upscale  (to the screen) hard blocks or a smooth blur, each block drawn as a
//            text character (ASCII), and a curved CRT with scanlines, a phosphor
//            mask, colour fringes and glow.
// Two changes reach the scene's own materials, so they apply on reload: the PS1
// wobble (vertices snapped to a coarse screen grid) and cel shading (light in hard
// bands). Everything else is live: the panel (devtools/retroPanel.ts) changes
// `retroTuning`, and the look picks it up on the next frame. The labels are drawn
// afterwards at full resolution, so text stays readable.

export type RetroStyle = string;
export type RetroPattern = "off" | "bayer2" | "bayer4" | "bayer8" | "ps1";

export interface RetroTuning {
  /** CSS pixels per chunky pixel (rounded to whole screen pixels). */
  pixel: number;
  smooth: boolean;
  render: "colour" | "lines";
  colours: "full" | "palette" | "bits";
  /** How many of the palette's colours to use, picked to spread out (paletteSubset). */
  paletteSize: number;
  bits: number;
  brightness: number;
  contrast: number;
  saturation: number;
  /** Kuwahara radius in pixels (0 off). */
  paint: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  fogColour: string;
  pattern: RetroPattern;
  /** The dither's spread, in sRGB (0 to 1). */
  dither: number;
  stableDither: boolean;
  outlines: boolean;
  outlineWidth: number;
  silhouette: number;
  silhouetteDark: number;
  crease: number;
  creaseDark: number;
  creaseRange: number;
  paper: string;
  ink: string;
  fill: number;
  grid: number;
  ascii: boolean;
  asciiMono: boolean;
  crt: boolean;
  curvature: number;
  scanlines: number;
  mask: number;
  aberration: number;
  glow: number;
  vignette: number;
  /** Vertex snapping steps across the screen's height (0 off); on reload. */
  wobble: number;
  /** Hard bands of light (0 off); on reload. */
  celBands: number;
}

export const RETRO_PALETTE: readonly string[] = retro.palette;
const BASE = retro.base as RetroTuning;
/** Every preset, each the base with its own changes. */
export const RETRO_PRESETS: Record<string, RetroTuning> = Object.fromEntries(
  Object.entries(retro.presets).map(([k, v]) => [k, { ...BASE, ...(v as Partial<RetroTuning>) }]),
);
export const PALETTE_MAX = 32;
const PATTERNS: RetroPattern[] = ["off", "bayer2", "bayer4", "bayer8", "ps1"];
/** The characters ASCII draws with, from darkest to brightest. */
const GLYPHS = " .:-=+*#%@";

const STORE = "dm.retroTuning";

/** The tuning in use, shared by the look and the panel; saved per browser and preset, so a reload keeps it. */
export const retroTuning: RetroTuning = { ...BASE };
const listeners = new Set<() => void>();

/** Start from a preset, or what was saved for it last time. */
export function initRetroTuning(style: RetroStyle): void {
  Object.assign(retroTuning, RETRO_PRESETS[style] ?? BASE);
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

/** The preset a page's address asks for (?look=snes, ?look=blueprint …), or null. */
export function retroStyleFrom(search: string): RetroStyle | null {
  const v = new URLSearchParams(search).get("look");
  return v && v in RETRO_PRESETS ? v : null;
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
  const [r, g, b] = rgb(hex).map(srgbToLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** A hex colour's sRGB channels, 0 to 1. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
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
    defines: { PALETTE_MAX, PAINT_MAX: 6 },
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null as THREE.Texture | null },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 1000 },
      projectionInverse: { value: new THREE.Matrix4() },
      cameraWorld: { value: new THREE.Matrix4() },
      pixelAngle: { value: 0.001 },
      render: { value: 0 },
      outlineOn: { value: 1 },
      outlineWidth: { value: 1 },
      outline: { value: new THREE.Vector4() },
      creaseRange: { value: 0 },
      grade: { value: new THREE.Vector3(1, 1, 1) },
      paint: { value: 0 },
      fog: { value: new THREE.Vector3() },
      fogColour: { value: new THREE.Vector3() },
      mode: { value: 0 },
      pattern: { value: 2 },
      dither: { value: 0 },
      stableDither: { value: 0 },
      bits: { value: 5 },
      paper: { value: new THREE.Vector3() },
      ink: { value: new THREE.Vector3() },
      fill: { value: 0 },
      grid: { value: 0 },
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
      uniform mat4 projectionInverse;
      uniform mat4 cameraWorld;
      uniform float pixelAngle;
      uniform int render;
      uniform float outlineOn;
      uniform float outlineWidth;
      uniform vec4 outline;
      uniform float creaseRange;
      uniform vec3 grade;
      uniform float paint;
      uniform vec3 fog;
      uniform vec3 fogColour;
      uniform int mode;
      uniform int pattern;
      uniform float dither;
      uniform float stableDither;
      uniform float bits;
      uniform vec3 paper;
      uniform vec3 ink;
      uniform float fill;
      uniform float grid;
      uniform int paletteSize;
      uniform vec3 paletteLab[PALETTE_MAX];
      uniform vec3 paletteRgb[PALETTE_MAX];
      varying vec2 vUv;

      float viewZ(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
      }

      vec3 worldAt(vec2 uv) {
        vec4 v = projectionInverse * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0);
        return (cameraWorld * vec4(v.xyz / v.w, 1.0)).xyz;
      }

      // A surface's own 2D coordinates: the world plane it faces most.
      vec2 planeOf(vec3 p, vec3 n) {
        vec3 a = abs(n);
        return a.y >= a.x && a.y >= a.z ? p.xz : a.x >= a.z ? p.zy : p.xy;
      }

      // Brush strokes: each pixel takes the mean of whichever of its four corner
      // squares is most even, so flat areas smear and edges stay sharp.
      vec3 kuwahara(vec2 uv, int r) {
        vec2 t = 1.0 / resolution;
        vec3 best = vec3(0.0);
        float bestVar = 1e9;
        for (int q = 0; q < 4; q++) {
          vec2 dir = vec2(q == 1 || q == 3 ? -1.0 : 1.0, q >= 2 ? -1.0 : 1.0);
          vec3 sum = vec3(0.0);
          vec3 sq = vec3(0.0);
          float n = 0.0;
          for (int y = 0; y <= PAINT_MAX; y++) {
            if (y > r) break;
            for (int x = 0; x <= PAINT_MAX; x++) {
              if (x > r) break;
              vec3 s = texture2D(tDiffuse, uv + vec2(float(x), float(y)) * dir * t).rgb;
              sum += s;
              sq += s * s;
              n += 1.0;
            }
          }
          vec3 mean = sum / n;
          vec3 v = sq / n - mean * mean;
          float var = v.r + v.g + v.b;
          if (var < bestVar) { bestVar = var; best = mean; }
        }
        return best;
      }

      // Ordered dither thresholds, 0 to 1, from Bayer matrices.
      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

      // The dither offset at this cell, about -0.5 to 0.5.
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
        vec2 px = floor(vUv * resolution);
        float zc = viewZ(vUv);
        bool sky = zc >= cameraFar * 0.98;
        // Where this pixel is in the world, and which way its surface faces (from the neighbours'), for the grid and the pinned dither.
        vec3 world = worldAt(vUv);
        vec3 normal = normalize(cross(dFdx(world), dFdy(world)));
        // How many metres one pixel spans, here.
        float pixelMetres = zc * pixelAngle;

        vec3 c = paint >= 1.0 ? kuwahara(vUv, int(paint)) : texture2D(tDiffuse, vUv).rgb;

        // Brightness, contrast and saturation.
        c *= grade.x;
        c = (c - 0.5) * grade.y + 0.5;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        c = clamp(mix(vec3(luma), c, grade.z), 0.0, 1.0);

        // Distance fog (the sky takes it in full).
        if (fog.x > 0.0) c = mix(c, fogColour, fog.x * (sky ? 1.0 : smoothstep(fog.y, fog.z, zc)));

        // Edges: 1 the near side of a jump in depth (a silhouette), 0.5 where a surface bends (a crease).
        float edge = 0.0;
        if ((outlineOn > 0.5 || render == 1) && !sky) {
          vec2 t = outlineWidth / resolution;
          float zl = viewZ(vUv - vec2(t.x, 0.0)), zr = viewZ(vUv + vec2(t.x, 0.0));
          float zd = viewZ(vUv - vec2(0.0, t.y)), zu = viewZ(vUv + vec2(0.0, t.y));
          float far = max(max(zl, zr), max(zd, zu));
          float near = min(min(zl, zr), min(zd, zu));
          if ((far - zc) / zc > outline.x) {
            edge = 1.0;
          } else if (outline.y > 0.0 && (zc - near) / zc <= outline.x && zc < creaseRange) {
            // 1/depth is flat across a flat surface, so its curvature finds the creases.
            float ic = 1.0 / zc;
            float bend = (abs(1.0 / zl + 1.0 / zr - 2.0 * ic) + abs(1.0 / zd + 1.0 / zu - 2.0 * ic)) / ic;
            if (bend > outline.y) edge = 0.5;
          }
        }

        if (render == 1) {
          // Lines: ink on paper, a little of the scene's shading, and a grid on the world's surfaces.
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 base = mix(paper, mix(paper, ink, lum), fill);
          float g = 0.0;
          if (grid > 0.0 && !sky) {
            vec2 p = planeOf(world, normal);
            vec2 f = abs(fract(p / grid + 0.5) - 0.5) * grid;
            g = step(min(f.x, f.y), pixelMetres * outlineWidth * 0.5) * 0.35;
          }
          gl_FragColor = vec4(mix(base, ink, max(edge >= 1.0 ? 1.0 : edge * 1.2, g)), 1.0);
          return;
        }

        if (edge >= 1.0) c *= outline.z;
        else if (edge > 0.0) c *= outline.w;

        if (mode != 0) {
          // Dither, pinned to the screen, or to the world: there, cells a power of two metres across, about a pixel each.
          vec2 cell = px;
          if (stableDither > 0.5 && !sky) cell = floor(planeOf(world, normal) / exp2(ceil(log2(max(pixelMetres, 1e-4)))));
          c = clamp(c + threshold(cell) * dither, 0.0, 1.0);
          if (mode == 2) {
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
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  };
}

/** The characters, white on black in a row, for the ASCII look. Made once, on first use. */
let glyphTexture: THREE.Texture | null = null;
function glyphs(): THREE.Texture {
  if (glyphTexture) return glyphTexture;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size * GLYPHS.length;
  canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#fff";
  g.font = `bold ${size * 0.9}px ui-monospace, Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  [...GLYPHS].forEach((ch, i) => g.fillText(ch, i * size + size / 2, size / 2 + 1));
  glyphTexture = new THREE.CanvasTexture(canvas);
  glyphTexture.colorSpace = THREE.NoColorSpace;
  return glyphTexture;
}

/** Scales the small picture up to the screen: blocks or a blur, characters, and the CRT. */
export function upscaleShader() {
  return {
    name: "RetroUpscale",
    uniforms: {
      tDiffuse: { value: null },
      lowSize: { value: new THREE.Vector2(1, 1) },
      screen: { value: new THREE.Vector2(1, 1) },
      scale: { value: 1 },
      smoothing: { value: 0 },
      ascii: { value: 0 },
      asciiMono: { value: 0 },
      glyphs: { value: null as THREE.Texture | null },
      glyphCount: { value: GLYPHS.length },
      paper: { value: new THREE.Vector3() },
      ink: { value: new THREE.Vector3() },
      crt: { value: 0 },
      curvature: { value: 0 },
      scanlines: { value: 0 },
      mask: { value: 0 },
      aberration: { value: 0 },
      glow: { value: 0 },
      vignette: { value: 0 },
    },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 lowSize;
      uniform vec2 screen;
      uniform float scale;
      uniform float smoothing;
      uniform float ascii;
      uniform float asciiMono;
      uniform sampler2D glyphs;
      uniform float glyphCount;
      uniform vec3 paper;
      uniform vec3 ink;
      uniform float crt;
      uniform float curvature;
      uniform float scanlines;
      uniform float mask;
      uniform float aberration;
      uniform float glow;
      uniform float vignette;
      varying vec2 vUv;

      vec3 texel(vec2 i) { return texture2D(tDiffuse, (i + 0.5) / lowSize).rgb; }

      // The picture at this screen pixel: its block, or blended between blocks.
      vec3 picture(vec2 sp) {
        vec2 tc = sp / scale;
        if (smoothing < 0.5) return texel(floor(tc));
        vec2 b = tc - 0.5;
        vec2 i = floor(b);
        vec2 f = fract(b);
        return mix(mix(texel(i), texel(i + vec2(1.0, 0.0)), f.x), mix(texel(i + vec2(0.0, 1.0)), texel(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      // The same, or as a character: the block's brightness picks it, in the block's colour or in ink.
      vec3 shade(vec2 sp) {
        if (ascii < 0.5) return picture(sp);
        vec2 tc = sp / scale;
        vec3 col = texel(floor(tc));
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        // On a curve, so the dim mid-tones of a lamp-lit hole still get the fuller characters.
        float idx = min(floor(pow(lum, 0.6) * glyphCount), glyphCount - 1.0);
        vec2 inCell = fract(tc);
        float a = texture2D(glyphs, vec2((idx + inCell.x) / glyphCount, inCell.y)).r;
        vec3 fg = asciiMono > 0.5 ? ink : col / max(max(col.r, max(col.g, col.b)), 0.25);
        return mix(paper, fg, a);
      }

      void main() {
        vec2 uv = vUv;
        vec2 q = uv * 2.0 - 1.0;
        if (crt > 0.5) {
          // The glass bulges: push the picture out towards the corners, and black beyond its edge.
          q *= 1.0 + curvature * dot(q, q);
          if (abs(q.x) > 1.0 || abs(q.y) > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          uv = q * 0.5 + 0.5;
        }
        vec2 sp = uv * screen;
        vec3 c;
        if (crt > 0.5 && aberration > 0.0) {
          vec2 o = vec2(aberration * scale * 0.5, 0.0);
          c = vec3(shade(sp + o).r, shade(sp).g, shade(sp - o).b);
        } else {
          c = shade(sp);
        }
        if (crt > 0.5) {
          if (glow > 0.0) {
            float r = 1.5 * max(scale, 2.0);
            vec3 g = (shade(sp + vec2(r, r)) + shade(sp + vec2(-r, r)) + shade(sp + vec2(r, -r)) + shade(sp - vec2(r, r))
              + shade(sp + vec2(2.0 * r, 0.0)) + shade(sp - vec2(2.0 * r, 0.0)) + shade(sp + vec2(0.0, 2.0 * r)) + shade(sp - vec2(0.0, 2.0 * r))) / 8.0;
            c += g * glow;
          }
          // Scanlines, one to a row of blocks (at least every few screen pixels).
          float row = fract(sp.y / max(scale, 3.0));
          c *= 1.0 - scanlines * (1.0 - sin(row * 3.14159));
          // The phosphor mask: red, green and blue stripes, a screen pixel each.
          float col = mod(floor(gl_FragCoord.x), 3.0);
          vec3 m = col < 1.0 ? vec3(1.0, 0.4, 0.4) : col < 2.0 ? vec3(0.4, 1.0, 0.4) : vec3(0.4, 0.4, 1.0);
          c *= mix(vec3(1.0), m, mask) * (1.0 + mask * 0.8);
          c *= 1.0 - vignette * dot(q, q) * 0.5;
        }
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  };
}

/** Set both passes' uniforms from the tuning. */
export function applyRetroTuning(u: Record<string, THREE.IUniform>, up: Record<string, THREE.IUniform>, t: RetroTuning): void {
  const v3 = (x: THREE.IUniform, hex: string) => (x.value as THREE.Vector3).set(...rgb(hex));
  u.render!.value = t.render === "lines" ? 1 : 0;
  u.outlineOn!.value = t.outlines ? 1 : 0;
  u.outlineWidth!.value = t.outlineWidth;
  (u.outline!.value as THREE.Vector4).set(t.silhouette, t.crease, t.silhouetteDark, t.creaseDark);
  u.creaseRange!.value = t.creaseRange;
  (u.grade!.value as THREE.Vector3).set(t.brightness, t.contrast, t.saturation);
  u.paint!.value = t.paint;
  (u.fog!.value as THREE.Vector3).set(t.fog, t.fogNear, Math.max(t.fogFar, t.fogNear + 1));
  v3(u.fogColour!, t.fogColour);
  u.mode!.value = t.colours === "palette" ? 1 : t.colours === "bits" ? 2 : 0;
  u.pattern!.value = Math.max(0, PATTERNS.indexOf(t.pattern));
  u.dither!.value = t.dither;
  u.stableDither!.value = t.stableDither ? 1 : 0;
  u.bits!.value = t.bits;
  v3(u.paper!, t.paper);
  v3(u.ink!, t.ink);
  u.fill!.value = t.fill;
  u.grid!.value = t.grid;
  const colours = paletteSubset(RETRO_PALETTE, t.paletteSize);
  u.paletteSize!.value = colours.length;
  const labs = u.paletteLab!.value as THREE.Vector3[];
  const rgbs = u.paletteRgb!.value as THREE.Vector3[];
  colours.forEach((h, i) => {
    labs[i]!.set(...oklab(h));
    rgbs[i]!.set(...rgb(h));
  });

  up.smoothing!.value = t.smooth ? 1 : 0;
  up.ascii!.value = t.ascii ? 1 : 0;
  up.asciiMono!.value = t.asciiMono ? 1 : 0;
  if (t.ascii && !up.glyphs!.value) up.glyphs!.value = glyphs();
  v3(up.paper!, t.paper);
  v3(up.ink!, t.ink);
  up.crt!.value = t.crt ? 1 : 0;
  up.curvature!.value = t.curvature;
  up.scanlines!.value = t.scanlines;
  up.mask!.value = t.mask;
  up.aberration!.value = t.aberration;
  up.glow!.value = t.glow;
  up.vignette!.value = t.vignette;
}

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

let banded = false;

/**
 * Cel shading: each light's contribution cut into hard bands by its strength, so
 * surfaces step from lit to shade rather than fading. Patched into three's shared
 * lighting code (standard, Lambert and Phong), before materials compile.
 */
export function bandLighting(bands: number): void {
  if (bands <= 0 || banded) return;
  banded = true;
  const line = "vec3 irradiance = dotNL * directLight.color;";
  const b = Math.round(bands).toFixed(1);
  const cut = `${line}
    { float il = max(max(irradiance.r, irradiance.g), irradiance.b);
      if (il > 0.0) irradiance *= (floor(il * ${b} + 0.35) / ${b}) / il; }`;
  const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
  for (const k of ["lights_physical_pars_fragment", "lights_lambert_pars_fragment", "lights_phong_pars_fragment"]) chunks[k] = chunks[k]!.replace(line, cut);
}

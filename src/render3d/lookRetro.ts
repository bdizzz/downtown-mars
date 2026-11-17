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
// The labels are drawn afterwards at full resolution, so text stays readable.

export type RetroStyle = "snes" | "ps1";

interface Outline {
  silhouette: number;
  crease: number;
  silhouetteDark: number;
  creaseDark: number;
  creaseRange: number;
}

interface RetroSettings {
  height: number;
  outline: Outline | null;
  dither: number;
  palette?: string[];
  bits?: number;
  wobble: number;
}

export const RETRO = retro as unknown as Record<RetroStyle, RetroSettings>;

/** The retro style a page's address asks for (?look=snes or ?look=ps1), or null. */
export function retroStyleFrom(search: string): RetroStyle | null {
  const v = new URLSearchParams(search).get("look");
  return v === "snes" || v === "ps1" ? v : null;
}

/**
 * The small picture for a screen: how many screen pixels each chunky pixel
 * covers (a whole number, so they're all the same size), and the picture's
 * size, just big enough to cover the screen at that scale.
 */
export function retroGrid(screenW: number, screenH: number, height: number): { scale: number; w: number; h: number } {
  const scale = Math.max(1, Math.round(screenH / height));
  return { scale, w: Math.max(1, Math.ceil(screenW / scale)), h: Math.max(1, Math.ceil(screenH / scale)) };
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

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** The repaint, at the small picture's size, on colour that's already tone mapped and in sRGB. */
export function retroShader(style: RetroStyle) {
  const s = RETRO[style];
  const palette = s.palette ?? [];
  const o = s.outline;
  return {
    name: `Retro-${style}`,
    defines: { PALETTE_SIZE: palette.length, OUTLINE: o ? 1 : 0, PS1: style === "ps1" ? 1 : 0 },
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null as THREE.Texture | null },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 1000 },
      outline: { value: new THREE.Vector4(o?.silhouette ?? 0, o?.crease ?? 0, o?.silhouetteDark ?? 1, o?.creaseDark ?? 1) },
      creaseRange: { value: o?.creaseRange ?? 0 },
      dither: { value: s.dither },
      bits: { value: s.bits ?? 8 },
      paletteLab: { value: palette.map((h) => new THREE.Vector3(...oklab(h))) },
      paletteRgb: { value: palette.map((h) => new THREE.Color().setRGB(((parseInt(h, 16) >> 16) & 255) / 255, ((parseInt(h, 16) >> 8) & 255) / 255, (parseInt(h, 16) & 255) / 255, THREE.LinearSRGBColorSpace)) },
    },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform vec4 outline;
      uniform float creaseRange;
      uniform float dither;
      uniform float bits;
      #if PALETTE_SIZE > 0
        uniform vec3 paletteLab[PALETTE_SIZE];
        uniform vec3 paletteRgb[PALETTE_SIZE];
      #endif
      varying vec2 vUv;

      float viewZ(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
      }

      // Ordered dither, 0 to 1, from a 4x4 Bayer matrix.
      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

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

        #if OUTLINE
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
            } else if ((zc - near) / zc <= outline.x && zc < creaseRange) {
              // Where a surface bends: 1/depth is flat across a flat surface, so its curvature finds the creases.
              float ic = 1.0 / zc;
              float bend = (abs(1.0 / zl + 1.0 / zr - 2.0 * ic) + abs(1.0 / zd + 1.0 / zu - 2.0 * ic)) / ic;
              if (bend > outline.y) c *= outline.w;
            }
          }
        #endif

        #if PS1
          // The PlayStation's dither table, in 8-bit steps, then truncated to 5 bits a channel.
          const mat4 table = mat4(-4.0, 0.0, -3.0, 1.0, 2.0, -2.0, 3.0, -1.0, -3.0, 1.0, -4.0, 0.0, 3.0, -1.0, 2.0, -2.0);
          int x = int(mod(px.x, 4.0));
          int y = int(mod(px.y, 4.0));
          float stepSize = exp2(8.0 - bits);
          vec3 c8 = clamp(floor(c * 255.0 + 0.5) + table[y][x] * dither, 0.0, 255.0);
          vec3 q = floor(c8 / stepSize);
          // Back to 8 bits the way the hardware did: the top bits repeated into the bottom.
          c = (q * stepSize + floor(q / exp2(bits - (8.0 - bits)))) / 255.0;
        #elif PALETTE_SIZE > 0
          c = clamp(c + (bayer4(px) - 0.5 + 1.0 / 32.0) * dither, 0.0, 1.0);
          vec3 lab = toOklab(toLinear(c));
          float best = 1e9;
          vec3 pick = c;
          for (int i = 0; i < PALETTE_SIZE; i++) {
            vec3 d = lab - paletteLab[i];
            float e = dot(d, d);
            if (e < best) { best = e; pick = paletteRgb[i]; }
          }
          c = pick;
        #endif
        gl_FragColor = vec4(c, 1.0);
      }`,
  };
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

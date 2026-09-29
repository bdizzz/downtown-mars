import * as THREE from "three";

// Procedural surfaces: patterns worked out in the shader from each point's
// position in the world, so there are no image files, nothing to unwrap, and
// they read the same on walls, ceilings and floors. Each adds to whatever the
// material's shader already does (walls down, for instance).

/** Value noise and a few octaves of it, in world metres. */
const NOISE_GLSL = /* glsl */ `
  float srfHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float srfNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(srfHash(i + vec3(0, 0, 0)), srfHash(i + vec3(1, 0, 0)), f.x), mix(srfHash(i + vec3(0, 1, 0)), srfHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(srfHash(i + vec3(0, 0, 1)), srfHash(i + vec3(1, 0, 1)), f.x), mix(srfHash(i + vec3(0, 1, 1)), srfHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float srfFbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * srfNoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`;

/**
 * Martian rock: sediment laid down in bands a metre or so thick, bent a little
 * so they wander, each band its own shade; a fine grain over it, broad
 * mottling, and dark flecks. Soft contrast, for the cozy look.
 */
const ROCK_GLSL = /* glsl */ `
  vec3 rockTone(vec3 p) {
    // Strata: bands in height, warped by broad noise so they undulate round the hole.
    float s = p.y / 1.4 + (srfFbm(p * 0.05) - 0.5) * 0.9;
    float band = floor(s);
    float edge = smoothstep(0.0, 0.12, fract(s)) * smoothstep(1.0, 0.88, fract(s));
    float shade = mix(0.84, 1.1, srfHash(vec3(band, 3.1, 7.7)));
    // A thin darker seam between bands.
    shade *= mix(0.9, 1.0, edge);
    // Mottling across metres, grain across centimetres.
    shade *= mix(0.9, 1.08, srfFbm(p * 0.35));
    shade *= mix(0.93, 1.05, srfNoise(p * 6.0));
    // Flecks of darker stone.
    shade *= 1.0 - 0.18 * smoothstep(0.78, 0.86, srfNoise(p * 2.7 + 11.0));
    // Warmer in the lighter bands, a touch cooler in the dark ones.
    return vec3(shade * 1.02, shade, shade * 0.97);
  }
`;

/** The surface's dust: broad soft mottling, fine grain and scattered pebbles, no layers. */
const REGOLITH_GLSL = /* glsl */ `
  vec3 regolithTone(vec3 p) {
    float shade = mix(0.9, 1.07, srfFbm(p * 0.12));
    shade *= mix(0.94, 1.04, srfNoise(p * 4.0));
    shade *= 1.0 - 0.12 * smoothstep(0.8, 0.88, srfNoise(p * 1.9 + 5.0));
    return vec3(shade * 1.01, shade, shade * 0.98);
  }
`;

/** Add a world-space pattern to a standard material: `tone(p)` multiplies its colour. */
function withPattern<T extends THREE.Material>(m: T, name: string, glsl: string, call: string): T {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSurfacePos;")
      .replace("#include <project_vertex>", "vSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSurfacePos;\n${NOISE_GLSL}\n${glsl}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.rgb *= ${call}(vSurfacePos);`);
  };
  m.customProgramCacheKey = () => `${prevKey}|${name}`;
  return m;
}

/** Stratified Martian rock, on any material that draws rock. */
export function withRock<T extends THREE.Material>(m: T): T {
  return withPattern(m, "rock", ROCK_GLSL, "rockTone");
}

/** The surface's dust (regolith), for the ground around the hole. */
export function withRegolith<T extends THREE.Material>(m: T): T {
  return withPattern(m, "regolith", REGOLITH_GLSL, "regolithTone");
}

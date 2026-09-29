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
  vec3 rockTone(vec3 p, vec3 n) {
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
  vec3 regolithTone(vec3 p, vec3 n) {
    float shade = mix(0.9, 1.07, srfFbm(p * 0.12));
    shade *= mix(0.94, 1.04, srfNoise(p * 4.0));
    shade *= 1.0 - 0.12 * smoothstep(0.8, 0.88, srfNoise(p * 1.9 + 5.0));
    return vec3(shade * 1.01, shade, shade * 0.98);
  }
`;

/**
 * Where on a surface a point is, as flat coordinates for a pattern that has a
 * direction (bricks, panels): on a wall, along it (round a curved wall by arc
 * length, out along a radial one) and up; on a floor, x and z.
 */
const WALL_UV_GLSL = /* glsl */ `
  vec2 surfaceUv(vec3 p, vec3 n) {
    if (abs(n.y) > 0.7) return p.xz;
    vec2 radial = normalize(p.xz + 1e-5);
    // A wall facing the shaft (or away) curves round it; one facing sideways runs out from it.
    float along = abs(dot(normalize(n.xz + 1e-5), radial)) > 0.7 ? atan(p.z, p.x) * length(p.xz) : length(p.xz);
    return vec2(along, p.y);
  }
`;

/** Brick: running bond on walls, square tiles on floors; mortar lines, and each brick its own shade. */
const BRICK_GLSL = /* glsl */ `
  vec3 brickTone(vec3 p, vec3 n) {
    vec2 uv = surfaceUv(p, n);
    if (abs(n.y) > 0.7) {
      vec2 t = uv / 0.6;
      vec2 f = fract(t);
      float grout = step(0.04, f.x) * step(0.04, f.y);
      float shade = mix(0.9, 1.06, srfHash(vec3(floor(t), 2.0)));
      return vec3(mix(0.62, shade, grout));
    }
    vec2 b = uv / vec2(0.5, 0.2);
    b.x += 0.5 * mod(floor(b.y), 2.0);
    vec2 f = fract(b);
    float mortar = step(0.05, f.x) * step(0.08, f.y);
    float shade = mix(0.82, 1.1, srfHash(vec3(floor(b), 5.0))) * mix(0.94, 1.04, srfNoise(p * 5.0));
    return mix(vec3(1.35, 1.3, 1.22), vec3(shade), mortar);
  }
`;

/** Metal: bolted panels with darker seams and a row of rivets beside each seam on walls; diamond plate underfoot. */
const METAL_GLSL = /* glsl */ `
  vec3 metalTone(vec3 p, vec3 n) {
    vec2 uv = surfaceUv(p, n);
    if (abs(n.y) > 0.7) {
      vec2 d = uv * 6.0;
      float plate = abs(fract(d.x + d.y) - 0.5) + abs(fract(d.x - d.y) - 0.5);
      float seams = step(0.02, fract(uv.x / 2.0)) * step(0.02, fract(uv.y / 2.0));
      return vec3(mix(0.7, mix(0.95, 1.08, smoothstep(0.35, 0.6, plate)), seams));
    }
    vec2 size = vec2(1.2, 1.0);
    vec2 f = fract(uv / size);
    // Metres to the nearest seam each way.
    vec2 edge = min(f, 1.0 - f) * size;
    float seam = step(0.012, edge.x) * step(0.012, edge.y);
    // Rivets: 3.5 cm in from each seam, every 25 cm along it.
    float alongY = (fract(uv.y / 0.25) - 0.5) * 0.25;
    float alongX = (fract(uv.x / 0.25) - 0.5) * 0.25;
    float rivet = max(step(length(vec2(edge.x - 0.035, alongY)), 0.012), step(length(vec2(edge.y - 0.035, alongX)), 0.012));
    float shade = mix(0.9, 1.06, srfHash(vec3(floor(uv / size), 9.0))) * mix(0.96, 1.03, srfNoise(vec3(uv.x * 40.0, uv.y * 2.0, 0.0)));
    return vec3(mix(0.62, shade, seam) * (1.0 + 0.18 * rivet));
  }
`;

/** Marscrete: speckled aggregate, faint form lines on walls every 60 cm, joints across floors every 3 m. */
const MARSCRETE_GLSL = /* glsl */ `
  vec3 marscreteTone(vec3 p, vec3 n) {
    vec2 uv = surfaceUv(p, n);
    float shade = mix(0.9, 1.06, srfFbm(p * 0.8)) * mix(0.94, 1.05, srfNoise(p * 14.0));
    shade *= 1.0 - 0.15 * smoothstep(0.82, 0.9, srfNoise(p * 7.0 + 3.0));
    if (abs(n.y) > 0.7) {
      vec2 f = fract(uv / 3.0);
      vec2 e = min(f, 1.0 - f) * 3.0;
      shade *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.015, min(e.x, e.y)));
    } else {
      float fy = fract(uv.y / 0.6);
      shade *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.012, min(fy, 1.0 - fy) * 0.6));
    }
    return vec3(shade);
  }
`;

/** Add a world-space pattern to a standard material: `tone(p, n)` multiplies its colour. */
function withPattern<T extends THREE.Material>(m: T, name: string, glsl: string, call: string): T {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSurfacePos;\nvarying vec3 vSurfaceNormal;")
      .replace(
        "#include <project_vertex>",
        "vSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSurfaceNormal = normalize(mat3(modelMatrix) * objectNormal);\n#include <project_vertex>",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSurfacePos;\nvarying vec3 vSurfaceNormal;\n${NOISE_GLSL}\n${WALL_UV_GLSL}\n${glsl}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.rgb *= ${call}(vSurfacePos, normalize(vSurfaceNormal));`);
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

/** What each room finish looks like: a base colour and roughness, and its pattern. */
const FINISH_LOOK = {
  rock: { glsl: ROCK_GLSL, call: "rockTone", color: 0x7a4f3c, roughness: 0.95, metalness: 0 },
  marscrete: { glsl: MARSCRETE_GLSL, call: "marscreteTone", color: 0x9c8f84, roughness: 0.9, metalness: 0 },
  brick: { glsl: BRICK_GLSL, call: "brickTone", color: 0x9c5438, roughness: 0.85, metalness: 0 },
  metal: { glsl: METAL_GLSL, call: "metalTone", color: 0x8d9299, roughness: 0.45, metalness: 0.55 },
} as const;

/** A room's walls and floor as the material it's built from (room colours off). */
export function finishMaterial(finish: keyof typeof FINISH_LOOK): THREE.MeshStandardMaterial {
  const f = FINISH_LOOK[finish];
  const m = new THREE.MeshStandardMaterial({ color: f.color, roughness: f.roughness, metalness: f.metalness, side: THREE.DoubleSide });
  return withPattern(m, finish, f.glsl, f.call);
}

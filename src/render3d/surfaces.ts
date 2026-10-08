import * as THREE from "three";
import { config } from "../sim/config";

const FLOOR_H = config.geometry.floorHeightM;
const CRUST = config.geometry.surfaceDepthM;

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
    float edge = smoothstep(0.0, 0.12, fract(s)) * (1.0 - smoothstep(0.88, 1.0, fract(s)));
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

/**
 * The land sliced open (Iso with a floor picked), along the line where the rings look widest from the
 * camera: square to `dir` (from the axis towards the camera), `offset` metres toward it, through the
 * points where the camera's sightlines graze the rock wall. While `on`, what's on the camera's side of
 * that line isn't drawn; land isn't drawn
 * over the rings (within `radius` of the axis); and land and the cut face thin out with distance past
 * the rings (from `radius + fadeFrom` to `radius + fadeTo`), a fine stipple into the background, so
 * the planet round the floor reads as a ghostly cut-out. Where the land meets the cut, both crumble
 * over `edge` metres (a ragged stipple, not a ruled line), and the cut rock darkens toward `earth` (the
 * backdrop) the deeper and further it goes (up to `tint`, fully by `tintDepth` metres down or the far
 * end of the fade), so it recedes as the floors below do. `amount` eases from 0 to 1 as the slice
 * opens: what goes dissolves away, what comes dissolves in.
 */
export interface Slice {
  on: { value: number };
  amount: { value: number };
  dir: { value: THREE.Vector2 };
  offset: { value: number };
  radius: { value: number };
  fadeFrom: { value: number };
  fadeTo: { value: number };
  edge: { value: number };
  earth: { value: THREE.Color };
  tint: { value: number };
  tintDepth: { value: number };
}

export interface SliceLook {
  fadeFrom: number;
  fadeTo: number;
  edge: number;
  earth: number;
  tint: number;
  tintDepth: number;
}

export function makeSlice(look: SliceLook): Slice {
  return {
    on: { value: 0 },
    amount: { value: 1 },
    dir: { value: new THREE.Vector2(1, 0) },
    offset: { value: 0 },
    radius: { value: 0 },
    fadeFrom: { value: look.fadeFrom },
    fadeTo: { value: look.fadeTo },
    edge: { value: look.edge },
    earth: { value: new THREE.Color(look.earth) },
    tint: { value: look.tint },
    tintDepth: { value: look.tintDepth },
  };
}

/**
 * What a slice does to a material: the land (all of the above), a wall round the rings (its near half
 * goes; it darkens with depth), the cut face (it fades, crumbles at the top and darkens), or the ground
 * at the cut floor past the rings (it only fades, so far off it's the backdrop, as the land above is).
 */
export type SliceRole = "land" | "wall" | "face" | "ground";

const SLICE_UNIFORMS = ["On", "Amount", "Offset", "Radius", "FadeFrom", "FadeTo", "Edge", "Tint", "TintDepth"].map((u) => `uniform float slice${u};`).join("\n") + "\nuniform vec2 sliceDir;\nuniform vec3 sliceEarth;";

const SLICE_GLSL = /* glsl */ `
  // A stipple threshold per pixel (interleaved gradient noise): fine, even, and steady as the camera moves.
  float sliceStipple() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }
  float sliceFade(vec3 p) { return smoothstep(sliceRadius + sliceFadeFrom, sliceRadius + sliceFadeTo, length(p.xz)); }
  // Smooth noise over metres, for the crumbling edge.
  float sliceHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sliceNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sliceHash(i), sliceHash(i + vec2(1.0, 0.0)), f.x), mix(sliceHash(i + vec2(0.0, 1.0)), sliceHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // How much crumbles away at d metres from the cut (1 at it, 0 past the edge), ragged by the noise at q.
  float sliceCrumble(float d, vec2 q) {
    float rough = sliceNoise(q * 0.35) * 0.65 + sliceNoise(q * 1.3) * 0.35;
    return 1.0 - smoothstep(0.0, sliceEdge, d - (rough - 0.5) * sliceEdge);
  }
  // How far toward the backdrop the cut rock darkens: with depth, and with distance along the fade.
  float sliceDarken(vec3 p) { return sliceTint * max(smoothstep(0.0, sliceTintDepth, -p.y), sliceFade(p)); }
`;

/** When a fragment goes, by role (n is its stipple threshold). */
const SLICE_CUT: Record<SliceRole, string> = {
  // The near half and the land over the rings dissolve away; the rest thins out with distance and crumbles by the cut.
  land: `(dot(vSlicePos.xz, sliceDir) > sliceOffset || length(vSlicePos.xz) < sliceRadius) ? n < sliceAmount
    : n < max(sliceFade(vSlicePos), sliceCrumble(sliceOffset - dot(vSlicePos.xz, sliceDir), vSlicePos.xz)) * sliceAmount`,
  // The near half dissolves away.
  wall: "dot(vSlicePos.xz, sliceDir) > sliceOffset && n < sliceAmount",
  // Dissolves in, thinning out with distance and crumbling along its top.
  face: "n > sliceAmount || n < max(sliceFade(vSlicePos), sliceCrumble(-vSlicePos.y, vec2(vSlicePos.x + vSlicePos.z, vSlicePos.y)))",
  // Thins out with distance.
  ground: "n < sliceFade(vSlicePos) * sliceAmount",
};

/** Let a slice cut this material, in this role. */
export function withSlice<T extends THREE.Material>(m: T, slice: Slice, role: SliceRole): T {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    Object.assign(shader.uniforms, {
      sliceOn: slice.on,
      sliceAmount: slice.amount,
      sliceDir: slice.dir,
      sliceOffset: slice.offset,
      sliceRadius: slice.radius,
      sliceFadeFrom: slice.fadeFrom,
      sliceFadeTo: slice.fadeTo,
      sliceEdge: slice.edge,
      sliceEarth: slice.earth,
      sliceTint: slice.tint,
      sliceTintDepth: slice.tintDepth,
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSlicePos;")
      .replace("#include <project_vertex>", "vSlicePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSlicePos;\n${SLICE_UNIFORMS}\n${SLICE_GLSL}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\nif (sliceOn > 0.5) { float n = sliceStipple(); if (${SLICE_CUT[role]}) discard; }`);
    // The cut rock recedes into the dark, once lit.
    if (role === "wall" || role === "face")
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        "#include <fog_fragment>\nif (sliceOn > 0.5) gl_FragColor.rgb = mix(gl_FragColor.rgb, sliceEarth, sliceDarken(vSlicePos));",
      );
  };
  m.customProgramCacheKey = () => `${prevKey}|slice-${role}`;
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
  metal: { glsl: METAL_GLSL, call: "metalTone", color: 0x8d9299, roughness: 0.32, metalness: 0.6 },
} as const;

/** A room's walls and floor as the material it's built from (room colours off). */
export function finishMaterial(finish: keyof typeof FINISH_LOOK): THREE.MeshStandardMaterial {
  const f = FINISH_LOOK[finish];
  const m = new THREE.MeshStandardMaterial({ color: f.color, roughness: f.roughness, metalness: f.metalness, side: THREE.DoubleSide });
  return withPattern(m, finish, f.glsl, f.call);
}

// ---- floors with room colours on ----

/** How much a room's category colour tints its floor with room colours on. */
const FLOOR_TINT = 0.25;

/**
 * A room's floor with room colours on: laid in the same material as with them off (the finish's own
 * pattern, colour and sheen), only tinted a little by the room's colour; the walls keep the room's colour.
 */
export function withFloor<T extends THREE.Material>(m: T, finish: keyof typeof FINISH_LOOK): T {
  const look = FINISH_LOOK[finish];
  const own = new THREE.Color(look.color);
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFloorPos;\nvarying vec3 vFloorNormal;")
      .replace("#include <project_vertex>", "vFloorPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFloorNormal = normalize(mat3(modelMatrix) * objectNormal);\n#include <project_vertex>");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vFloorPos;\nvarying vec3 vFloorNormal;\n${NOISE_GLSL}\n${WALL_UV_GLSL}\n${look.glsl}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (abs(vFloorNormal.y) > 0.7) diffuseColor.rgb = mix(vec3(${own.r.toFixed(4)}, ${own.g.toFixed(4)}, ${own.b.toFixed(4)}), diffuseColor.rgb, ${FLOOR_TINT.toFixed(2)}) * ${look.call}(vFloorPos, normalize(vFloorNormal));`,
      )
      // The floor's own sheen (the walls keep the room's).
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\nif (abs(vFloorNormal.y) > 0.7) roughnessFactor = ${look.roughness.toFixed(2)};`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\nif (abs(vFloorNormal.y) > 0.7) metalnessFactor = ${look.metalness.toFixed(2)};`);
  };
  m.customProgramCacheKey = () => `${prevKey}|floor-${finish}`;
  return m;
}

// ---- furniture: what each part is made of ----

/** What a furniture part is made of, written to each vertex as `aMat`, for its fine pattern. */
export const PART_MAT = { none: 0, fibre: 1, fabric: 2, metal: 3, painted: 4, soil: 5 } as const;

const PART_GLSL = /* glsl */ `
  float partTone(vec3 p, float mat) {
    if (mat < 0.5) return 1.0;
    if (mat < 1.5) {
      // Fibre composite (no wood on Mars): a fine twill of fibres under matte resin, faintly mottled.
      float twill = 0.5 + 0.5 * sin((p.x + p.y + p.z) * 220.0) * sin((p.x - p.z) * 220.0 + p.y * 110.0);
      return mix(0.95, 1.03, twill) * mix(0.93, 1.04, srfFbm(p * 5.0));
    }
    if (mat < 2.5) {
      // Fabric: a soft weave and a little pilling.
      float weave = 0.5 + 0.5 * sin(p.x * 180.0) * sin(p.z * 180.0 + p.y * 180.0);
      return mix(0.93, 1.03, weave * 0.5 + srfNoise(p * 30.0) * 0.5);
    }
    if (mat < 3.5) {
      // Metal: brushed, with worn scuffs.
      float brushed = mix(0.95, 1.04, srfNoise(vec3(p.x * 60.0, p.y * 2.0, p.z * 60.0)));
      return brushed * (1.0 - 0.1 * smoothstep(0.7, 0.85, srfFbm(p * 6.0)));
    }
    if (mat < 4.5) {
      // Painted panel: worn at random, showing darker underneath, with fine scratches.
      float wear = smoothstep(0.72, 0.8, srfFbm(p * 4.0 + 7.0));
      float scratch = smoothstep(0.93, 0.97, srfNoise(vec3(p.x * 80.0, p.y * 3.0, p.z * 80.0)));
      return (1.0 - 0.22 * wear) * (1.0 - 0.1 * scratch);
    }
    // Soil: clumps and dark crumbs.
    float clumps = mix(0.8, 1.12, srfFbm(p * 14.0));
    return clumps * (1.0 - 0.25 * smoothstep(0.75, 0.85, srfNoise(p * 40.0)));
  }
`;

/** Furniture parts get the fine pattern of what they're made of (from `aMat`). */
export function withPartPatterns<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aMat;\nvarying float vPartMat;\nvarying vec3 vPartPos;")
      .replace("#include <project_vertex>", "vPartMat = aMat;\nvPartPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying float vPartMat;\nvarying vec3 vPartPos;\n${NOISE_GLSL}\n${PART_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= partTone(vPartPos, vPartMat);");
  };
  m.customProgramCacheKey = () => `${prevKey}|part-patterns`;
  return m;
}

/** Glass catches the light at a glancing angle: more of it shows, as a reflection would. */
export function withFresnel<T extends THREE.Material>(m: T, strength = 0.55): T {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>\ndiffuseColor.a = min(1.0, diffuseColor.a + pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * ${strength.toFixed(2)});`,
    );
  };
  m.customProgramCacheKey = () => `${prevKey}|fresnel`;
  return m;
}

// ---- wear and grime ----

/** How grubby a room gets at each level (1 to 3): walls streak and stain toward the floor, floors scuff. */
const GRIME_GLSL = /* glsl */ `
  float grimeTone(vec3 p, vec3 n, float level) {
    if (level < 0.5) return 1.0;
    float amount = level / 3.0;
    float above = mod(p.y + ${CRUST.toFixed(2)}, ${FLOOR_H.toFixed(2)});
    if (abs(n.y) > 0.7) {
      // Floors: scuffed where people walk, with the odd stain.
      float scuff = smoothstep(0.55, 0.8, srfFbm(p * 1.3)) * 0.5 + smoothstep(0.75, 0.85, srfNoise(p * 3.1)) * 0.4;
      return 1.0 - 0.28 * amount * scuff;
    }
    // Walls: grime rising from the floor, streaks running down, and stains.
    float rise = (1.0 - smoothstep(0.0, 1.4, above)) * mix(0.6, 1.2, srfFbm(p * 0.9));
    float streak = smoothstep(0.62, 0.8, srfNoise(vec3(p.x * 3.0, p.y * 0.25, p.z * 3.0))) * (1.0 - smoothstep(2.0, 3.8, above));
    float stain = smoothstep(0.7, 0.82, srfFbm(p * 0.6 + 4.0));
    return 1.0 - amount * (0.3 * rise + 0.2 * streak + 0.18 * stain);
  }
`;

/** A room's walls and floor worn to a level (0 to 3): see view/grime.ts. */
export function withGrime<T extends THREE.Material>(m: T, level: number): T {
  if (level <= 0) return m;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    const hasNoise = shader.fragmentShader.includes("srfNoise");
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrimePos;\nvarying vec3 vGrimeNormal;")
      .replace("#include <project_vertex>", "vGrimePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGrimeNormal = normalize(mat3(modelMatrix) * objectNormal);\n#include <project_vertex>");
    // After everything else declared (other patterns insert their noise right after <common> too, and
    // whatever is inserted last lands first), so the noise it calls is already defined.
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", `varying vec3 vGrimePos;\nvarying vec3 vGrimeNormal;\n${hasNoise ? "" : NOISE_GLSL}\n${GRIME_GLSL}\nvoid main() {`)
      .replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.rgb *= grimeTone(vGrimePos, normalize(vGrimeNormal), ${level.toFixed(1)});`);
  };
  m.customProgramCacheKey = () => `${prevKey}|grime-${level}`;
  return m;
}

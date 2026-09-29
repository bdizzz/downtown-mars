import * as THREE from "three";
import { config } from "../sim/config";

// Small moving details, each a touch added to a material's shader: screens
// that flicker, indicator lights that blink, fires that dance, plants that
// sway, water that shimmers, and windows fogged at the bottom with droplets.
// They share one clock, which runs while the game does (see `advanceDetails`).
// Each wrapper keeps whatever the material's shader already does.

const FLOOR_H = config.geometry.floorHeightM;
const CRUST = config.geometry.surfaceDepthM;

/** The clock every detail runs on, in seconds. */
const clock = { uFxTime: { value: 0 } };

export function advanceDetails(dt: number): void {
  clock.uFxTime.value += dt;
}

/** How glowing parts behave, written to each vertex as `aGlow`. */
export const GLOW_MODE = { steady: 0, screen: 1, blink: 2, fire: 3 } as const;

const DETAILS = {
  /** Plants: how far they lean per metre of height (at the top of a gust), and how fast. */
  sway: { lean: 0.02, speed: 1.3 },
  /** Windows: fog up to this share of the way up the window band, how thick, and droplets. */
  fog: { rise: 0.45, thickness: 0.45, drops: 26, dropSize: 0.28 },
  /** The window band, metres above the floor (as rooms3d's WINDOW). */
  band: [1.4, 3.0] as const,
};

const HASH = /* glsl */ `
  float fxHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float fxHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

/** Chain a shader edit onto a material, after anything it already does. */
function chain<T extends THREE.Material>(m: T, name: string, edit: (shader: THREE.WebGLProgramParametersWithUniforms) => void): T {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    Object.assign(shader.uniforms, clock);
    // Every detail wants the world position in the fragment shader.
    if (!shader.vertexShader.includes("vFxWorld")) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vFxWorld;\nuniform float uFxTime;\n${HASH}`)
        .replace("#include <project_vertex>", "vFxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vFxWorld;\nuniform float uFxTime;\n${HASH}`);
    }
    edit(shader);
  };
  m.customProgramCacheKey = () => `${prevKey}|${name}`;
  return m;
}

/** Glowing parts come alive: screens flicker a little, small lights blink, fires dance; lamps hold steady. */
export function withGlowFx<T extends THREE.Material>(m: T): T {
  return chain(m, "glow-fx", (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        {
          float h = fxHash(floor(vFxWorld * 3.0));
          float k = 1.0;
          if (vGlow > 0.5 && vGlow < 1.5) k = 0.92 + 0.06 * sin(uFxTime * (2.0 + h * 3.0) + h * 20.0) + 0.03 * sin(uFxTime * 23.0 + h * 50.0);
          else if (vGlow > 1.5 && vGlow < 2.5) k = step(0.3, fract(uFxTime * (0.35 + h * 0.9) + h * 7.0));
          else if (vGlow > 2.5) k = 0.78 + 0.22 * sin(uFxTime * 8.0 + h * 30.0) * sin(uFxTime * 5.3 + h * 11.0);
          totalEmissiveRadiance *= k;
        }`,
      );
  });
}

/** Plants sway: more the higher up they are above their floor, in slow gusts. */
export function withSway<T extends THREE.Material>(m: T): T {
  return chain(m, "sway", (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `#include <begin_vertex>
      {
        vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float above = mod(wp.y + ${CRUST.toFixed(2)}, ${FLOOR_H.toFixed(2)});
        float gust = 0.6 + 0.4 * sin(uFxTime * 0.37 + wp.x * 0.05);
        float lean = ${DETAILS.sway.lean.toFixed(3)} * above * gust;
        transformed.x += sin(uFxTime * ${DETAILS.sway.speed.toFixed(2)} + wp.x * 0.9 + wp.z * 0.4) * lean;
        transformed.z += sin(uFxTime * ${(DETAILS.sway.speed * 0.83).toFixed(2)} + wp.z * 0.8 - wp.x * 0.3) * lean;
      }`,
    );
  });
}

/** Water: light ripples across it, and its top surface rises and falls a hair. */
export function withShimmer<T extends THREE.Material>(m: T): T {
  return chain(m, "shimmer", (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `#include <begin_vertex>
      if (normal.y > 0.9) {
        vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
        transformed.y += 0.012 * sin(uFxTime * 1.7 + wp.x * 3.0) * sin(uFxTime * 1.3 + wp.z * 2.5);
      }`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      /* glsl */ `#include <color_fragment>
      {
        vec2 p = vFxWorld.xz * 2.5 + vFxWorld.y * 1.5;
        float c = sin(p.x + uFxTime * 0.9) * sin(p.y * 1.3 - uFxTime * 0.7) + sin((p.x + p.y) * 0.7 + uFxTime * 1.1);
        diffuseColor.rgb *= 0.9 + 0.18 * smoothstep(-0.5, 1.5, c);
      }`,
    );
  });
}

/** Windows fog at the bottom, with droplets beading on the glass. */
export function withCondensation<T extends THREE.Material>(m: T): T {
  const [b0, b1] = DETAILS.band;
  const f = DETAILS.fog;
  return chain(m, "condensation", (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      /* glsl */ `#include <color_fragment>
      {
        float above = mod(vFxWorld.y + ${CRUST.toFixed(2)}, ${FLOOR_H.toFixed(2)});
        float up = clamp((above - ${b0.toFixed(2)}) / ${(b1 - b0).toFixed(2)}, 0.0, 1.0);
        // Fog thick at the sill, thinning upward, a little uneven.
        float along = atan(vFxWorld.z, vFxWorld.x) * length(vFxWorld.xz);
        float fog = smoothstep(${f.rise.toFixed(2)}, 0.0, up + 0.08 * sin(along * 1.7) * sin(along * 0.6 + 1.0));
        // Droplets: a scattering of beads, more low down.
        vec2 cell = vec2(along, above) * ${f.drops.toFixed(1)};
        vec2 id = floor(cell);
        float h = fxHash2(id);
        vec2 at = vec2(fxHash2(id + 3.1), fxHash2(id + 7.7)) * 0.6 + 0.2;
        float drop = step(0.55 + up * 0.35, h) * smoothstep(${f.dropSize.toFixed(2)}, ${(f.dropSize * 0.5).toFixed(2)}, length(fract(cell) - at));
        float mist = fog * ${f.thickness.toFixed(2)} + drop * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.94), mist);
        diffuseColor.a = min(1.0, diffuseColor.a + mist * 0.6);
      }`,
    );
  });
}

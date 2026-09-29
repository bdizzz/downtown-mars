import * as THREE from "three";
import type { Fitted } from "../view/furnish";
import { itemDef } from "../view/furniture";
import { floorSpan } from "./cylinder";

// Light from lamps, fires and grow lights. Every one pools its light on the
// floor below it: a soft coloured disc, drawn additively, merged per room
// with the room's furniture, so it costs next to nothing. The few nearest the
// camera also light the room properly, with a small pool of point lights that
// follows the camera round (how many is a graphics setting).

export interface Lamp {
  x: number;
  y: number;
  z: number;
  floor: number;
  /** Where its pool lies: under it, or (a wall lamp) a little out from its wall. */
  px: number;
  pz: number;
  color: string;
  reach: number;
  strength: number;
}

const POOL = {
  /** A pool's radius as a share of the light's reach, its brightness, and how far below the light it may be before it fades out entirely. */
  size: 0.9,
  brightness: 0.22,
  fadeBy: 3.2,
  /** Sat just above the floor, under rugs' tops. */
  lift: 0.03,
  /** A wall light's pool lies this share of its reach out from the wall. */
  out: 0.35,
};

/** The point lights: the most at full setting, their brightness per unit strength, and how far past its reach one lights. */
export const LAMP_LIGHTS = { most: 12, intensity: 3.5, range: 1.6, decay: 1.8, within: 45 };

/** The lights among some fitted furniture, in world space. */
export function lampsOf(fitted: Fitted[]): Lamp[] {
  const out: Lamp[] = [];
  for (const f of fitted) {
    const light = itemDef(f.item).light;
    if (!light) continue;
    const [lx, ly, lz] = light.at;
    const c = Math.cos(f.turn);
    const s = Math.sin(f.turn);
    const [x, z] = [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
    const out_ = itemDef(f.item).mount !== undefined ? light.reach * POOL.out : 0;
    out.push({ x, y: f.y + ly, z, floor: f.floor, px: x + s * out_, pz: z + c * out_, color: light.color, reach: light.reach, strength: light.strength });
  }
  return out;
}

let poolTexture: THREE.Texture | null = null;
/** A soft round falloff, brightest in the middle. */
function poolDot(): THREE.Texture {
  if (poolTexture) return poolTexture;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5) / (n / 2);
      const v = Math.max(0, 1 - r) ** 2;
      data.set([255, 255, 255, Math.round(v * 255)], (j * n + i) * 4);
    }
  }
  poolTexture = new THREE.DataTexture(data, n, n);
  poolTexture.needsUpdate = true;
  return poolTexture;
}

let poolMaterial: THREE.MeshBasicMaterial | null = null;
function material(): THREE.MeshBasicMaterial {
  poolMaterial ??= new THREE.MeshBasicMaterial({
    map: poolDot(),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  return poolMaterial;
}

/** One mesh of light pools on the floor, one per lamp, or null when there are none. */
export function lightPools(lamps: Lamp[]): THREE.Mesh | null {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const l of lamps) {
    const floorY = floorSpan(l.floor)[0] + POOL.lift;
    const above = l.y - floorY;
    // A lamp high up spreads its light thinner.
    const k = l.strength * POOL.brightness * Math.max(0, 1 - above / (l.reach * POOL.fadeBy));
    if (k <= 0) continue;
    const r = l.reach * POOL.size;
    c.set(l.color).multiplyScalar(k);
    const corners: [number, number, number, number][] = [
      [-r, -r, 0, 0],
      [r, -r, 1, 0],
      [r, r, 1, 1],
      [-r, r, 0, 1],
    ];
    for (const i of [0, 2, 1, 0, 3, 2]) {
      const [dx, dz, u, v] = corners[i]!;
      pos.push(l.px + dx, floorY, l.pz + dz);
      uv.push(u, v);
      col.push(c.r, c.g, c.b);
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, material());
  mesh.userData.pool = true;
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * A handful of point lights that follow the camera: each redraw, they go to
 * the lamps nearest it (on floors that are shown), brightest first.
 */
export class LampLights {
  readonly group = new THREE.Group();
  private lights: THREE.PointLight[] = [];

  /** How many point lights there are. Changing it recompiles shaders, so only settings change it. */
  setCount(n: number): void {
    if (n === this.lights.length) return;
    for (const l of this.lights) this.group.remove(l);
    this.lights = Array.from({ length: n }, () => {
      const l = new THREE.PointLight(0xffffff, 0, 1, LAMP_LIGHTS.decay);
      this.group.add(l);
      return l;
    });
  }

  get count(): number {
    return this.lights.length;
  }

  /**
   * Put the lights on the lamps nearest `at`, only on `floor` when there is one
   * (the floor you're walking, or the one picked). Lights don't cast shadows, so
   * a lamp on another floor would shine through the floor between.
   */
  place(lamps: Lamp[], at: THREE.Vector3, floor: number | null): Lamp[] {
    if (!this.lights.length) return [];
    const near = lamps
      .filter((l) => floor === null || l.floor === floor)
      .map((l) => ({ l, d: Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z) }))
      .filter((e) => e.d < LAMP_LIGHTS.within)
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lights.length);
    this.lights.forEach((light, i) => {
      const e = near[i];
      if (!e) {
        light.intensity = 0;
        return;
      }
      light.position.set(e.l.x, e.l.y, e.l.z);
      light.color.set(e.l.color);
      light.distance = e.l.reach * LAMP_LIGHTS.range;
      // Fade in and out at the edge of the range, so lights don't pop as they move between lamps.
      const edge = Math.min(1, (LAMP_LIGHTS.within - e.d) / 8);
      light.intensity = e.l.strength * LAMP_LIGHTS.intensity * edge;
    });
    return near.map((e) => e.l);
  }
}

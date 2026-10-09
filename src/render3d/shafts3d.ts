import * as THREE from "three";
import { galleryEdges } from "../sim/edges";
import type { Layout } from "../sim/placement";
import { glazedWalls } from "../sim/windows";
import { floorSpan, LEDGE_THICKNESS, openShaftRadius } from "./cylinder";

const TAU = Math.PI * 2;

// Light shafts: sunlight falling down the open shaft around midday, caught
// in the dust. A soft column of light, brightest where you look through the
// most of it, fading with depth, with faint streaks drifting down it. It
// leans a little toward the sun, and a dust storm smothers it.

const SHAFT = {
  /** The column's radius as a share of the open shaft's, and how far it leans toward the sun at most (radians). */
  radius: 0.62,
  lean: 0.22,
  /** How bright at full, its colour, and how quickly it fades going down (per metre). */
  strength: 0.18,
  color: 0xffd9a8,
  fade: 0.045,
  /** It fades in over this many metres below the rim, so its open top never shows as a ring over the hole (T-102). */
  top: 8,
  /** With a floor picked, it comes in from that floor's ceiling instead, fading in over this many metres. */
  topCut: 1.5,
  /** The sun must be at least this high (sin of its elevation) for any to reach down; full from `full`. */
  from: 0.35,
  full: 0.85,
};

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDown;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vDown = -position.y;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  uniform float fade;
  uniform float time;
  uniform float columnLength;
  uniform float top;
  uniform float topFrom;
  uniform float clipY;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDown;
  void main() {
    // With a floor picked, the rock above is lifted away: the light comes in from its ceiling.
    if (vWorld.y > clipY) discard;
    vec3 toCam = normalize(cameraPosition - vWorld);
    // Through the middle of the column there's the most light to see; its edges fade out.
    float through = pow(abs(dot(normalize(vNormal), toCam)), 1.6);
    // Fading in below the rim (leaning lifts one side of its top above the ground), fading down
    // the hole, and gone before the column's end, so it has no hard rim at either end.
    float depth = smoothstep(topFrom, topFrom + top, vDown) * exp(-vDown * fade) * (1.0 - smoothstep(columnLength * 0.55, columnLength, vDown));
    // Faint streaks drifting down.
    float a = atan(vWorld.z, vWorld.x);
    float streaks = 0.75 + 0.25 * sin(a * 23.0 + vDown * 0.35 - time * 0.6) * sin(a * 7.0 - time * 0.23);
    float k = strength * through * depth * streaks;
    // Additive blending scales by alpha: the colour goes in whole.
    gl_FragColor = vec4(color, k);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class LightShaft {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private depth = 1;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(SHAFT.color) },
        strength: { value: 0 },
        fade: { value: SHAFT.fade },
        time: { value: 0 },
        columnLength: { value: 1 },
        top: { value: SHAFT.top },
        topFrom: { value: 0 },
        clipY: { value: 1e9 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), this.material);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  /** Fit the column to the shaft: its open radius, and how deep the hole goes (metres below the surface). */
  fit(openRadius: number, depth: number): void {
    if (depth === this.depth && this.mesh.scale.x === openRadius * SHAFT.radius) return;
    this.depth = depth;
    // A unit cylinder, stretched: its top at the surface, running down the hole.
    this.mesh.geometry.dispose();
    const g = new THREE.CylinderGeometry(openRadius * SHAFT.radius, openRadius * SHAFT.radius, depth, 48, 1, true);
    g.translate(0, -depth / 2, 0);
    this.mesh.geometry = g;
    this.material.uniforms.columnLength!.value = depth;
  }

  /**
   * The sun's direction (unit, y up), how dusty the air is (0 clear to 1 a
   * full storm), and whether it can be seen at all.
   */
  update(sun: THREE.Vector3, storm: number, shown: boolean): void {
    const high = THREE.MathUtils.smoothstep(sun.y, SHAFT.from, SHAFT.full);
    const k = SHAFT.strength * high * (1 - storm);
    this.material.uniforms.strength!.value = k;
    this.mesh.visible = shown && k > 0.001;
    // Lean away from the sun, as the light does, a little.
    const lean = Math.min(SHAFT.lean, Math.acos(Math.min(1, sun.y)));
    const away = Math.atan2(-sun.z, -sun.x);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotateOnWorldAxis(new THREE.Vector3(-Math.sin(away), 0, Math.cos(away)), -lean);
  }

  /** Cut the column off above a height (a picked floor's ceiling, below the surface), or not at all. */
  clip(y: number | null): void {
    const u = this.material.uniforms;
    u.clipY!.value = y ?? 1e9;
    u.topFrom!.value = y === null ? 0 : -y;
    u.top!.value = y === null ? SHAFT.top : SHAFT.topCut;
  }

  /** Let the streaks drift. */
  step(dt: number): void {
    this.material.uniforms.time!.value += dt;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// Sun pools: where the light down the shaft lands. A soft warm glow on the
// gallery tubes' floors, at the bottom of the hole, and inside rooms with
// windows onto the shaft, fading in from the glass. Dimmer each floor down, as
// the column is; brightest at noon, gone at night and in a storm. One mesh,
// drawn additively, so it costs next to nothing.

const SUN_POOL = {
  /** How bright at full: in a room by its windows, along a gallery tube, and where the column lands at the bottom. */
  room: 0.55,
  gallery: 0.35,
  bottom: 0.6,
  /** How far into a room the light reaches from its windows (metres), and in how many steps its fade is drawn. */
  reach: 5,
  steps: 4,
  /** Steps along an arc per metre of the shaft wall, and how far above the floor (under rugs' tops). */
  perM: 1,
  lift: 0.04,
};

export class SunPools {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: SHAFT.color,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  /** Lay the pools out for a layout, from `topFloor` down (every floor when none is picked). */
  build(layout: Layout, topFloor: number | null): void {
    const hole = layout.hole;
    const R = hole.shaftRadiusM;
    const rOpen = openShaftRadius(hole);
    const pos: number[] = [];
    const col: number[] = [];
    // White, its alpha the pool's strength there: the material's colour and opacity do the rest.
    const vertex = (r: number, a: number, y: number, k: number) => {
      pos.push(r * Math.cos(a), y, r * Math.sin(a));
      col.push(1, 1, 1, k);
    };
    /** A band from radius r0 (strength k0) to r1 (k1) along an arc. */
    const band = (r0: number, r1: number, a0: number, a1: number, y: number, k0: number, k1: number) => {
      const n = Math.max(2, Math.ceil((a1 - a0) * R * SUN_POOL.perM));
      for (let i = 0; i < n; i++) {
        const b0 = a0 + ((a1 - a0) * i) / n;
        const b1 = a0 + ((a1 - a0) * (i + 1)) / n;
        vertex(r0, b0, y, k0);
        vertex(r1, b0, y, k1);
        vertex(r1, b1, y, k1);
        vertex(r0, b0, y, k0);
        vertex(r1, b1, y, k1);
        vertex(r0, b1, y, k0);
      }
    };
    // Fainter each floor down, as the column fades with depth below the surface.
    const at = (floor: number) => Math.exp(floorSpan(floor)[0] * SHAFT.fade);
    const first = topFloor ?? 1;
    // The gallery tubes' floors (under the dome, the open ledge all round).
    for (let floor = first; floor <= hole.floors; floor++) {
      const y = floorSpan(floor)[0] + LEDGE_THICKNESS + SUN_POOL.lift;
      const k = at(floor) * SUN_POOL.gallery;
      for (const e of galleryEdges(hole, floor)) {
        if (!layout.domed && (!layout.corridors?.[e.id] || layout.corridorsBuilding?.[e.id] !== undefined)) continue;
        band(rOpen, R, e.a0 * TAU, e.a1 * TAU, y, k, k);
      }
    }
    // Rooms with windows onto the shaft: light falling in through the glass, fading across the floor.
    for (const room of layout.rooms) {
      for (const { edge, across } of glazedWalls(layout, room)) {
        if (across !== "shaft" || edge.kind !== "arc" || edge.floor < first || edge.floor > hole.floors) continue;
        const y = floorSpan(edge.floor)[0] + SUN_POOL.lift;
        const k = at(edge.floor) * SUN_POOL.room;
        for (let s = 0; s < SUN_POOL.steps; s++) {
          const t0 = s / SUN_POOL.steps;
          const t1 = (s + 1) / SUN_POOL.steps;
          band(R + t0 * SUN_POOL.reach, R + t1 * SUN_POOL.reach, edge.a0 * TAU, edge.a1 * TAU, y, k * (1 - t0) ** 2, k * (1 - t1) ** 2);
        }
      }
    }
    // Where the column lands: the bottom of the hole.
    const yb = floorSpan(hole.floors + 1)[0] + SUN_POOL.lift;
    const kb = at(hole.floors + 1) * SUN_POOL.bottom;
    const rb = rOpen * SHAFT.radius * 1.3;
    const n = 48;
    for (let i = 0; i < n; i++) {
      vertex(0, 0, yb, kb);
      vertex(rb, ((i + 1) / n) * TAU, yb, 0);
      vertex(rb, (i / n) * TAU, yb, 0);
    }
    this.mesh.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
    this.mesh.geometry = g;
  }

  /** As the column: the sun's direction (unit, y up), how dusty the air is (0 to 1), and whether it's shown. */
  update(sun: THREE.Vector3, storm: number, shown: boolean): void {
    const k = THREE.MathUtils.smoothstep(sun.y, SHAFT.from, SHAFT.full) * (1 - storm);
    this.material.opacity = k;
    this.mesh.visible = shown && k > 0.001;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

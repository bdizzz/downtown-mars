import * as THREE from "three";
import type { RoomStatus } from "../sim/economy";
import type { Layout } from "../sim/placement";
import { furnish, type Fitted } from "../view/furnish";
import { furniture } from "../view/furniture";

// Small effects on working rooms: sparks spitting from a smelter's furnace
// mouth, steam rising off life support's scrubber vents. They come from the
// furniture itself (where the template put each furnace or scrubber), and
// only while the room is running, and only while that furniture is shown
// (not above a chosen floor). Each kind is one set of points, animated
// on the CPU from a fixed pool, so a busy hole costs two draw calls.

type Kind = "sparks" | "steam";

/** Where on an item (in its own frame: x across, y up, z out its front) each effect comes from. */
const EMITTERS: Record<string, { kind: Kind; at: [number, number, number] }[]> = {
  furnace: [{ kind: "sparks", at: [0, 0.95, 1.3] }],
  scrubber_unit: [{ kind: "steam", at: [0.8, 3.45, -0.3] }],
};

/** How each kind looks and moves: pool size, particles per second per emitter, life (s), size (m), speeds (m/s), colour. */
const LOOK: Record<Kind, { pool: number; rate: number; life: [number, number]; size: [number, number]; alpha: number; color: number; additive: boolean }> = {
  sparks: { pool: 500, rate: 32, life: [0.5, 1.2], size: [0.16, 0.07], alpha: 1, color: 0xffa040, additive: true },
  steam: { pool: 300, rate: 3, life: [2.2, 3.6], size: [0.35, 1.5], alpha: 0.28, color: 0xf2ece4, additive: false },
};
const MOTION = { sparkOut: 2.2, sparkUp: 2.2, sparkSpread: 1.2, gravity: 5, steamRise: 0.55, steamDrift: 0.12 };

export interface Emitter {
  kind: Kind;
  x: number;
  y: number;
  z: number;
  /** The way the item faces (sparks fly out of the furnace's front). */
  fx: number;
  fz: number;
  /** 0..1 of full output: a slowed room makes fewer. */
  rate: number;
  floor: number;
  owed: number;
}

/** What the view hides: every floor above a chosen one. */
export interface FxView {
  topFloor: number | null;
}

const hiddenIn = (e: Emitter, v: FxView) => v.topFloor !== null && e.floor < v.topFloor;
/** Emitters are remade whenever a room's output changes: the same spot is the same emitter. */
const spotKey = (e: Emitter) => `${e.kind}:${e.x.toFixed(3)}:${e.y.toFixed(3)}:${e.z.toFixed(3)}`;

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  }
`;
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One kind's particles: a pool of points, each with a position, velocity, age and life. */
class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  /** The emitter each particle came from, so they go when it's hidden or gone. */
  private owner: (Emitter | null)[];
  private next = 0;
  private material: THREE.ShaderMaterial;

  constructor(private kind: Kind) {
    const n = LOOK[kind].pool;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1);
    this.owner = new Array<Emitter | null>(n).fill(null);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    const look = LOOK[kind];
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(look.color) }, uScale: { value: 500 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: look.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  setScale(s: number): void {
    this.material.uniforms.uScale!.value = s;
  }

  spawn(e: Emitter): void {
    const i = this.next;
    this.next = (this.next + 1) % this.age.length;
    const look = LOOK[this.kind];
    const r = () => Math.random() - 0.5;
    this.pos.set([e.x + r() * 0.5, e.y + r() * 0.2, e.z + r() * 0.5], i * 3);
    if (this.kind === "sparks") {
      const out = MOTION.sparkOut * (0.6 + Math.random() * 0.8);
      // Out of the furnace's front, up, and spread sideways.
      const sx = -e.fz;
      const sz = e.fx;
      const side = r() * MOTION.sparkSpread;
      this.vel.set([e.fx * out + sx * side, MOTION.sparkUp * (0.4 + Math.random()), e.fz * out + sz * side], i * 3);
    } else {
      this.vel.set([r() * MOTION.steamDrift, MOTION.steamRise * (0.7 + Math.random() * 0.6), r() * MOTION.steamDrift], i * 3);
    }
    this.owner[i] = e;
    this.age[i] = 0;
    this.life[i] = look.life[0] + Math.random() * (look.life[1] - look.life[0]);
  }

  step(dt: number): void {
    const look = LOOK[this.kind];
    for (let i = 0; i < this.age.length; i++) {
      const t = (this.age[i]! += dt) / this.life[i]!;
      if (t >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      if (this.kind === "sparks") this.vel[i * 3 + 1]! -= MOTION.gravity * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k]! += this.vel[i * 3 + k]! * dt;
      this.size[i] = look.size[0] + (look.size[1] - look.size[0]) * t;
      // Sparks burn out; steam swells in, then thins away.
      this.alpha[i] = look.alpha * (this.kind === "sparks" ? 1 - t * t : Math.min(1, t * 5) * (1 - t));
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.aSize!.needsUpdate = true;
    g.attributes.aAlpha!.needsUpdate = true;
  }

  /** Particles live on only while `keep` gives their emitter (or a stand-in for it); the rest go at once. */
  retain(keep: (e: Emitter) => Emitter | null): void {
    let changed = false;
    for (let i = 0; i < this.age.length; i++) {
      const e = this.owner[i];
      if (!e || this.age[i]! >= this.life[i]!) continue;
      const to = keep(e);
      this.owner[i] = to;
      if (to) continue;
      this.age[i] = this.life[i]!;
      this.alpha[i] = 0;
      changed = true;
    }
    if (changed) this.points.geometry.attributes.aAlpha!.needsUpdate = true;
  }

  /** How many are alive and showing. */
  get live(): number {
    let n = 0;
    for (let i = 0; i < this.age.length; i++) if (this.age[i]! < this.life[i]! && this.alpha[i]! > 0) n++;
    return n;
  }

  clear(): void {
    this.owner.fill(null);
    this.age.fill(1);
    this.alpha.fill(0);
    this.points.geometry.attributes.aAlpha!.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

export class RoomEffects {
  readonly group = new THREE.Group();
  private kinds: Record<Kind, Particles> = { sparks: new Particles("sparks"), steam: new Particles("steam") };
  private emitters: Emitter[] = [];
  private key = "";
  private view: FxView = { topFloor: null };

  constructor() {
    this.group.add(this.kinds.sparks.points, this.kinds.steam.points);
  }

  /** Find the emitters: the furnaces and scrubbers of built rooms, with how hard each room is running (a stopped one makes none). */
  sync(layout: Layout, status: Record<number, RoomStatus>): void {
    const key = emittersKey(layout, status);
    if (key === this.key) return;
    this.key = key;
    this.emitters = emittersOf(layout, status);
    // What's in the air stays with the same spot (a stopped furnace's last sparks fade out); one that's gone takes its sparks with it.
    const now = new Map(this.emitters.map((e) => [spotKey(e), e]));
    this.retain((e) => now.get(spotKey(e)) ?? null);
  }

  /** What the view hides changed: anything from hidden furniture goes at once, even while paused. */
  setView(view: FxView): void {
    this.view = view;
    this.retain((e) => (hiddenIn(e, view) ? null : e));
  }

  private retain(keep: (e: Emitter) => Emitter | null): void {
    this.kinds.sparks.retain(keep);
    this.kinds.steam.retain(keep);
  }

  /** Particles alive and showing, of each kind. */
  get live(): Record<Kind, number> {
    return { sparks: this.kinds.sparks.live, steam: this.kinds.steam.live };
  }

  /** Points' sizes are in metres: how many pixels a metre is at unit distance. */
  setScale(pixelsPerMetre: number): void {
    this.kinds.sparks.setScale(pixelsPerMetre);
    this.kinds.steam.setScale(pixelsPerMetre);
  }

  /** Advance by dt seconds; hidden emitters stay quiet. */
  step(dt: number): void {
    for (const e of this.emitters) {
      if (hiddenIn(e, this.view)) continue;
      e.owed += LOOK[e.kind].rate * e.rate * dt;
      while (e.owed >= 1) {
        this.kinds[e.kind].spawn(e);
        e.owed -= 1;
      }
    }
    this.kinds.sparks.step(dt);
    this.kinds.steam.step(dt);
  }

  get active(): boolean {
    return this.emitters.some((e) => e.rate > 0);
  }

  clear(): void {
    this.kinds.sparks.clear();
    this.kinds.steam.clear();
  }

  dispose(): void {
    this.kinds.sparks.dispose();
    this.kinds.steam.dispose();
  }
}

const withEmitters = (layout: Layout) => layout.rooms.filter((r) => !r.planned && !r.building && (furniture.rooms[r.type] ?? []).some((id) => EMITTERS[id]));

/** What decides the emitters: the layout, and how hard each room with one is running (in quarters). */
export function emittersKey(layout: Layout, status: Record<number, RoomStatus>): string {
  return `${layout.version}:${withEmitters(layout).map((r) => `${r.id}.${Math.round((status[r.id]?.rate ?? 0) * 4)}`).join(",")}`;
}

/** Every emitter in the hole: the furnaces and scrubbers of built rooms, with how hard each room is running (also for the Godot viewer). */
export function emittersOf(layout: Layout, status: Record<number, RoomStatus>): Emitter[] {
  return withEmitters(layout).flatMap((room) => {
    const rate = status[room.id]?.rate ?? 0;
    return furnish(layout, room).flatMap((f) => (EMITTERS[f.item] ?? []).map((e) => emitterAt(f, e.kind, e.at, rate)));
  });
}

/** An emitter at a point in an item's own frame, turned and placed with the item. */
function emitterAt(f: Fitted, kind: Kind, [lx, ly, lz]: [number, number, number], rate: number): Emitter {
  const c = Math.cos(f.turn);
  const s = Math.sin(f.turn);
  return {
    kind,
    x: f.x + lx * c + lz * s,
    y: f.y + ly,
    z: f.z - lx * s + lz * c,
    fx: s,
    fz: c,
    rate,
    floor: f.floor,
    owed: 0,
  };
}

/** A soft round dot, for points that would otherwise draw as squares (dust). */
export function softDot(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

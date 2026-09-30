import * as THREE from "three";
import type { Hole } from "../sim/geometry";
import type { Fitted } from "../view/furnish";
import { itemDef } from "../view/furniture";
import { floorSpan, LEDGE_THICKNESS, openShaftRadius, TAU } from "./cylinder";

// Colonists as little figures: legs, a body in their clothes' colour, and a
// head. Some walk the galleries, bobbing as they go; the rest are where the
// furniture puts them: at work posts in rooms that are staffed, asleep in
// beds at night, sitting about in the evening. Purely cosmetic: who's where
// follows the clock and each room's staff, never the simulation. Every pose
// is one instanced mesh, so a crowd costs a few draw calls.

/** Sizes in metres, times in game hours, speeds in metres per real second. */
const FIGURE = {
  /** Walking the galleries: at most this many, one per so many colonists, how fast, and how they bob. */
  walkers: { max: 60, perColonists: 3, speed: 0.35, bob: 0.045, stride: 7, sway: 0.06 },
  /** The most figures in rooms (the rest of a big colony is out of sight). */
  inRooms: 600,
  skin: [0xf1c9a5, 0xd9a47c, 0xb57a52, 0x8a5634, 0x5e3a22, 0xe8b894],
  clothes: [0xd8c0ae, 0x6f93bd, 0x86ad58, 0xc9a456, 0xd48092, 0x9b8fc4, 0x7fb8b0, 0xc47a5a],
  trousers: 0x3a3a44,
  /** Night is from `sleep` to `wake`; the evening (more sitting about) from `evening`. */
  hours: { wake: 6, evening: 18, sleep: 22 },
  /** Shares of seats taken, by time of day, and of beds by day (night shift). */
  seats: { day: 0.3, evening: 0.55, night: 0.03 },
  bedsByDay: 0.08,
};

export type SpotKind = "seat" | "bed" | "post";
export interface Spot {
  kind: SpotKind;
  x: number;
  y: number;
  z: number;
  /** Which way they face, radians about y (0 faces +z). */
  turn: number;
  floor: number;
}

/** The places for people among some fitted furniture, in world space. */
export function spotsOf(fitted: Fitted[]): Spot[] {
  const out: Spot[] = [];
  for (const f of fitted) {
    for (const s of itemDef(f.item).spots ?? []) {
      const [lx, ly, lz] = s.at;
      const c = Math.cos(f.turn);
      const sn = Math.sin(f.turn);
      out.push({ kind: s.kind, x: f.x + lx * c + lz * sn, y: f.y + ly, z: f.z - lx * sn + lz * c, turn: f.turn + ((s.turn ?? 0) * Math.PI) / 180, floor: f.floor });
    }
  }
  return out;
}

/** A small deterministic hash to 0..1, so the same room looks the same each time. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A room's people spots, and what the stage knows of it. */
export interface RoomSpots {
  roomId: number;
  spots: Spot[];
  /** Its category colour: what its staff wear. */
  accent: string;
  /** A home, a galley, a plaza, an office: somewhere to sit about. */
  social: boolean;
}

/** Who's in: the spots taken, for the hour, each room's staff, and how full the beds are. */
export function occupied(rooms: RoomSpots[], hour: number, staff: (roomId: number) => number, population: number): { spot: Spot; clothes: number; skin: number }[] {
  const night = hour < FIGURE.hours.wake || hour >= FIGURE.hours.sleep;
  const evening = !night && hour >= FIGURE.hours.evening;
  const beds = rooms.reduce((n, r) => n + r.spots.filter((s) => s.kind === "bed").length, 0);
  const bedShare = night ? Math.min(1, population / Math.max(1, beds)) : FIGURE.bedsByDay;
  const seatShare = night ? FIGURE.seats.night : evening ? FIGURE.seats.evening : FIGURE.seats.day;
  const out: { spot: Spot; clothes: number; skin: number }[] = [];
  for (const r of rooms) {
    let posts = staff(r.roomId);
    r.spots.forEach((spot, i) => {
      const h = hash(r.roomId, i);
      let taken = false;
      if (spot.kind === "post") taken = posts-- > 0;
      else if (spot.kind === "bed") taken = h < bedShare;
      else taken = r.social && h < seatShare;
      if (!taken) return;
      const pick = hash(r.roomId + 7, i * 3 + 1);
      const clothes = spot.kind === "post" ? new THREE.Color(r.accent).getHex() : FIGURE.clothes[Math.floor(pick * FIGURE.clothes.length)]!;
      out.push({ spot, clothes, skin: FIGURE.skin[Math.floor(hash(r.roomId, i * 5 + 2) * FIGURE.skin.length)]! });
    });
  }
  return out.slice(0, FIGURE.inRooms);
}

// ---- the figure ----

/** Where the head goes, in each pose's own frame. */
const HEAD = { stand: new THREE.Vector3(0, 1.52, 0), sit: new THREE.Vector3(0, 0.78, -0.04), radius: 0.12 };

/** Boxes merged into one geometry, coloured per vertex (trousers dark, the rest white, to take the instance's colour). */
function figure(boxes: [number, number, number, number, number, number, "t" | "c"][]): THREE.BufferGeometry {
  const parts = boxes.map(([x, y, z, w, h, d, c]) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    const col = new THREE.Color(c === "t" ? FIGURE.trousers : 0xffffff);
    const n = g.getAttribute("position").count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(Array.from({ length: n }, () => [col.r, col.g, col.b]).flat()), 3));
    return g;
  });
  const merged = new THREE.BufferGeometry();
  const total = parts.reduce((n, g) => n + g.getAttribute("position").count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.getAttribute("position").array as Float32Array, o * 3);
    nor.set(g.getAttribute("normal").array as Float32Array, o * 3);
    col.set(g.getAttribute("color").array as Float32Array, o * 3);
    o += g.getAttribute("position").count;
    g.dispose();
  }
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  merged.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return merged;
}

/** Standing, facing +z, feet at y = 0. */
function standing(): THREE.BufferGeometry {
  return figure([
    [-0.08, 0.4, 0, 0.13, 0.8, 0.15, "t"],
    [0.08, 0.4, 0, 0.13, 0.8, 0.15, "t"],
    [0, 1.1, 0, 0.36, 0.62, 0.21, "c"],
    [-0.235, 1.1, 0, 0.09, 0.56, 0.11, "c"],
    [0.235, 1.1, 0, 0.09, 0.56, 0.11, "c"],
    [0, 1.42, 0, 0.1, 0.06, 0.1, "c"],
  ]);
}

/** Sitting on a seat at y = 0, facing +z, feet down on the floor about 0.47 m below. */
function sitting(): THREE.BufferGeometry {
  return figure([
    [-0.08, 0.06, 0.2, 0.13, 0.14, 0.46, "t"],
    [0.08, 0.06, 0.2, 0.13, 0.14, 0.46, "t"],
    [-0.08, -0.21, 0.4, 0.13, 0.48, 0.13, "t"],
    [0.08, -0.21, 0.4, 0.13, 0.48, 0.13, "t"],
    [0, 0.4, -0.04, 0.36, 0.6, 0.21, "c"],
    [-0.235, 0.36, 0.06, 0.09, 0.5, 0.11, "c"],
    [0.235, 0.36, 0.06, 0.09, 0.5, 0.11, "c"],
    [0, 0.72, -0.04, 0.1, 0.06, 0.1, "c"],
  ]);
}

type Pose = "stand" | "sit";

/** Lying: the standing figure turned so its up runs along -x and its front faces up. */
const LYING = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
/** How far along a bed (+x, from its middle) the feet are. */
const BED_FEET = 0.85;

interface Gallery {
  floor: number;
  angle: number;
  /** The tube run they walk (radians): they turn back at its ends, unless it goes all the way round. */
  a0: number;
  a1: number;
  full: boolean;
  /** Radians per second, signed: which way round they're walking. */
  speed: number;
  /** A little in or out on the ledge, so they don't walk single file. */
  offset: number;
  clothes: number;
  skin: number;
  phase: number;
}

export class People {
  readonly group = new THREE.Group();
  private bodies: Record<Pose, THREE.InstancedMesh>;
  private heads: THREE.InstancedMesh;
  private walkers: Gallery[] = [];
  private seated: { spot: Spot; clothes: number; skin: number }[] = [];
  private hole: Hole | null = null;
  private topFloor: number | null = null;
  private time = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor() {
    const cap = FIGURE.walkers.max + FIGURE.inRooms;
    const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    this.bodies = {
      stand: new THREE.InstancedMesh(standing(), body, cap),
      sit: new THREE.InstancedMesh(sitting(), body, cap),
    };
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(HEAD.radius, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), cap * 2);
    for (const mesh of [this.bodies.stand, this.bodies.sit, this.heads]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      // Instance colours are made on first use; start them white.
      mesh.setColorAt(0, this.c.set(0xffffff));
      this.group.add(mesh);
    }
  }

  private runsKey = "";

  /** Match the gallery crowd to the colony: more people, more walkers, spread over the gallery tubes (runs of them, in turns). */
  sync(hole: Hole, population: number, runs: { floor: number; t0: number; t1: number; full: boolean }[]): void {
    // Short runs don't get walkers: there's hardly anywhere to go.
    const usable = runs.filter((r) => (r.t1 - r.t0) * TAU * openShaftRadius(hole) >= 4);
    const want = usable.length ? Math.min(FIGURE.walkers.max, Math.ceil(population / FIGURE.walkers.perColonists)) : 0;
    const key = JSON.stringify(usable);
    if (this.hole === hole && this.walkers.length === want && key === this.runsKey) return;
    this.hole = hole;
    this.runsKey = key;
    let s = (population * 131 + hole.floors) >>> 0 || 1;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
    // Longer runs get more walkers.
    const lengths = usable.map((r) => r.t1 - r.t0);
    const total = lengths.reduce((a, b) => a + b, 0);
    const pickRun = () => {
      let x = rand() * total;
      for (let i = 0; i < usable.length; i++) if ((x -= lengths[i]!) <= 0) return usable[i]!;
      return usable.at(-1)!;
    };
    this.walkers = Array.from({ length: want }, () => {
      const run = pickRun();
      const a0 = run.t0 * TAU;
      const a1 = run.t1 * TAU;
      return {
      floor: run.floor,
      angle: a0 + rand() * (a1 - a0),
      a0,
      a1,
      full: run.full,
      speed: (rand() < 0.5 ? -1 : 1) * FIGURE.walkers.speed * (0.6 + rand() * 0.8),
      offset: rand() * 1.2,
      clothes: FIGURE.clothes[Math.floor(rand() * FIGURE.clothes.length)]!,
      skin: FIGURE.skin[Math.floor(rand() * FIGURE.skin.length)]!,
      phase: rand() * TAU,
      };
    });
    this.place();
  }

  /** Who's in the rooms now. */
  setRooms(people: { spot: Spot; clothes: number; skin: number }[]): void {
    this.seated = people;
    this.place();
  }

  /** Hide everyone above a chosen floor. */
  setTopFloor(floor: number | null): void {
    if (floor === this.topFloor) return;
    this.topFloor = floor;
    this.place();
  }

  /** How many figures are showing, standing and sitting (lying counts as standing, turned over). */
  get shown(): { stand: number; sit: number } {
    return { stand: this.bodies.stand.count, sit: this.bodies.sit.count };
  }

  /** Walk on by dt real seconds. */
  step(dt: number): void {
    this.time += dt;
    for (const w of this.walkers) {
      w.angle += (w.speed * dt) / Math.max(1, this.radiusFor(w));
      if (w.full) continue;
      // Turn back at the end of the tube, a little short of it.
      const margin = 0.6 / Math.max(1, this.radiusFor(w));
      if (w.angle > w.a1 - margin && w.speed > 0) w.speed = -w.speed;
      if (w.angle < w.a0 + margin && w.speed < 0) w.speed = -w.speed;
    }
    this.place();
  }

  private radiusFor(w: Gallery): number {
    // Along the tube's floor, between the glass and the shaft wall.
    return this.hole ? openShaftRadius(this.hole) + 0.4 + w.offset * 0.9 : 1;
  }

  private shows(floor: number): boolean {
    return this.topFloor === null || floor >= this.topFloor;
  }

  private place(): void {
    const n = { stand: 0, sit: 0, head: 0 };
    const put = (pose: Pose, m: THREE.Matrix4, clothes: number, skin: number) => {
      const i = n[pose]++;
      this.bodies[pose].setMatrixAt(i, m);
      this.bodies[pose].setColorAt(i, this.c.set(clothes));
      const head = this.v.copy(pose === "sit" ? HEAD.sit : HEAD.stand).applyMatrix4(m);
      const h = n.head++;
      this.heads.setMatrixAt(h, new THREE.Matrix4().makeTranslation(head.x, head.y, head.z));
      this.heads.setColorAt(h, this.c.set(skin));
    };
    const up = new THREE.Vector3(0, 1, 0);
    if (this.hole) {
      for (const w of this.walkers) {
        if (!this.shows(w.floor)) continue;
        const r = this.radiusFor(w);
        const y = floorSpan(w.floor)[0] + LEDGE_THICKNESS;
        // Facing the way they walk (round the shaft), bobbing with each step and swaying a little.
        const stride = this.time * FIGURE.walkers.stride * Math.abs(w.speed) / FIGURE.walkers.speed + w.phase;
        const bob = Math.abs(Math.sin(stride)) * FIGURE.walkers.bob;
        const facing = Math.atan2(-Math.sin(w.angle) * Math.sign(w.speed), Math.cos(w.angle) * Math.sign(w.speed));
        this.q.setFromEuler(new THREE.Euler(0, facing, Math.sin(stride) * FIGURE.walkers.sway, "YXZ"));
        this.m.compose(this.v.set(r * Math.cos(w.angle), y + bob, r * Math.sin(w.angle)), this.q, new THREE.Vector3(1, 1, 1));
        put("stand", this.m, w.clothes, w.skin);
      }
    }
    for (const p of this.seated) {
      const s = p.spot;
      if (!this.shows(s.floor)) continue;
      if (s.kind === "bed") {
        // Lying on their back along the bed: head toward its head (-x), face up, feet at its foot.
        this.q.setFromAxisAngle(up, s.turn).multiply(LYING);
        const toFeet = new THREE.Vector3(BED_FEET, 0.1, 0).applyAxisAngle(up, s.turn);
        this.m.compose(this.v.set(s.x + toFeet.x, s.y + toFeet.y, s.z + toFeet.z), this.q, new THREE.Vector3(1, 1, 1));
        put("stand", this.m, p.clothes, p.skin);
      } else {
        this.q.setFromAxisAngle(up, s.turn);
        this.m.compose(this.v.set(s.x, s.y, s.z), this.q, new THREE.Vector3(1, 1, 1));
        put(s.kind === "seat" ? "sit" : "stand", this.m, p.clothes, p.skin);
      }
    }
    for (const pose of ["stand", "sit"] as const) {
      const mesh = this.bodies[pose];
      mesh.count = n[pose];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.heads.count = n.head;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
  }
}

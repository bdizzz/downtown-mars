import * as THREE from "three";
import { config } from "../sim/config";
import mapData from "../../data/mars-map.json";
import { traitAt } from "../sim/sites";
import { FAR_SHADOW, withFarShadow, withLandRock } from "./surfaces";
import { piecesReady, placedGeometry, type PieceName } from "./landPieces";

// The land around the hole: the ground rolls away from a flat pad at the rim
// (where surface buildings stand) in undulations and ridges, pocked with
// craters and scattered with boulders; toward the horizon, landforms of their
// own at several distances (mountain massifs, mesas and buttes, plateaus,
// domed hills and the raised rims of big craters) in front of a far ridge of
// mountains, low ground or hills, depending on the site. A site by a named
// feature (#497, its trait's place: sim/sites.ts) shows it: a crater's rim
// wall all round, a canyon's walls, a basin's flat floor, cratered highlands,
// a shield volcano. All of it is real
// geometry, so it turns, shades with the sun and shifts with the camera, and
// the farther it stands the paler and dustier it is. The same site always gets
// the same land.

export type HorizonStyle = "mountains" | "mesas" | "hills" | "crater" | "canyon" | "basin" | "highland" | "volcano";
type LandformKind = "massif" | "mesa" | "butte" | "plateau" | "dome" | "crater" | "mound";

/** Sizes in metres. */
/** The surface rings' outer edge, metres out from the rim (T-108): the ground stays flat, and clear of boulders, out past it. */
const RINGS_OUT = config.geometry.surfaceRingM + (config.geometry.surfaceRings - 0.5) * config.geometry.surfaceRingDepthM;

const LAND = {
  /** Flat around the rim, out past the surface rings, then easing into the terrain over `blend`. */
  pad: Math.max(45, RINGS_OUT + 4),
  blend: 60,
  /** The ground reaches this far out, to meet the horizon. */
  reach: 1700,
  rings: 140,
  segments: 360,
  /** Rolling ground and ridges: heights and sizes. */
  roll: { height: 1.6, size: 70 },
  ridge: { height: 4.5, size: 240 },
  /** The land rises a little toward the horizon. */
  rise: 18,
  craters: { count: 14, min: 5, max: 70, depth: 0.22, rim: 0.08 },
  rocks: { count: 320, min: 0.25, max: 2.2, near: Math.max(50, RINGS_OUT + 6), far: 900 },
  /** The horizon ring: where its ridge line runs, and how finely. */
  horizon: { radius: 1500, segments: 720 },
  /** Landforms in front of it, by kind: how far out, how wide (their footprint's radius) and how tall, and how many facets round. */
  landforms: {
    massif: { near: 750, far: 1300, radius: [180, 380], height: [90, 230], segments: 40 },
    mesa: { near: 600, far: 1300, radius: [110, 260], height: [50, 120], segments: 40 },
    butte: { near: 550, far: 1250, radius: [60, 110], height: [45, 95], segments: 28 },
    plateau: { near: 950, far: 1300, radius: [280, 460], height: [35, 75], segments: 48 },
    dome: { near: 700, far: 1300, radius: [200, 400], height: [25, 60], segments: 36 },
    /** A crater's height is its rim's, a share of its radius. */
    crater: { near: 850, far: 1250, radius: [180, 360], height: [0.06, 0.09], segments: 48 },
    /** A crater's central mound (#497). */
    mound: { near: 650, far: 900, radius: [260, 380], height: [120, 170], segments: 48 },
  },
  /** How many of each a site gets, by its horizon style: [fewest, most]. Every site has a big crater or two, more on flatter land (Bryon, Oct 5). */
  mix: {
    mountains: { massif: [4, 6], plateau: [1, 1], crater: [1, 2] },
    mesas: { mesa: [3, 6], plateau: [1, 1], crater: [2, 3] },
    hills: { dome: [3, 5], plateau: [1, 1], crater: [2, 3] },
    // By the place (#497). In a crater lake: its central mound and a few low hills on the old lakebed (the rim is a wall of its own).
    crater: { mound: [1, 1], dome: [1, 2] },
    // On a canyon's floor: the mesas and buttes the walls wore back from.
    canyon: { mesa: [4, 6], plateau: [1, 1] },
    // A basin's wide floor: little stands up from it.
    basin: { dome: [1, 2], crater: [1, 2] },
    // Old highlands: crater on crater, and the plateaus between.
    highland: { crater: [4, 6], plateau: [2, 3] },
    // By a volcano (its shield is the skyline): lava domes and a cinder cone or so.
    volcano: { dome: [3, 4], crater: [1, 1] },
  } as Record<HorizonStyle, Partial<Record<LandformKind, [number, number]>>>,
  /** How rough the near ground is, by style (1 elsewhere): a lakebed's and a basin's floors are flatter, the highlands' more broken. */
  ground: { crater: 0.45, basin: 0.4, highland: 1.4 } as Partial<Record<HorizonStyle, number>>,
  /** The near ground's craters, as a multiple of `craters.count` (1 elsewhere). */
  craterCount: { highland: 2, basin: 0.6, crater: 0.6 } as Partial<Record<HorizonStyle, number>>,
  /** Of the mesas, this share are narrow buttes. */
  buttes: 0.35,
  /** Aerial perspective: the farthest land leans this far toward the dust of the sky at the horizon. */
  haze: { near: 400, far: 1600, most: 0.24 },
};

const COLORS = { rock: 0x4a2c20, horizon: 0x9a5c44, haze: 0xdca77a };
/** The ground's own dust, before a site's soil tints it. */
export const GROUND_BASE = 0x7a3b22;

/**
 * A site's colour on the land (T-073). The ground leans from its base dust toward the map's colour there
 * (`soil`, from the sim's soilAt) by data/mars-map.json's soil strength, so dark lowlands and pale
 * highlands differ but both still read as Mars. Boulders and the horizon shift with it, by as much as
 * they're bright next to the ground (dark rock a little, the pale horizon a little more).
 */
export function soilTint(hex: number, soil: string | null): number {
  if (!soil) return hex;
  const k = mapData.soil.strength;
  const channels = (n: number) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (c: number[]) => c[0]! + c[1]! + c[2]!;
  const base = channels(GROUND_BASE);
  const want = channels(parseInt(soil.slice(1), 16));
  const c = channels(hex);
  const share = lum(c) / lum(base);
  const out = c.map((v, i) => Math.min(255, Math.max(0, Math.round(v + (want[i]! - base[i]!) * k * share))));
  return (out[0]! << 16) | (out[1]! << 8) | out[2]!;
}

/** A small seeded random generator (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a plane, seeded. */
function noise2(seed: number): (x: number, y: number) => number {
  const hash = (i: number, j: number) => {
    let h = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = fade(x - i);
    const fy = fade(y - j);
    const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * fx;
    const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The land by the kind of place a site is (#497): the trait its place on the map would give a hole (sim/sites.ts). */
const PLACE_STYLE: Partial<Record<string, HorizonStyle>> = { geothermal: "volcano", crater: "crater", canyon: "canyon", basin: "basin", highland: "highland" };

/**
 * Which horizon a site has: by a named feature, the place's own (#497); otherwise from where it is, or
 * (before it has a place on the map) its name, one of mountains, mesas or hills.
 */
export function horizonStyle(seed: number, site: { lat: number; lon: number } | null = null): HorizonStyle {
  const place = site ? PLACE_STYLE[traitAt(site)?.id ?? ""] : undefined;
  if (place) return place;
  const r = random(seed ^ 0x9e3779b9)();
  return r < 0.36 ? "mountains" : r < 0.66 ? "mesas" : "hills";
}

/** A seed for a site: its rounded map position, or failing that, its name. */
export function siteSeed(site: { lat: number; lon: number } | null, name: string): number {
  if (site) return (Math.round(site.lat * 10) * 7919 + Math.round(site.lon * 10) * 104729) | 0;
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h | 0;
}

export interface Terrain {
  group: THREE.Group;
  /** The ground itself. */
  ground: THREE.Mesh;
  style: HorizonStyle;
  /** The ground's height at a point, metres. */
  heightAt: (x: number, z: number) => number;
  /** What casts the far shadows (#497): the skyline by angle (how far out it starts, how high it stands) and the landforms (x, z, radius, top). */
  shadows: { occluder: Float32Array; forms: [number, number, number, number][] };
}

/**
 * A site's walls (#497): a canyon's two either side of its line, or a crater's all round. Where each stands
 * (its foot, metres from the axis), how tall it is and how much of it there is (`side`, 0 where it opens out),
 * by angle round the hole; and for a canyon, the landslide that fell from one wall.
 */
interface Walls {
  kind: "canyon" | "crater";
  axis: number;
  foot: (a: number) => number;
  height: (a: number) => number;
  side: (a: number) => number;
  slide: { at: number; half: number } | null;
}

/** The angle from b to a, -π to π. */
const angleOff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function wallsFor(style: HorizonStyle, seed: number, rim: number): Walls | null {
  if (style !== "canyon" && style !== "crater") return null;
  const n = noise2(seed + 401);
  const ring = (a: number, f: number) => n(Math.cos(a) * f + 50, Math.sin(a) * f + 50);
  const axis = random(seed + 307)() * Math.PI * 2;
  const spec = WALLS[style];
  const side = style === "canyon" ? (a: number) => smoothstep(0.25, 0.7, Math.abs(Math.sin(angleOff(a, axis)))) : () => 1;
  const rand = random(seed + 419);
  return {
    kind: style,
    axis,
    foot: (a) => rim + spec.foot[0] + (spec.foot[1] - spec.foot[0]) * ring(a, 2),
    height: (a) => side(a) * (spec.height[0] + (spec.height[1] - spec.height[0]) * ring(a, 3)),
    side,
    // Square to the canyon's line, on one side or the other, a little off.
    slide: style === "canyon" ? { at: axis + (rand() < 0.5 ? 1 : -1) * Math.PI / 2 + (rand() - 0.5) * 0.5, half: WALLS.canyon.slide.half } : null,
  };
}

/** The landslide's deposit (#497): a lobe spread out from the foot of the wall it fell from, ridged along its flow, with a raised toe. */
function slideHeight(w: Walls, x: number, z: number): number {
  if (!w.slide) return 0;
  const s = WALLS.canyon.slide;
  const a = Math.atan2(z, x);
  const off = angleOff(a, w.slide.at);
  if (Math.abs(off) > 0.8) return 0;
  const foot = w.foot(w.slide.at);
  const r = Math.hypot(x, z);
  // How far out from the wall (0 at its foot, 1 at the toe), and across it, metres from the middle.
  const u = (foot - r) / s.length;
  if (u < -0.05 || u > 1.05) return 0;
  const across = off * foot;
  const half = s.width[0] + (s.width[1] - s.width[0]) * Math.max(0, u);
  const edge = 1 - smoothstep(0.7, 1, Math.abs(across) / half);
  if (edge <= 0) return 0;
  const ridges = 1 + 0.38 * Math.sin(across / 17) * smoothstep(0.08, 0.35, u);
  const toe = 0.35 * Math.exp(-(((u - 0.93) / 0.06) ** 2));
  const body = Math.pow(Math.max(0, 1 - Math.max(0, u)), 0.55) * smoothstep(-0.05, 0.02, u);
  return s.height * edge * (body * ridges + toe) * (u > 1 ? 1 - smoothstep(1, 1.05, u) : 1);
}

/** A field of dunes (#497): transverse crests across the wind, steep on their lee side, in a patch that fades at its edge. */
function dunesFor(style: HorizonStyle, seed: number, rim: number, walls: Walls | null): ((x: number, z: number) => number) | null {
  if (style !== "canyon" && style !== "crater" && style !== "basin") return null;
  const rand = random(seed + 431);
  // On a canyon's floor, down its line; elsewhere anywhere round.
  const at = walls?.kind === "canyon" ? walls.axis + (rand() < 0.5 ? 0 : Math.PI) + (rand() - 0.5) * 0.4 : rand() * Math.PI * 2;
  const d = rim + DUNES.distance[0] + (DUNES.distance[1] - DUNES.distance[0]) * rand();
  const cx = d * Math.cos(at);
  const cz = d * Math.sin(at);
  const wind = rand() * Math.PI * 2;
  const wx = Math.cos(wind);
  const wz = Math.sin(wind);
  const n = noise2(seed + 433);
  return (x, z) => {
    const dx = x - cx;
    const dz = z - cz;
    const t = Math.hypot(dx, dz) / DUNES.radius;
    if (t >= 1) return 0;
    const along = dx * wx + dz * wz;
    const across = -dx * wz + dz * wx;
    const phase = along / DUNES.wavelength + 0.45 * Math.sin(across / 85) + (n(x / 140, z / 140) - 0.5) * 0.8;
    const f = phase - Math.floor(phase);
    const crest = f < 0.78 ? f / 0.78 : (1 - f) / 0.22;
    return DUNES.height * crest ** 1.3 * (1 - smoothstep(0.55, 1, t));
  };
}

/** The land around a hole of this rim radius, for this site (by its seed, and where it is), its boulders and horizon tinted by its soil. */
export function buildTerrain(rim: number, seed: number, groundMaterial: THREE.Material, soil: string | null = null, site: { lat: number; lon: number } | null = null): Terrain {
  const style = horizonStyle(seed, site);
  const rough = LAND.ground[style] ?? 1;
  const rand = random(seed);
  const roll = noise2(seed + 11);
  const ridge = noise2(seed + 23);
  const walls = wallsFor(style, seed, rim);
  const dunes = dunesFor(style, seed, rim, walls);
  // Craters: a few, of all sizes, clear of the pad.
  const craters = Array.from({ length: Math.round(LAND.craters.count * (LAND.craterCount[style] ?? 1)) }, () => {
    const radius = LAND.craters.min + (LAND.craters.max - LAND.craters.min) * rand() ** 2;
    const d = rim + LAND.pad + LAND.blend + radius + rand() * 800;
    const a = rand() * Math.PI * 2;
    return { x: d * Math.cos(a), z: d * Math.sin(a), radius };
  });

  const heightAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z) - rim;
    const away = smoothstep(LAND.pad, LAND.pad + LAND.blend, d);
    if (away <= 0) return 0;
    let h = (roll(x / LAND.roll.size, z / LAND.roll.size) - 0.5) * 2 * LAND.roll.height;
    h += (roll(x / (LAND.roll.size * 0.37), z / (LAND.roll.size * 0.37)) - 0.5) * LAND.roll.height * 0.6;
    // Ridges: the creases of a noise, sharpened.
    const rv = 1 - Math.abs(ridge(x / LAND.ridge.size, z / LAND.ridge.size) * 2 - 1);
    h += rv ** 3 * LAND.ridge.height;
    h *= rough;
    h += smoothstep(300, LAND.reach, d) * LAND.rise;
    for (const c of craters) {
      const t = Math.hypot(x - c.x, z - c.z) / c.radius;
      if (t > 1.8) continue;
      h += c.radius * LAND.craters.rim * Math.exp(-((t - 1) ** 2) / 0.08);
      if (t < 1) h -= c.radius * LAND.craters.depth * (1 - t * t);
    }
    if (walls) h += slideHeight(walls, x, z);
    if (dunes) h += dunes(x, z);
    return h * away;
  };

  const group = new THREE.Group();

  // The ground: rings from the rim out, spaced wider the further they go.
  const pos: number[] = [];
  const index: number[] = [];
  const S = LAND.segments;
  for (let i = 0; i <= LAND.rings; i++) {
    const t = i / LAND.rings;
    const r = rim + (LAND.reach - rim) * t ** 2.2;
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      pos.push(x, heightAt(x, z), z);
    }
  }
  for (let i = 0; i < LAND.rings; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * S + j;
      const b = i * S + ((j + 1) % S);
      const c = (i + 1) * S + j;
      const d = (i + 1) * S + ((j + 1) % S);
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, groundMaterial);
  group.add(ground);

  // Boulders, sitting a little into the ground: strewn about, and by the place (#497): fallen under a
  // canyon's cliffs and on its landslide, or thrown out round the highlands' craters.
  const places: { x: number; z: number; s: number }[] = [];
  for (let k = 0; k < LAND.rocks.count; k++) {
    const d = rim + LAND.rocks.near + (LAND.rocks.far - LAND.rocks.near) * rand() ** 1.6;
    const a = rand() * Math.PI * 2;
    places.push({ x: d * Math.cos(a), z: d * Math.sin(a), s: LAND.rocks.min + (LAND.rocks.max - LAND.rocks.min) * rand() ** 3 });
  }
  if (walls?.kind === "canyon") {
    for (let k = 0; places.length < LAND.rocks.count + BOULDERS.cliffs; k++) {
      const onSlide = walls.slide && k % 3 === 0;
      const a = onSlide ? walls.slide!.at + (rand() - 0.5) * 0.5 : rand() * Math.PI * 2;
      if (walls.side(a) < 0.5) continue;
      const d = walls.foot(a) - rand() ** 1.5 * (onSlide ? WALLS.canyon.slide.length : BOULDERS.spread);
      places.push({ x: d * Math.cos(a), z: d * Math.sin(a), s: BOULDERS.size[0] + (BOULDERS.size[1] - BOULDERS.size[0]) * rand() ** 2.5 });
    }
  }
  if (style === "highland") {
    for (const c of craters.filter((c) => c.radius > 20)) {
      for (let k = 0; k < BOULDERS.ejecta; k++) {
        const a = rand() * Math.PI * 2;
        const t = 1 + rand() ** 1.7 * 0.8;
        places.push({ x: c.x + c.radius * t * Math.cos(a), z: c.z + c.radius * t * Math.sin(a), s: 0.3 + rand() ** 2 * 2.2 });
      }
    }
  }
  // Weathered and detailed as the land's rock (#497): close by the hole, the detail map shows most here.
  const rockMat = withFarShadow(withLandRock(new THREE.MeshStandardMaterial({ color: soilTint(COLORS.rock, soil), roughness: 1, flatShading: true }), false));
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, places.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  places.forEach((p, k) => {
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    m.compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) + p.s * 0.25, p.z), q, new THREE.Vector3(p.s * (0.8 + rand() * 0.6), p.s * (0.5 + rand() * 0.4), p.s * (0.8 + rand() * 0.6)));
    rocks.setMatrixAt(k, m);
  });
  group.add(rocks);

  const tint = soilTint(COLORS.horizon, soil);
  const skylineAt = skyline(style, seed);
  group.add(horizon(skylineAt, tint));
  if (walls) group.add(wallMesh(walls, seed, heightAt, soil));
  if (walls?.kind === "canyon" && piecesReady()) group.add(buttresses(walls, seed, heightAt, soil));
  const forms = landforms(style, seed, rim, heightAt, tint);
  for (const f of forms) group.add(f.mesh);
  if (style === "volcano") for (const f of lavaFlows(seed, rim, heightAt, soil)) group.add(f);

  // What casts the far shadows: the walls where they stand, else the horizon's ridge; and the biggest landforms.
  const occluder = new Float32Array(SHADOW_ANGLES * 2);
  for (let j = 0; j < SHADOW_ANGLES; j++) {
    const a = ((j + 0.5) / SHADOW_ANGLES) * Math.PI * 2 - Math.PI;
    const h = skylineAt(a);
    let start = LAND.horizon.radius - h * 0.6;
    let top = h;
    if (walls && walls.side(a) > 0.2) {
      const foot = walls.foot(a);
      start = foot + WALLS[walls.kind].shadowIn;
      top = heightAt(foot * Math.cos(a), foot * Math.sin(a)) + walls.height(a) * 0.9;
    }
    occluder[j * 2] = start;
    occluder[j * 2 + 1] = top;
  }
  const shadows = {
    occluder,
    forms: forms
      .filter((f) => f.radius > 0)
      .sort((a, b) => b.top - a.top)
      .slice(0, 8)
      .map((f) => [f.x, f.z, f.radius * 0.7, f.top] as [number, number, number, number]),
  };
  setFarShadow(shadows);
  return { group, ground, style, heightAt, shadows };
}

/** How finely the far shadows' skyline is kept, round the circle. */
const SHADOW_ANGLES = 512;

/** Hand the far shadows to the shaders (FAR_SHADOW in surfaces.ts): the skyline as a texture, the landforms as they are. */
function setFarShadow(s: Terrain["shadows"]): void {
  const data = new Float32Array(SHADOW_ANGLES * 4);
  for (let j = 0; j < SHADOW_ANGLES; j++) {
    data[j * 4] = s.occluder[j * 2]!;
    data[j * 4 + 1] = s.occluder[j * 2 + 1]!;
  }
  const tex = new THREE.DataTexture(data, SHADOW_ANGLES, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  FAR_SHADOW.fsOccluder.value?.dispose();
  FAR_SHADOW.fsOccluder.value = tex;
  FAR_SHADOW.fsForms.value.forEach((v, i) => {
    const f = s.forms[i];
    v.set(f?.[0] ?? 0, f?.[1] ?? 0, f?.[2] ?? 0, f?.[3] ?? 0);
  });
}

/**
 * The far skyline's height at an angle, for a style: jagged peaks, low broken ground (behind the mesas), soft
 * hills; or, by the place (#497), low ground behind a canyon's or a crater's walls, a basin's far low edge,
 * battered highland, or a volcano's shield rising on one side.
 */
function skyline(style: HorizonStyle, seed: number): (a: number) => number {
  const n = noise2(seed + 101);
  // Noise round a circle, so the skyline joins up where it started.
  const ring = (a: number, f: number) => n(Math.cos(a) * f + 50, Math.sin(a) * f + 50);
  // A direction of its own per site: the volcano's summit.
  const axis = random(seed + 307)() * Math.PI * 2;
  if (style === "hills") return (a) => 10 + 34 * (ring(a, 2) * 0.7 + ring(a, 5) * 0.3);
  // The walls stand in front, as solids of their own (wallMesh).
  if (style === "canyon" || style === "crater") return (a) => 8 + 10 * ring(a, 4);
  if (style === "basin") return (a) => 3 + 9 * (ring(a, 2) * 0.6 + ring(a, 7) * 0.4);
  // Low hills, worn and broken, with the odd crater rim's bump.
  if (style === "highland") return (a) => 14 + 26 * ring(a, 3) + 14 * (1 - Math.abs(ring(a, 9) * 2 - 1)) ** 2;
  // A shield volcano: a long gentle rise to a broad summit (a caldera's notch at the top), and plains elsewhere.
  if (style === "volcano") {
    return (a) => {
      const o = angleOff(a, axis);
      const shield = Math.exp(-(o * o) / 0.9);
      const caldera = 1 - 0.12 * Math.exp(-(o * o) / 0.01);
      return 10 + 12 * ring(a, 4) + 260 * shield * caldera * (0.9 + 0.1 * ring(a, 10));
    };
  }
  if (style === "mountains") {
    return (a) => {
      let h = 0;
      let amp = 1;
      for (const f of [2.5, 6, 14, 30]) {
        h += (1 - Math.abs(ring(a, f) * 2 - 1)) * amp;
        amp *= 0.45;
      }
      return 30 + 190 * (h / 1.8) ** 2.2;
    };
  }
  // Mesas stand in front as landforms of their own; behind them, low broken ground.
  return (a) => 6 + 14 * (ring(a, 3) * 0.75 + ring(a, 9) * 0.25);
}

/**
 * The horizon: a ridge all the way round, faceted. Each point on the skyline
 * is a peak with a slope in front and behind, so the light catches it.
 */
function horizon(H: (a: number) => number, color: number): THREE.Mesh {
  const { radius, segments } = LAND.horizon;
  const pos: number[] = [];
  const index: number[] = [];
  for (let j = 0; j < segments; j++) {
    const a = (j / segments) * Math.PI * 2;
    const h = H(a);
    const c = Math.cos(a);
    const s = Math.sin(a);
    // In front (toward the hole), the peak, and behind.
    const front = radius - h * 1.3;
    const back = radius + h * 1.3;
    pos.push(front * c, -2, front * s, radius * c, h, radius * s, back * c, -2, back * s);
  }
  for (let j = 0; j < segments; j++) {
    const a = j * 3;
    const b = ((j + 1) % segments) * 3;
    index.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  const mesh = new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ color: hazed(color, radius), roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  mesh.name = "horizon";
  return mesh;
}

/** A colour paled toward the sky's dust by how far off it stands (aerial perspective; the haze pass adds the rest, look.ts). */
function hazed(hex: number, distance: number): number {
  const t = LAND.haze.most * smoothstep(LAND.haze.near, LAND.haze.far, distance);
  return mixHex(hex, COLORS.haze, t);
}

/** Two colours mixed, `t` of the way from a to b. */
function mixHex(a: number, b: number, t: number): number {
  const m = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * The walls (#497), by kind: where their feet stand (metres from the rim), how high they rise, how far
 * spurs jut out (and gullies cut back), the rock's colour, and where their shadow starts (metres out past the foot).
 * A canyon's: Valles Marineris' layered walls, with the landslide that fell from one of them (how wide its
 * lobe is at the wall and at its toe, how far out it runs, how high it piles, and how deep a scar it left).
 * A crater's: its rim all round, slumped into terraces inside, falling away outside.
 */
const WALLS = {
  canyon: { foot: [950, 1150], height: [230, 330], spur: 85, color: 0x93593d, shadowIn: 60, slide: { half: 0.26, width: [190, 330], length: 600, height: 44, scar: 190 } },
  crater: { foot: [1050, 1250], height: [110, 170], spur: 40, color: 0x8e5a40, shadowIn: 90 },
} as const;

/** Dunes (#497): how far out their field lies (from the rim), its radius, and the dunes' spacing and height, metres. */
const DUNES = { distance: [330, 650], radius: 260, wavelength: 78, height: 6 } as const;

/** Extra boulders by the place (#497): under a canyon's cliffs (how many, how far out they roll, their size) and round each highland crater. */
const BOULDERS = { cliffs: 220, spread: 110, size: [0.8, 5.5], ejecta: 18 } as const;

/**
 * A wall's cross-section, from its foot outward: [metres out, share of its height]. A canyon's: a talus slope,
 * then its beds each a cliff over a ledge (harder beds sheerer, softer ones wearing back further), the caprock
 * and the plateau behind. A crater's: talus, three terraces where the rim slumped, the crest, and the long
 * outer flank.
 */
function wallProfile(kind: Walls["kind"], seed: number): [number, number][] {
  const rand = random(seed + 409);
  if (kind === "crater") {
    const prof: [number, number][] = [[0, -0.03], [28, 0.07], [55, 0.15]];
    let out = 55;
    let h = 0.15;
    for (let i = 0; i < 3; i++) {
      const rise = 0.22 + rand() * 0.04;
      out += 40 + rand() * 20;
      h += rise;
      prof.push([out, h]);
      out += 35 + rand() * 30;
      h += 0.02;
      prof.push([out, h]);
    }
    prof.push([out + 45, 1], [out + 70, 1.01], [out + 160, 0.86], [out + 330, 0.6], [out + 520, 0.38]);
    return prof;
  }
  const beds = Array.from({ length: 7 }, () => ({ thick: 0.7 + rand() * 0.6, hard: rand() }));
  const total = beds.reduce((t, b) => t + b.thick, 0);
  const talus = 0.24;
  const prof: [number, number][] = [[0, -0.03], [22, 0.05], [48, 0.13], [74, 0.2], [92, talus]];
  let out = 92;
  let h = talus;
  for (const b of beds) {
    const rise = ((1 - talus - 0.07) * b.thick) / total;
    out += 3 + b.hard * 3;
    prof.push([out, h + rise * 0.82]);
    out += 6 + (1 - b.hard) * 22;
    h += rise;
    prof.push([out, h]);
  }
  out += 4;
  prof.push([out, 1], [out + 30, 1.005], [out + 320, 0.97]);
  return prof;
}

/**
 * A site's walls as one solid (#497), the cross-section swept round the hole. Spurs jut out between gullies
 * that cut back into the wall and notch its rim; fans of debris spread below the gullies; above a canyon's
 * landslide, its scar is a great alcove bitten out of the wall. Bedded and dusted by the land's rock shader
 * (withLandRock); each vertex coloured by the rock, hazed by how far off it stands.
 */
function wallMesh(w: Walls, seed: number, heightAt: (x: number, z: number) => number, soil: string | null): THREE.Mesh {
  const spec = WALLS[w.kind];
  const n = noise2(seed + 401);
  const ring = (a: number, f: number) => n(Math.cos(a) * f + 50, Math.sin(a) * f + 50);
  const prof = wallProfile(w.kind, seed);
  const top = Math.max(...prof.map(([, h]) => h));
  const S = 900;
  const col: { x: number; y: number; z: number; h: number }[][] = [];
  const side: number[] = [];
  for (let j = 0; j < S; j++) {
    const a = (j / S) * Math.PI * 2;
    const s = w.side(a);
    side.push(s);
    const foot = w.foot(a);
    const height = w.height(a);
    const g = (1 - Math.abs(ring(a, 16) * 2 - 1)) * 1.65 + (1 - Math.abs(ring(a, 30) * 2 - 1)) * 0.35 - 1;
    const scar = w.slide ? Math.exp(-((angleOff(a, w.slide.at) / (w.slide.half * 0.6)) ** 2)) * WALLS.canyon.slide.scar : 0;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const base = heightAt(foot * c, foot * sn);
    col.push(
      prof.map(([out, h]) => {
        const t = Math.max(0, Math.min(1, h));
        const jut = g > 0 ? g * spec.spur * Math.sin(Math.PI * Math.min(1, t * 1.15)) : g * spec.spur * (0.3 + 0.7 * t);
        const fan = t < 0.24 && g < 0 ? -g * 40 * (1 - t / 0.24) : 0;
        const notch = h >= 0.99 && h <= 1.02 && g < -0.3 ? (g + 0.3) * 0.08 : 0;
        const r = foot + out - jut - fan + scar * smoothstep(0.15, 0.6, t);
        return { x: r * c, z: r * sn, y: base + height * (h + notch), h: h / top };
      }),
    );
  }
  const pos: number[] = [];
  const heights: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  const rock = soilTint(spec.color, soil);
  const put = (p: { x: number; y: number; z: number; h: number }) => {
    pos.push(p.x, p.y, p.z);
    heights.push(p.h);
    color.setHex(hazed(rock, Math.hypot(p.x, p.z)));
    colors.push(color.r, color.g, color.b);
  };
  for (let j = 0; j < S; j++) {
    const k = (j + 1) % S;
    // Only where there's a wall, either side of this step.
    if (side[j]! < 0.01 && side[k]! < 0.01) continue;
    for (let i = 0; i < prof.length - 1; i++) {
      // Wound so the faces look in toward the hole (and up).
      for (const p of [col[j]![i]!, col[k]![i]!, col[j]![i + 1]!, col[k]![i]!, col[k]![i + 1]!, col[j]![i + 1]!]) put(p);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("landH", new THREE.Float32BufferAttribute(heights, 1));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, withLandRock(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true }), true));
  mesh.name = "walls";
  mesh.userData.layered = true;
  return mesh;
}

/**
 * Lava flows by a volcano (#497): long tongues of dark rock run down off the shield toward the hole, each
 * with steep margins, a blunt snout where it stopped, and (on the biggest) a channel between levees. Draped
 * on the ground as ribbons of their own, so the bridge sends them as landforms.
 */
const LAVA = { count: [3, 5], start: 1180, end: [380, 640], width: [18, 38], thick: [4, 7], color: 0x3a2622 } as const;

function lavaFlows(seed: number, rim: number, heightAt: (x: number, z: number) => number, soil: string | null): THREE.Mesh[] {
  const rand = random(seed + 443);
  const axis = random(seed + 307)() * Math.PI * 2;
  const n = noise2(seed + 449);
  const count = LAVA.count[0] + Math.floor(rand() * (LAVA.count[1] - LAVA.count[0] + 1));
  const out: THREE.Mesh[] = [];
  for (let f = 0; f < count; f++) {
    const a0 = axis + (rand() - 0.5) * 1.3;
    const end = rim + LAVA.end[0] + (LAVA.end[1] - LAVA.end[0]) * rand();
    const width = LAVA.width[0] + (LAVA.width[1] - LAVA.width[0]) * rand();
    const thick = LAVA.thick[0] + (LAVA.thick[1] - LAVA.thick[0]) * rand();
    const channel = f === 0;
    // The centre line: in from the shield, wandering side to side.
    const steps = Math.ceil((LAVA.start - end) / 18);
    const line: { x: number; z: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const r = LAVA.start - ((LAVA.start - end) * i) / steps;
      const a = a0 + (n(r / 200, f * 3.1) - 0.5) * 0.45;
      line.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
    }
    // Across the flow: margins at the ground, steep sides, the top (with levees and a channel on the biggest).
    const across = channel ? [-1.08, -1, -0.8, -0.45, 0, 0.45, 0.8, 1, 1.08] : [-1.08, -1, -0.75, 0, 0.75, 1, 1.08];
    const lift = channel ? [-0.6, 0.75, 1.1, 0.7, 0.55, 0.7, 1.1, 0.75, -0.6] : [-0.6, 0.75, 1, 1.05, 1, 0.75, -0.6];
    const rows: { x: number; y: number; z: number; h: number }[][] = [];
    line.forEach((p, i) => {
      const q = line[Math.min(line.length - 1, i + 1)]!;
      const o = line[Math.max(0, i - 1)]!;
      const tx = q.x - o.x;
      const tz = q.z - o.z;
      const tl = Math.hypot(tx, tz) || 1;
      const nx = -tz / tl;
      const nz = tx / tl;
      const u = i / steps;
      // Wider toward the snout, then it ends blunt.
      const w = width * (0.7 + 0.5 * u) * (1 + 0.15 * (n(u * 6, f + 9) - 0.5));
      const snout = i === steps;
      rows.push(
        across.map((s, k) => {
          const x = p.x + nx * s * w;
          const z = p.z + nz * s * w;
          return { x, z, y: heightAt(x, z) + (snout ? -0.6 : lift[k]! * thick), h: 0.5 };
        }),
      );
    });
    const pos: number[] = [];
    const heights: number[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      for (let k = 0; k < across.length - 1; k++) {
        const a = rows[i]![k]!;
        const b = rows[i]![k + 1]!;
        const c = rows[i + 1]![k]!;
        const d = rows[i + 1]![k + 1]!;
        for (const p of [a, b, c, b, d, c]) {
          pos.push(p.x, p.y, p.z);
          heights.push(p.h);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("landH", new THREE.Float32BufferAttribute(heights, 1));
    geo.computeVertexNormals();
    const mid = line[Math.floor(line.length / 2)]!;
    const mesh = new THREE.Mesh(geo, withFarShadow(withLandRock(new THREE.MeshStandardMaterial({ color: hazed(soilTint(LAVA.color, soil), Math.hypot(mid.x, mid.z)), roughness: 1, flatShading: true }), false)));
    mesh.name = "landform";
    out.push(mesh);
  }
  return out;
}

/**
 * A landform's cross-section, from its foot to its middle: each step a share of its radius and of its
 * height, how much that ring wanders in and out round the landform, and how much it jags up and down.
 */
type Profile = [r: number, h: number, wander: number, jag: number][];

const between = (rand: () => number, [lo, hi]: readonly number[]) => lo! + (hi! - lo!) * rand();

/** The cross-section for a kind, varied a little per landform. */
function profile(kind: LandformKind, rand: () => number): Profile {
  switch (kind) {
    case "mesa": {
      // A talus slope at the foot, a cliff, a ledge where a softer stratum wore back, a second cliff, and a worn top edge.
      const talus = 0.22 + rand() * 0.12;
      const ledge = talus + (0.95 - talus) * (0.35 + rand() * 0.3);
      const back = 0.05 + rand() * 0.05;
      return [[1, -0.1, 0.06, 0], [0.8, talus, 0.1, 0.06], [0.77, ledge, 0.06, 0], [0.77 - back, ledge + 0.03, 0.08, 0.02], [0.74 - back, 0.96, 0.08, 0], [0.7 - back, 1, 0.14, 0.03], [0, 1, 0, 0]];
    }
    case "butte":
      // Mostly talus, with a narrow cap of hard rock on top.
      return [[1, -0.1, 0.08, 0], [0.62, 0.36 + rand() * 0.1, 0.1, 0.08], [0.52, 0.94, 0.06, 0], [0.47, 1, 0.12, 0.03], [0, 1, 0, 0]];
    case "plateau":
      return [[1, -0.1, 0.05, 0], [0.9, 0.2, 0.08, 0.05], [0.88, 0.5, 0.05, 0], [0.84, 0.54, 0.06, 0.02], [0.82, 0.97, 0.05, 0], [0.79, 1, 0.1, 0.02], [0, 1, 0, 0]];
    case "massif":
      // Spurs and gullies wander most halfway up; the peaks are jagged.
      return [[1, -0.08, 0.12, 0], [0.8, 0.16, 0.22, 0.1], [0.6, 0.38, 0.32, 0.14], [0.42, 0.6, 0.32, 0.16], [0.24, 0.82, 0.28, 0.14], [0.09, 0.96, 0.25, 0.06], [0, 1, 0, 0]];
    case "mound":
      // A crater's central mound (#497), as Gale's Mount Sharp: beds laid down in the old lake, worn back into tiers.
      return [[1, -0.08, 0.1, 0], [0.86, 0.12, 0.12, 0.05], [0.74, 0.3, 0.1, 0.04], [0.66, 0.34, 0.1, 0.02], [0.56, 0.52, 0.1, 0.04], [0.48, 0.56, 0.1, 0.02], [0.38, 0.74, 0.12, 0.05], [0.3, 0.78, 0.1, 0.02], [0.18, 0.94, 0.14, 0.06], [0, 1, 0, 0]];
    case "dome":
      return [[1, -0.08, 0.1, 0], [0.78, 0.26, 0.14, 0.06], [0.54, 0.62, 0.14, 0.06], [0.28, 0.9, 0.1, 0.04], [0, 1, 0, 0]];
    case "crater":
      // A wide apron rising to the rim, then a steeper fall inside to a floor a little above the plain.
      return [[1, -0.15, 0.04, 0], [0.8, 0.25, 0.05, 0.1], [0.67, 0.8, 0.04, 0.1], [0.6, 1, 0.04, 0.12], [0.54, 0.72, 0.04, 0.06], [0.42, 0.18, 0.05, 0.04], [0, 0.12, 0, 0]];
  }
}

/** Landforms laid down in beds, shaded as layered rock (#497); the rest (peaks, domes) only weathered. */
const LAYERED: ReadonlySet<LandformKind> = new Set(["mesa", "butte", "plateau", "crater", "mound"]);

/**
 * The landforms toward the horizon for a site: a handful, spread round it at different distances so nearer
 * ones stand in front of farther ones. Each is a faceted solid of its own, so the sun shades its sides
 * differently as the day goes and the camera sees round it as it orbits.
 */
function landforms(style: HorizonStyle, seed: number, rim: number, heightAt: (x: number, z: number) => number, color: number): { mesh: THREE.Mesh; x: number; z: number; radius: number; top: number }[] {
  // On a canyon's floor they stand short of its walls, a little smaller.
  const reach = style === "canyon" ? CANYON_FLOOR : null;
  const axis = style === "canyon" ? random(seed + 307)() * Math.PI * 2 : null;
  const rand = random(seed + 7);
  const kinds: LandformKind[] = [];
  for (const [kind, range] of Object.entries(LAND.mix[style]) as [LandformKind, [number, number]][]) {
    const n = range[0] + Math.floor(rand() * (range[1] - range[0] + 1));
    for (let i = 0; i < n; i++) kinds.push(kind === "mesa" && rand() < LAND.buttes ? "butte" : kind);
  }
  // Shuffled, then each given a share of the circle, so they spread round rather than bunch.
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  const start = rand() * Math.PI * 2;
  return kinds.map((kind, k) => {
    const spec = LAND.landforms[kind];
    // On a canyon's floor, down its line (either way), clear of its walls and the landslide.
    const at = reach && axis !== null ? axis + (k % 2 ? Math.PI : 0) + (rand() - 0.5) * 0.9 : start + ((k + 0.15 + rand() * 0.7) / kinds.length) * Math.PI * 2;
    const distance = rim + (reach ? between(rand, reach.distance) : between(rand, [spec.near, spec.far]));
    const radius = between(rand, spec.radius) * (reach ? reach.scale : 1);
    const shape = {
      x: distance * Math.cos(at),
      z: distance * Math.sin(at),
      radius,
      height: kind === "crater" ? radius * between(rand, spec.height) : between(rand, spec.height),
      // Stretched one way and turned, so footprints aren't circles; peaks and domes lean off centre.
      stretch: kind === "crater" ? 0.85 + rand() * 0.3 : 0.6 + rand() * 0.8,
      turn: rand() * Math.PI,
      lean: kind === "massif" || kind === "dome" ? [(rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5] : [0, 0],
      segments: spec.segments,
    };
    const prof = profile(kind, rand);
    // A sculpted piece once they're in (picked either way, so the land after is the same).
    const hero = HERO[kind];
    const pick = rand();
    const made = hero && piecesReady()
      ? heroLandform(hero[Math.floor(pick * hero.length)]!, shape, heightAt, hazed(color, distance))
      : landform(shape, prof, noise2(seed + 211 + k * 31), heightAt, hazed(color, distance), LAYERED.has(kind));
    made.mesh.name = "landform";
    // A crater's rim is a ring, not a solid: it casts no far shadow of its own.
    return { mesh: made.mesh, x: shape.x, z: shape.z, radius: kind === "crater" ? 0 : radius * Math.min(1, shape.stretch), top: made.top };
  });
}

/** The landforms sculpted in Blender (#497, landPieces.ts), by kind: one of these, at random, in place of the profile. */
const HERO: Partial<Record<LandformKind, PieceName[]>> = { mesa: ["mesa_a", "mesa_b"], butte: ["butte_a", "butte_b"], mound: ["mound"] };

/** Where a landform's foot sits: the lowest ground under it, so no edge floats. */
function footOf(s: { x: number; z: number; radius: number }, heightAt: (x: number, z: number) => number): number {
  let base = heightAt(s.x, s.z);
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2;
    base = Math.min(base, heightAt(s.x + s.radius * Math.cos(a), s.z + s.radius * Math.sin(a)));
  }
  return base;
}

/** A sculpted landform (#497): the piece stretched to its footprint, turned, stood on the ground and scaled to its height. */
function heroLandform(
  name: PieceName,
  s: { x: number; z: number; radius: number; height: number; stretch: number; turn: number },
  heightAt: (x: number, z: number) => number,
  color: number,
): { mesh: THREE.Mesh; top: number } {
  const base = footOf(s, heightAt);
  const cos = Math.cos(s.turn);
  const sin = Math.sin(s.turn);
  const geo = placedGeometry(name, (x, y, z) => {
    const lx = x * s.radius * s.stretch;
    const lz = z * s.radius;
    return [s.x + lx * cos - lz * sin, base + y * s.height, s.z + lx * sin + lz * cos];
  });
  const mesh = new THREE.Mesh(geo, withFarShadow(withLandRock(new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 1, flatShading: true }), true)));
  mesh.userData.layered = true;
  return { mesh, top: base + s.height };
}

/**
 * Buttresses along a canyon's walls (#497): spurs of rock sculpted in Blender, set along the walls' feet a
 * couple of hundred metres apart (jittered, mixed among three), standing a little proud of the swept wall so
 * the cliff line breaks up into spurs and the gullies between them; none in the landslide's scar. One mesh.
 */
const BUTTRESS = { spacing: 210, halfWidth: 115, depth: 165, proud: 25, height: [0.82, 1.0] } as const;

function buttresses(w: Walls, seed: number, heightAt: (x: number, z: number) => number, soil: string | null): THREE.Mesh {
  const rand = random(seed + 457);
  const names: PieceName[] = ["buttress_a", "buttress_b", "buttress_c"];
  const parts: THREE.BufferGeometry[] = [];
  let a = rand() * 0.05;
  while (a < Math.PI * 2) {
    const foot = w.foot(a);
    const step = BUTTRESS.spacing / foot;
    const at = a + (rand() - 0.5) * step * 0.4;
    a += step;
    // Only where the wall stands full height either side, so no buttress outstands a tapering wall.
    if (Math.min(w.side(at - step * 0.6), w.side(at), w.side(at + step * 0.6)) < 0.97) continue;
    if (w.slide && Math.abs(angleOff(at, w.slide.at)) < w.slide.half * 0.9) continue;
    const c = Math.cos(at);
    const s = Math.sin(at);
    const r0 = foot - BUTTRESS.proud;
    const base = heightAt(r0 * c, r0 * s) - 2;
    const height = w.height(at) * (BUTTRESS.height[0] + (BUTTRESS.height[1] - BUTTRESS.height[0]) * rand());
    const flip = rand() < 0.5 ? -1 : 1;
    parts.push(
      placedGeometry(names[Math.floor(rand() * names.length)]!, (x, y, z) => {
        // Across the wall (along its tangent) and out from the hole, from the buttress's foot.
        const across = x * flip * BUTTRESS.halfWidth;
        const out = r0 + z * BUTTRESS.depth;
        return [out * c - across * s, base + y * height, out * s + across * c];
      }),
    );
  }
  const geo = mergeGeometries(parts);
  const mid = (w.foot(0) + w.foot(Math.PI)) / 2;
  const mesh = new THREE.Mesh(geo, withLandRock(new THREE.MeshStandardMaterial({ color: hazed(soilTint(WALLS.canyon.color, soil), mid), vertexColors: true, roughness: 1, flatShading: true }), true));
  mesh.name = "landform";
  mesh.userData.layered = true;
  return mesh;
}

/** Non-indexed geometries with the same attributes, end to end. */
function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color", "landH"]) {
    const size = parts[0]?.getAttribute(name)?.itemSize ?? 3;
    const total = parts.reduce((n, p) => n + p.getAttribute(name).array.length, 0);
    const arr = new Float32Array(total);
    let at = 0;
    for (const p of parts) {
      arr.set(p.getAttribute(name).array as Float32Array, at);
      at += p.getAttribute(name).array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const p of parts) p.dispose();
  return out;
}

/** The mesas on a canyon's floor (#497): how far out, and their size against elsewhere. */
const CANYON_FLOOR = { distance: [430, 800] as [number, number], scale: 0.75 };

/** One landform: its profile turned round its middle, wandering by noise, sat on the ground and faceted. */
function landform(
  s: { x: number; z: number; radius: number; height: number; stretch: number; turn: number; lean: number[]; segments: number },
  prof: Profile,
  n: (x: number, y: number) => number,
  heightAt: (x: number, z: number) => number,
  color: number,
  layered = false,
): { mesh: THREE.Mesh; top: number } {
  const cos = Math.cos(s.turn);
  const sin = Math.sin(s.turn);
  // Its foot sits at the lowest ground under it, so no edge floats.
  let base = heightAt(s.x, s.z);
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2;
    base = Math.min(base, heightAt(s.x + s.radius * Math.cos(a), s.z + s.radius * Math.sin(a)));
  }
  const S = s.segments;
  const pos: number[] = [];
  const hs: number[] = [];
  prof.forEach(([r, h, wander, jag], i) => {
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const c = Math.cos(a);
      const si = Math.sin(a);
      // Broad swells and finer gullies round the ring, different on each ring.
      const w = (n(c * 1.6 + 20, si * 1.6 + i * 0.45) - 0.5) * 1.4 + (n(c * 5 + 40, si * 5 + i * 0.7) - 0.5) * 0.8;
      const rr = s.radius * r * (1 + wander * w);
      const lx = rr * c * s.stretch + s.lean[0]! * s.radius * h;
      const lz = rr * si + s.lean[1]! * s.radius * h;
      const y = base + s.height * (h + jag * (n(c * 9 + 60, si * 9 + i * 1.3) - 0.5) * 2);
      pos.push(s.x + lx * cos - lz * sin, y, s.z + lx * sin + lz * cos);
      hs.push(Math.max(0, h));
    }
  });
  const index: number[] = [];
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * S + j;
      const b = i * S + ((j + 1) % S);
      const c = (i + 1) * S + j;
      const d = (i + 1) * S + ((j + 1) % S);
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("landH", new THREE.Float32BufferAttribute(hs, 1));
  geo.setIndex(index);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  const mesh = new THREE.Mesh(flat, withFarShadow(withLandRock(new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }), layered)));
  mesh.userData.layered = layered;
  return { mesh, top: base + s.height };
}

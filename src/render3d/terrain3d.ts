import * as THREE from "three";
import { config } from "../sim/config";
import mapData from "../../data/mars-map.json";
import { traitAt } from "../sim/sites";

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
type LandformKind = "massif" | "mesa" | "butte" | "plateau" | "dome" | "crater";

/** Sizes in metres. */
/** The surface rings' outer edge, metres out from the rim (T-108): the ground stays flat, and clear of boulders, out past it. */
const RINGS_OUT = config.geometry.surfaceRingM + (config.geometry.surfaceRings - 0.5) * config.geometry.surfaceRingDepthM;

const LAND = {
  /** Flat around the rim, out past the surface rings, then easing into the terrain over `blend`. */
  pad: Math.max(45, RINGS_OUT + 4),
  blend: 60,
  /** The ground reaches this far out, to meet the horizon. */
  reach: 1700,
  rings: 110,
  segments: 256,
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
  },
  /** How many of each a site gets, by its horizon style: [fewest, most]. Every site has a big crater or two, more on flatter land (Bryon, Oct 5). */
  mix: {
    mountains: { massif: [4, 6], plateau: [1, 1], crater: [1, 2] },
    mesas: { mesa: [3, 6], plateau: [1, 1], crater: [2, 3] },
    hills: { dome: [3, 5], plateau: [1, 1], crater: [2, 3] },
    // By the place (#497). In a crater lake: its central peak and a few low hills on the old lakebed (the rim is the skyline).
    crater: { massif: [1, 1], dome: [2, 3] },
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
  haze: { near: 400, far: 1600, most: 0.42 },
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
}

/** The land around a hole of this rim radius, for this site (by its seed, and where it is), its boulders and horizon tinted by its soil. */
export function buildTerrain(rim: number, seed: number, groundMaterial: THREE.Material, soil: string | null = null, site: { lat: number; lon: number } | null = null): Terrain {
  const style = horizonStyle(seed, site);
  const rough = LAND.ground[style] ?? 1;
  const rand = random(seed);
  const roll = noise2(seed + 11);
  const ridge = noise2(seed + 23);
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

  // Boulders, sitting a little into the ground.
  const rockMat = new THREE.MeshStandardMaterial({ color: soilTint(COLORS.rock, soil), roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, LAND.rocks.count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let k = 0; k < LAND.rocks.count; k++) {
    const d = rim + LAND.rocks.near + (LAND.rocks.far - LAND.rocks.near) * rand() ** 1.6;
    const a = rand() * Math.PI * 2;
    const s = LAND.rocks.min + (LAND.rocks.max - LAND.rocks.min) * rand() ** 3;
    const x = d * Math.cos(a);
    const z = d * Math.sin(a);
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.25, z), q, new THREE.Vector3(s * (0.8 + rand() * 0.6), s * (0.5 + rand() * 0.4), s * (0.8 + rand() * 0.6)));
    rocks.setMatrixAt(k, m);
  }
  group.add(rocks);

  const tint = soilTint(COLORS.horizon, soil);
  group.add(horizon(style, seed, tint));
  if (style === "canyon") group.add(canyonWalls(seed, rim, heightAt, soil));
  for (const m of landforms(style, seed, rim, heightAt, tint, soil)) group.add(m);
  return { group, ground, style, heightAt };
}

/**
 * The far skyline's height at an angle, for a style: jagged peaks, low broken ground (behind the mesas), soft
 * hills; or, by the place (#497), a crater's rim wall, a canyon's two walls, a basin's far low edge, battered
 * highland, or a volcano's shield rising on one side.
 */
function skyline(style: HorizonStyle, seed: number): (a: number) => number {
  const n = noise2(seed + 101);
  // Noise round a circle, so the skyline joins up where it started.
  const ring = (a: number, f: number) => n(Math.cos(a) * f + 50, Math.sin(a) * f + 50);
  // A direction of its own per site: the canyon's line, the volcano's summit.
  const axis = random(seed + 307)() * Math.PI * 2;
  const off = (a: number) => Math.atan2(Math.sin(a - axis), Math.cos(a - axis));
  if (style === "hills") return (a) => 10 + 34 * (ring(a, 2) * 0.7 + ring(a, 5) * 0.3);
  // The rim all round, level-ish, notched here and there, slumped in places.
  if (style === "crater") return (a) => 75 + 40 * ring(a, 1.5) + 12 * ring(a, 6) + 5 * (1 - Math.abs(ring(a, 18) * 2 - 1));
  // Low broken ground down the canyon's line; its walls stand in front, as solids of their own (canyonWalls).
  if (style === "canyon") return (a) => 8 + 10 * ring(a, 4);
  if (style === "basin") return (a) => 3 + 9 * (ring(a, 2) * 0.6 + ring(a, 7) * 0.4);
  // Low hills, worn and broken, with the odd crater rim's bump.
  if (style === "highland") return (a) => 14 + 26 * ring(a, 3) + 14 * (1 - Math.abs(ring(a, 9) * 2 - 1)) ** 2;
  // A shield volcano: a long gentle rise to a broad summit (a caldera's notch at the top), and plains elsewhere.
  if (style === "volcano") {
    return (a) => {
      const o = off(a);
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
function horizon(style: HorizonStyle, seed: number, color: number): THREE.Mesh {
  const H = skyline(style, seed);
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

/** A colour paled toward the sky's dust by how far off it stands (aerial perspective). */
function hazed(hex: number, distance: number): number {
  const t = LAND.haze.most * smoothstep(LAND.haze.near, LAND.haze.far, distance);
  const mix = (shift: number) => Math.round(((hex >> shift) & 255) * (1 - t) + ((COLORS.haze >> shift) & 255) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/**
 * A canyon's walls (#497): two long solids either side of its line, each a cross-section swept round the hole.
 * From the floor up: a talus slope of fallen rock, then the layered beds, each a cliff over a ledge where a
 * softer bed wore back, then the hard caprock and the plateau behind. Spurs jut out between gullies that cut
 * back into the wall and notch its rim; fans of debris spread below the gullies. Every face is coloured by
 * the bed it cuts (pale and dark bands, a dark caprock, dust on the ledges and the talus), so the strata
 * read from the hole, and hazed by how far off it stands. Tapers away where the canyon opens.
 */
const CANYON = {
  /** Where the walls' feet stand, metres from the rim, and how high their rims rise. */
  foot: [950, 1150],
  height: [230, 330],
  /** How far spurs jut out (and gullies cut back) at most, metres. */
  spur: 85,
  /** The beds: how many, and their colours (pale, mid, dark, repeating with a little variety). */
  beds: 7,
  colors: { pale: 0xb68159, mid: 0x93593d, dark: 0x6b3d2b, cap: 0x55322a, dust: 0xbf8f66 },
  /** The talus' share of the height, and the plateau's depth behind the rim. */
  talus: 0.24,
  back: 320,
  segments: 900,
  /** The mesas on the canyon floor: how far out, and their size against elsewhere. */
  floor: { distance: [430, 800] as [number, number], scale: 0.75 },
};

function canyonWalls(seed: number, rim: number, heightAt: (x: number, z: number) => number, soil: string | null): THREE.Mesh {
  const n = noise2(seed + 401);
  const ring = (a: number, f: number) => n(Math.cos(a) * f + 50, Math.sin(a) * f + 50);
  const axis = random(seed + 307)() * Math.PI * 2;
  const rand = random(seed + 409);
  // Each bed's thickness and how hard it is (a hard bed stands as a cliff, a soft one wears back to a ledge).
  const beds = Array.from({ length: CANYON.beds }, () => ({ thick: 0.7 + rand() * 0.6, hard: rand() }));
  const total = beds.reduce((t, b) => t + b.thick, 0);
  // The cross-section, as [metres out from the foot, share of the height], with each step's bed (-1 talus, beds.length the cap).
  const prof: { out: number; h: number; bed: number }[] = [];
  const talus = CANYON.talus;
  for (const [out, h] of [[0, -0.03], [22, 0.05], [48, 0.13], [74, 0.2], [92, talus]]) prof.push({ out: out!, h: h!, bed: -1 });
  let out = 92;
  let h = talus;
  beds.forEach((b, i) => {
    const rise = ((1 - talus - 0.07) * b.thick) / total;
    const ledge = 6 + (1 - b.hard) * 22;
    // The cliff, nearly sheer, then the ledge's gentler slope back to the next.
    out += 3 + b.hard * 3;
    prof.push({ out, h: h + rise * 0.82, bed: i });
    out += ledge;
    h += rise;
    prof.push({ out, h, bed: i });
  });
  out += 4;
  prof.push({ out, h: 1, bed: beds.length });
  prof.push({ out: out + 30, h: 1.005, bed: beds.length });
  prof.push({ out: out + CANYON.back, h: 0.97, bed: beds.length });

  const S = CANYON.segments;
  const col: { x: number; z: number; y: number; bed: number }[][] = [];
  const side: number[] = [];
  for (let j = 0; j < S; j++) {
    const a = (j / S) * Math.PI * 2;
    const o = Math.atan2(Math.sin(a - axis), Math.cos(a - axis));
    const s = smoothstep(0.25, 0.7, Math.abs(Math.sin(o)));
    side.push(s);
    const foot = rim + CANYON.foot[0]! + (CANYON.foot[1]! - CANYON.foot[0]!) * ring(a, 2);
    const height = s * (CANYON.height[0]! + (CANYON.height[1]! - CANYON.height[0]!) * ring(a, 3));
    // Spurs (+) and gullies (-): sharp-crested ridges of noise at two scales.
    const g = (1 - Math.abs(ring(a, 18) * 2 - 1)) * 1.55 + (1 - Math.abs(ring(a, 47) * 2 - 1)) * 0.45 - 1;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const base = heightAt(foot * c, foot * sn);
    col.push(
      prof.map((p) => {
        const t = Math.max(0, Math.min(1, p.h));
        // Spurs jut most halfway up; gullies cut back further near the top and spread their fans at the foot.
        const jut = g > 0 ? g * CANYON.spur * Math.sin(Math.PI * Math.min(1, t * 1.15)) : g * CANYON.spur * (0.3 + 0.7 * t);
        const fan = p.bed === -1 && g < 0 ? -g * 40 * (1 - t / talus) : 0;
        const notch = p.bed === beds.length && g < -0.3 ? (g + 0.3) * 0.08 : 0;
        const r = foot + p.out - jut - fan;
        return { x: r * c, z: r * sn, y: base + height * (p.h + notch), bed: p.bed };
      }),
    );
  }

  const pos: number[] = [];
  const colors: number[] = [];
  const shade = bedShader(soil, beds.length);
  const tri = (a: (typeof col)[0][0], b: (typeof col)[0][0], c: (typeof col)[0][0], bed: number) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const color = shade(a, b, c, bed);
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  };
  for (let j = 0; j < S; j++) {
    const k = (j + 1) % S;
    // Only where there's a wall, either side of this step.
    if (side[j]! < 0.01 && side[k]! < 0.01) continue;
    for (let i = 0; i < prof.length - 1; i++) {
      const bed = prof[i + 1]!.bed;
      // Wound so the faces look in toward the hole (and up).
      tri(col[j]![i]!, col[k]![i]!, col[j]![i + 1]!, bed);
      tri(col[k]![i]!, col[k]![i + 1]!, col[j]![i + 1]!, bed);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true }));
  mesh.name = "walls";
  return mesh;
}

type P3 = { x: number; y: number; z: number };

/**
 * A face's colour by the bed it cuts (-1 the talus, `beds` and over the caprock): pale, mid and dark beds in
 * turn, tinted by the site's soil; faces that look up gather dust (ledges, the talus); paler the farther off.
 */
function bedShader(soil: string | null, beds: number): (a: P3, b: P3, c: P3, bed: number) => THREE.Color {
  const tint = (hex: number) => soilTint(hex, soil);
  const k = CANYON.colors;
  const palette = { pale: tint(k.pale), mid: tint(k.mid), dark: tint(k.dark), cap: tint(k.cap), dust: tint(k.dust) };
  const bedColor = (bed: number) => (bed < 0 ? palette.dust : bed >= beds ? palette.cap : [palette.pale, palette.mid, palette.dark, palette.mid][bed % 4]!);
  const color = new THREE.Color();
  return (a, b, c, bed) => {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const up = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
    const own = bedColor(bed);
    const hex = up > 0.8 && bed < beds ? palette.dust : up > 0.6 && bed >= 0 && bed < beds ? mixHex(own, palette.dust, 0.5) : own;
    return color.setHex(hazed(hex, Math.hypot((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3)));
  };
}

/** A landform coloured in beds, as the canyon's walls (#497): by each face's height up it, the top its caprock. */
function layered(mesh: THREE.Mesh, soil: string | null, seed: number): void {
  const g = mesh.geometry;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const span = Math.max(1, max.y - min.y);
  const beds = 2 + Math.floor(random(seed + 503)() * 2);
  const shade = bedShader(soil, beds);
  const p = g.getAttribute("position");
  const colors: number[] = [];
  const v = [0, 1, 2].map(() => ({ x: 0, y: 0, z: 0 }));
  // Both triangles of a quad (landform() makes them in pairs) take one bed, by the quad's middle, so the beds run level.
  for (let q = 0; q < p.count; q += 6) {
    let y = 0;
    const n = Math.min(6, p.count - q);
    for (let j = 0; j < n; j++) y += p.getY(q + j);
    const t = (y / n - min.y) / span;
    const bed = t < 0.2 ? -1 : t > 0.93 ? beds : Math.floor(((t - 0.2) / 0.73) * beds);
    for (let i = q; i < q + n; i += 3) {
      for (let j = 0; j < 3; j++) Object.assign(v[j]!, { x: p.getX(i + j), y: p.getY(i + j), z: p.getZ(i + j) });
      const color = shade(v[0]!, v[1]!, v[2]!, bed);
      for (let j = 0; j < 3; j++) colors.push(color.r, color.g, color.b);
    }
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.vertexColors = true;
  m.color.setHex(0xffffff);
}

/** Two colours mixed, `t` of the way from a to b. */
function mixHex(a: number, b: number, t: number): number {
  const m = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * A landform's cross-section, from its foot to its middle: each step a share of its radius and of its
 * height, how much that ring wanders in and out round the landform, and how much it jags up and down.
 */
type Profile = [r: number, h: number, wander: number, jag: number][];

const between = (rand: () => number, [lo, hi]: number[]) => lo! + (hi! - lo!) * rand();

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
    case "dome":
      return [[1, -0.08, 0.1, 0], [0.78, 0.26, 0.14, 0.06], [0.54, 0.62, 0.14, 0.06], [0.28, 0.9, 0.1, 0.04], [0, 1, 0, 0]];
    case "crater":
      // A wide apron rising to the rim, then a steeper fall inside to a floor a little above the plain.
      return [[1, -0.15, 0.04, 0], [0.8, 0.25, 0.05, 0.1], [0.67, 0.8, 0.04, 0.1], [0.6, 1, 0.04, 0.12], [0.54, 0.72, 0.04, 0.06], [0.42, 0.18, 0.05, 0.04], [0, 0.12, 0, 0]];
  }
}

/**
 * The landforms toward the horizon for a site: a handful, spread round it at different distances so nearer
 * ones stand in front of farther ones. Each is a faceted solid of its own, so the sun shades its sides
 * differently as the day goes and the camera sees round it as it orbits.
 */
function landforms(style: HorizonStyle, seed: number, rim: number, heightAt: (x: number, z: number) => number, color: number, soil: string | null = null): THREE.Mesh[] {
  // On a canyon's floor they stand short of its walls, a little smaller.
  const reach = style === "canyon" ? CANYON.floor : null;
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
    const at = start + ((k + 0.15 + rand() * 0.7) / kinds.length) * Math.PI * 2;
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
    const mesh = landform(shape, profile(kind, rand), noise2(seed + 211 + k * 31), heightAt, hazed(color, distance));
    // In a canyon, the mesas the walls wore back from show the same beds.
    if (reach && kind !== "dome" && kind !== "crater" && kind !== "massif") layered(mesh, soil, seed + k);
    mesh.name = "landform";
    return mesh;
  });
}

/** One landform: its profile turned round its middle, wandering by noise, sat on the ground and faceted. */
function landform(
  s: { x: number; z: number; radius: number; height: number; stretch: number; turn: number; lean: number[]; segments: number },
  prof: Profile,
  n: (x: number, y: number) => number,
  heightAt: (x: number, z: number) => number,
  color: number,
): THREE.Mesh {
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
  geo.setIndex(index);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  return new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
}

import { createEvents, type EventsState } from "./events";
import { fillAir, type AirState } from "./air";
import type { LandingKitName, SimConfig } from "./config";
import type { Drill } from "./digging";
import type { HoleFailure } from "./failure";
import { createEarth, type EarthState } from "./earth";
import { refreshEffects, type Effects } from "./effects";
import { createHappiness, updateHappiness, type Happiness } from "./happiness";
import { createLedger, type Ledger } from "./ledger";
import { createNotables, type Notable } from "./notables";
import { createOffice, type Office } from "./visits";
import type { Message } from "./messages";
import type { WeatherState } from "./weather";
import type { MaintenanceState } from "./condition";
import type { History } from "./history";
import type { Population, RoomStatus } from "./economy";
import { createHole } from "./geometry";
import { createLayout, placeRoom, type Layout } from "./placement";
import { openCells } from "./excavation";
import type { DepositKind } from "./mapgeo";
import { roomDef } from "./rooms";
import { galleryEdges, outsideEdges } from "./edges";
import { corridors, recomputeAccess, routeToRoom } from "./corridors";
import { culture, type Culture } from "./culture";
import { addAdults } from "./people";
import { createConstruction, type ConstructionState } from "./construction";
import { settleStorage } from "./storage";

/** Where a hole is on Mars, in degrees. */
export interface Site {
  lat: number;
  lon: number;
}

/** One hole's state. Every system that runs inside a hole works on this; the World holds several. */
export interface SimState {
  holeId: number;
  name: string;
  /** Null until the map exists (older saves) or before a site is chosen. */
  site: Site | null;
  /** What's in the ground here: digging yields it, and regional rooms need it. */
  deposits: DepositKind[];
  /** Goods loaded into the staging bay's seed kit so far. */
  kit: Record<string, number>;
  /** Milestones that unlock rooms: "children" (first birth), "elders" (first retirement). */
  unlocks?: string[];
  /** Extra room for resources, made by the console when it gives more than the hole could hold (testing). */
  consoleSpace?: Record<string, number>;
  /** The player asked the staging bay to gather a kit; it stops when the kit is full or leaves. */
  gatheringKit: boolean;
  tick: number;
  rngState: number;
  layout: Layout;
  drill: Drill;
  /** Stockpiles by resource id. Fractional amounts accumulate between ticks. */
  resources: Record<string, number>;
  /** Smoothed net change per game day, by resource id. */
  rates: Record<string, number>;
  population: Population;
  workforce: { total: number; employed: number };
  roomStatus: Record<number, RoomStatus>;
  earth: EarthState;
  /** Dust storms forecast or blowing (absent in older saves until the first tick). */
  weather?: WeatherState;
  /** Maintenance and cleaning services at work (absent in older saves until the first tick). */
  maintenance?: MaintenanceState;
  messages: Message[];
  /** Derived from the layout; recomputed only when layout.version changes. */
  effects: Effects;
  happiness: Happiness;
  notables: Notable[];
  office: Office;
  /** Enacted ordinance ids. */
  ordinances: string[];
  ledger: Ledger;
  /** What's waiting to be built, in order. */
  construction: ConstructionState;
  /** Culture sliders, -1 to +1 each; they drift toward a target daily. */
  culture: Culture;
  /** The hole that founded this one, if any. */
  parentHoleId: number | null;
  foundedTick: number;
  /** Resources and vital signs over time, for the charts (absent in older saves until the first sample). */
  history?: History;
  /** Events waiting for an answer, finds made, moods and festivals (PLAN-M14; absent in older saves until the first). */
  events?: EventsState;
  /** The living volume, cached (air.ts; absent in older saves until the first tick). */
  air?: AirState;
  /** The most people this hole has had (failure.ts; absent in older saves until the first tick). */
  peakPopulation?: number;
  /** When the hole last emptied, while it stays empty. */
  emptySince?: number;
  /** Set when the hole has failed: empty, with no one to let newcomers in (T-162). For good. */
  failed?: HoleFailure;
}

export interface HoleIdentity {
  holeId: number;
  name: string;
  site: Site | null;
  deposits: DepositKind[];
  /** Each hole has its own random stream, so holes never disturb each other's luck. */
  seed: number;
}

export function createInitialState(
  cfg: SimConfig,
  who: HoleIdentity = { holeId: 1, name: "Bradbury", site: null, deposits: [], seed: cfg.seed },
  kitName: LandingKitName = "bare",
): SimState {
  const kit = cfg.landingKits[kitName];
  const h = cfg.starterHole;
  const layout = createLayout(createHole(h.shaftRadiusM, h.floors, h.unlockedRings, cfg.geometry), cfg);
  // The landing crew has blasted out floor 1's first ring (and the kit's rooms); the rest is rock.
  for (let ring = 1; ring <= h.openRings; ring++) {
    openCells(layout, Array.from({ length: layout.hole.ringSlots[ring - 1]! }, (_, slot) => ({ floor: 1, ring, slot })));
  }

  for (const k of kit.surface) {
    must(placeRoom(layout, k.room, { kind: "surface", slot: k.slot }, cfg), k.room);
  }
  for (const k of kit.ring) {
    const [w, d] = cfg.shapes[roomDef(k.room).size as keyof SimConfig["shapes"]]![0]!;
    const placed = must(placeRoom(layout, k.room, { kind: "ring", floor: k.floor, ring: k.ring, slot: k.slot, w, d }, cfg), k.room);
    // The kit's rooms come with their space blasted out, wherever they stand.
    if (placed.ok) openCells(layout, placed.cells);
    const room = layout.rooms.find((r) => "id" in placed && r.id === placed.id);
    if (room && k.holds) room.holds = k.holds;
  }
  // Floor 1's gallery comes built, all the way round the shaft.
  for (const e of galleryEdges(layout.hole, 1)) layout.corridors[e.id] = corridors.gallery.id;
  recomputeAccess(layout);
  // Kit rooms nothing reaches (deeper than ring 2) get a corridor along their fronts, and
  // the shortest spoke carved out to it: one line in, rather than a spoke to each.
  for (const room of layout.rooms) {
    if (room.connected || room.at.kind !== "ring") continue;
    const ring = room.at.ring;
    for (const e of outsideEdges(layout.hole, room.cells)) if (e.kind === "arc" && e.circle === ring - 1) layout.corridors[e.id] = corridors.defaultFinish;
  }
  recomputeAccess(layout);
  for (const room of layout.rooms) {
    const path = room.connected ? [] : (routeToRoom(layout, room, cfg) ?? []);
    if (!path.length) continue;
    for (const id of path) layout.corridors[id] = corridors.defaultFinish;
    recomputeAccess(layout);
  }
  layout.version = 0;
  const state: SimState = {
    holeId: who.holeId,
    name: who.name,
    site: who.site,
    deposits: who.deposits,
    kit: {},
    gatheringKit: false,
    tick: 0,
    rngState: who.seed >>> 0,
    layout,
    drill: { active: true, progress: 0 },
    resources: { ...cfg.startingStock },
    rates: {},
    population: { count: 0, cohorts: [], health: 100, needsMet: {}, sanitation: 1 },
    workforce: { total: cfg.colonists.start, employed: 0 },
    roomStatus: {},
    earth: createEarth(cfg),
    messages: [],
    effects: refreshEffects(layout, null),
    happiness: createHappiness(),
    notables: [],
    office: createOffice(),
    ordinances: [],
    ledger: createLedger(),
    construction: createConstruction(),
    culture: { ...culture.start },
    parentHoleId: null,
    foundedTick: 0,
    events: createEvents(who.seed),
  };
  // The landing crew sealed the hole and made its air: O2 at the target, CO2 at the scrub floor.
  fillAir(state, cfg);
  addAdults(state, cfg.colonists.start, cfg); // the game starts with working adults only
  createNotables(state);
  updateHappiness(state, cfg, true);
  // The kit's dry goods are stowed in the pod.
  settleStorage(state);
  return state;
}

function must<T extends { ok: boolean; reason?: string }>(result: T, what: string): T {
  if (!result.ok) throw new Error(`landing kit: can't place ${what}: ${result.reason}`);
  return result;
}

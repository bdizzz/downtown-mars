import { setRoomWindows, shaftBorders } from "./windows";
import { refreshEffects } from "./effects";
import { createLedger } from "./ledger";
import { isRoomType, roomDef } from "./rooms";
import type { SimState } from "./state";
import { config, type SimConfig } from "./config";
import { depositsAt, generateMap, type MapState } from "./map";
import { network } from "./network";
import { culture } from "./culture";
import { addAdults } from "./people";
import { corridors, migrateCorridorRooms, recomputeAccess } from "./corridors";
import { galleryEdges } from "./edges";
import { ensureFloors, placeRoom, type Layout } from "./placement";
import { openCells } from "./excavation";
import type { World } from "./world";

// Saves are the whole world as JSON, minus what can be rebuilt (each hole's
// effect field). Bump the version whenever the shape changes, and add a
// migration from the previous version so old saves keep working.

export const SAVE_VERSION = 20;

type Raw = Record<string, unknown>;

/** MIGRATIONS[n] upgrades a version-n save's state to version n + 1. */
const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // v2 added the flow ledger (to what was then a single hole).
  1: (s) => ({ ...s, ledger: createLedger() }),
  // v3 put holes in a world; an old save becomes a world of one.
  2: (s) => ({
    tick: s.tick,
    holes: [{ ...s, holeId: 1, name: network.holeNames[0], site: null }],
    nextHoleId: 2,
  }),
  // v4 gave the world a seed and a map; older games get the default seed's map.
  3: (s) => ({ ...s, seed: config.seed, map: generateMap(config.seed) }),
  // v5 recorded what each hole sits on, and whether the map is open.
  4: (s) => {
    const map = s.map as MapState;
    const holes = (s.holes as Raw[]).map((h): Raw => ({ ...h, deposits: h.site ? depositsAt(map, h.site as { lat: number; lon: number }) : [] }));
    const pop = holes.reduce((n, h) => n + ((h.population as { count: number } | undefined)?.count ?? 0), 0);
    return { ...s, holes, mapUnlocked: pop >= network.mapUnlockPopulation };
  },
  // v6 added seed kits and founding convoys.
  5: (s) => ({ ...s, holes: (s.holes as Raw[]).map((h) => ({ ...h, kit: {} })), convoys: [] }),
  // v7 added rover trade routes.
  6: (s) => ({ ...s, routes: [], nextRouteId: 1 }),
  // v8 added culture and opinion.
  7: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => ({ ...h, culture: { ...culture.start }, parentHoleId: null, foundedTick: 0 })),
    relations: {},
  }),
  // v9: the staging bay gathers only when asked. Rooms gained optional pause and stop-at.
  8: (s) => ({ ...s, holes: (s.holes as Raw[]).map((h) => ({ ...h, gatheringKit: false })) }),
  // v10: colonists became cohorts. Everyone already there is a working adult; convoys carry adults.
  9: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const pop = h.population as { count: number };
      const hole = { ...h, population: { ...pop, count: 0, cohorts: [] } } as unknown as SimState;
      addAdults(hole, pop.count, config);
      return hole as unknown as Raw;
    }),
    convoys: ((s.convoys as Raw[] | undefined) ?? []).map((c) => ({
      ...c,
      people: [{ stage: "adult", count: c.volunteers, until: (c.arriveTick as number) + 120 * config.ticksPerDay }],
    })),
  }),
  // v11 added migration between holes.
  10: (s) => ({ ...s, migrations: [] }),
  // v12: corridors moved from rooms to the borders between cells.
  11: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const layout = h.layout as Layout;
      migrateCorridorRooms(layout);
      return { ...h, layout };
    }),
  }),
  // v13: construction time. What was already there is built.
  12: (s) => ({ ...s, holes: (s.holes as Raw[]).map((h) => ({ ...h, construction: { queue: [], nextJobId: 1 } })) }),
  // v14: dry goods live in storage rooms. What the hole could hold before now sits in the landing pod.
  13: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const layout = h.layout as Layout;
      const pod = layout.rooms.find((r) => r.type === "landing_pod");
      if (pod) {
        pod.allocation = { ...LEGACY_CAPACITY };
        pod.storageUnits = Object.values(LEGACY_CAPACITY).reduce((a, b) => a + b, 0);
      }
      return { ...h, layout };
    }),
  }),
  // v15: cells are rock until excavated. Old drills paid out every cell's rock already, but only the
  // cells under rooms are dug out; the rest stays rock. Their shafts still link every floor (no stairs
  // needed). They get an entrance in the first free ring-1 slot of floor 1, if there is one.
  14: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const layout = h.layout as Layout;
      delete layout.open;
      ensureFloors(layout);
      for (const r of layout.rooms) if (!r.planned) openCells(layout, [...r.cells, ...(r.pendingCells ?? [])]);
      layout.openShaft = true;
      const slot = layout.grid[0]?.[0]?.findIndex((id) => !id) ?? -1;
      if (slot >= 0 && !layout.rooms.some((r) => r.type === "entrance")) {
        const placed = placeRoom(layout, "entrance", { kind: "ring", floor: 1, ring: 1, slot, w: 1, d: 1 });
        if (placed.ok) openCells(layout, placed.cells);
      }
      return { ...h, layout };
    }),
  }),
  // v16: the gallery is built, like corridors. Every floor that had one gets it all the way round.
  15: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const layout = h.layout as Layout;
      layout.corridors ??= {};
      for (let f = 1; f <= layout.hole.floors; f++) for (const e of galleryEdges(layout.hole, f)) layout.corridors[e.id] ??= corridors.gallery.id;
      recomputeAccess(layout);
      return { ...h, layout };
    }),
  }),
  // v17: windows are an upgrade. Rooms keep the shaft windows they had: every private room's ring-1 face.
  16: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const layout = h.layout as Layout;
      for (const room of layout.rooms) {
        const def = roomDef(room.type);
        if (room.at.kind !== "ring" || def.public || def.excavationOnly) continue;
        const shaft = shaftBorders(layout, room);
        if (shaft.length) setRoomWindows(room, shaft, true);
      }
      return { ...h, layout };
    }),
  }),
  // v18: windows cost glass, and the landing kit brings some. Holes get the kit's glass, and the pod room for it.
  17: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const layout = h.layout as Layout;
      const kit = config.startingStock.glass ?? 0;
      const pod = layout.rooms.find((r) => r.type === "landing_pod");
      if (pod) {
        // A legacy pod has its own space: grow it by what glass takes.
        const room = Math.max(0, kit - (pod.allocation?.glass ?? 0));
        if (pod.storageUnits !== undefined) pod.storageUnits += room;
        pod.allocation = { ...(pod.allocation ?? {}), glass: Math.max(pod.allocation?.glass ?? 0, kit) };
      }
      const resources = h.resources as Record<string, number>;
      return { ...h, layout, resources: { ...resources, glass: Math.max(resources.glass ?? 0, kit) } };
    }),
  }),
  // v19: water is a loop (T-005). Black water became tailings; tanks hold clean water unless set otherwise.
  18: (s) => ({
    ...s,
    holes: (s.holes as Raw[]).map((h) => {
      const ledger = h.ledger as { current: Raw; days: Raw[] } | undefined;
      const history = h.history as { hourly: Raw; daily: Raw; acc: Raw } | undefined;
      return {
        ...h,
        resources: renameKey(h.resources as Raw, "blackWater", "tailings"),
        rates: renameKey((h.rates ?? {}) as Raw, "blackWater", "tailings"),
        ...(h.consoleSpace ? { consoleSpace: renameKey(h.consoleSpace as Raw, "blackWater", "tailings") } : {}),
        ...(ledger ? { ledger: { current: renameKey(ledger.current, "blackWater", "tailings"), days: ledger.days.map((d) => renameKey(d, "blackWater", "tailings")) } } : {}),
        ...(history
          ? { history: { ...history, hourly: renameKey(history.hourly, "blackWater", "tailings"), daily: renameKey(history.daily, "blackWater", "tailings"), acc: renameKey(history.acc, "blackWater", "tailings") } }
          : {}),
      };
    }),
  }),
  // v20: rooms have linings (material, finish, flooring). Absent means bare rock, which every old room is.
  19: (s) => s,
};

/** A copy of a record with one key renamed (a resource that changed its id). */
function renameKey(r: Raw, from: string, to: string): Raw {
  if (!(from in r)) return r;
  const { [from]: v, ...rest } = r;
  return { ...rest, [to]: v };
}

/** What a hole could hold of each dry good before storage rooms (save v13 and older). */
const LEGACY_CAPACITY: Record<string, number> = {meals:  30, rawFood:  200, rations:  200, soil:  100, rock:  400, ore:  300, silica:  300, brick:  200, marscrete:  200, metal:  200, machinery:  50, wafers:  100, electronics:  50};

export interface SaveSummary {
  day: number;
  /** Everyone, in every hole. */
  population: number;
  /** Deepest hole. */
  floors: number;
  holes: number;
}

type StoredHole = Omit<SimState, "effects">;
interface SaveFile {
  game: "downtown-mars";
  version: number;
  state: Omit<World, "holes"> & { holes: StoredHole[] };
}

export function summarize(world: World, cfg: SimConfig): SaveSummary {
  return {
    day: Math.floor(world.tick / cfg.ticksPerDay) + 1,
    population: world.holes.reduce((n, h) => n + h.population.count, 0),
    floors: Math.max(...world.holes.map((h) => h.layout.hole.floors)),
    holes: world.holes.length,
  };
}

export function serialize(world: World): string {
  const holes = world.holes.map(({ effects: _, ...rest }) => rest);
  const file: SaveFile = { game: "downtown-mars", version: SAVE_VERSION, state: { ...world, holes } };
  return JSON.stringify(file);
}

export type LoadResult = { ok: true; world: World } | { ok: false; reason: string };

export function deserialize(json: string): LoadResult {
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(json) as Partial<SaveFile>;
  } catch {
    return { ok: false, reason: "That file isn't a save: it isn't valid JSON." };
  }
  if (file.game !== "downtown-mars" || !file.state) return { ok: false, reason: "That file isn't a Downtown Mars save." };
  let version = file.version ?? 0;
  let raw = file.state as unknown as Raw;
  while (version < SAVE_VERSION && MIGRATIONS[version]) raw = MIGRATIONS[version++]!(raw);
  if (version !== SAVE_VERSION) {
    return { ok: false, reason: `That save is from a different version (save v${file.version}, game v${SAVE_VERSION}).` };
  }
  const state = raw as unknown as SaveFile["state"];
  for (const hole of state.holes ?? []) {
    const unknown = hole.layout?.rooms.find((r) => !isRoomType(r.type));
    if (unknown) return { ok: false, reason: `That save has a room this version doesn't know: "${unknown.type}".` };
  }
  const holes = state.holes.map((h) => ({ ...h, effects: refreshEffects(h.layout, null) }) as SimState);
  return { ok: true, world: { ...state, holes } };
}

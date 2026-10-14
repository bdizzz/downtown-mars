import { config } from "../sim/config";
import { amenityFelt, reachOf } from "../sim/amenities";
import { holding, mainOutput, roomSpec } from "../sim/economy";
import { effectName, effectOnRoom, FIELD_TYPES } from "../sim/effects";
import { crowdedAir } from "../sim/happiness";
import { network } from "../sim/network";
import { canLine, liningOf, liningText, MATERIALS, refitPlan, refitRefusal, type Finish, type Material } from "../sim/materials";
import type { RoomInstance } from "../sim/placement";
import { roomName } from "../sim/roomName";
import { roomDef } from "../sim/rooms";
import { allows, contentsOf, spaceOf, STORABLE, usedSpace } from "../sim/storage";
import type { Snapshot } from "../sim/snapshot";
import { glazedWalls, sunlight, windowComfort, type Across } from "../sim/windows";
import { dining, hoursText, num, ordinal, resName, signed } from "../ui/format";
import { reachSteps, reachTints } from "./reachView";

// What the room panel says about a room, as rows of text: shared by the web's inspector
// (ui/Inspector.tsx) and the Godot viewer's (bridge/inspect.ts), so both say the same.

/** A line of the panel: an optional label (dimmed), its text, and whether it's a warning. */
export interface Row {
  k?: string;
  text: string;
  warn?: boolean;
}

type Room = Snapshot["layout"]["rooms"][number];

const flows = (label: string, f: Record<string, number>): Row | null => {
  const entries = Object.entries(f).filter(([, v]) => v > 0);
  return entries.length ? { k: label, text: entries.map(([id, v]) => `${resName(id)} ${num(v)}`).join(", ") } : null;
};

/** A service's or amenity's reach on foot: the homes within it (tinted on the map when no overlay is on). */
export function reachesRow(s: Snapshot, room: Room): Row | null {
  const tints = reachTints(s.layout, room.id);
  if (!tints) return null;
  const within = tints.filter((t) => t.steps !== null).sort((a, b) => a.steps! - b.steps!);
  const names = within.length ? `: ${within.slice(0, 4).map((t) => `${roomName(t.room)} ${Math.max(1, Math.round(t.steps!))}`).join(", ")}${within.length > 4 ? "…" : ""}` : "";
  return { k: "Reaches", text: `${within.length} of ${tints.length} ${tints.length === 1 ? "home" : "homes"} within ${reachSteps(room.type)} steps${names}` };
}

/** The hole's restroom coverage, for a restroom's panel. */
function sanitation(s: Snapshot): string {
  const v = s.population.sanitation ?? 1;
  return v >= 0.98 ? "everyone has one" : `${Math.round((1 - v) * 100)}% of people have none within reach`;
}

/** Clinic, school and elder-care places within reach of a home. */
export function careRow(s: Snapshot, room: Room): Row | null {
  const c = s.population.care?.byHome[room.id];
  if (!c) return null;
  const part = (name: string, v: number, who: number) => (who <= 0 ? null : v >= 0.98 ? `${name} ✓` : `${name} ${Math.round(v * 100)}%`);
  const items = [part("clinic", c.care, 1), part("school", c.school, s.care.school.who), part("elder care", c.elders, s.care.elders.who)].filter(Boolean);
  const short = c.care < 0.98 || (s.care.school.who > 0 && c.school < 0.98) || (s.care.elders.who > 0 && c.elders < 0.98);
  return { k: "Within reach", text: items.join(" · "), warn: short };
}

/** What a home's people can walk to: seats at a galley or canteen, care, and the amenities in reach. */
export function withinReachRows(s: Snapshot, room: Room): Row[] {
  const seated = s.population.servedByHome?.[room.id];
  const felt = amenityFelt(s, room);
  const rows: Row[] = [];
  if (seated !== undefined) rows.push({ k: "Meals", text: seated >= 0.98 ? "a seat for everyone within reach" : `${Math.round(seated * 100)}% seated within reach; the rest eat on the go`, warn: seated < 0.98 });
  const wc = s.population.sanitationByHome?.[room.id];
  if (roomDef(room.type).ownBathroom) rows.push({ k: "Restroom", text: "its own bathroom" });
  else if (wc !== undefined)
    rows.push({
      k: "Restroom",
      text:
        wc >= 0.98
          ? "a place for everyone within reach"
          : `${Math.round((1 - wc) * 100)}% without one within ${reachOf("restroom")} steps: comfort ${signed(-(1 - wc) * config.happiness.noRestroomComfort)}`,
      warn: wc < 0.98,
    });
  const care = careRow(s, room);
  if (care) rows.push(care);
  rows.push({
    k: "On foot",
    text: felt.from.length
      ? felt.from.map((f) => `${roomDef(f.type).name} ${Math.max(1, Math.round(f.steps))} steps (${[f.comfort ? `comfort ${signed(f.comfort)}` : "", f.health ? `health ${signed(f.health)}` : ""].filter(Boolean).join(", ")})`).join(" · ")
      : "no park, plaza, gym or restroom in reach",
  });
  return rows;
}

const ACROSS: Record<Across, string> = { shaft: "the shaft", corridor: "a corridor", public: "a walk-through room" };

/** A room's windows: what they look out on, and (a home) the comfort they give. None until the player puts them in. */
export function windowsRow(s: Snapshot, room: Room): Row | null {
  const walls = glazedWalls(s.layout, room);
  const home = !!roomDef(room.type).houses;
  if (!walls.length) return home ? { k: "Windows", text: "none yet: add them with Build → Corridors → Windows, on a wall facing the shaft, a corridor or a plaza" } : null;
  const onto = [...new Set(walls.map((w) => ACROSS[w.across]))].join(", ");
  const sun = sunlight(s.layout, room, config) > 0 ? ", and the sun gets in" : "";
  return { k: "Windows", text: `onto ${onto}${home ? `: ${signed(windowComfort(s.layout, room, config))} comfort` : ""}${sun}` };
}

/** The neighbours' effects felt in the room. */
export function feltRow(s: Snapshot, room: Room): Row {
  const felt = FIELD_TYPES.map((t) => [t, effectOnRoom(s.effects, t, room)] as const).filter(([, v]) => Math.abs(v) >= 0.05);
  return { k: "Felt here", text: felt.length ? felt.map(([t, v]) => `${effectName(t)} ${signed(v)}`).join(", ") : "nothing" };
}

/** A home's residents and their happiness, and what it's made of. */
export function homeRows(s: Snapshot, roomId: number, capacity: number): Row[] {
  const pool = s.happiness.pools.find((p) => p.roomId === roomId);
  if (!pool) return [{ k: "Houses", text: String(capacity) }];
  const f = pool.factors;
  const trend = pool.target > pool.happiness + 1 ? " ↑" : pool.target < pool.happiness - 1 ? " ↓" : "";
  return [
    { k: "Residents", text: `${pool.residents} / ${capacity}` },
    { k: "Happiness", text: `${Math.round(pool.happiness)}${trend} (heading for ${Math.round(pool.target)})`, warn: pool.happiness < 50 },
    { k: "Noise", text: `${signed(f.noise)} · Comfort ${signed(f.comfort)} · Health ${signed(f.health)}` },
  ];
}

/** A room (or its next floor, or its refit) waiting in the construction queue: progress, place, time left, whether it can move up, and (a refit) be called off. */
export function constructionInfo(s: Snapshot, roomId: number): { jobId: number; progress: number; text: string; canPrioritize: boolean; canCancel: boolean } | null {
  const index = s.construction.jobs.findIndex((j) => j.roomId === roomId);
  const job = s.construction.jobs[index];
  if (!job) return null;
  const lead = job.kind === "extend" ? "Another floor: " : job.kind === "upgrade" ? `${job.lead} ${job.note}: ` : "";
  const text = `${lead}${job.phase === "excavating" ? "Excavating · " : ""}${Math.round(job.progress * 100)}% · ${ordinal(index + 1)} in the queue · ${job.hoursLeft === null ? "waits for its floor to be dug" : `done in about ${hoursText(job.hoursLeft)}`}`;
  return { jobId: job.id, progress: job.progress, text, canPrioritize: index > 0, canCancel: job.kind === "upgrade" };
}

/** A lining a room could be refitted in: what it gives, costs and takes, and why it can't be ordered (null when it can). */
export interface RefitOption {
  material: Material;
  finish: Finish;
  name: string;
  text: string;
  refusal: string | null;
}

/** The linings a built room could be refitted in (every one but its own), or null if it can't have one. */
export function refitOptions(s: Snapshot, room: RoomInstance): RefitOption[] | null {
  if (!canLine(room) || room.planned || room.building) return null;
  const queued = s.construction.jobs.find((j) => j.roomId === room.id && j.to);
  const own = liningOf(room);
  // Whole amounts as they are ("brick 16", "6 h"), not "16.0".
  const amount = (v: number) => (Number.isInteger(v) ? String(v) : num(v));
  return MATERIALS.walls
    .filter((w) => w !== own)
    .map((w) => {
      const plan = refitPlan(room, w)!;
      const pay = Object.entries(plan.cost).map(([r, v]) => `${resName(r).toLowerCase()} ${amount(v)}`);
      const back = Object.entries(plan.salvage).map(([r, v]) => `${resName(r).toLowerCase()} ${amount(v)}`);
      const price = [pay.length ? pay.join(", ") : "free", back.length ? `salvages ${back.join(", ")}` : ""].filter(Boolean).join(", ");
      const fitting = queued?.to?.material === w.material && queued.to.finish === w.finish;
      return {
        material: w.material,
        finish: w.finish,
        name: w.name,
        text: `${liningText({ ...room, material: w.material, finish: w.finish })} · ${price} · ${amount(plan.work)} h of work`,
        refusal: fitting ? "being fitted now" : refitRefusal(room, plan, s.resources, queued?.paid),
      };
    });
}

/** Who's repairing a room, or where it is in the maintenance queue ("" when neither). */
export function conditionNote(s: Snapshot, roomId: number, repairing?: { done: number; work: number }): string {
  const lane = s.maintenance.lanes.find((l) => l.target === roomId);
  const place = s.maintenance.queue.findIndex((q) => q.roomId === roomId);
  return lane
    ? `${lane.kind === "all" ? "🛠 Being repaired" : "🧽 Being cleaned"}: ${Math.round((lane.progress ?? 0) * 100)}% done`
    : place >= 0
      ? `In the maintenance queue: ${place === 0 ? "next" : ordinal(place + 1)}${repairing ? ", part repaired" : ""}`
      : "";
}

/** The seed kit at a staging bay: how far along, what's in it, the button's label (null when it's ready), and a note. */
export function seedKitInfo(s: Snapshot): { progress: number; goods: string; button: string | null; note: string } {
  const goods = Object.entries(network.seedKit.goods)
    .map(([id, want]) => `${resName(id)} ${num(s.kit.loaded[id] ?? 0)}/${want}`)
    .join(" · ");
  const button = s.kit.progress < 0.999 ? (s.kit.gathering ? "Stop gathering" : s.kit.progress > 0 ? "Resume gathering" : "Gather a seed kit") : null;
  const note = s.kit.gathering
    ? "The bay's crew is moving goods into the kit, never leaving less than a reserve in store."
    : s.kit.progress >= 0.999
      ? `Ready. Pick a site on the map (M) and send ${network.seedKit.volunteers} volunteers to found a new hole.`
      : "The bay stands idle, its crew free for other work, until you ask for a kit.";
  return { progress: s.kit.progress, goods, button, note };
}

/**
 * The panel's rows after its controls at the top (construction, condition, storage, connect): staff and
 * flows (`before`), then (after the seed kit, if any) what it does for the hole and what reaches it (`after`).
 */
export function panelRows(s: Snapshot, room: RoomInstance): { before: Row[]; after: Row[] } {
  const def = roomDef(room.type);
  const spec = roomSpec(room, config);
  const st = s.roomStatus[room.id];
  const before: (Row | null)[] = [
    spec.staff > 0 ? { k: "Staff", text: `${st?.staff ?? 0} / ${spec.staff}` } : null,
    flows("Uses/month", spec.uses),
    flows("Makes/month", spec.makes),
    flows("Scrubs/month", spec.scrubs),
    flows("Stores", spec.stores),
  ];
  const after: (Row | null)[] = [
    ...(def.houses ? homeRows(s, room.id, def.houses) : []),
    def.teaches
      ? { k: "Teaches", text: `up to ${def.teaches} children · ${s.care.school.who} in the hole, ${s.care.school.missing > 0 ? `${num(s.care.school.missing)} without a place` : "all with a place"}` }
      : null,
    def.rests ? { k: "Rests", text: `up to ${def.rests} · ${s.rest.interred} laid to rest here, ${s.rest.space} places left` } : null,
    def.caresForElders
      ? { k: "Cares for", text: `up to ${def.caresForElders} elders · ${s.care.elders.who} in the hole, ${s.care.elders.missing > 0 ? `${num(s.care.elders.missing)} without care` : "all cared for"}` }
      : null,
    spec.sanitation > 0 ? { k: "Restroom for", text: `${num(spec.sanitation)} people from homes within ${def.reach ?? 0} steps · ${sanitation(s)}` } : null,
    spec.serves > 0 ? { k: "Seats", text: `${num(spec.serves)} diners · ${dining(s)}` } : null,
    canLine(room) ? { k: "Walls", text: liningText(room) } : null,
    room.at.kind === "ring" && !def.public ? windowsRow(s, room) : null,
    def.houses && crowdedAir(s, room) < -0.01 ? { k: "Crowded", text: `air ${signed(crowdedAir(s, room))}: more than ${config.effects.crowding.perCell} to a cell gets stuffy`, warn: true } : null,
    ...(def.houses ? withinReachRows(s, room) : []),
    reachesRow(s, room),
    room.at.kind === "ring" ? feltRow(s, room) : null,
  ];
  const keep = (rows: (Row | null)[]) => rows.filter((r): r is Row => !!r);
  return { before: keep(before), after: keep(after) };
}

/** Stop at: the output a room can stand by on, and a suggested level (a little over what's in store). */
export function stopAtInfo(s: Snapshot, room: RoomInstance): { resource: string; suggested: number } | null {
  const out = mainOutput(room, config);
  if (!out) return null;
  return { resource: out, suggested: Math.max(10, Math.round(((s.resources[out] ?? 0) + 20) / 10) * 10) };
}

/** Does this room carry the hole-wide tank fill slider? Electrolyzers, and gas tanks holding O2. */
export function fillsTanks(room: RoomInstance): boolean {
  return !!roomDef(room.type).topsUpAir || holding(room) === "o2Tank";
}

/** Colours for the goods in a storage room's bar, by their place in the list of storable goods. */
const GOOD_COLORS = ["#c9a46a", "#8fb86a", "#d9825b", "#7fa3c4", "#b98fc9", "#d8c070", "#9c8a6a", "#6fb3a6", "#c97a8a", "#a3a3a3"];

export function goodColor(id: string): string {
  const i = STORABLE.indexOf(id);
  return GOOD_COLORS[(i < 0 ? 0 : i) % GOOD_COLORS.length]!;
}

export interface StorageInfo {
  space: number;
  used: number;
  summary: string;
  /** Every storable good, whether the room allows it, and how much of it the room holds. */
  goods: { id: string; name: string; allowed: boolean; stored: number; color: string }[];
  /** What's in the room now, largest first, for the bar. */
  segments: { id: string; name: string; units: number; color: string }[];
}

/** A storage room's panel: what it holds and the goods it allows (shared by the web's and Godot's). */
export function storageInfo(room: RoomInstance): StorageInfo | null {
  const space = spaceOf(room);
  if (!space) return null;
  const used = usedSpace(room);
  const contents = contentsOf(room);
  const goods = STORABLE.map((id) => ({ id, name: resName(id), allowed: allows(room, id), stored: contents[id] ?? 0, color: goodColor(id) }));
  const count = goods.filter((g) => g.allowed).length;
  const what = count === goods.length ? "allows everything" : count === 0 ? "allows nothing" : `allows ${count} of ${goods.length} goods`;
  const segments = goods.filter((g) => g.stored >= 0.5).map((g) => ({ id: g.id, name: g.name, units: g.stored, color: g.color }));
  segments.sort((a, b) => b.units - a.units);
  return { space, used, summary: `${num(used)} of ${space} full · ${what}`, goods, segments };
}

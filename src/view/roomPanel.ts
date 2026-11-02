import { config } from "../sim/config";
import { amenityFelt, reachOf } from "../sim/amenities";
import { holding, mainOutput, roomSpec } from "../sim/economy";
import { effectName, effectOnRoom, FIELD_TYPES } from "../sim/effects";
import { DIAGNOSIS } from "../sim/diagnosis";
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
import { CONDITION, hasCondition } from "../sim/condition";
import { isIcon, type IconId } from "./icons";
import { reachSteps, reachTints } from "./reachView";
import { roomState, roomTone, statusWord, type Tone } from "./roomState";

// What the room panel says about a room: shared by the web's inspector (ui/Inspector.tsx) and the
// Godot viewer's (bridge/inspect.ts), so both say the same. `panelModel` is the whole panel as data
// (status, headline, alerts, glance, sections: docs/PLAN-M18.md §7); `panelRows` the flat rows.

/** A meter from 0 to max (condition, staff), and a signed one from −range to +range (noise −1.6 of 3). */
export interface Meter {
  value: number;
  max: number;
}
export interface Signed {
  value: number;
  range: number;
}

/**
 * A line of the panel: an optional label (dimmed), its text (short: the label, icon and tone carry the rest),
 * whether it's a warning, and the longer version as a tooltip where there's more to say. A row of resources
 * (uses, makes) also has them as chips, which the viewers draw instead of the text.
 */
export interface Row {
  k?: string;
  text: string;
  warn?: boolean;
  icon?: IconId;
  tone?: Tone;
  signed?: Signed;
  tip?: string;
  chips?: Chip[];
}

export type SectionId = "work" | "home" | "serves" | "surroundings" | "building" | "kit" | "storage";

/** An icon and a short value, with what it is (its label) and maybe a meter, a tone and a longer tip. */
export interface Chip {
  icon: IconId;
  value: string;
  label: string;
  tone?: Tone;
  meter?: Meter;
  signed?: Signed;
  tip?: string;
  section?: SectionId;
}

/** A warning raised to the top of the panel, naming the section it comes from. */
export interface Alert {
  text: string;
  tone: "warn" | "bad";
  section: SectionId;
  action?: "connect";
  /** The row's longer version, when it has one. */
  tip?: string;
}

export interface Section {
  id: SectionId;
  title: string;
  icon: IconId;
  open: boolean;
  rows: Row[];
  chips?: Chip[];
}

export interface PanelModel {
  status: { text: string; tone: Tone; tip: string };
  headline: Chip[];
  alerts: Alert[];
  glance: Chip[];
  sections: Section[];
}

type Room = Snapshot["layout"]["rooms"][number];

/** A resource as a chip: its icon (machinery for one without its own) and amount. */
const resourceChip = (id: string, v: number): Chip => ({ icon: isIcon(id) ? id : "machinery", value: num(v), label: resName(id) });

const flows = (label: string, f: Record<string, number>): Row | null => {
  const entries = Object.entries(f).filter(([, v]) => v > 0);
  return entries.length ? { k: label, text: entries.map(([id, v]) => `${resName(id)} ${num(v)}`).join(", "), chips: entries.map(([id, v]) => resourceChip(id, v)) } : null;
};

/** A service's or amenity's reach on foot: the homes within it (tinted on the map when no overlay is on). */
export function reachesRow(s: Snapshot, room: Room): Row | null {
  const tints = reachTints(s.layout, room.id);
  if (!tints) return null;
  const within = tints.filter((t) => t.steps !== null).sort((a, b) => a.steps! - b.steps!);
  const names = within.map((t) => `${roomName(t.room)} ${Math.max(1, Math.round(t.steps!))} steps`).join(", ");
  return { k: "Reaches", text: `${within.length} of ${tints.length} ${tints.length === 1 ? "home" : "homes"} within ${reachSteps(room.type)} steps`, ...(names ? { tip: names } : {}) };
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
  if (seated !== undefined)
    rows.push(
      seated >= 0.98
        ? { k: "Meals", text: "a seat for everyone", warn: false }
        : { k: "Meals", text: `${Math.round(seated * 100)}% seated`, tip: `${Math.round(seated * 100)}% have a seat at a galley or canteen within reach; the rest eat on the go`, warn: true },
    );
  const wc = s.population.sanitationByHome?.[room.id];
  if (roomDef(room.type).ownBathroom) rows.push({ k: "Restroom", text: "its own bathroom" });
  else if (wc !== undefined)
    rows.push(
      wc >= 0.98
        ? { k: "Restroom", text: "a place for everyone", warn: false }
        : {
            k: "Restroom",
            text: `${Math.round((1 - wc) * 100)}% without one`,
            tip: `${Math.round((1 - wc) * 100)}% without one within ${reachOf("restroom")} steps: comfort ${signed(-(1 - wc) * config.happiness.noRestroomComfort)}`,
            warn: true,
          },
    );
  const care = careRow(s, room);
  if (care) rows.push(care);
  const steps = (f: (typeof felt.from)[number]) => `${roomDef(f.type).name} ${Math.max(1, Math.round(f.steps))}`;
  rows.push(
    felt.from.length
      ? {
          k: "On foot",
          text: `${felt.from.slice(0, 3).map(steps).join(", ")}${felt.from.length > 3 ? "…" : ""} steps`,
          tip: felt.from.map((f) => `${steps(f)} steps (${[f.comfort ? `comfort ${signed(f.comfort)}` : "", f.health ? `wellbeing ${signed(f.health)}` : ""].filter(Boolean).join(", ")})`).join(" · "),
        }
      : { k: "On foot", text: "nothing in reach", tip: "No park, plaza, gym or restroom within walking distance" },
  );
  return rows;
}

const ACROSS: Record<Across, string> = { shaft: "the shaft", corridor: "a corridor", public: "a walk-through room" };

/** A room's windows: what they look out on, and (a home) the comfort they give. None until the player puts them in. */
export function windowsRow(s: Snapshot, room: Room): Row | null {
  const walls = glazedWalls(s.layout, room);
  const home = !!roomDef(room.type).houses;
  if (!walls.length) return home ? { k: "Windows", text: "none yet", tip: "Add them with Build → Corridors → Windows, on a wall facing the shaft, a corridor or a plaza" } : null;
  const onto = [...new Set(walls.map((w) => ACROSS[w.across]))].join(", ");
  const sun = sunlight(s.layout, room, config) > 0 ? ", and the sun gets in" : "";
  return { k: "Windows", text: `onto ${onto}${home ? `: ${signed(windowComfort(s.layout, room, config))} comfort` : ""}${sun}` };
}

/** The neighbours' effects felt in the room. */
export function feltRow(s: Snapshot, room: Room): Row {
  const felt = FIELD_TYPES.map((t) => [t, effectOnRoom(s.effects, t, room)] as const).filter(([, v]) => Math.abs(v) >= 0.05);
  return { k: "Felt here", text: felt.length ? felt.map(([t, v]) => `${effectName(t)} ${signed(v)}`).join(", ") : "nothing" };
}

/** Where a room is, for telling rooms of a kind apart in a list: "floor 2, ring 3". */
export function placeText(room: RoomInstance): string {
  return room.at.kind === "ring" ? `floor ${room.at.floor}, ring ${room.at.ring}` : "on the surface";
}

/** The rooms behind one neighbour effect in a home, biggest first: "Smelter −0.8, Pump −0.2" (F-018). */
export function sourcesText(s: Snapshot, homeId: number, field: string, shown = 3): string {
  const list = (s.diagnosis.sources[homeId] ?? []).filter((x) => x.type === field && x.from !== homeId);
  const named = list.slice(0, shown).map((x) => {
    const room = s.layout.rooms.find((r) => r.id === x.from);
    return `${room ? roomName(room) : "a room"} ${signed(x.value)}`;
  });
  return named.length ? `${named.join(", ")}${list.length > shown ? "…" : ""}` : "";
}

/**
 * A home's noise, comfort and wellbeing, each broken into its parts in the factor's own units (its share of
 * the happiness points over the factor's weight, so they add up to the factor as felt), and the rooms behind
 * the neighbour effects: "Comfort +0.5 = view +1, no galley seat −1, neighbours −0.3 (Farm −0.3)".
 */
export function factorRows(s: Snapshot, roomId: number): Row[] {
  const pool = s.happiness.pools.find((p) => p.roomId === roomId);
  if (!pool) return [];
  const rows: Row[] = [];
  for (const factor of ["noise", "comfort", "health"] as const) {
    const total = pool.factors[factor];
    const weight = config.happiness.weights[factor] || 1;
    const parts = Object.entries(pool.points ?? {})
      .map(([id, pts]) => ({ id, def: DIAGNOSIS.happiness[id], v: pts / weight }))
      .filter((p) => p.def?.factor === factor && Math.abs(p.v) >= 0.05)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    // Noise has one part, its neighbours: just name them.
    const named = parts.length === 1 && parts[0]!.id === "noise";
    const full = parts.map(({ id, def, v }) => {
      const from = def!.field ? sourcesText(s, roomId, def!.field) : "";
      return named ? from : `${def!.label ?? id} ${signed(v)}${from ? ` (${from})` : ""}`;
    });
    // The row says the biggest two parts; the tooltip all of them, with the rooms behind each.
    const short = named ? [sourcesText(s, roomId, parts[0]!.def!.field!, 2)] : parts.slice(0, 2).map(({ id, def, v }) => `${def!.label ?? id} ${signed(v)}`);
    const sum = (list: string[], more = false) => (Math.abs(total) < 0.05 && !parts.length ? "none" : `${signed(total)}${list.length && list[0] ? ` = ${list.join(", ")}${more ? "…" : ""}` : ""}`);
    const text = sum(short, !named && parts.length > 2);
    const tip = sum(full);
    rows.push({ k: DIAGNOSIS.factors[factor] ?? factor, text, ...(tip !== text ? { tip } : {}), warn: total <= -1 });
  }
  return rows;
}

/** A home's residents and their happiness, and what it's made of. */
export function homeRows(s: Snapshot, roomId: number, capacity: number): Row[] {
  const pool = s.happiness.pools.find((p) => p.roomId === roomId);
  if (!pool) return [{ k: "Houses", text: String(capacity) }];
  const trend = pool.target > pool.happiness + 1 ? " ↑" : pool.target < pool.happiness - 1 ? " ↓" : "";
  return [
    { k: "Residents", text: `${pool.residents} / ${capacity}` },
    { k: "Happiness", text: `${Math.round(pool.happiness)}${trend}${trend ? `, heading for ${Math.round(pool.target)}` : ", steady"}`, warn: pool.happiness < 50 },
    ...factorRows(s, roomId),
  ];
}

/** The least a room's effect must be felt in a home for it to count as bothering (or lifting) it. */
const FELT_FROM = 0.1;

/** Who a room's neighbour effects reach (F-018): "noise felt in 3 homes, smell reaches 4 homes"; the bad first, then the good. */
export function feltByRows(s: Snapshot, roomId: number): Row[] {
  const bad = new Map<string, number>();
  const good = new Map<string, number>();
  for (const [home, list] of Object.entries(s.diagnosis.sources)) {
    if (Number(home) === roomId) continue;
    for (const x of list) {
      if (x.from !== roomId || Math.abs(x.value) < FELT_FROM) continue;
      // Good air, wellbeing and comfort lift; noise and smell are only ever a bother.
      const into = x.value < 0 ? bad : good;
      into.set(x.type, (into.get(x.type) ?? 0) + 1);
    }
  }
  const homes = (n: number) => `${n} ${n === 1 ? "home" : "homes"}`;
  const say = (t: string, n: number) => (t === "smell" || t === "airQuality" ? `${t === "smell" ? "smell" : "stale air"} reaches ${homes(n)}` : `${effectName(t)} felt in ${homes(n)}`);
  const rows: Row[] = [];
  if (bad.size) rows.push({ k: "Bothers", text: [...bad].map(([t, n]) => say(t, n)).join(", "), warn: true });
  if (good.size) rows.push({ k: "Lifts", text: [...good].map(([t, n]) => `${t === "airQuality" ? "fresher air" : effectName(t)} in ${homes(n)}`).join(", ") });
  return rows;
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

/** A row of the panel, where today's flat list puts it (before or after the seed kit) and the section it belongs in. */
interface Entry {
  part: "before" | "after";
  section: SectionId;
  row: Row;
}

/** Each row label's icon, where it has one. */
const ROW_ICONS: Record<string, IconId> = {
  Staff: "workers",
  Residents: "colonists",
  Houses: "colonists",
  Happiness: "happiness",
  Noise: "noise",
  Comfort: "comfort",
  Wellbeing: "health",
  Teaches: "school",
  "Cares for": "clinic",
  "Restroom for": "restroom",
  Restroom: "restroom",
  Seats: "seat",
  Meals: "meals",
  Walls: "walls",
  Windows: "window",
  Crowded: "air",
  "Within reach": "clinic",
  "On foot": "reach",
  Reaches: "reach",
  "Felt here": "smell",
  Bothers: "alert",
};

/** Every row of the panel, in the order today's flat list has them, each tagged with its section. */
function panelEntries(s: Snapshot, room: RoomInstance): Entry[] {
  const def = roomDef(room.type);
  const spec = roomSpec(room, config);
  const st = s.roomStatus[room.id];
  const ring = room.at.kind === "ring";
  const tagged = (part: Entry["part"], section: SectionId, rows: (Row | null)[]): Entry[] => rows.filter((r): r is Row => !!r).map((row) => ({ part, section, row }));
  const entries = [
    ...tagged("before", "work", [
      spec.staff > 0 ? { k: "Staff", text: `${st?.staff ?? 0} / ${spec.staff}` } : null,
      flows("Uses/month", spec.uses),
      flows("Makes/month", spec.makes),
      flows("Scrubs/month", spec.scrubs),
      flows("Stores", spec.stores),
    ]),
    ...tagged("after", "home", def.houses ? homeRows(s, room.id, def.houses) : []),
    ...tagged("after", "serves", [
      def.teaches
        ? { k: "Teaches", text: `up to ${def.teaches} children`, tip: `${s.care.school.who} children in the hole, ${s.care.school.missing > 0 ? `${num(s.care.school.missing)} without a place` : "all with a place"}` }
        : null,
      def.rests ? { k: "Rests", text: `up to ${def.rests}`, tip: `${s.rest.interred} laid to rest here, ${s.rest.space} places left` } : null,
      def.caresForElders
        ? { k: "Cares for", text: `up to ${def.caresForElders} elders`, tip: `${s.care.elders.who} elders in the hole, ${s.care.elders.missing > 0 ? `${num(s.care.elders.missing)} without care` : "all cared for"}` }
        : null,
      spec.sanitation > 0 ? { k: "Restroom for", text: `${num(spec.sanitation)} people within ${def.reach ?? 0} steps`, tip: `Across the hole, ${sanitation(s)}` } : null,
      spec.serves > 0 ? { k: "Seats", text: `${num(spec.serves)} diners`, tip: `Across the hole: ${dining(s)}` } : null,
    ]),
    ...tagged("after", "building", [canLine(room) ? { k: "Walls", text: liningText(room) } : null]),
    ...tagged("after", "surroundings", [
      ring && !def.public ? windowsRow(s, room) : null,
      def.houses && crowdedAir(s, room) < -0.01
        ? { k: "Crowded", text: `air ${signed(crowdedAir(s, room))}`, tip: `More than ${config.effects.crowding.perCell} people to a cell gets stuffy`, warn: true }
        : null,
    ]),
    ...tagged("after", "home", def.houses ? withinReachRows(s, room) : []),
    ...tagged("after", "serves", [reachesRow(s, room)]),
    ...tagged("after", "surroundings", [ring ? feltRow(s, room) : null, ...(ring ? feltByRows(s, room.id) : [])]),
  ];
  for (const { row } of entries) {
    const icon = row.k ? ROW_ICONS[row.k] : undefined;
    if (icon) row.icon = icon;
    if (row.warn) row.tone = "warn";
  }
  return entries;
}

/**
 * The panel's rows after its controls at the top (construction, condition, storage, connect): staff and
 * flows (`before`), then (after the seed kit, if any) what it does for the hole and what reaches it (`after`).
 * The same rows `panelModel` sorts into sections, in the order the viewers draw them today.
 */
export function panelRows(s: Snapshot, room: RoomInstance): { before: Row[]; after: Row[] } {
  const entries = panelEntries(s, room);
  const part = (p: Entry["part"]) => entries.filter((e) => e.part === p).map((e) => e.row);
  return { before: part("before"), after: part("after") };
}

/** Each section's title and icon, in the order the panel shows them. */
const SECTIONS: Record<SectionId, { title: string; icon: IconId }> = {
  work: { title: "Work", icon: "workers" },
  home: { title: "Home", icon: "colonists" },
  serves: { title: "Serves", icon: "reach" },
  surroundings: { title: "Surroundings", icon: "air" },
  building: { title: "Building", icon: "walls" },
  kit: { title: "Seed kit", icon: "crate" },
  storage: { title: "Storage", icon: "crate" },
};

/** The neighbour effects as felt (and a home's factors) run −3..+3. */
const FELT_RANGE = 3;
const FELT_ICONS: Record<string, IconId> = { noise: "noise", smell: "smell", health: "health", comfort: "comfort", airQuality: "air" };

const signedTone = (v: number): Tone => (v <= -1 ? "bad" : v < -0.05 ? "warn" : v >= 0.05 ? "good" : "idle");
const shareChip = (icon: IconId, label: string, v: number, section: SectionId): Chip => ({
  icon,
  label,
  value: v >= 0.98 ? "✓" : `${Math.round(v * 100)}%`,
  tone: v >= 0.98 ? "good" : "warn",
  meter: { value: v, max: 1 },
  section,
});

/** The room's few numbers that matter most: staff and main output, a home's residents and happiness, a store's fill. */
function headlineChips(s: Snapshot, room: RoomInstance): Chip[] {
  const def = roomDef(room.type);
  const spec = roomSpec(room, config);
  const chips: Chip[] = [];
  if (def.houses) {
    const pool = s.happiness.pools.find((p) => p.roomId === room.id);
    const residents = pool?.residents ?? 0;
    chips.push({ icon: "colonists", label: "Residents", value: `${residents}/${def.houses}`, meter: { value: residents, max: def.houses }, section: "home" });
    if (pool) {
      const trend = pool.target > pool.happiness + 1 ? " ↑" : pool.target < pool.happiness - 1 ? " ↓" : "";
      chips.push({
        icon: "happiness",
        label: "Happiness",
        value: `${Math.round(pool.happiness)}${trend}`,
        tone: pool.happiness < 50 ? "bad" : "good",
        meter: { value: pool.happiness, max: 100 },
        tip: `Heading for ${Math.round(pool.target)}`,
        section: "home",
      });
    }
    return chips;
  }
  if (spec.staff > 0) {
    const staff = s.roomStatus[room.id]?.staff ?? 0;
    chips.push({ icon: "workers", label: "Staff", value: `${staff}/${spec.staff}`, ...(staff < spec.staff ? { tone: "warn" as const } : {}), meter: { value: staff, max: spec.staff }, section: "work" });
  }
  const out = mainOutput(room, config);
  if (out) chips.push({ icon: isIcon(out) ? out : "machinery", label: resName(out), value: `${num(spec.makes[out] ?? 0)}/mo`, section: "work" });
  const store = storageInfo(room);
  if (store) chips.push({ icon: "crate", label: "Storage", value: `${num(store.used)}/${store.space}`, meter: { value: store.used, max: store.space }, section: "storage" });
  else if (!out) {
    // A tank: what it holds, and how much.
    const held = Object.entries(spec.stores).find(([, v]) => v > 0);
    if (held) chips.push({ icon: isIcon(held[0]) ? held[0] : "crate", label: resName(held[0]), value: num(held[1]), tip: `Stores ${num(held[1])} ${resName(held[0]).toLowerCase()}`, section: "work" });
  }
  return chips;
}

/** The at-a-glance band: condition, what's felt here (a home: its factors, meals and restroom), and a service's reach. */
function glanceChips(s: Snapshot, room: RoomInstance): Chip[] {
  const def = roomDef(room.type);
  const chips: Chip[] = [];
  if (!room.planned && !room.building && hasCondition(room)) {
    const v = room.condition ?? 1;
    const note = conditionNote(s, room.id, room.repair);
    chips.push({
      icon: "condition",
      label: "Condition",
      value: `${Math.round(v * 100)}%`,
      tone: v <= 0 ? "bad" : v < CONDITION.wornBelow ? "warn" : "good",
      meter: { value: v, max: 1 },
      ...(note ? { tip: note } : {}),
      section: "building",
    });
  }
  const pool = def.houses ? s.happiness.pools.find((p) => p.roomId === room.id) : undefined;
  if (pool) {
    // Each factor's breakdown, with the rooms behind it, as its tooltip.
    const parts = new Map(factorRows(s, room.id).map((r) => [r.k, r.tip ?? r.text]));
    for (const f of ["comfort", "noise", "health"] as const) {
      const v = pool.factors[f];
      const label = DIAGNOSIS.factors[f] ?? f;
      const tip = parts.get(label);
      chips.push({ icon: FELT_ICONS[f]!, label, value: Math.abs(v) < 0.05 ? "0" : signed(v), tone: signedTone(v), signed: { value: v, range: FELT_RANGE }, ...(tip ? { tip } : {}), section: "home" });
    }
    const seated = s.population.servedByHome?.[room.id];
    if (seated !== undefined) chips.push(shareChip("meals", "Meals", seated, "home"));
    const wc = s.population.sanitationByHome?.[room.id];
    if (!def.ownBathroom && wc !== undefined) chips.push(shareChip("restroom", "Restroom", wc, "home"));
  } else if (room.at.kind === "ring") {
    for (const t of FIELD_TYPES) {
      const v = effectOnRoom(s.effects, t, room);
      if (Math.abs(v) < 0.05) continue;
      chips.push({ icon: FELT_ICONS[t] ?? "air", label: effectName(t), value: signed(v), tone: signedTone(v), signed: { value: v, range: FELT_RANGE }, section: "surroundings" });
    }
  }
  const tints = reachTints(s.layout, room.id);
  if (tints) {
    const within = tints.filter((t) => t.steps !== null).length;
    chips.push({ icon: "reach", label: "Reach", value: `${within}/${tints.length} homes`, meter: { value: within, max: tints.length }, section: "serves" });
  }
  return chips;
}

/** A section with no rows still shows when it holds the room's controls (crop, priority, construction, demolish, the kit, storage). */
function hasControls(id: SectionId, room: RoomInstance, queued: boolean): boolean {
  const def = roomDef(room.type);
  if (id === "work") return roomSpec(room, config).staff > 0 || !!def.growsCrops || !!holding(room) || fillsTanks(room);
  if (id === "building") return !!def.buildable || canLine(room) || queued;
  if (id === "kit") return !!def.stagesSeedKit;
  if (id === "storage") return !!storageInfo(room);
  return false;
}

/** Is a section open before the player opens or closes it? Its kind of room's own, and any holding a warning. */
function openByDefault(id: SectionId, room: RoomInstance, rows: Row[], queued: boolean): boolean {
  const def = roomDef(room.type);
  if (rows.some((r) => r.warn)) return true;
  if (id === "work") return roomSpec(room, config).staff > 0;
  if (id === "home") return !!def.houses;
  if (id === "serves") return !def.houses;
  // A blueprint, or a room (or its refit) in the construction queue.
  if (id === "building") return room.planned || !!room.building || queued;
  return id === "kit" || id === "storage";
}

/** The whole room panel as data (docs/PLAN-M18.md §7), for both viewers to draw. */
export function panelModel(s: Snapshot, room: RoomInstance): PanelModel {
  const st = s.roomStatus[room.id];
  const entries = panelEntries(s, room);
  const job = room.building ? s.construction.jobs.find((j) => j.roomId === room.id) : undefined;
  const tone = roomTone(room, st);
  const status = { text: statusWord(room, st, job?.progress), tone, tip: roomState(s.layout, room, st) };

  const queued = !!constructionInfo(s, room.id);
  const sections: Section[] = (Object.keys(SECTIONS) as SectionId[])
    .map((id) => ({ id, rows: entries.filter((e) => e.section === id).map((e) => e.row) }))
    .filter(({ id, rows }) => rows.length > 0 || hasControls(id, room, queued))
    .map(({ id, rows }) => ({ id, ...SECTIONS[id], open: openByDefault(id, room, rows, queued), rows }));

  // The room's own state first (cut off, short of an input, slowed), then every warning row.
  const alerts: Alert[] = [];
  if (!room.planned && !room.building && !room.connected) alerts.push({ text: status.tip, tone: "bad", section: "building", ...(room.at.kind === "ring" ? { action: "connect" as const } : {}) });
  else if (tone === "bad" || tone === "warn") alerts.push({ text: status.tip, tone, section: "work" });
  for (const { section, row } of entries) if (row.warn) alerts.push({ text: row.k ? `${row.k}: ${row.text}` : row.text, tone: "warn", section, ...(row.tip ? { tip: row.tip } : {}) });

  return { status, headline: headlineChips(s, room), alerts, glance: glanceChips(s, room), sections };
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

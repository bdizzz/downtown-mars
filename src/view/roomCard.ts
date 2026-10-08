import { config } from "../sim/config";
import { roomWork } from "../sim/construction";
import { resourceDef } from "../sim/resources";
import type { EffectDef, RoomDef } from "../sim/rooms";
import { num, resName, signed } from "../ui/format";

// The room card: everything a player needs to decide where a room goes, before placing it. Shared by
// the web's build palette (ui/RoomCard.tsx) and the Godot viewer's (through the bridge's palette).

export const SIZE_NAMES: Record<string, string> = { S: "Small", M: "Medium", L: "Large", H: "Huge", surface: "Surface" };

/** A line of the card, and its tone: dimmed (k), a plus (good), a minus (bad), or plain. */
export interface CardLine {
  text: string;
  tone?: "k" | "good" | "bad";
}

export interface CardContent {
  name: string;
  /** "Medium", and for a surface room how many slots it takes; the ring rooms' shape is added by whoever shows it. */
  size: string;
  surface: boolean;
  /** Each cost, and whether the stocks are short of it. */
  cost: { text: string; short: boolean }[];
  lines: CardLine[];
}

function effectText(e: EffectDef): string {
  const name = e.type === "airQuality" ? "Air quality" : e.type[0]!.toUpperCase() + e.type.slice(1);
  const v = `${e.strength > 0 ? "+" : "−"}${Math.abs(e.strength)}`;
  if (e.residentsOnly) return `${name} ${v} for its own residents`;
  if (e.radius === 0) return `${name} ${v} in the room`;
  return `${name} ${v}, fading over ${e.radius} ${e.radius === 1 ? "step" : "steps"}`;
}

const flows = (r: Record<string, number>) =>
  Object.entries(r)
    .map(([id, v]) => `${resName(id)} ${num(v)}`)
    .join(", ");

/** The card for a room: its size, cost, and what it takes, makes and does to its neighbours. */
export function roomCard(def: RoomDef, resources: Record<string, number>, siteNote?: string | null): CardContent {
  const lines: (CardLine | null)[] = [
    { text: `Takes ${roomWork(def.id)} work-hours to build`, tone: "k" },
    def.storage ? { text: `Stores ${def.storage} units of goods, shared among those you choose`, tone: "good" } : null,
    def.constructionBandwidth ? { text: `Adds ${def.constructionBandwidth} to construction bandwidth at full staff`, tone: "good" } : null,
    def.staff > 0 ? { text: `Staff ${def.staff}` } : null,
    Object.keys(def.uses).length > 0 ? { text: `Uses ${flows(def.uses)} a month` } : null,
    Object.keys(def.makes).length > 0 ? { text: `Makes ${flows(def.makes)} a month` } : null,
    def.stores ? { text: `Stores ${flows(def.stores)}` } : null,
    def.houses ? { text: `Houses ${def.houses}` } : null,
    def.houses ? { text: `Windows (an upgrade): up to ${signed(config.windows.view.shaft)} comfort looking out over the shaft, less onto a plaza or a corridor`, tone: "good" } : null,
    def.sanitation ? { text: `Restroom for ${def.sanitation} people from homes within ${def.reach ?? 0} steps; without one, comfort suffers` } : null,
    def.ownBathroom ? { text: "Has its own bathroom: no restroom needed", tone: "good" } : null,
    def.cares ? { text: `Care for ${def.cares}` } : null,
    def.serves ? { text: `Seats ${def.serves} diners${def.reach ? ` from homes within ${def.reach} steps` : ""}${def.makes.meals ? "" : " (meals cooked elsewhere)"}` } : null,
    def.amenity
      ? {
          text: `${[def.amenity.comfort ? `Comfort ${signed(def.amenity.comfort)}` : "", def.amenity.health ? `Health ${signed(def.amenity.health)}` : ""].filter(Boolean).join(", ")} for homes within ${def.amenity.reach} steps on foot, less further off (the nearest of each kind counts)`,
          tone: "good",
        }
      : null,
    !def.serves && def.makes.meals ? { text: "Cooks but seats no one: pair it with a canteen", tone: "k" } : null,
    def.ordinanceSlots ? { text: `${def.ordinanceSlots} ordinance slots` } : null,
    ...def.effects.map((e): CardLine => ({ text: effectText(e), tone: e.strength < 0 ? "bad" : "good" })),
    siteNote ? { text: `${siteNote}.`, tone: "bad" } : null,
    (def.floors ?? 1) > 1 ? { text: `Spans ${def.floors} floors, linking them` } : null,
    def.public
      ? { text: "Walk-through: its sides count as corridors, so neighbours open onto it", tone: "good" }
      : def.size !== "surface"
        ? { text: "Needs a gallery tube, a corridor or a plaza along one side.", tone: "k" }
        : null,
  ];
  return {
    name: def.name,
    size: `${SIZE_NAMES[def.size]}${def.size === "surface" && def.surfaceSlots ? ` · ${def.surfaceSlots} surface ${def.surfaceSlots === 1 ? "slot" : "slots"}` : ""}`,
    surface: def.size === "surface",
    cost: Object.keys(def.cost).length ? Object.entries(def.cost).map(([id, amt]) => ({ text: `${resourceDef(id).name} ${amt}`, short: (resources[id] ?? 0) < amt })) : [{ text: "Free", short: false }],
    lines: lines.filter((l): l is CardLine => !!l),
  };
}

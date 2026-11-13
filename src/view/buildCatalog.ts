import { config } from "../sim/config";
import { roomFamilies, type RoomDef } from "../sim/rooms";
import type { IconId } from "./icons";

// The build palette's catalogue, shared by the web's Build strip (ui/BuildPalette.tsx) and the
// Godot viewer's (src/bridge/build.ts): room hotkeys, the categories in order with their names,
// and each room's shapes.

/**
 * Keyboard shortcuts for the build tools, live only in Build mode (so they're
 * free for other things elsewhere). R rotates, X demolishes, Z draws corridors,
 * and Space pauses; V, C and M always open View, Charts and Map. B opens Build
 * from anywhere, and inside it is the battery bank's.
 */
export const HOTKEYS: Record<string, string> = {
  bunk_dorm: "D",
  galley: "G",
  farm: "F",
  composter: "J",
  water_tank: "T",
  water_recycler: "Y",
  restroom: "W",
  life_support: "L",
  clinic: "K",
  school: "E",
  elder_care: "Q",
  admin_office: "A",
  battery_bank: "B",
  solar_array: "S",
  landing_pad: "P",
  deep_well_pump: "U",
  smelter: "O",
  machine_shop: "H",
  silicon_refinery: "I",
  electronics_fab: "N",
};
export const DEMOLISH_KEY = "X";
export const CORRIDOR_KEY = "Z";

export const CATEGORY_ORDER = ["circulation", "excavation", "construction", "services", "storage", "public", "housing", "food", "water", "air", "power", "health", "admin", "industry", "logistics"];
export const CATEGORY_NAMES: Record<string, string> = {
  circulation: "Access",
  excavation: "Excavation",
  public: "Public",
  construction: "Construction",
  services: "Services",
  storage: "Storage",
  housing: "Housing",
  food: "Food",
  water: "Water",
  air: "Air",
  power: "Power",
  health: "Health",
  admin: "Admin",
  industry: "Industry",
  logistics: "Logistics",
};

export function shapesFor(def: RoomDef): [number, number][] {
  if (def.size === "surface") return [[1, 1]];
  return config.shapes[def.size] ?? [[1, 1]];
}

// ---- The web's build rail: a few groups down the left edge, each a short list of tiles ----

/** A group on the build rail: several categories under one icon, so there are seven things to scan, not fifteen. */
export interface BuildGroup {
  id: string;
  name: string;
  icon: IconId;
  categories: string[];
}

export const BUILD_GROUPS: BuildGroup[] = [
  { id: "access", name: "Access", icon: "stairs", categories: ["circulation", "excavation"] },
  { id: "homes", name: "Homes", icon: "home", categories: ["housing"] },
  { id: "food", name: "Food & water", icon: "rawFood", categories: ["food", "water"] },
  { id: "air", name: "Air & power", icon: "power", categories: ["air", "power"] },
  { id: "community", name: "Community", icon: "community", categories: ["public", "health", "admin"] },
  { id: "industry", name: "Industry", icon: "machinery", categories: ["industry", "construction", "services"] },
  { id: "storage", name: "Storage", icon: "crate", categories: ["storage", "logistics"] },
];

/** The group a category sits in. */
export const groupOf = (category: string): BuildGroup | undefined => BUILD_GROUPS.find((g) => g.categories.includes(category));

/** One tile in a group's list: a room, or a family of them (sizes or grades of one thing) behind one tile. */
export interface BuildTile {
  /** The family's id, or the room's own. */
  id: string;
  name: string;
  category: string;
  /** The rooms behind it, smallest or plainest first; one for a room with no family. */
  members: RoomDef[];
}

/** The rooms as tiles, in the catalog's order: a family's tile sits where its first member does. */
export function buildTiles(defs: readonly RoomDef[]): BuildTile[] {
  const tiles: BuildTile[] = [];
  for (const def of defs) {
    const family = def.family;
    const tile = family ? tiles.find((t) => t.id === family) : undefined;
    if (tile) tile.members.push(def);
    else tiles.push({ id: family ?? def.id, name: family ? (roomFamilies[family] ?? def.name) : def.name, category: def.category, members: [def] });
  }
  // A family with one member showing (the guided tutorial, say) is just that room.
  return tiles.map((t) => (t.members.length === 1 ? { ...t, name: t.members[0]!.name } : t));
}

/** A family member's label in the picker: its size's letter when the family is sizes of one thing, else its short name. */
export function variantLabel(tile: BuildTile, def: RoomDef): string {
  const sizes = new Set(tile.members.map((m) => m.size));
  return sizes.size === tile.members.length ? def.size : def.short;
}

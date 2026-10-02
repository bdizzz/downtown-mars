import { config } from "../sim/config";
import type { RoomDef } from "../sim/rooms";

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

import rawCrops from "../../data/crops.json";
import rawResources from "../../data/resources.json";

export interface ResourceDef {
  id: string;
  name: string;
  group: string;
  baseCapacity: number;
  /** A byproduct: full storage never slows the room making it. */
  waste?: boolean;
  /** Used as it's made; only batteries carry it between ticks. */
  flow?: boolean;
  /** Wastewater with nowhere to go: rooms whose used water turns into it stall when it's full (gray water). */
  backsUp?: boolean;
}

export interface CropDef {
  id: string;
  name: string;
  /** What a farm growing it calls itself ("Potato farm"). */
  farmName: string;
  group: "staple" | "protein" | "produce";
  yield: number;
  water: number;
  power: number;
}

export const resourceDefs: ResourceDef[] = rawResources.resources as ResourceDef[];
export const cropDefs: CropDef[] = rawCrops.crops as CropDef[];

const resById = new Map(resourceDefs.map((r) => [r.id, r]));
const cropById = new Map(cropDefs.map((c) => [c.id, c]));

export function resourceDef(id: string): ResourceDef {
  const def = resById.get(id);
  if (!def) throw new Error(`unknown resource "${id}"`);
  return def;
}

export function cropDef(id: string): CropDef {
  const def = cropById.get(id);
  if (!def) throw new Error(`unknown crop "${id}"`);
  return def;
}

export function isCrop(id: string): boolean {
  return cropById.has(id);
}

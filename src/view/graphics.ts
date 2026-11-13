// Graphics settings for the 3D view: how much of each effect to draw, so a
// laptop can scale them down. Presets set everything at once; changing one
// effect makes the settings "custom". Amounts run from 0 (off) to 1 (full).

/**
 * Where the better, Blender-made furniture (#357, public/models/fp.bin) is drawn (#391):
 * `basic` never (the chunky code-built shapes everywhere, and fp.bin is never fetched),
 * `firstPerson` only when walking, `everywhere` in every view (the default).
 */
export type FurnitureDetail = "basic" | "firstPerson" | "everywhere";

export const FURNITURE_DETAILS: { id: FurnitureDetail; name: string; hint: string }[] = [
  { id: "basic", name: "Simple shapes", hint: "Chunky shapes everywhere; the lightest, and nothing extra to download" },
  { id: "firstPerson", name: "Detailed on foot", hint: "Detailed furniture only when you walk a room; simple shapes from above" },
  { id: "everywhere", name: "Detailed everywhere", hint: "Detailed furniture in every view; the nicest, and the heaviest" },
];

export const DEFAULT_FURNITURE: FurnitureDetail = "everywhere";

export function isFurnitureDetail(v: unknown): v is FurnitureDetail {
  return v === "basic" || v === "firstPerson" || v === "everywhere";
}

/** One step lighter: everywhere, then on foot, then simple shapes; null when already the lightest. */
export function lighterFurniture(f: FurnitureDetail): FurnitureDetail | null {
  return f === "everywhere" ? "firstPerson" : f === "firstPerson" ? "basic" : null;
}

/** Does this furniture setting draw the detailed models in this view (walking or not)? */
export function drawsDetailedFurniture(f: FurnitureDetail, walking: boolean): boolean {
  return f === "everywhere" || (f === "firstPerson" && walking);
}

export interface Graphics {
  /** Detailed furniture models: never, on foot only, or everywhere. Not part of the presets: it's its own choice. */
  furniture: FurnitureDetail;
  /** The most screen pixels per CSS pixel to render (capped by the display's own). */
  pixelRatio: 1 | 1.5 | 2;
  /** Colonists walking the galleries, and dust in the air. */
  life: boolean;
  /** Metal, glass and screens reflect a soft studio light. */
  reflections: boolean;
  /** Ambient occlusion: soft shade where things meet (corners, under furniture). */
  ao: number;
  /** Glow around bright things: windows, lamps, screens, furnaces. */
  bloom: number;
  /** Warm dusty haze that thickens with distance and depth. */
  haze: number;
  /** In Free view, a depth of field: the floor in view sharp, nearer and farther things blurred, so the hole looks like a miniature. */
  tiltShift: number;
  /** The final warm colour grade and vignette. */
  grade: number;
  /** Lamps, fires and grow lights light the rooms around them: their pools on the floor, and the nearest few properly. */
  lamps: number;
  /** Shadows: the sun's, down the shaft and on the surface (sharper at full). */
  shadows: number;
}

export type Preset = "low" | "medium" | "high";

/** What a preset sets: everything but the furniture choice, which stays as the player chose it. */
export type PresetSettings = Omit<Graphics, "furniture">;

export const GRAPHICS_PRESETS: Record<Preset, PresetSettings> = {
  low: { pixelRatio: 1, life: false, reflections: false, ao: 0, bloom: 0, haze: 0, tiltShift: 0, grade: 0, lamps: 0, shadows: 0 },
  medium: { pixelRatio: 1.5, life: true, reflections: true, ao: 0, bloom: 0.6, haze: 0.8, tiltShift: 0.3, grade: 0.8, lamps: 0.5, shadows: 0.5 },
  high: { pixelRatio: 2, life: true, reflections: true, ao: 0.8, bloom: 0.8, haze: 1, tiltShift: 0.4, grade: 1, lamps: 1, shadows: 1 },
};

export const PRESET_NAMES: { id: Preset; name: string; hint: string }[] = [
  { id: "low", name: "Low", hint: "No effects, for slower machines" },
  { id: "medium", name: "Medium", hint: "Glow, haze and colour, for most laptops" },
  { id: "high", name: "High", hint: "Everything, at full sharpness" },
];

export const DEFAULT_GRAPHICS: Graphics = { ...GRAPHICS_PRESETS.high, furniture: DEFAULT_FURNITURE };

/** The next preset down, or null from the lowest. */
export function lowerPreset(p: Preset | "custom"): Preset | null {
  return p === "high" || p === "custom" ? "medium" : p === "medium" ? "low" : null;
}

/** Which preset these settings match, or "custom". */
export function presetOf(g: PresetSettings): Preset | "custom" {
  const keys = Object.keys(GRAPHICS_PRESETS.high) as (keyof PresetSettings)[];
  return (Object.keys(GRAPHICS_PRESETS) as Preset[]).find((p) => keys.every((k) => GRAPHICS_PRESETS[p][k] === g[k])) ?? "custom";
}

/** Does anything need drawing after the scene (so the post-processing chain runs)? */
export function hasPostEffects(g: PresetSettings): boolean {
  return g.ao > 0 || g.bloom > 0 || g.haze > 0 || g.tiltShift > 0 || g.grade > 0;
}

/** Settings read from storage, filled out and clamped, so an old or hand-edited save can't break the view. */
export function cleanGraphics(raw: Partial<Graphics> | undefined): Graphics {
  const g = { ...DEFAULT_GRAPHICS, ...(raw ?? {}) };
  const amount = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
  return {
    furniture: isFurnitureDetail(g.furniture) ? g.furniture : DEFAULT_FURNITURE,
    pixelRatio: g.pixelRatio === 1 || g.pixelRatio === 1.5 || g.pixelRatio === 2 ? g.pixelRatio : DEFAULT_GRAPHICS.pixelRatio,
    life: typeof g.life === "boolean" ? g.life : DEFAULT_GRAPHICS.life,
    reflections: typeof g.reflections === "boolean" ? g.reflections : DEFAULT_GRAPHICS.reflections,
    ao: amount(g.ao, DEFAULT_GRAPHICS.ao),
    bloom: amount(g.bloom, DEFAULT_GRAPHICS.bloom),
    haze: amount(g.haze, DEFAULT_GRAPHICS.haze),
    tiltShift: amount(g.tiltShift, DEFAULT_GRAPHICS.tiltShift),
    grade: amount(g.grade, DEFAULT_GRAPHICS.grade),
    lamps: amount(g.lamps, DEFAULT_GRAPHICS.lamps),
    shadows: amount(g.shadows, DEFAULT_GRAPHICS.shadows),
  };
}

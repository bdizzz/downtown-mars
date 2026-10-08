import raw from "../../data/settings.json";

// The settings as one table (data/settings.json): which section each sits in,
// its name, a one-line hint and its control. The settings screen draws from it;
// Godot reads the same file. Adding a setting is a row here plus its binding in
// SettingsView.

export type SectionId = "game" | "display" | "sound" | "controls" | "access";

export interface SettingRow {
  id: string;
  section: SectionId;
  name: string;
  hint: string;
  control: "toggle" | "slider" | "select" | "button";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number; name: string }[];
  default?: boolean | number;
  /** Shown in one of the two only. */
  only?: "web" | "godot";
}

export const SECTIONS = raw.sections as { id: SectionId; name: string }[];

/** The web's rows, in the table's order. */
export const SETTING_ROWS = (raw.settings as SettingRow[]).filter((r) => r.only !== "godot");

export function rowsIn(section: SectionId): SettingRow[] {
  return SETTING_ROWS.filter((r) => r.section === section);
}

/** A plain setting's default, from the table (a missing one is a mistake in the table). */
export function defaultOf(id: string, type: "boolean"): boolean;
export function defaultOf(id: string, type: "number"): number;
export function defaultOf(id: string, type: "boolean" | "number"): boolean | number {
  const d = SETTING_ROWS.find((r) => r.id === id)?.default;
  if (typeof d !== type) throw new Error(`data/settings.json: ${id} needs a ${type} default`);
  return d!;
}

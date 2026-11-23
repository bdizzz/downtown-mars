import raw from "../../data/settings.json";
import { canHideSystemBar } from "./systemBar";
import { isDevBuild } from "./devBuild";

// The settings as one table (data/settings.json): which section each sits in,
// its name, a one-line hint and its control. The settings screen draws from it;
// Godot reads the same file. Adding a setting is a row here plus its binding in
// SettingsView.

export type SectionId = "game" | "display" | "sound" | "controls" | "access";

export interface SettingRow {
  id: string;
  section: SectionId;
  /** A sub-header inside the section (#587), drawn where it changes from the row before. */
  group?: string;
  name: string;
  hint: string;
  /** `panel`: a panel of the web's own (the frame rate), placed by its row. */
  control: "toggle" | "slider" | "select" | "button" | "panel";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number; name: string }[];
  default?: boolean | number;
  /** Shown in one of the two only. */
  only?: "web" | "godot";
  /** Shown only where it applies (see WHEN). */
  when?: keyof typeof WHEN;
}

/** Rows that apply only on some devices. */
const WHEN = {
  installedAndroid: canHideSystemBar,
  devBuild: isDevBuild,
};

export const SECTIONS = raw.sections as { id: SectionId; name: string }[];

/** The web's rows, in the table's order. */
export const SETTING_ROWS = (raw.settings as SettingRow[]).filter((r) => r.only !== "godot");

/** A section's rows in runs under their sub-headers (#587); rows with no group run under none. */
export function groupsIn(section: SectionId): { group: string | undefined; rows: SettingRow[] }[] {
  const runs: { group: string | undefined; rows: SettingRow[] }[] = [];
  for (const r of rowsIn(section)) {
    const last = runs[runs.length - 1];
    if (last && last.group === r.group) last.rows.push(r);
    else runs.push({ group: r.group, rows: [r] });
  }
  return runs;
}

export function rowsIn(section: SectionId): SettingRow[] {
  return SETTING_ROWS.filter((r) => r.section === section && (!r.when || WHEN[r.when]()));
}

/** A plain setting's default, from the table (a missing one is a mistake in the table). */
export function defaultOf(id: string, type: "boolean"): boolean;
export function defaultOf(id: string, type: "number"): number;
export function defaultOf(id: string, type: "boolean" | "number"): boolean | number {
  const d = SETTING_ROWS.find((r) => r.id === id)?.default;
  if (typeof d !== type) throw new Error(`data/settings.json: ${id} needs a ${type} default`);
  return d!;
}

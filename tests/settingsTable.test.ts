import { describe, expect, it } from "vitest";
import raw from "../data/settings.json";
import { DEFAULT_SETTINGS } from "../src/ui/settings";
import { SECTIONS, SETTING_ROWS } from "../src/ui/settingsTable";
import { DEFAULT_GRAPHICS, FURNITURE_DETAILS } from "../src/view/graphics";

describe("the settings table", () => {
  const all = raw.settings as { id: string; section: string; control: string; options?: unknown[]; only?: string; min?: number; max?: number; step?: number }[];

  it("puts every row in a known section, with a unique id", () => {
    const sections = new Set(SECTIONS.map((s) => s.id));
    for (const r of all) expect(sections.has(r.section as never), r.id).toBe(true);
    // Godot and the web may each have a row of their own under one name, but not two of one id.
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
  });

  it("gives every web row something to change", () => {
    for (const r of SETTING_ROWS) {
      // The preset, the tutorial (kept by App), buttons and panels are bound by hand in SettingsView.
      if (r.control === "button" || r.control === "panel" || r.id === "graphics.preset" || r.id === "tutorial") continue;
      if (r.id.startsWith("graphics.")) expect(r.id.slice(9) in DEFAULT_GRAPHICS, r.id).toBe(true);
      else expect(r.id in DEFAULT_SETTINGS, r.id).toBe(true);
    }
  });

  it("gives sliders a range and plain selects their options", () => {
    for (const r of all) {
      if (r.control === "slider") expect([r.min, r.max, r.step].every((v) => typeof v === "number"), r.id).toBe(true);
      if (r.control === "select" && !["graphics.preset", "graphics.quality"].includes(r.id)) expect(r.options?.length, r.id).toBeGreaterThan(0);
    }
  });

  it("keeps each sub-header's rows together, Display opening on the frame rate and closing on the look (#587)", () => {
    for (const s of SECTIONS) {
      const groups = SETTING_ROWS.filter((r) => r.section === s.id).map((r) => r.group);
      const runs = groups.filter((g, i) => g !== groups[i - 1]);
      expect(new Set(runs).size, s.id).toBe(runs.length);
    }
    const display = SETTING_ROWS.filter((r) => r.section === "display");
    expect(display[0]!.id).toBe("fps");
    expect(display.slice(-2).map((r) => r.id)).toEqual(["graphics.style", "graphics.styleTuning"]);
    expect(display.at(-1)!.group).toBe("Visual style");
    for (const id of ["celsius", "graphics.keepSurface"]) expect(SETTING_ROWS.find((r) => r.id === id)!.section).toBe("game");
  });

  it("lists the furniture choices as the web names them, in the same order (Godot reads the table)", () => {
    const row = all.find((r) => r.id === "graphics.furniture") as unknown as { options: { value: number; name: string }[]; only?: string };
    expect(row.only).toBeUndefined(); // both viewers have it
    expect(row.options.map((o) => o.value)).toEqual([0, 1, 2]);
    expect(row.options.map((o) => o.name)).toEqual(FURNITURE_DETAILS.map((f) => f.name));
  });

  it("takes the plain defaults from the table", () => {
    expect(DEFAULT_SETTINGS.volume).toBe(0.6);
    expect(DEFAULT_SETTINGS.autosave).toBe(true);
    expect(DEFAULT_SETTINGS.uiScale).toBe(1);
  });
});

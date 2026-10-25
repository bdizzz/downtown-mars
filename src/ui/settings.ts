import { useCallback, useEffect, useState } from "react";
import { cleanGraphics, DEFAULT_GRAPHICS, GRAPHICS_PRESETS, type Graphics } from "../view/graphics";
import { clampCutAngle, DEFAULT_VIEW3D, isCamera, type View3d } from "../view/cameras";
import { storageKey } from "./storageKey";
import { defaultOf } from "./settingsTable";

// Player preferences, kept in browser storage. Reading or writing storage
// can fail (private windows, blocked storage); the game then just uses the
// defaults for this session.

export type ViewMode = "2d" | "plan" | "3d";
export const VIEW_MODES: { id: ViewMode; name: string; hint: string }[] = [
  { id: "2d", name: "Unrolled", hint: "Every floor, the ring unrolled flat" },
  { id: "plan", name: "Plan", hint: "One floor from above, rings around the shaft" },
  { id: "3d", name: "3D", hint: "The hole as a real cylinder" },
];

export interface Settings {
  /** Master volume; the three below are buses under it (src/audio/sound.ts). */
  volume: number;
  music: number;
  effects: number;
  ambience: number;
  /** 1 = normal. */
  uiScale: number;
  /** Orange/blue instead of red/green in overlays. */
  colorBlind: boolean;
  autosave: boolean;
  /** The deputy's one-time tips when a problem first shows up (F-018). */
  tips: boolean;
  /** Pointing at a floor in the floor picker shows it before you click. */
  floorHoverPreview: boolean;
  /** First person: how fast the mouse turns the head, 1 = normal (WALK in stage3d.ts, the same in Godot). */
  lookSpeed: number;
  /** The installed app on Android: hide the system bar (systemBar.ts). */
  fullscreen: boolean;
  /** Which view the player last used: the unrolled wall, one floor from above, or 3D. */
  view: ViewMode;
  /** 3D graphics: sharpness, ambient life, and how much of each effect. */
  graphics: Graphics;
  /** The 3D camera, walls down and the overlays, as last used. */
  view3d: View3d;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: defaultOf("volume", "number"),
  music: defaultOf("music", "number"),
  effects: defaultOf("effects", "number"),
  ambience: defaultOf("ambience", "number"),
  uiScale: defaultOf("uiScale", "number"),
  colorBlind: defaultOf("colorBlind", "boolean"),
  autosave: defaultOf("autosave", "boolean"),
  tips: defaultOf("tips", "boolean"),
  floorHoverPreview: defaultOf("floorHoverPreview", "boolean"),
  lookSpeed: defaultOf("lookSpeed", "number"),
  fullscreen: defaultOf("fullscreen", "boolean"),
  view: "3d",
  graphics: DEFAULT_GRAPHICS,
  view3d: DEFAULT_VIEW3D,
};

/** The 3D view used to keep its own camera choice; carried over the first time. */
const OLD_VIEW3D_KEY = storageKey("view3d");

function cleanView3d(raw: Partial<View3d> | undefined): View3d {
  let v = raw;
  if (!v) {
    try {
      const old = JSON.parse(localStorage.getItem(OLD_VIEW3D_KEY) ?? "{}") as { mode?: string; wallsDown?: boolean };
      v = { camera: old.mode as View3d["camera"], wallsDown: old.wallsDown };
    } catch {
      v = {};
    }
  }
  // The Shaft and Top cameras are gone (T-052): either falls back to Free view; an old xray flag is dropped.
  return { camera: isCamera(v.camera) ? v.camera : DEFAULT_VIEW3D.camera, wallsDown: !!v.wallsDown, roomColors: v.roomColors ?? DEFAULT_VIEW3D.roomColors, flows: !!v.flows, cutAngle: clampCutAngle(v.cutAngle) };
}

const KEY = storageKey("settings");

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Settings> & { quality3d?: "high" | "low"; sfx?: boolean; ambient?: boolean }) : {};
    // Before graphics settings there was one "3D detail" choice: low becomes the low preset.
    const graphics = stored.graphics ? cleanGraphics(stored.graphics) : stored.quality3d === "low" ? GRAPHICS_PRESETS.low : DEFAULT_GRAPHICS;
    // Sound effects and ambience were on/off switches (T-066): off becomes silent, on the default.
    const { quality3d: _old, sfx, ambient, ...rest } = stored;
    const sound = { effects: sfx === false ? 0 : DEFAULT_SETTINGS.effects, ambience: ambient === false ? 0 : DEFAULT_SETTINGS.ambience };
    const s: Settings = { ...DEFAULT_SETTINGS, ...sound, ...rest, graphics, view3d: cleanView3d(stored.view3d) };
    return VIEW_MODES.some((m) => m.id === s.view) ? s : { ...s, view: DEFAULT_SETTINGS.view };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not persisted; fine for this session.
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  useEffect(() => saveSettings(settings), [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  return [settings, update] as const;
}

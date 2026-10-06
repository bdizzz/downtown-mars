import { useCallback, useEffect, useState } from "react";
import { cleanGraphics, DEFAULT_GRAPHICS, GRAPHICS_PRESETS, type Graphics } from "../view/graphics";
import { DEFAULT_VIEW3D, isCamera, type View3d } from "../view/cameras";
import { storageKey } from "./storageKey";

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
  volume: number;
  sfx: boolean;
  ambient: boolean;
  /** 1 = normal. */
  uiScale: number;
  /** Orange/blue instead of red/green in overlays. */
  colorBlind: boolean;
  autosave: boolean;
  /** Pointing at a floor in the floor picker shows it before you click. */
  floorHoverPreview: boolean;
  /** Which view the player last used: the unrolled wall, one floor from above, or 3D. */
  view: ViewMode;
  /** 3D graphics: sharpness, ambient life, and how much of each effect. */
  graphics: Graphics;
  /** The 3D camera, X-ray and walls down, as last used. */
  view3d: View3d;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  sfx: true,
  ambient: true,
  uiScale: 1,
  colorBlind: false,
  autosave: true,
  floorHoverPreview: false,
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
      const old = JSON.parse(localStorage.getItem(OLD_VIEW3D_KEY) ?? "{}") as { mode?: string; xray?: boolean; wallsDown?: boolean };
      v = { camera: old.mode as View3d["camera"], xray: old.xray, wallsDown: old.wallsDown };
    } catch {
      v = {};
    }
  }
  return { camera: isCamera(v.camera) ? v.camera : DEFAULT_VIEW3D.camera, xray: !!v.xray, wallsDown: !!v.wallsDown, roomColors: v.roomColors ?? DEFAULT_VIEW3D.roomColors, flows: !!v.flows };
}

const KEY = storageKey("settings");

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Settings> & { quality3d?: "high" | "low" }) : {};
    // Before graphics settings there was one "3D detail" choice: low becomes the low preset.
    const graphics = stored.graphics ? cleanGraphics(stored.graphics) : stored.quality3d === "low" ? GRAPHICS_PRESETS.low : DEFAULT_GRAPHICS;
    const { quality3d: _old, ...rest } = stored;
    const s: Settings = { ...DEFAULT_SETTINGS, ...rest, graphics, view3d: cleanView3d(stored.view3d) };
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

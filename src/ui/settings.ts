import { useCallback, useEffect, useState } from "react";

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
  /** Which view the player last used: the unrolled wall, one floor from above, or 3D. */
  view: ViewMode;
  /** 3D detail: high adds walkers and dust and renders at full resolution. */
  quality3d: "high" | "low";
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  sfx: true,
  ambient: true,
  uiScale: 1,
  colorBlind: false,
  autosave: true,
  view: "2d",
  quality3d: "high",
};

const KEY = "downtown-mars.settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
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

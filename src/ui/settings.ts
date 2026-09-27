import { useCallback, useEffect, useState } from "react";

// Player preferences, kept in browser storage. Reading or writing storage
// can fail (private windows, blocked storage); the game then just uses the
// defaults for this session.

export interface Settings {
  volume: number;
  sfx: boolean;
  ambient: boolean;
  /** 1 = normal. */
  uiScale: number;
  /** Orange/blue instead of red/green in overlays. */
  colorBlind: boolean;
  autosave: boolean;
  /** Which camera the player last used. */
  view: "2d" | "3d";
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  sfx: true,
  ambient: true,
  uiScale: 1,
  colorBlind: false,
  autosave: true,
  view: "2d",
};

const KEY = "downtown-mars.settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
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

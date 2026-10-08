import type { SaveSummary } from "../sim/save";
import { storageKey } from "./storageKey";
import { monthLabel } from "../view/months";

// Saves live in the browser's localStorage. Every access can throw (private
// windows, blocked storage, full quota), so each one is guarded and failure
// is reported rather than crashing the game.

export const SLOTS = ["autosave", "slot1", "slot2", "slot3"] as const;
export type Slot = (typeof SLOTS)[number];

export interface StoredSave {
  data: string;
  summary: SaveSummary;
  savedAt: number;
}

const key = (slot: Slot) => storageKey(`save.${slot}`);

export function readSave(slot: Slot): StoredSave | null {
  try {
    const raw = localStorage.getItem(key(slot));
    return raw ? (JSON.parse(raw) as StoredSave) : null;
  } catch {
    return null;
  }
}

export function writeSave(slot: Slot, save: StoredSave): boolean {
  try {
    localStorage.setItem(key(slot), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function deleteSave(slot: Slot): void {
  try {
    localStorage.removeItem(key(slot));
  } catch {
    // Nothing to do: storage isn't available.
  }
}

export function slotLabel(slot: Slot): string {
  return slot === "autosave" ? "Autosave" : `Slot ${slot.slice(4)}`;
}

export function describeSave(s: StoredSave): string {
  const when = new Date(s.savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const holes = (s.summary.holes ?? 1) > 1 ? ` · ${s.summary.holes} holes` : "";
  return `${monthLabel(s.summary.day)} · ${s.summary.population} colonists${holes} · ${s.summary.floors} floors · ${when}`;
}

/** Offer a save as a .json download. */
export function downloadSave(s: StoredSave): void {
  const blob = new Blob([s.data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `downtown-mars-month-${s.summary.day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ask for a .json file and return its text, or null if cancelled. */
export function pickSaveFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    // Kept in the document while the dialog is open: a detached input can be
    // garbage-collected by Chrome and Safari before its change event fires.
    document.body.appendChild(input);
    const done = (text: string | null) => {
      input.remove();
      resolve(text);
    };
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      file.text().then(done, () => done(null));
    });
    input.addEventListener("cancel", () => done(null));
    input.click();
  });
}

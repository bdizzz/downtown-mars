import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { config } from "../sim/config";
import { serialize, summarize, type SaveSummary } from "../sim/save";
import { gameTime } from "../sim/clock";
import type { World } from "../sim/world";
import { monthLabel } from "../view/months";

// Saves for the Godot viewer, as the web game keeps them (ui/saves.ts): an autosave (each new game
// day) and three slots, each { data, summary, savedAt } with `data` the web's own save file, so a
// save moves between the two (the web's Export, and Godot's Import). Here they're files, in
// ~/.downtown-mars/saves (or DM_SAVES).

export const SLOTS = ["autosave", "slot1", "slot2", "slot3"] as const;
export type Slot = (typeof SLOTS)[number];

interface StoredSave {
  data: string;
  summary: SaveSummary;
  savedAt: number;
}

const dir = process.env.DM_SAVES ?? join(homedir(), ".downtown-mars", "saves");
const file = (slot: Slot) => join(dir, `${slot}.json`);

export const isSlot = (s: string): s is Slot => (SLOTS as readonly string[]).includes(s);

export function writeSlot(world: World, slot: Slot): void {
  mkdirSync(dir, { recursive: true });
  const save: StoredSave = { data: serialize(world), summary: summarize(world, config), savedAt: Date.now() };
  writeFileSync(file(slot), JSON.stringify(save));
}

/** A slot's save file (the web's format), or null if it's empty or unreadable. */
export function readSlot(slot: Slot): string | null {
  try {
    return existsSync(file(slot)) ? (JSON.parse(readFileSync(file(slot), "utf8")) as StoredSave).data : null;
  } catch {
    return null;
  }
}

export interface SavesMessage {
  type: "saves";
  folder: string;
  slots: { slot: Slot; label: string; text: string | null }[];
}

/** Every slot, described as the web's menu does (ui/saves.ts describeSave), or null when empty. */
export function savesList(): SavesMessage {
  return {
    type: "saves",
    folder: dir,
    slots: SLOTS.map((slot) => {
      let text: string | null = null;
      try {
        if (existsSync(file(slot))) {
          const s = JSON.parse(readFileSync(file(slot), "utf8")) as StoredSave;
          const when = new Date(s.savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
          const holes = (s.summary.holes ?? 1) > 1 ? ` · ${s.summary.holes} holes` : "";
          text = `${monthLabel(s.summary.day)} · ${s.summary.population} colonists${holes} · ${s.summary.floors} floors · ${when}`;
        }
      } catch {
        text = "Unreadable";
      }
      return { slot, label: slot === "autosave" ? "Autosave" : `Slot ${slot.slice(4)}`, text };
    }),
  };
}

/** The game day, to autosave when a new one starts. */
export const dayOf = (world: World) => gameTime(world.tick, config).day;

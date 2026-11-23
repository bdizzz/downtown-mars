import { paints } from "./interaction";
import type { Tool } from "./types";

/**
 * Moving the camera with a key held, as Google Maps 3D does (#585): ⌘ (or Ctrl) and drag turns and tilts,
 * Shift and drag pans, in Build or out. With the corridor tool, whose Shift snakes a fill-in, ⌘ Shift and drag pans.
 */
export type CameraDrag = "turn" | "pan";

export interface DragKeys {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

/** Is the turn key (⌘ on a Mac, Ctrl elsewhere; either works) held? While it is, a drag only moves the camera. */
export function turnKeyHeld(e: DragKeys): boolean {
  return e.metaKey || e.ctrlKey;
}

/** What a drag starting with these keys does to the camera; null for the plain drag (which turns, or draws corridors). */
export function cameraDragFor(e: DragKeys, tool: Tool): CameraDrag | null {
  const turnKey = turnKeyHeld(e);
  if (e.shiftKey && (turnKey || !paints(tool))) return "pan";
  return turnKey ? "turn" : null;
}

/** Is this a Mac (where the turn key reads ⌘)? */
export function onMac(): boolean {
  const nav = typeof navigator === "undefined" ? null : navigator;
  return !!nav && /Mac|iPhone|iPad/.test(nav.platform || nav.userAgent);
}

/** The tool bar's hint: what the keys do to the camera with this tool in hand. */
export function cameraDragHint(tool: Tool, mac = onMac()): string {
  const turn = mac ? "⌘" : "Ctrl";
  const pan = paints(tool) ? `${turn} ⇧` : "⇧";
  return `${turn} drag turns the view · ${pan} drag pans`;
}

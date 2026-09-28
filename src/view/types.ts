import type { SimCommand } from "../sim/commands";
import type { CheckResult, RoomInstance } from "../sim/placement";
import type { Snapshot } from "../sim/snapshot";

// What the UI and a view (2D or 3D) say to each other. Both views implement
// Stage, and turn pointer input into the same Picks and commands, so the
// React UI never needs to know which one is showing.

/** What's under the pointer. angle is in degrees around the shaft. */
export type Pick =
  | { kind: "surface"; angle: number }
  | { kind: "gallery"; floor: number; angle: number; digging: boolean }
  | { kind: "slot"; floor: number; ring: number; slot: number; locked: boolean; digging: boolean; angle: number }
  | { kind: "rock" };

export type Tool =
  | { kind: "build"; room: string; shape: [number, number] }
  | { kind: "demolish" }
  /** Draw corridors along borders, in a finish; with erase, remove them. */
  | { kind: "corridor"; finish: string; erase: boolean }
  | null;

/** The border under the pointer, with the corridor tool. */
export interface EdgeHover {
  id: string;
  /** Already a corridor, and in which finish. */
  finish?: string;
  /** Why a corridor can't be drawn here (null: it can). */
  refusal: string | null;
  cost: Record<string, number>;
  /** Linked to the shaft (for existing corridors). */
  linked?: boolean;
  /** Removing rather than drawing (erase mode, or Shift held). */
  erase: boolean;
}

export interface HoverInfo {
  pick: Pick;
  room?: RoomInstance;
  check?: CheckResult;
  edge?: EdgeHover;
}

/** A snaked chain of corridors waiting for the player to confirm: to carve, or (erase) to fill in. */
export interface Proposal {
  edges: string[];
  erase: boolean;
}

export interface StageOptions {
  /** A corridor chain was snaked out and the button released: ask the player to confirm it. */
  onPropose?: (p: Proposal) => void;
  onHover?: (info: HoverInfo | null) => void;
  /** quiet: a failure isn't worth telling the player about (e.g. painting over existing rooms). */
  onCommand?: (cmd: SimCommand, quiet?: boolean) => void;
  onCancel?: () => void;
  onSelect?: (roomId: number | null) => void;
  /** A click where the room can't go: say why. */
  onInvalid?: (reason: string) => void;
  /** The view broke after starting (e.g. lost its graphics context). */
  onError?: (message: string) => void;
}

export type Quality = "high" | "low";

export interface Stage {
  update(snapshot: Snapshot): void;
  setTool(tool: Tool): void;
  setSelected(roomId: number | null): void;
  /** Heat map of one neighbor effect over the rooms, or null for none. */
  setOverlay(type: string | null): void;
  setColorBlind(on: boolean): void;
  /**
   * Focus on one floor: the plan view draws it alone, the 3D view hides
   * everything above it (the shallower floors and the surface). null shows
   * every floor. The unrolled view ignores it.
   */
  setFloor(floor: number | null): void;
  /** The chain the confirm popup is asking about, kept on show until it's answered (null: none). */
  setProposal(p: Proposal | null): void;
  /** Detail level; views that have nothing to trade may ignore it. */
  setQuality(q: Quality): void;
  destroy(): void;
}


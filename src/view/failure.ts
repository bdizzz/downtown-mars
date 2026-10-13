import type { HoleSummary } from "../sim/snapshot";
import { monthsText } from "./months";

// The cards for a hole that has failed (T-162), shared by the web (ui/FailureCard.tsx) and the
// Godot viewer (the bridge's "failure" message), shaped like the welcome card (view/welcome.ts).
// "lost": one hole emptied and the game goes on in the others. "over": every hole has, and the
// only way on is back to the start screen.

export interface FailureCard {
  type: "failure";
  kind: "lost" | "over";
  /** The hole a "lost" card is about. */
  holeId: number | null;
  title: string;
  /** Each paragraph as runs of text, every other one bold, starting plain. */
  paragraphs: string[][];
  button: string;
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** "It lasted 3 years 2 months, and at its peak 84 people lived there." */
function lasted(h: HoleSummary): string[] {
  const f = h.failed!;
  return ["It lasted ", monthsText(f.days), ", and at its peak ", people(f.peak), " lived there."];
}

/**
 * The card to show now, if any: the game-over card once every hole has failed, or else a lost card
 * for a failed hole not in `seen` (the holes whose card was already shown, or that had failed before
 * the game was loaded).
 */
export function nextFailureCard(holes: HoleSummary[], gameOver: boolean, seen: ReadonlySet<number>): FailureCard | null {
  if (gameOver) return overCard(holes);
  const lost = holes.find((h) => h.failed && !seen.has(h.id));
  return lost ? lostCard(lost) : null;
}

/** One hole has emptied while others go on. */
export function lostCard(h: HoleSummary): FailureCard {
  return {
    type: "failure",
    kind: "lost",
    holeId: h.id,
    title: `${h.name} has failed`,
    paragraphs: [
      [`The last colonist in ${h.name} is gone. With no one left to open the airlock, no newcomers can come in: the hole is lost.`],
      lasted(h),
      ["The rest of the network carries on."],
    ],
    button: "Carry on",
  };
}

/** Every hole has failed: the game is over. */
export function overCard(holes: HoleSummary[]): FailureCard {
  const failed = holes.filter((h) => h.failed);
  const one = failed.length === 1 ? failed[0]! : null;
  return {
    type: "failure",
    kind: "over",
    holeId: null,
    title: one ? `${one.name} has failed` : "The colony has failed",
    paragraphs: one
      ? [
          [`The last colonist is gone. With no one left to open the airlock, no newcomers can come in, and ${one.name} falls quiet.`],
          lasted(one),
          ["Its save is kept to look back on. Mars is patient: dig again."],
        ]
      : [
          ["Every hole is empty. With no one left to open the airlocks, no newcomers can come in."],
          ...failed.map((h) => ["", h.name, ` lasted ${monthsText(h.failed!.days)}, with ${people(h.failed!.peak)} at its peak.`]),
          ["The save is kept to look back on. Mars is patient: dig again."],
        ],
    button: "Back to the start screen",
  };
}

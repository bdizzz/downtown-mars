import type { Snapshot } from "../sim/snapshot";
import { shownGoal, tutorial, type TutorialStep } from "../ui/tutorialGoals";

// The tutorial for the Godot viewer, as the web's (ui/Tutorial.tsx): the deputy, the goal the card's
// on (the first not yet met, or the one the viewer's arrows and dots picked; the goals can be met in
// any order), its hint and what to pulse, and the row of goals done. The viewer says what it saw that
// the sim can't know (the noise overlay, Flows) and which step it picked ("tutorialStep").

export interface TutorialMessage {
  type: "tutorial";
  name: string;
  /** Said until the first goal's met (the web's "before any": here the 3D goal is met from the start). */
  intro: string | null;
  /** The goal shown; `done` when it's already met (browsed back to). */
  goal: { text: string; hint: string; highlight: string; done: boolean } | null;
  outro: string;
  /** Each goal: "done" or "". */
  states: string[];
  /** The index of the goal shown, -1 when all are met. */
  at: number;
  done: number;
}

/** `met` from metGoals, `step` already moved on (advanceStep). */
export function tutorialMessage(s: Snapshot, met: boolean[], step: TutorialStep): TutorialMessage {
  const name = s.notables[0]?.name ?? "your deputy";
  const fill = (t: string) => t.replaceAll("{name}", name);
  const at = shownGoal(step, met);
  const goal = at >= 0 ? tutorial.goals[at]! : null;
  const done = met.filter(Boolean).length;
  return {
    type: "tutorial",
    name,
    intro: met[0] ? null : fill(tutorial.intro),
    goal: goal ? { text: fill(goal.text), hint: goal.hint, highlight: goal.highlight, done: met[at]! } : null,
    outro: fill(tutorial.outro),
    states: met.map((m) => (m ? "done" : "")),
    at,
    done,
  };
}

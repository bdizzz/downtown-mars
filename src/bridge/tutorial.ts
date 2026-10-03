import type { Snapshot } from "../sim/snapshot";
import { CHECKS, tutorial, type UiFlags } from "../ui/tutorialGoals";

// The tutorial for the Godot viewer, as the web's (ui/Tutorial.tsx): the deputy, the goal they're on
// (the first not yet met; the goals can be met in any order), its hint and what to pulse, and the
// row of goals done. The viewer says what it saw that the sim can't know (the noise overlay, Flows).

export interface TutorialMessage {
  type: "tutorial";
  name: string;
  /** Said until the first goal's met (the web's "before any": here the 3D goal is met from the start). */
  intro: string | null;
  goal: { text: string; hint: string; highlight: string } | null;
  outro: string;
  /** Each goal: "done", "now" (the one being talked about) or "". */
  states: string[];
  done: number;
}

export function tutorialMessage(s: Snapshot, flags: UiFlags): TutorialMessage {
  const name = s.notables[0]?.name ?? "your deputy";
  const fill = (t: string) => t.replaceAll("{name}", name);
  const met = tutorial.goals.map((g) => !!CHECKS[g.id]?.(s, flags));
  const now = met.indexOf(false);
  const goal = now >= 0 ? tutorial.goals[now]! : null;
  const done = met.filter(Boolean).length;
  return {
    type: "tutorial",
    name,
    intro: met[0] ? null : fill(tutorial.intro),
    goal: goal ? { text: fill(goal.text), hint: goal.hint, highlight: goal.highlight } : null,
    outro: fill(tutorial.outro),
    states: met.map((m, i) => (m ? "done" : i === now ? "now" : "")),
    done,
  };
}

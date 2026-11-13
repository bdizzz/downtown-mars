import raw from "../../data/tutorial.json";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import type { GuideState } from "../sim/state";
import { CHECKS, type UiFlags } from "./tutorialGoals";

// The guided tutorial (F-007, T-083): for newcomers to city builders, picked on the welcome card.
// Unlike the regular tutorial's goals (met in any order), its steps go one at a time, in order. Each
// unlocks parts of the interface (recorded in the save, for T-084 to hide the rest), sets the pace
// (slow, or paused to read) and may have a "Show me" clip (T-086). Until the step named calmUntil is
// done, the sim holds off storms and events (SimState.guide.calm). Its progress lives in the save,
// moved on by the setGuide command, so a loaded game carries on where it was.

export interface GuidedStep {
  id: string;
  /** A goal id from CHECKS that finishes the step; none: a step to read, finished by its button. */
  check?: string;
  text: string;
  hint: string;
  /** What to pulse, as the regular tutorial's goals. */
  highlight: string;
  /** UI element ids this step reveals. */
  unlocks: string[];
  /** "slow": the game runs at config.slowSpeed; "read": paused until the button. */
  pace: "slow" | "read";
  /** The button's words, for a step to read (default "Go on"). */
  button?: string;
  /** The "Show me" clip's name (T-086). */
  clip?: string;
}

export interface GuidedTrack {
  intro: string;
  calmUntil: string;
  steps: GuidedStep[];
  outro: string;
  leave: string;
}

export const guided = raw.guided as GuidedTrack;

/** The step a guide is on, or null once it's past the last. */
export function guideStep(g: GuideState): GuidedStep | null {
  return guided.steps[g.step] ?? null;
}

/** The guide at step `i`: everything unlocked up to and including it, and calm until calmUntil is done. */
export function guideAt(i: number, unlocked: string[] = []): GuideState {
  const calmEnd = guided.steps.findIndex((s) => s.id === guided.calmUntil);
  const got = new Set(unlocked);
  for (const s of guided.steps.slice(0, i + 1)) for (const u of s.unlocks) got.add(u);
  return { step: i, unlocked: [...got], calm: i <= calmEnd };
}

/** A new guided game, on its first step. */
export const startGuide = (): GuideState => guideAt(0);

/** The guide one step on. */
export const nextGuide = (g: GuideState): GuideState => guideAt(g.step + 1, g.unlocked);

/** Whether the step's check is met now (a step to read never is: its button moves it on). */
export function stepMet(step: GuidedStep, s: Snapshot, flags: UiFlags): boolean {
  return !!step.check && !!CHECKS[step.check]?.(s, flags);
}

/** The speed a step runs at: paused to read, else slow. */
export function stepSpeed(step: GuidedStep | null): number {
  if (!step) return 1;
  return step.pace === "read" ? 0 : config.slowSpeed;
}

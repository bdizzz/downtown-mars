import raw from "../../data/tutorial.json";
import { config } from "../sim/config";

// The card every new game opens with (not a loaded one), tutorial or not: who you are and why the
// colony goes underground. The text is data (data/tutorial.json `welcome`), shared by the web
// (ui/Welcome.tsx) and the Godot viewer (the bridge's "welcome" message).

export interface WelcomeCard {
  type: "welcome";
  title: string;
  /** Each paragraph as runs of text, every other one bold (the data's **…**), starting plain. */
  paragraphs: string[][];
  button: string;
  /** The second way in: the guided tutorial (F-007, T-083), and a line on what it is. */
  guidedButton: string;
  guidedNote: string;
}

export function welcomeCard(): WelcomeCard {
  const w = raw.welcome;
  const fill = (t: string) => t.replaceAll("{colonists}", String(config.colonists.start));
  return { type: "welcome", title: w.title, paragraphs: w.paragraphs.map((p) => fill(p).split("**")), button: w.button, guidedButton: w.guidedButton, guidedNote: w.guidedNote };
}

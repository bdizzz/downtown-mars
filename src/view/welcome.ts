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
}

export function welcomeCard(): WelcomeCard {
  const w = raw.welcome;
  const fill = (t: string) => t.replaceAll("{colonists}", String(config.colonists.start));
  return { type: "welcome", title: w.title, paragraphs: w.paragraphs.map((p) => fill(p).split("**")), button: w.button };
}

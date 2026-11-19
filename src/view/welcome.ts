import raw from "../../data/tutorial.json";
import { config } from "../sim/config";
import { DIFFICULTY, type Level } from "../sim/difficulty";

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
  /** The difficulty picker (F-014, T-123): the levels with a line each, which one starts picked, and the options' labels. */
  difficulty: {
    label: string;
    picked: Level;
    levels: { id: Level; name: string; hint: string; veteran: boolean; guided: boolean }[];
    veteran: string;
    veteranNote: string;
    guided: string;
  };
}

export function welcomeCard(): WelcomeCard {
  const w = raw.welcome;
  const fill = (t: string) => t.replaceAll("{colonists}", String(config.colonists.start));
  const d = DIFFICULTY;
  return {
    type: "welcome",
    title: w.title,
    paragraphs: w.paragraphs.map((p) => fill(p).split("**")),
    button: w.button,
    guidedButton: w.guidedButton,
    guidedNote: w.guidedNote,
    difficulty: {
      label: d.picker.label,
      picked: d.default,
      levels: d.levels.map(({ id, name, hint, veteran, guided }) => ({ id, name, hint, veteran, guided })),
      veteran: d.picker.veteran,
      veteranNote: d.picker.veteranNote,
      guided: d.picker.guided,
    },
  };
}

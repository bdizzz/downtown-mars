import { useState } from "react";
import type { Level } from "../sim/difficulty";
import { welcomeCard } from "../view/welcome";

/** What the player picked on the welcome card. */
export interface WelcomeChoice {
  difficulty: Level;
  /** The bare landing kit, where the level offers it (normal's veteran start). */
  veteran: boolean;
  /** The guided tutorial for newcomers to city builders (F-007, T-083). */
  guided: boolean;
}

/**
 * The card a new game opens with; the game waits behind it. The player picks a difficulty (F-014,
 * T-123), with a line on what each means; easy ticks the guided tutorial, which can still be unticked,
 * and normal offers a veteran start (the bare landing kit).
 */
export function Welcome({ onClose }: { onClose: (choice: WelcomeChoice) => void }) {
  const card = welcomeCard();
  const d = card.difficulty;
  const [level, setLevel] = useState<Level>(d.picked);
  const info = d.levels.find((l) => l.id === level)!;
  const [guided, setGuided] = useState(info.guided);
  const [veteran, setVeteran] = useState(false);
  const pick = (id: Level) => {
    setLevel(id);
    // Each level brings its own tutorial default; picking a level again resets it.
    setGuided(d.levels.find((l) => l.id === id)!.guided);
    setVeteran(false);
  };
  return (
    <div className="menu-backdrop">
      <div className="menu welcome" role="dialog" aria-label={card.title}>
        <h2>{card.title}</h2>
        {card.paragraphs.map((runs, i) => (
          <p key={i}>{runs.map((r, j) => (j % 2 ? <strong key={j}>{r}</strong> : r))}</p>
        ))}
        <fieldset className="welcome-difficulty">
          <legend>{d.label}</legend>
          <div className="welcome-levels" role="radiogroup" aria-label={d.label}>
            {d.levels.map((l) => (
              <button key={l.id} role="radio" aria-checked={l.id === level} className={l.id === level ? "on" : ""} onClick={() => pick(l.id)}>
                {l.name}
              </button>
            ))}
          </div>
          <p className="welcome-hint">{info.hint}</p>
          <label className="welcome-option">
            <input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} />
            <span>
              {d.guided}
              <span className="k">{card.guidedNote}</span>
            </span>
          </label>
          {info.veteran && (
            <label className="welcome-option">
              <input type="checkbox" checked={veteran} onChange={(e) => setVeteran(e.target.checked)} />
              <span>
                {d.veteran}
                <span className="k">{d.veteranNote}</span>
              </span>
            </label>
          )}
        </fieldset>
        <button className="primary" autoFocus onClick={() => onClose({ difficulty: level, veteran: info.veteran && veteran, guided })}>
          {card.button}
        </button>
      </div>
    </div>
  );
}

import { welcomeCard } from "../view/welcome";

/**
 * The card a new game opens with; the game waits behind it. Two ways in: the usual start, or the
 * guided tutorial for newcomers to city builders (F-007, T-083), `guided` true.
 */
export function Welcome({ onClose }: { onClose: (guided: boolean) => void }) {
  const card = welcomeCard();
  return (
    <div className="menu-backdrop">
      <div className="menu welcome" role="dialog" aria-label={card.title}>
        <h2>{card.title}</h2>
        {card.paragraphs.map((runs, i) => (
          <p key={i}>{runs.map((r, j) => (j % 2 ? <strong key={j}>{r}</strong> : r))}</p>
        ))}
        <button className="primary" autoFocus onClick={() => onClose(false)}>
          {card.button}
        </button>
        <button className="welcome-guided" onClick={() => onClose(true)} title={card.guidedNote}>
          {card.guidedButton}
          <span className="k">{card.guidedNote}</span>
        </button>
      </div>
    </div>
  );
}

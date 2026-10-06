import { welcomeCard } from "../view/welcome";

/** The card a new game opens with; the game waits behind it. */
export function Welcome({ onClose }: { onClose: () => void }) {
  const card = welcomeCard();
  return (
    <div className="menu-backdrop">
      <div className="menu welcome" role="dialog" aria-label={card.title}>
        <h2>{card.title}</h2>
        {card.paragraphs.map((runs, i) => (
          <p key={i}>{runs.map((r, j) => (j % 2 ? <strong key={j}>{r}</strong> : r))}</p>
        ))}
        <button className="primary" autoFocus onClick={onClose}>
          {card.button}
        </button>
      </div>
    </div>
  );
}

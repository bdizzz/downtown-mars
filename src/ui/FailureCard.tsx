import type { FailureCard as Card } from "../view/failure";

/** A hole has failed (T-162): a card over the game, which waits behind it. Text from view/failure.ts. */
export function FailureCard({ card, onClose }: { card: Card; onClose: () => void }) {
  return (
    <div className={`menu-backdrop${card.kind === "over" ? " failure-over" : ""}`}>
      <div className="menu welcome failure" role="alertdialog" aria-label={card.title}>
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

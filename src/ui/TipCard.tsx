import type { Snapshot } from "../sim/snapshot";
import type { Spot } from "../view/reachView";
import type { Tip } from "../view/tips";
import { Portrait } from "./Portrait";

// The deputy's one-time tip (F-018, T-177): the first time a problem shows up, what's behind it and
// how to fix it, with Show me. It sits where the tutorial's card does, over it while it's up. The
// words and when it shows: view/tips.ts.

interface Props {
  s: Snapshot;
  tip: Tip;
  /** Whether Show me is on for it (its spotlight id is "tip:<id>"). */
  shown: boolean;
  onShow: (id: string | null, spot: Spot | null) => void;
  onSeen: () => void;
  /** No more tips (Settings > Tips). */
  onOff: () => void;
}

export function TipCard({ s, tip, shown, onShow, onSeen, onOff }: Props) {
  return (
    <div className="tutorial tip" role="complementary" aria-label="Tip">
      <div className="who">
        <Portrait who={s.notables[0]} />
        <span>
          <strong>{tip.name}</strong>
          <span className="k"> · deputy</span>
        </span>
      </div>
      <p className="say">{tip.text}</p>
      <p className="k">{tip.hint}</p>
      <div className="tip-actions">
        {tip.spot && (
          <button className={`why-show${shown ? " on" : ""}`} onClick={() => onShow(shown ? null : `tip:${tip.id}`, shown ? null : tip.spot)} aria-pressed={shown}>
            {shown ? "Showing" : "Show me"}
          </button>
        )}
        <button className="why-show on" onClick={onSeen}>
          Got it
        </button>
      </div>
      <button className="link" onClick={onOff} title="Settings > Tips turns them back on">
        No more tips
      </button>
    </div>
  );
}

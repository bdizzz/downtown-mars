import type { Snapshot } from "../sim/snapshot";
import type { Spot } from "../view/reachView";
import { whyContent, type WhyItem } from "../view/whyPanel";

// The "Why?" panel (F-018): what's hurting health and happiness, biggest first, each with its fix and a
// Show me that lights up the rooms and homes involved and turns to them; then the unhappiest homes, a click
// away. Opened by clicking Health or Happiness on the bar. The words: view/whyPanel.ts.

export type WhyTab = "health" | "happiness";

interface Props {
  s: Snapshot;
  tab: WhyTab;
  setTab: (tab: WhyTab) => void;
  /** The cause Show me is on (its id), or null. */
  shown: string | null;
  onShow: (id: string | null, spot: Spot | null) => void;
  onSelect: (roomId: number) => void;
  onTrend: (key: string) => void;
  onClose: () => void;
}

function Item({ item, shown, onShow }: { item: WhyItem; shown: boolean; onShow: Props["onShow"] }) {
  return (
    <li className={`why-item${item.bad ? " bad" : " good"}`}>
      <p>
        <strong className="why-amount">{item.amount}</strong> {item.text}
      </p>
      {item.from && <p className="k">{item.from}</p>}
      {item.fix && <p className="why-fix">Fix: {item.fix}</p>}
      {item.spot && (
        <button className={`why-show${shown ? " on" : ""}`} onClick={() => onShow(shown ? null : item.id, shown ? null : item.spot)} aria-pressed={shown}>
          {shown ? "Showing" : "Show me"}
        </button>
      )}
    </li>
  );
}

export function WhyPanel({ s, tab, setTab, shown, onShow, onSelect, onTrend, onClose }: Props) {
  const why = whyContent(s);
  const section = why[tab];
  return (
    <aside className="inspector why">
      <header>
        <h2>Why?</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="seg" role="group" aria-label="What to explain">
        {(["health", "happiness"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} aria-pressed={tab === t}>
            {t === "health" ? "Health" : "Happiness"}
          </button>
        ))}
      </div>
      <h3 className="why-head">{section.headline}</h3>
      <p className="k">{section.note}</p>
      {section.items.length ? (
        <ul className="why-list">
          {section.items.map((item) => (
            <Item key={item.id} item={item} shown={shown === item.id} onShow={onShow} />
          ))}
        </ul>
      ) : (
        <p className="k">Nothing to fix.</p>
      )}
      {tab === "happiness" && why.worst.length > 0 && (
        <>
          <h3>Unhappiest homes</h3>
          <ul className="why-list">
            {why.worst.map((w) => (
              <li key={w.roomId}>
                <button className="why-home" onClick={() => onSelect(w.roomId)} title="Select it, to see what makes up its noise, comfort and wellbeing">
                  <span className="why-amount">{w.happiness}</span> {w.name}
                  <span className="k"> · {w.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button className="why-trend" onClick={() => onTrend(tab)}>
        {tab === "health" ? "Health" : "Happiness"} over time, by cause →
      </button>
    </aside>
  );
}

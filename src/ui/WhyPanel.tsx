import type { Snapshot } from "../sim/snapshot";
import type { Spot } from "../view/reachView";
import { whyContent, type WhyItem } from "../view/whyPanel";
import { PanelHeader } from "./PanelHeader";
import { useState } from "react";
import { Icon } from "./Icon";

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

/**
 * One cause: how much it weighs and what it is, with Show me beside it. Where it comes from and how to
 * fix it fold open under it (the biggest cause starts open), so the list reads as a list first.
 */
function Item({ item, shown, onShow, first }: { item: WhyItem; shown: boolean; onShow: Props["onShow"]; first: boolean }) {
  const [open, setOpen] = useState(first);
  const more = !!(item.from || item.fix);
  return (
    <li className={`why-item${item.bad ? " bad" : " good"}${open ? " open" : ""}`}>
      <div className="why-top">
        <button className="why-what" onClick={() => setOpen(!open)} aria-expanded={open} disabled={!more} title={more ? (open ? "Hide the details" : "Where it comes from, and the fix") : undefined}>
          <strong className="why-amount">{item.amount.replace(/ points?$/, "")}</strong>
          <span>{item.text}</span>
          {more && <Icon id="chevron" size={11} className="chev" />}
        </button>
        {item.spot && (
          <button
            className={`why-show eye${shown ? " on" : ""}`}
            onClick={() => onShow(shown ? null : item.id, shown ? null : item.spot)}
            aria-pressed={shown}
            aria-label="Show me"
            title={shown ? "Showing: the rooms behind it and the homes that feel it are lit up. Click to stop." : "Show me: light up the rooms behind it and the homes that feel it"}
          >
            <Icon id="eye" size={14} />
          </button>
        )}
      </div>
      {open && item.from && <p className="why-from">{item.from}</p>}
      {open && item.fix && (
        <p className="why-fix">
          <b>Fix</b> {item.fix}
        </p>
      )}
    </li>
  );
}

export function WhyPanel({ s, tab, setTab, shown, onShow, onSelect, onTrend, onClose }: Props) {
  const why = whyContent(s);
  const section = why[tab];
  return (
    <aside className="inspector why">
      <PanelHeader title="Why?" onClose={onClose} />
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
            <Item key={item.id} item={item} shown={shown === item.id} onShow={onShow} first={item === section.items[0]} />
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

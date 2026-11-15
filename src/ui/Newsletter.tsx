import type { NewsIssue } from "../sim/newsletter";
import type { Snapshot } from "../sim/snapshot";
import { monthLabel } from "../view/months";
import { NEWSLETTER_NAME, writeNewsletter } from "../view/newsletter";
import { PanelHeader } from "./PanelHeader";

// The Hole Truth (#424): each month's newsletter opens as a card over the game, which keeps running
// behind it; Charts → The Hole Truth lists the back issues. The words: view/newsletter.ts.

export function NewsletterCard({ issue, onClose }: { issue: NewsIssue; onClose: () => void }) {
  const n = writeNewsletter(issue);
  return (
    <div className="newsletter-wrap">
      <article className="newsletter" role="dialog" aria-label={`${n.name}, ${n.dateline}`}>
        <header>
          <h2>{n.name}</h2>
          <div className="k tagline">
            {n.tagline} · {n.dateline}
          </div>
        </header>
        <section className="lead">
          <div className="kicker">{n.lead.kicker}</div>
          <h3>{n.lead.head}</h3>
          <p>{n.lead.text}</p>
        </section>
        {n.stories.map((st, i) => (
          <section key={i} className="story">
            <div className="kicker">{st.kicker}</div>
            <p>
              <strong>{st.head}.</strong> {st.text}
            </p>
          </section>
        ))}
        {n.letters.map((l, i) => (
          <section key={`l${i}`} className="story letter">
            <div className="kicker">{l.kicker}</div>
            <p>
              <span className="k">{l.intro}</span> {l.quote}
            </p>
          </section>
        ))}
        <p className="filler k">{n.filler}</p>
        <footer>
          <span className="k sign">{n.sign}</span>
          <button className="primary" autoFocus onClick={onClose}>
            Close
          </button>
        </footer>
      </article>
    </div>
  );
}

/** Charts → The Hole Truth: the back issues, newest first. */
export function NewsPanel({ s, onOpen, onClose }: { s: Snapshot; onOpen: (no: number) => void; onClose: () => void }) {
  const issues = [...s.newsletter.issues].reverse();
  return (
    <aside className="inspector news-panel">
      <PanelHeader title={<>{NEWSLETTER_NAME} <span className="k">· back issues</span></>} onClose={onClose} />
      {!issues.length && <p className="k">The first issue comes out at the end of the month.</p>}
      {issues.map((i) => (
        <button key={i.no} className="news-row" onClick={() => onOpen(i.no)}>
          <span className="name">{writeNewsletter(i).lead.head}</span>
          <span className="k">
            No. {i.no} · {monthLabel(i.day)}
          </span>
        </button>
      ))}
    </aside>
  );
}

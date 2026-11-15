import type { NewsIssue } from "../sim/newsletter";
import type { Snapshot } from "../sim/snapshot";
import { monthLabel } from "../view/months";
import { NEWSLETTER_NAME, writeNewsletter } from "../view/newsletter";
import { portraitSvg } from "../view/portrait";
import { PanelHeader } from "./PanelHeader";

// The Hole Truth (#424): each month's newsletter opens as a card over the game, which waits while it's
// open (App.tsx); Charts → The Hole Truth lists the back issues. The words: view/newsletter.ts.

export function NewsletterCard({ issue, onClose }: { issue: NewsIssue; onClose: () => void }) {
  const n = writeNewsletter(issue);
  return (
    <div className="newsletter-wrap">
      <article className="newsletter" role="dialog" aria-label={`${n.name}, ${n.dateline}`}>
        <div className="np-sync" aria-hidden="true">
          <span>E-PAPER · {n.hole.toUpperCase()} NET</span>
          <span className="np-dot">synced</span>
        </div>
        <header className="np-mast">
          <div className="np-ear">
            <b>Pop.</b> {n.population}
          </div>
          <h2>{n.name}</h2>
          <div className="np-ear right">
            <b>Weather</b> {n.weather}
          </div>
        </header>
        <div className="np-strip">
          <span>{n.dateline}</span>
          <span className="np-tag">{n.tagline}</span>
          <span>{n.price}</span>
        </div>
        <section className="np-lead">
          <div className="kicker">{n.lead.kicker}</div>
          {n.lead.head && <h3>{n.lead.head}</h3>}
          <p className="np-drop">{n.lead.text}</p>
        </section>
        {(n.stories.length > 0 || n.letters.length > 0) && (
          <div className={`np-cols${n.stories.length + n.letters.length === 1 ? " one" : ""}`}>
            {n.stories.map((st, i) => (
              <section key={i} className="np-story">
                <div className="kicker">{st.kicker}</div>
                <p>
                  {st.head && <strong>{st.head}. </strong>}
                  {st.text}
                </p>
              </section>
            ))}
            {n.letters.map((l, i) => (
              <section key={`l${i}`} className="np-story np-letter">
                <div className="kicker">{l.kicker}</div>
                <p className="np-intro">{l.intro}</p>
                <p>
                  <em>{l.quote}</em>
                </p>
              </section>
            ))}
          </div>
        )}
        {n.fluff.length > 0 && (
          <div className={`np-cols np-fluff${n.fluff.length === 1 ? " one" : ""}`}>
            {n.fluff.map((st, i) => (
              <section key={`f${i}`} className="np-story">
                <div className="kicker">{st.kicker}</div>
                {st.head && <h4>{st.head}</h4>}
                {st.who && (
                  <figure className="np-photo">
                    <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: portraitSvg(st.who, 96) }} />
                  </figure>
                )}
                <p>{st.text}</p>
              </section>
            ))}
          </div>
        )}
        <div className="np-filler">
          <span className="kicker">Notices</span>
          {n.notices.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
        <footer>
          <span className="np-sign">{n.sign}</span>
          <button className="np-close" autoFocus onClick={onClose}>
            Fold it up
          </button>
        </footer>
        <div className="np-printed">{n.printed}</div>
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
          <span className="name">{writeNewsletter(i).lead.head || writeNewsletter(i).lead.text}</span>
          <span className="k">
            No. {i.no} · {monthLabel(i.day)}
          </span>
        </button>
      ))}
    </aside>
  );
}

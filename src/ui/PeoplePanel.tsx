import { useEffect, useState } from "react";
import type { PeoplePage, PeopleQuery } from "../sim/personView";
import type { Snapshot } from "../sim/snapshot";
import { peopleReport } from "../view/colony";
import { FILTERS, pageText, rowText, SORTS } from "../view/personCard";
import { PanelHeader } from "./PanelHeader";

// The hole's people: who they are by life stage, what's coming, and why
// children are or aren't being born (the words: view/colony.ts); and
// everyone, one by one, in a list to search (#528). A row opens their card.

/** The people list: a page asked of the worker while the panel's open, and again as the game runs. */
function Everyone({ list, tick, onPerson }: { list: (q: PeopleQuery) => Promise<PeoplePage>; tick: number; onPerson: (id: number) => void }) {
  const [q, setQ] = useState<PeopleQuery>({ sort: "happiness", filter: "all", search: "", offset: 0 });
  const [page, setPage] = useState<PeoplePage | null>(null);
  const beat = Math.floor(tick / 40);
  useEffect(() => {
    let live = true;
    void list(q).then((p) => live && setPage(p));
    return () => {
      live = false;
    };
  }, [q, beat, list]);
  const set = (part: Partial<PeopleQuery>) => setQ((x) => ({ ...x, offset: 0, ...part }));
  return (
    <>
      <h3>Everyone</h3>
      <div className="finder">
        <input type="search" placeholder="Find by name" value={q.search} onChange={(e) => set({ search: e.target.value })} />
        <select value={q.filter} onChange={(e) => set({ filter: e.target.value as PeopleQuery["filter"] })} aria-label="Show">
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <select value={q.sort} onChange={(e) => set({ sort: e.target.value as PeopleQuery["sort"] })} aria-label="Sort">
          {SORTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="roster">
        {page?.rows.map((r) => {
          const t = rowText(r);
          return (
            <li key={r.id}>
              <button className="link" onClick={() => onPerson(r.id)}>
                {t.name}
              </button>
              <span className="k">{t.detail}</span>
            </li>
          );
        })}
      </ul>
      {page && (
        <div className="pager">
          <button disabled={page.offset === 0} onClick={() => setQ((x) => ({ ...x, offset: Math.max(0, x.offset - page.pageSize) }))}>
            ‹
          </button>
          <span className="k">{pageText(page.total, page.offset, page.rows.length)}</span>
          <button disabled={page.offset + page.rows.length >= page.total} onClick={() => setQ((x) => ({ ...x, offset: x.offset + page.pageSize }))}>
            ›
          </button>
        </div>
      )}
    </>
  );
}

export function PeoplePanel({ s, onClose, list, onPerson }: { s: Snapshot; onClose: () => void; list: (q: PeopleQuery) => Promise<PeoplePage>; onPerson: (id: number) => void }) {
  const { child, adult, elder } = s.stages;
  const total = Math.max(1, child + adult + elder);
  const r = peopleReport(s);
  return (
    <aside className="inspector people">
      <PanelHeader title="People" onClose={onClose} />
      <div className="stages" role="img" aria-label={`${child} children, ${adult} adults, ${elder} elders`}>
        <div className="child" style={{ width: `${(child / total) * 100}%` }} />
        <div className="adult" style={{ width: `${(adult / total) * 100}%` }} />
        <div className="elder" style={{ width: `${(elder / total) * 100}%` }} />
      </div>
      <p className="legend">
        <span>
          <i className="child" /> {child} {child === 1 ? "child" : "children"}
        </span>
        <span>
          <i className="adult" /> {adult} {adult === 1 ? "adult" : "adults"}
        </span>
        <span>
          <i className="elder" /> {elder} {elder === 1 ? "elder" : "elders"}
        </span>
      </p>
      <p className="k">{r.work}</p>

      {r.leaving && <p className="warn">{r.leaving}</p>}

      <h3>Births</h3>
      <p className={r.births.ok ? "" : "warn"}>{r.births.text}</p>
      <ul className="checks">
        {r.checks.map(([ok, text]) => (
          <li key={text} className={ok ? "ok" : ""}>
            {ok ? "✓" : "✗"} {text}
          </li>
        ))}
      </ul>
      <p className="k">{r.born}</p>

      <h3>School, care and meals</h3>
      {r.care.map((c) => (
        <p key={c.label}>
          <span className="k">{c.label}</span> {c.text}
        </p>
      ))}

      <h3>The departed</h3>
      <p>{r.departed}</p>
      {r.grief && <p className="warn">{r.grief}</p>}

      <h3>Coming up</h3>
      <ul className="upcoming">
        {r.upcoming.map((u, i) => (
          <li key={i}>{u}</li>
        ))}
      </ul>

      <Everyone list={list} tick={s.tick} onPerson={onPerson} />
    </aside>
  );
}

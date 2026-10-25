import { useState } from "react";
import type { Snapshot } from "../sim/snapshot";
import { directory, directoryCategories, type DirFilter, NO_FILTER } from "../view/directory";
import { FloorBadge } from "./RoomName";

// Charts → Directory (T-149): every floor from the surface down and the rooms on
// each, with a dot for how each is doing. Filter by kind of room, by name, or to
// rooms with problems; click a room to open its panel on its floor.

const DOT_TITLES = { ok: "Running", building: "Being built", worn: "Worn", stalled: "Stalled" };

export function DirectoryPanel({ s, onSelect, onClose }: { s: Snapshot; onSelect: (roomId: number) => void; onClose: () => void }) {
  const [filter, setFilter] = useState<DirFilter>(NO_FILTER);
  const floors = directory(s, filter);
  const kinds = directoryCategories(s);
  const count = floors.reduce((n, f) => n + f.rooms.length, 0);
  return (
    <aside className="inspector directory">
      <header>
        <h2>Directory</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <input className="dir-search" type="search" placeholder="Find a room by name" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} aria-label="Find a room" />
      <div className="dir-filters">
        <select value={filter.category ?? ""} onChange={(e) => setFilter({ ...filter, category: e.target.value || null })} aria-label="Kind of room">
          <option value="">Every kind</option>
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <div className="seg small" role="group" aria-label="Show">
          <button className={filter.problems ? "" : "on"} onClick={() => setFilter({ ...filter, problems: false })} aria-pressed={!filter.problems}>
            All
          </button>
          <button className={filter.problems ? "on" : ""} onClick={() => setFilter({ ...filter, problems: true })} aria-pressed={filter.problems} title="Only rooms that are stalled or worn">
            Problems
          </button>
        </div>
      </div>
      {!count && <p className="k">{filter.problems ? "No rooms with problems." : "No rooms match."}</p>}
      {floors.map((f) => (
        <section key={f.floor ?? "surface"} className="dir-floor">
          <h3>
            <FloorBadge floor={f.floor} /> {f.floor === null ? "Surface" : `Floor ${f.floor}`} <span className="k">· {f.rooms.length}</span>
          </h3>
          {f.rooms.map((r) => (
            <button key={r.id} className="dir-room" onClick={() => onSelect(r.id)} title={r.why || "Show it"}>
              <i className={`dot ${r.status}`} aria-label={DOT_TITLES[r.status]} />
              <span className="name">{r.name}</span>
              <span className="k">{r.size}</span>
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
}

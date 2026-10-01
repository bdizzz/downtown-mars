import { useState } from "react";
import { culture } from "../sim/culture";
import { resourceDef } from "../sim/resources";
import type { RouteView, Snapshot } from "../sim/snapshot";
import type { CommandResult } from "../sim/commands";
import type { RouteAction } from "../worker/protocol";
import { num } from "./format";

// The network: every hole, its rovers, and the trade routes between them.

const STEPS = [10, 20, 40, 80];

const HOLE_COLORS = ["#e07a3f", "#6fb3c9", "#b48ad8", "#9bc46a", "#e0c050"];
const colorOf = (s: Snapshot, id: number) => HOLE_COLORS[s.holes.findIndex((h) => h.id === id) % HOLE_COLORS.length]!;

function phaseText(r: RouteView): string {
  if (r.idle) return "parked: no free rover";
  if (r.loadFactor === 0) return "they refuse to load: relations are hostile";
  if (r.phase === "loading") return "waiting for a load";
  const left = Math.max(0, r.legDays * (1 - r.progress));
  const eta = left < 0.05 ? "arriving" : `${left.toFixed(1)} d`;
  return r.phase === "outbound" ? `carrying ${num(r.cargo)} · ${eta}` : `driving back · ${eta}`;
}

export function NetworkPanel({
  s,
  onRoute,
  onClose,
}: {
  s: Snapshot;
  onRoute: (a: RouteAction) => Promise<CommandResult>;
  onClose: () => void;
}) {
  const others = s.holes.filter((h) => h.id !== s.holeId);
  const here = s.holes.find((h) => h.id === s.holeId);
  const [to, setTo] = useState<number | null>(null);
  const [resource, setResource] = useState("metal");
  const [amount, setAmount] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const name = (id: number) => s.holes.find((h) => h.id === id)?.name ?? "?";
  const target = to ?? others[0]?.id ?? null;
  const used = s.routes.filter((r) => r.fromHoleId === s.holeId).length;
  const tradeable = here ? Object.keys(here.stock) : [];

  return (
    <aside className="inspector network">
      <header>
        <h2>Network</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <table className="holes">
        <thead>
          <tr>
            <th>Hole</th>
            <th>People</th>
            <th>Rovers</th>
          </tr>
        </thead>
        <tbody>
          {s.holes.map((h) => (
            <tr key={h.id} className={h.id === s.holeId ? "here" : ""}>
              <td>
                <i className="dot" style={{ background: colorOf(s, h.id) }} />
                {h.name}{h.domed ? " ◓" : ""}
              </td>
              <td>{h.population}</td>
              <td>
                {s.routes.filter((r) => r.fromHoleId === h.id && !r.idle).length}/{h.rovers}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>
        Culture<span className="k">● now ○ heading</span>
      </h3>
      {culture.axes.map((a) => (
        <div key={a.id} className="axis">
          <span>{a.left}</span>
          <div className="track">
            {s.holes.map((h) => (
              <span key={h.id}>
                <i
                  className="target"
                  style={{ left: `${((h.cultureTarget[a.id] + 1) / 2) * 100}%`, borderColor: colorOf(s, h.id) }}
                />
                <i
                  className="now"
                  title={`${h.name}: ${a.left} ${Math.round(((1 - h.culture[a.id]) / 2) * 100)}% · ${a.right} ${Math.round(((1 + h.culture[a.id]) / 2) * 100)}%`}
                  style={{ left: `${((h.culture[a.id] + 1) / 2) * 100}%`, background: colorOf(s, h.id) }}
                />
              </span>
            ))}
          </div>
          <span>{a.right}</span>
        </div>
      ))}
      <div className="legend">
        {s.holes.map((h) => (
          <span key={h.id}>
            <i style={{ background: colorOf(s, h.id) }} />
            {h.name}{h.domed ? " ◓" : ""}
          </span>
        ))}
      </div>

      <h3>Opinion</h3>
      {s.relations.map((r) => (
        <div key={`${r.from}>${r.to}`} className="opinion">
          <span>
            {name(r.from)} of {name(r.to)}
          </span>
          <div className="bar">
            <div
              className={r.opinion >= 0 ? "pos" : "neg"}
              style={{ left: r.opinion >= 0 ? "50%" : `${50 + r.opinion / 2}%`, width: `${Math.abs(r.opinion) / 2}%` }}
            />
          </div>
          <span className={`tier ${r.tier.toLowerCase()}`}>
            {r.opinion >= 0 ? "+" : "−"}
            {Math.abs(Math.round(r.opinion))} {r.tier}
          </span>
        </div>
      ))}

      {s.migrations.length > 0 && (
        <>
          <h3>On the move</h3>
          {s.migrations.map((m, i) => (
            <p key={i} className="k">
              {m.count} {m.count === 1 ? "colonist" : "colonists"} moving from {name(m.from)} to {name(m.to)} · {Math.max(0, m.daysLeft).toFixed(1)} d
            </p>
          ))}
        </>
      )}

      <h3>Routes</h3>
      {s.routes.length === 0 && <p className="k">No routes yet.</p>}
      {s.routes.map((r) => (
        <div key={r.id} className={`route${r.idle ? " idle" : ""}`}>
          <div>
            <strong>
              {name(r.fromHoleId)} → {name(r.toHoleId)}
            </strong>
            : {num(r.amountPerTrip)} {resourceDef(r.resource).name.toLowerCase()} a trip
            <div className="k">
              {phaseText(r)} · {r.legDays.toFixed(1)} d each way
              {r.loadFactor > 0 && Math.abs(r.loadFactor - 1) >= 0.01 && (
                <> · loads {r.loadFactor > 1 ? "+" : "−"}{Math.round(Math.abs(r.loadFactor - 1) * 100)}%</>
              )}
            </div>
            {r.phase !== "loading" && (
              <div className="trip">
                <div
                  className={r.phase}
                  style={{ width: `${Math.round((r.phase === "outbound" ? r.progress : 1 - r.progress) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <button onClick={() => onRoute({ kind: "remove", routeId: r.id })} title="End this route">
            ×
          </button>
        </div>
      ))}

      <h3>
        New route from {s.holeName}
        <span className="k">
          {used}/{here?.rovers ?? 0} rovers busy
        </span>
      </h3>
      {others.length === 0 ? (
        <p className="k">Found a second hole to trade with (Map, M).</p>
      ) : (
        <div className="new-route">
          <label>
            To
            <select value={target ?? ""} onChange={(e) => setTo(Number(e.target.value))}>
              {others.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Carry
            <select value={resource} onChange={(e) => setResource(e.target.value)}>
              {tradeable.map((r) => (
                <option key={r} value={r}>
                  {resourceDef(r).name} ({num(here?.stock[r] ?? 0)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Per trip
            <select value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
              {STEPS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={target === null}
            onClick={async () => {
              if (target === null) return;
              const r = await onRoute({ kind: "add", fromHoleId: s.holeId, toHoleId: target, resource, amountPerTrip: amount });
              setError(r.ok ? null : r.reason);
            }}
          >
            Start route
          </button>
          {error && <p className="warn">{error}</p>}
          {(here?.rovers ?? 0) === 0 && !error && <p className="k">Build a rover depot on the surface first: each holds 2 rovers.</p>}
        </div>
      )}
    </aside>
  );
}

import { useState } from "react";
import { config } from "../sim/config";
import type { Flows } from "../sim/ledger";
import type { Snapshot } from "../sim/snapshot";
import { FLOW_TABS, flowColor, river, waterNote } from "../view/flows";
import { num } from "./format";

// River-style flow diagrams: for each resource, where it comes from (left),
// where it goes (right), per day averaged over recent days. A use that says
// where it went next (the ledger's `then`) gets a third column.

const W = 320;
/** A river with a second step is drawn wider, to fit the third column. */
const W2 = 460;
const LABEL_W = 100;
const BAR = 6;
const GAP = 4;
const MAX_H = 130;

type Node = { label: string; value: number; y: number; h: number };

function stack(entries: [string, number][], scale: number, y = 0): Node[] {
  return entries.map(([label, value]) => {
    const h = Math.max(1.5, value * scale);
    const n = { label, value, y, h };
    y += h + GAP;
    return n;
  });
}

const bottom = (nodes: Node[]) => (nodes.length ? nodes.at(-1)!.y + nodes.at(-1)!.h : 0);

/** A ribbon from one side's node to a slice of the middle bar. */
function ribbon(x1: number, y1: number, x2: number, y2: number, h: number): string {
  const m = (x1 + x2) / 2;
  return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2} L${x2},${y2 + h} C${m},${y2 + h} ${m},${y1 + h} ${x1},${y1 + h} Z`;
}

function River({ resource, flows, stock }: { resource: string; flows: Flows[string] | undefined; stock: number }) {
  const { name, ins, outs, thens, totalIn, totalOut } = river(resource, flows);
  if (!ins.length && !outs.length) {
    return (
      <div className="river">
        <h4>{name}</h4>
        <p className="k">Nothing moving yet. In store: {num(stock)}</p>
      </div>
    );
  }

  const twoStep = outs.some(([label]) => thens[label]);
  const w = twoStep ? W2 : W;
  const scale = MAX_H / Math.max(totalIn, totalOut, 1e-6);
  const left = stack(ins, scale);
  const right = stack(outs, scale);
  // The second step: each use's next places, stacked from the use's own top (or below the last).
  const next: (Node & { from: Node; off: number })[] = [];
  for (const use of right) {
    let off = 0;
    for (const n of stack(thens[use.label] ?? [], scale, Math.max(use.y, next.length ? bottom(next) + GAP : 0))) {
      next.push({ ...n, from: use, off });
      off += n.h;
    }
  }
  const midH = Math.max(totalIn, totalOut) * scale;
  const height = Math.max(midH, bottom(left), bottom(right), bottom(next)) + 4;
  const xL = LABEL_W;
  const xM = twoStep ? 160 : W / 2 - BAR / 2;
  const xR = twoStep ? 250 : W - LABEL_W - BAR;
  const xT = w - LABEL_W - BAR;

  let inOffset = 0;
  let outOffset = 0;
  const net = totalIn - totalOut;
  return (
    <div className="river">
      <h4>
        {name}
        <span className="k">
          {" "}
          · in {num(totalIn)} · out {num(totalOut)} a month · {net >= 0 ? "+" : "−"}
          {num(Math.abs(net))} net · {num(stock)} stored
        </span>
      </h4>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label={`${name} flows`}>
        {left.map((n) => {
          const d = ribbon(xL + BAR, n.y, xM, inOffset, n.h);
          inOffset += n.h;
          return <path key={`i${n.label}`} d={d} fill={flowColor(n.label)} opacity={0.45} />;
        })}
        {right.map((n) => {
          const d = ribbon(xM + BAR, outOffset, xR, n.y, n.h);
          outOffset += n.h;
          return <path key={`o${n.label}`} d={d} fill={flowColor(n.label)} opacity={0.45} />;
        })}
        {next.map((n) => (
          <path key={`t${n.from.label}/${n.label}`} d={ribbon(xR + BAR, n.from.y + n.off, xT, n.y, n.h)} fill={flowColor(n.from.label)} opacity={0.3} />
        ))}
        <rect x={xM} y={0} width={BAR} height={midH} fill="#f0e0d0" opacity={0.8} />
        {left.map((n) => (
          <g key={`li${n.label}`}>
            <rect x={xL} y={n.y} width={BAR} height={n.h} fill={flowColor(n.label)} />
            <text x={xL - 4} y={n.y + n.h / 2} textAnchor="end" dominantBaseline="middle" className="lbl">
              {n.label} {num(n.value)}
            </text>
          </g>
        ))}
        {right.map((n) => (
          <g key={`ro${n.label}`}>
            <rect x={xR} y={n.y} width={BAR} height={n.h} fill={flowColor(n.label)} />
            <text x={xR + BAR + 4} y={n.y + n.h / 2} dominantBaseline="middle" className={twoStep ? "lbl halo" : "lbl"}>
              {n.label} {num(n.value)}
            </text>
          </g>
        ))}
        {next.map((n) => (
          <g key={`tn${n.from.label}/${n.label}`}>
            <rect x={xT} y={n.y} width={BAR} height={n.h} fill={flowColor(n.from.label)} opacity={0.8} />
            <text x={xT + BAR + 4} y={n.y + n.h / 2} dominantBaseline="middle" className="lbl">
              {n.label} {num(n.value)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function FlowPanel({ s, onClose }: { s: Snapshot; onClose: () => void }) {
  const [tab, setTab] = useState("water");
  const current = FLOW_TABS.find((t) => t.id === tab)!;
  const note = waterNote(s.flows);
  const twoStep = current.resources.some((r) => Object.keys(river(r, s.flows[r]).thens).length);

  return (
    <aside className={twoStep ? "inspector flows wide" : "inspector flows"}>
      <header>
        <h2>Flows</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <nav className="tabs">
        {FLOW_TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
      </nav>
      <p className="k">
        Per game day, averaged over the last {config.economy.ledgerDays} days. Overflow is what was made or delivered with nowhere
        to store it.
      </p>
      {tab === "water" && note !== null && <p>{note}</p>}
      {current.resources.map((r) => (
        <River key={r} resource={r} flows={s.flows[r]} stock={s.resources[r] ?? 0} />
      ))}
    </aside>
  );
}

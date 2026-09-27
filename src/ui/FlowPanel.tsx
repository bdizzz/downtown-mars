import { useState } from "react";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import { config } from "../sim/config";
import { LABELS } from "../sim/ledger";
import { resourceDef } from "../sim/resources";
import { roomDefs } from "../sim/rooms";
import type { Snapshot } from "../sim/snapshot";
import { num } from "./format";

// River-style flow diagrams: for each resource, where it comes from (left),
// where it goes (right), per day averaged over recent days.

const TABS: { id: string; name: string; resources: string[] }[] = [
  { id: "water", name: "Water", resources: ["water", "grayWater", "blackWater"] },
  { id: "air", name: "Air", resources: ["o2", "co2"] },
  { id: "food", name: "Food", resources: ["rawFood", "rations", "meals"] },
  { id: "power", name: "Power", resources: ["power"] },
  { id: "materials", name: "Materials", resources: ["rock", "metal", "brick", "machinery", "electronics"] },
];

const FIXED_COLORS: Record<string, string> = {
  [LABELS.colonists]: "#d8c0ae",
  [LABELS.earth]: "#b48ad8",
  [LABELS.digging]: "#9a8574",
  [LABELS.lost]: "#e0503a",
  [LABELS.restrooms]: cssColor(CATEGORY_COLORS.water!),
  Construction: "#c9a456",
};

function colorOf(label: string): string {
  if (FIXED_COLORS[label]) return FIXED_COLORS[label]!;
  const def = roomDefs.find((d) => d.name === label);
  return cssColor(def ? (CATEGORY_COLORS[def.category] ?? 0x888888) : 0x888888);
}

const W = 320;
const LABEL_W = 100;
const BAR = 6;
const GAP = 4;
const MAX_H = 130;
const MIN_FLOW = 0.05;

type Node = { label: string; value: number; y: number; h: number };

function stack(entries: [string, number][], scale: number): Node[] {
  let y = 0;
  return entries.map(([label, value]) => {
    const h = Math.max(1.5, value * scale);
    const n = { label, value, y, h };
    y += h + GAP;
    return n;
  });
}

/** A ribbon from one side's node to a slice of the middle bar. */
function ribbon(x1: number, y1: number, x2: number, y2: number, h: number): string {
  const m = (x1 + x2) / 2;
  return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2} L${x2},${y2 + h} C${m},${y2 + h} ${m},${y1 + h} ${x1},${y1 + h} Z`;
}

function River({ resource, flows, stock }: { resource: string; flows: { in: Record<string, number>; out: Record<string, number> } | undefined; stock: number }) {
  const def = resourceDef(resource);
  const ins = Object.entries(flows?.in ?? {}).filter(([, v]) => v >= MIN_FLOW).sort((a, b) => b[1] - a[1]);
  const outs = Object.entries(flows?.out ?? {})
    .filter(([, v]) => v >= MIN_FLOW)
    .map(([k, v]) => [def.flow && k === LABELS.lost ? "Unused" : k, v] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const totalIn = ins.reduce((s, [, v]) => s + v, 0);
  const totalOut = outs.reduce((s, [, v]) => s + v, 0);
  if (!ins.length && !outs.length) {
    return (
      <div className="river">
        <h4>{def.name}</h4>
        <p className="k">Nothing moving yet. In store: {num(stock)}</p>
      </div>
    );
  }

  const scale = MAX_H / Math.max(totalIn, totalOut, 1e-6);
  const left = stack(ins, scale);
  const right = stack(outs, scale);
  const midH = Math.max(totalIn, totalOut) * scale;
  const height = Math.max(midH, left.at(-1) ? left.at(-1)!.y + left.at(-1)!.h : 0, right.at(-1) ? right.at(-1)!.y + right.at(-1)!.h : 0) + 4;
  const xL = LABEL_W;
  const xM = W / 2 - BAR / 2;
  const xR = W - LABEL_W - BAR;

  let inOffset = 0;
  let outOffset = 0;
  const net = totalIn - totalOut;
  return (
    <div className="river">
      <h4>
        {def.name}
        <span className="k">
          {" "}
          · in {num(totalIn)} · out {num(totalOut)} a day · {net >= 0 ? "+" : "−"}
          {num(Math.abs(net))} net · {num(stock)} stored
        </span>
      </h4>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`${def.name} flows`}>
        {left.map((n) => {
          const d = ribbon(xL + BAR, n.y, xM, inOffset, n.h);
          inOffset += n.h;
          return <path key={`i${n.label}`} d={d} fill={colorOf(n.label)} opacity={0.45} />;
        })}
        {right.map((n) => {
          const d = ribbon(xM + BAR, outOffset, xR, n.y, n.h);
          outOffset += n.h;
          return <path key={`o${n.label}`} d={d} fill={colorOf(n.label)} opacity={0.45} />;
        })}
        <rect x={xM} y={0} width={BAR} height={midH} fill="#f0e0d0" opacity={0.8} />
        {left.map((n) => (
          <g key={`li${n.label}`}>
            <rect x={xL} y={n.y} width={BAR} height={n.h} fill={colorOf(n.label)} />
            <text x={xL - 4} y={n.y + n.h / 2} textAnchor="end" dominantBaseline="middle" className="lbl">
              {n.label} {num(n.value)}
            </text>
          </g>
        ))}
        {right.map((n) => (
          <g key={`ro${n.label}`}>
            <rect x={xR} y={n.y} width={BAR} height={n.h} fill={colorOf(n.label)} />
            <text x={xR + BAR + 4} y={n.y + n.h / 2} dominantBaseline="middle" className="lbl">
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
  const current = TABS.find((t) => t.id === tab)!;
  const water = s.flows.water;
  const recycled = water?.in["Water recycler"] ?? 0;
  const used = Object.entries(water?.out ?? {})
    .filter(([k]) => k !== LABELS.lost)
    .reduce((a, [, v]) => a + v, 0);

  return (
    <aside className="inspector flows">
      <header>
        <h2>Flows</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
      </nav>
      <p className="k">
        Per game day, averaged over the last {config.economy.ledgerDays} days. Overflow is what was made or delivered with nowhere
        to store it.
      </p>
      {tab === "water" && used > 0 && (
        <p>
          <strong>{Math.round((recycled / used) * 100)}%</strong> of the clean water used comes back from recycling.
          {recycled === 0 && " Build a water recycler to close the loop."}
        </p>
      )}
      {current.resources.map((r) => (
        <River key={r} resource={r} flows={s.flows[r]} stock={s.resources[r] ?? 0} />
      ))}
    </aside>
  );
}

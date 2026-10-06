import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import { LABELS, type Flows } from "../sim/ledger";
import { resourceDef } from "../sim/resources";
import { roomDefs } from "../sim/rooms";

// Where each resource comes from and goes, as the flow panel shows it: the tabs, each source and
// use with its colour, biggest first. Shared by the web's panel (ui/FlowPanel.tsx) and the Godot
// viewer's (src/bridge/charts.ts).

export const FLOW_TABS: { id: string; name: string; resources: string[] }[] = [
  { id: "water", name: "Water", resources: ["water", "grayWater", "tailings"] },
  { id: "air", name: "Air", resources: ["o2", "co2"] },
  { id: "food", name: "Food", resources: ["rawFood", "rations", "meals"] },
  { id: "power", name: "Power", resources: ["power"] },
  { id: "materials", name: "Materials", resources: ["rock", "metal", "brick", "machinery", "electronics", "ore", "silica", "wafers"] },
];

const FIXED_COLORS: Record<string, string> = {
  [LABELS.colonists]: "#d8c0ae",
  [LABELS.earth]: "#b48ad8",
  [LABELS.digging]: "#9a8574",
  [LABELS.lost]: "#e0503a",
  [LABELS.household]: "#e8b88a",
  Construction: "#c9a456",
};

/** A source's or a use's colour: its room's category, or its own for the colonists (and their household water), Earth, digging and overflow. */
export function flowColor(label: string): string {
  if (FIXED_COLORS[label]) return FIXED_COLORS[label]!;
  if (label.startsWith("Rover ")) return "#6fb3c9";
  const def = roomDefs.find((d) => d.name === label);
  return cssColor(def ? (CATEGORY_COLORS[def.category] ?? 0x888888) : 0x888888);
}

/** Flows smaller than this (a day) aren't shown. */
export const MIN_FLOW = 0.05;

export interface River {
  resource: string;
  name: string;
  ins: [string, number][];
  outs: [string, number][];
  totalIn: number;
  totalOut: number;
}

/** One resource's sources and uses, biggest first (for a flow, what's lost is "Unused"). */
export function river(resource: string, flows: Flows[string] | undefined): River {
  const def = resourceDef(resource);
  const ins = Object.entries(flows?.in ?? {})
    .filter(([, v]) => v >= MIN_FLOW)
    .sort((a, b) => b[1] - a[1]);
  const outs = Object.entries(flows?.out ?? {})
    .filter(([, v]) => v >= MIN_FLOW)
    .map(([k, v]) => [def.flow && k === LABELS.lost ? "Unused" : k, v] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  return { resource, name: def.name, ins, outs, totalIn: ins.reduce((s, [, v]) => s + v, 0), totalOut: outs.reduce((s, [, v]) => s + v, 0) };
}

/** The share of clean water used that comes back from recycling, or null with none used. */
export function recycledShare(flows: Flows): number | null {
  const water = flows.water;
  const recycled = water?.in["Water recycler"] ?? 0;
  const used = Object.entries(water?.out ?? {})
    .filter(([k]) => k !== LABELS.lost)
    .reduce((a, [, v]) => a + v, 0);
  return used > 0 ? recycled / used : null;
}

/** The water tab's line on the loop: how much comes back, and what to build when it doesn't. Null with no water used. */
export function waterNote(flows: Flows): string | null {
  const share = recycledShare(flows);
  if (share === null) return null;
  const recycled = flows.water?.in["Water recycler"] ?? 0;
  const spilled = flows.grayWater?.out[LABELS.lost] ?? 0;
  let note = `${Math.round(share * 100)}% of the clean water used comes back from recycling.`;
  if (recycled === 0) note += " Build a water recycler to close the loop.";
  else if (spilled >= MIN_FLOW) note += ` ${Math.round(spilled)} gray water a day overflows: another recycler, or a tank set to hold gray water.`;
  return note;
}

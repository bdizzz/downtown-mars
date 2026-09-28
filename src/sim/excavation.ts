import type { SimConfig } from "./config";
import { LABELS, record } from "./ledger";
import type { Cell, Layout } from "./placement";
import type { SimState } from "./state";

// Every cell is solid rock until it's excavated. The drill only sinks the
// shaft; rooms are carved out of the rock around it, one construction job at
// a time, and bring up that rock (and whatever the hole sits on) as they go.
// An excavated cell with no room in it is empty space: pillars, no walls,
// walk-through like a plaza.

/** Is this cell excavated (empty space or a room)? */
export function isOpen(layout: Layout, c: Cell): boolean {
  return layout.open?.[c.floor - 1]?.[c.ring - 1]?.[c.slot] === 1;
}

/** Mark cells excavated. */
export function openCells(layout: Layout, cells: Cell[]): void {
  for (const c of cells) {
    const row = layout.open?.[c.floor - 1]?.[c.ring - 1];
    if (row && c.slot < row.length) row[c.slot] = 1;
  }
}

/** The cells still solid rock. */
export function rockCells(layout: Layout, cells: Cell[]): Cell[] {
  return cells.filter((c) => !isOpen(layout, c));
}

/** Excavated cells with no room in them, on dug floors. */
export function emptyCells(layout: Layout): Cell[] {
  const out: Cell[] = [];
  const floors = Math.min(layout.hole.floors, layout.open?.length ?? 0);
  for (let f = 0; f < floors; f++) {
    layout.open![f]!.forEach((ring, ri) =>
      ring.forEach((v, slot) => {
        if (v === 1 && !layout.grid[f]?.[ri]?.[slot]) out.push({ floor: f + 1, ring: ri + 1, slot });
      }),
    );
  }
  return out;
}

/** The shaft's floor area in slots: what the drill brings up per floor. */
export function shaftSlots(layout: Layout, cfg: SimConfig): number {
  const r = layout.hole.shaftRadiusM;
  return (Math.PI * r * r) / (cfg.geometry.slotWidthM * cfg.geometry.roomDepthM);
}

/** Rock, and whatever the hole sits on, from digging out `slots` slots' worth. */
export function yieldRock(state: SimState, cfg: SimConfig, slots: number, label: string = LABELS.excavation): void {
  if (slots <= 0) return;
  const rock = slots * cfg.digging.rockPerSlot;
  state.resources.rock = (state.resources.rock ?? 0) + rock;
  record(state, "rock", "in", label, rock);
  for (const kind of state.deposits ?? []) {
    for (const [id, perSlot] of Object.entries(cfg.digging.depositYieldsPerSlot[kind] ?? {})) {
      const amount = slots * perSlot;
      state.resources[id] = (state.resources[id] ?? 0) + amount;
      record(state, id, "in", label, amount);
    }
  }
}

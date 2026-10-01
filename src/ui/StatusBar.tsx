import { roomName } from "../sim/roomName";
import type { ViewMode } from "./settings";
import type { HoverInfo, Tool } from "../view/types";
import { reachSummary } from "../view/reachView";
import type { Hole } from "../sim/geometry";
import { effectAt, effectName, FIELD_TYPES } from "../sim/effects";
import type { Snapshot } from "../sim/snapshot";
import { num, resName, signed } from "./format";
import { finishDef, floorLinked } from "../sim/corridors";
import { construction } from "../sim/construction";
import { config } from "../sim/config";

const deg = (turns: number) => `${Math.round(turns * 360)}°`;

function where(info: HoverInfo, hole: Hole): string {
  const p = info.pick;
  switch (p.kind) {
    case "surface":
      return `Surface · ${Math.round(p.angle)}°`;
    case "gallery":
      return `Floor ${p.floor}${p.digging ? " (being dug)" : ""} · shaft gallery`;
    case "rock":
      return "Solid rock";
    case "slot": {
      const n = hole.ringSlots[p.ring - 1]!;
      const lock = p.locked ? " · locked (needs reinforcement frames)" : "";
      const dig = p.digging ? " (being dug)" : "";
      return `Floor ${p.floor}${dig} · ring ${p.ring} · slot ${p.slot + 1} of ${n} · ${deg(p.slot / n)}–${deg((p.slot + 1) / n)}${lock}`;
    }
  }
}

interface Props {
  info: HoverInfo | null;
  /** The tool in hand: placing a room shows what it would reach on foot. */
  tool?: Tool;
  snapshot: Snapshot | null;
  notice: string | null;
  overlay: string | null;
  /** Which view is showing: the plan zooms with the wheel. */
  view: ViewMode;
}

/** "noise −1.3 · health +0.7" for a slot, skipping effects that are ~0. */
function effectsHere(s: Snapshot, cell: { floor: number; ring: number; slot: number }): string {
  return FIELD_TYPES.map((t) => [t, effectAt(s.effects, t, cell)] as const)
    .filter(([, v]) => Math.abs(v) >= 0.05)
    .map(([t, v]) => `${effectName(t)} ${signed(v)}`)
    .join(" · ");
}

/** Average effects over some cells: what a room placed there would live with. */
function feltOver(s: Snapshot, cells: { floor: number; ring: number; slot: number }[]): string {
  if (!cells.length) return "";
  return FIELD_TYPES.map((t) => [t, cells.reduce((sum, c) => sum + effectAt(s.effects, t, c), 0) / cells.length] as const)
    .filter(([, v]) => Math.abs(v) >= 0.05)
    .map(([t, v]) => `${effectName(t)} ${signed(v)}`)
    .join(", ");
}

export function StatusBar({ info, snapshot, notice, overlay, view, tool }: Props) {
  const hole = snapshot?.layout.hole;
  let text = view === "plan" ? "Drag to pan · scroll or pinch to zoom" : "Drag to pan · scroll to move · pinch or ctrl+scroll to zoom";
  let bad = false;
  if (notice) {
    text = notice;
    bad = true;
  } else if (info && hole) {
    text = where(info, hole);
    const e = info.edge;
    if (e) {
      const cost = Object.entries(e.cost)
        .map(([id, v]) => `${num(v)} ${resName(id).toLowerCase()}`)
        .join(", ");
      const here = e.finish ? `${finishDef(e.finish).name} corridor${e.linked ? "" : ", not linked to the entrance yet"}` : "";
      if (e.refusal) {
        text = `${e.refusal}${here ? ` · ${here}` : ""} · ${text}`;
        bad = true;
      } else if (e.windows) {
        const onto = e.windows.across === "shaft" ? "over the shaft" : e.windows.across === "public" ? "onto the walk-through room" : "onto the corridor";
        const felt = e.windows.comfort !== null ? `; the home's windows give comfort ${e.windows.comfort > 0 ? "+" : ""}${Math.round(e.windows.comfort * 100) / 100}` : "";
        text = e.erase ? `Take the windows out of this wall (free)${felt} · ${text}` : `Put windows in this wall, looking ${onto}: ${cost || "free"}${felt} · ${text}`;
      } else if (e.bulkhead) text = e.erase ? `Take out this bulkhead (free) · ${text}` : `Fit a bulkhead here: ${cost}. Air and smell stop at it; people pass · ${text}`;
      else if (e.erase) text = `Fill in this ${here.toLowerCase()}, rebuilding the walls: ${cost} · ${text}`;
      else text = `Carve a corridor here: ${cost} · ${text}`;
    } else if (info.check && !info.check.ok) {
      text = `${info.check.reason} · ${text}`;
      bad = true;
    } else if (info.check?.ok && snapshot) {
      const felt = feltOver(snapshot, info.check.cells);
      const onFoot = tool?.kind === "build" && info.check.cells.length ? reachSummary(snapshot.layout, tool.room, info.check.cells) : "";
      const blueprint = info.check.planned ? "Blueprint: builds when this floor is dug · " : "";
      const floor = info.check.cells[0]?.floor ?? 1;
      const cutOff = !info.check.unconnected
        ? ""
        : floor > 1 && !floorLinked(snapshot.layout, floor) && !info.check.planned
          ? `⚠ No stairs reach floor ${floor} from the entrance yet: it won't work until they do · `
          : "⚠ No corridor reaches here yet: it won't work until one does · ";
      // Solid rock is dug out first: time, and rock coming up.
      const rock = info.check.rock ?? 0;
      const digs = rock
        ? `Digs out ${rock} ${rock === 1 ? "cell" : "cells"} of rock first: ${num(rock * construction.excavationHoursPerSlot)} h, +${num(rock * config.digging.rockPerSlot)} rock · `
        : "";
      const note = info.check.note ? `＋ ${info.check.note} · ` : "";
      const d = info.check.destroys?.length ?? 0;
      const lost = (info.check.strands?.rooms.length ?? 0) + (info.check.strands?.corridors.length ?? 0);
      if (d) bad = true;
      const over = d ? `⚠ Fills in ${d} corridor ${d === 1 ? "segment" : "segments"}${lost ? `, cutting off ${lost} more` : ""} · ` : "";
      text = `${over}${note}${cutOff}${blueprint}${digs}${onFoot ? `On foot: ${onFoot} · ` : ""}${felt ? `Felt here: ${felt} · ` : ""}${text}`;
    } else if (info.room) {
      const blueprint = info.room.planned ? " (blueprint)" : "";
      const st = snapshot?.roomStatus[info.room.id];
      const running = st && !info.room.planned && info.room.connected ? ` · ${Math.round(st.rate * 100)}%` : "";
      text = `${roomName(info.room)}${blueprint}${running}${info.room.connected ? "" : " · no access: connect it with a corridor"} · click for details · ${text}`;
      bad = !info.room.connected;
    }
  }
  if (!notice && overlay && snapshot && info?.pick.kind === "slot") {
    text = `${effectsHere(snapshot, info.pick) || "no effects here"} · ${text}`;
  }
  return <footer className={`status${bad ? " bad" : ""}`}>{text}</footer>;
}

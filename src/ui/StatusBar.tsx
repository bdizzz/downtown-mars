import type { HoverInfo } from "../view/types";
import type { Hole } from "../sim/geometry";
import { effectAt, FIELD_TYPES } from "../sim/effects";
import type { Snapshot } from "../sim/snapshot";
import { num, resName, signed } from "./format";
import { finishDef } from "../sim/corridors";
import { roomDef } from "../sim/rooms";

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
  snapshot: Snapshot | null;
  notice: string | null;
  overlay: string | null;
}

/** "noise −1.3 · health +0.7" for a slot, skipping effects that are ~0. */
function effectsHere(s: Snapshot, cell: { floor: number; ring: number; slot: number }): string {
  return FIELD_TYPES.map((t) => [t, effectAt(s.effects, t, cell)] as const)
    .filter(([, v]) => Math.abs(v) >= 0.05)
    .map(([t, v]) => `${t} ${signed(v)}`)
    .join(" · ");
}

/** Average effects over some cells: what a room placed there would live with. */
function feltOver(s: Snapshot, cells: { floor: number; ring: number; slot: number }[]): string {
  if (!cells.length) return "";
  return FIELD_TYPES.map((t) => [t, cells.reduce((sum, c) => sum + effectAt(s.effects, t, c), 0) / cells.length] as const)
    .filter(([, v]) => Math.abs(v) >= 0.05)
    .map(([t, v]) => `${t} ${signed(v)}`)
    .join(", ");
}

export function StatusBar({ info, snapshot, notice, overlay }: Props) {
  const hole = snapshot?.layout.hole;
  let text = "Drag to pan · scroll to move · pinch or ctrl+scroll to zoom";
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
      const here = e.finish ? `${finishDef(e.finish).name} corridor${e.linked ? "" : ", not linked to the shaft yet"}` : "";
      if (e.refusal) {
        text = `${e.refusal}${here ? ` · ${here}` : ""} · ${text}`;
        bad = true;
      } else if (e.erase) text = `Fill in this ${here.toLowerCase()}, rebuilding the walls: ${cost} · ${text}`;
      else text = `Carve a corridor here: ${cost} · ${text}`;
    } else if (info.check && !info.check.ok) {
      text = `${info.check.reason} · ${text}`;
      bad = true;
    } else if (info.check?.ok && snapshot) {
      const felt = feltOver(snapshot, info.check.cells);
      const blueprint = info.check.planned ? "Blueprint: builds when this floor is dug · " : "";
      const cutOff = info.check.unconnected ? "⚠ No corridor reaches here yet: it won't work until one does · " : "";
      const note = info.check.note ? `＋ ${info.check.note} · ` : "";
      text = `${note}${cutOff}${blueprint}${felt ? `Felt here: ${felt} · ` : ""}${text}`;
    } else if (info.room) {
      const def = roomDef(info.room.type);
      const blueprint = info.room.planned ? " (blueprint)" : "";
      const st = snapshot?.roomStatus[info.room.id];
      const running = st && !info.room.planned && info.room.connected ? ` · ${Math.round(st.rate * 100)}%` : "";
      text = `${def.name}${blueprint}${running}${info.room.connected ? "" : " · no access: connect it with a corridor"} · click for details · ${text}`;
      bad = !info.room.connected;
    }
  }
  if (!notice && overlay && snapshot && info?.pick.kind === "slot") {
    text = `${effectsHere(snapshot, info.pick) || "no effects here"} · ${text}`;
  }
  return <footer className={`status${bad ? " bad" : ""}`}>{text}</footer>;
}

import type { HoverInfo } from "../render2d/stage";
import type { Hole } from "../sim/geometry";
import { roomDef } from "../sim/rooms";

const deg = (turns: number) => `${Math.round(turns * 360)}°`;

function where(info: HoverInfo, hole: Hole): string {
  const p = info.pick;
  switch (p.kind) {
    case "surface":
      return `Surface · ${Math.round(p.angle)}°`;
    case "gallery":
      return `Floor ${p.floor} · shaft gallery`;
    case "rock":
      return "Solid rock";
    case "slot": {
      const n = hole.ringSlots[p.ring - 1]!;
      const lock = p.locked ? " · locked (needs reinforcement frames)" : "";
      return `Floor ${p.floor} · ring ${p.ring} · slot ${p.slot + 1} of ${n} · ${deg(p.slot / n)}–${deg((p.slot + 1) / n)}${lock}`;
    }
  }
}

interface Props {
  info: HoverInfo | null;
  hole: Hole | undefined;
  notice: string | null;
}

export function StatusBar({ info, hole, notice }: Props) {
  let text = "Drag to pan · scroll to move · pinch or ctrl+scroll to zoom";
  let bad = false;
  if (notice) {
    text = notice;
    bad = true;
  } else if (info && hole) {
    text = where(info, hole);
    if (info.check && !info.check.ok) {
      text = `${info.check.reason} · ${text}`;
      bad = true;
    } else if (info.room) {
      const def = roomDef(info.room.type);
      text = `${def.name}${info.room.connected ? "" : " · no access: connect it with a corridor"} · ${text}`;
      bad = !info.room.connected;
    }
  }
  return <footer className={`status${bad ? " bad" : ""}`}>{text}</footer>;
}

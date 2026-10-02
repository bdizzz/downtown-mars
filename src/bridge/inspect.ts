import * as THREE from "three";
import { config } from "../sim/config";
import { conditionOf, hasCondition } from "../sim/condition";
import { roomSpec } from "../sim/economy";
import type { SimState } from "../sim/state";
import { roomDef } from "../sim/rooms";
import { roomName } from "../sim/roomName";
import { outlineGeometry, roomGeometry } from "../render3d/rooms3d";
import { pickAt } from "../render3d/cylinder";
import { num, resName } from "../ui/format";
import { isProblem, roomState } from "../view/roomState";

// The Godot viewer's room panel: what was clicked, and what that room is and how it's doing, in a
// few lines as the web's inspector (ui/Inspector.tsx) puts them, with its outline to draw.

export interface InspectedMessage {
  type: "inspected";
  roomId: number | null;
  title?: string;
  subtitle?: string;
  state?: string;
  problem?: boolean;
  lines?: string[];
  /** The room's outline: float32 line segments (xyz pairs), base64. */
  outline?: string;
}

/** The room at a world point (as the web view picks), or null. */
export function roomAtPoint(state: SimState, [x, y, z]: [number, number, number]): number | null {
  const pick = pickAt(state.layout.hole, x, y, z);
  if (pick.kind !== "slot") return null;
  return state.layout.grid[pick.floor - 1]?.[pick.ring - 1]?.[pick.slot] || null;
}

const flows = (label: string, f: Record<string, number>) => {
  const list = Object.entries(f).filter(([, v]) => v > 0);
  return list.length ? `${label}: ${list.map(([id, v]) => `${resName(id)} ${num(v)}`).join(", ")} a day` : null;
};

export function inspect(state: SimState, roomId: number | null): InspectedMessage {
  const room = roomId === null ? undefined : state.layout.rooms.find((r) => r.id === roomId);
  if (!room) return { type: "inspected", roomId: null };
  const def = roomDef(room.type);
  const st = state.roomStatus[room.id];
  const spec = roomSpec(room, config);
  const floors = [...new Set(room.cells.map((c) => c.floor))].sort((a, b) => a - b);
  const where = floors.length > 1 ? `floors ${floors[0]}–${floors.at(-1)}` : `floor ${floors[0] ?? "surface"}`;
  const lines = [
    spec.staff > 0 && !room.planned && !room.building ? `Staff: ${st?.staff ?? 0} of ${st?.staffNeeded ?? spec.staff}` : null,
    def.houses ? `Homes for ${def.houses}` : null,
    flows("Makes", spec.makes),
    flows("Uses", spec.uses),
    !room.planned && !room.building && hasCondition(room) ? `Condition: ${Math.round(conditionOf(room) * 100)}%` : null,
  ].filter((l): l is string => !!l);

  // Its outline, in world space, as line pairs.
  const geo = roomGeometry(state.layout, room.cells);
  const edges = outlineGeometry(geo);
  const pos = edges.getAttribute("position") as THREE.BufferAttribute;
  const outline = Buffer.from(new Float32Array(pos.array).buffer).toString("base64");
  geo.dispose();
  edges.dispose();

  return {
    type: "inspected",
    roomId: room.id,
    title: roomName(room),
    subtitle: `${def.name} · ${where}`,
    state: roomState(state.layout, room, st),
    problem: isProblem(room, st),
    lines,
    outline,
  };
}

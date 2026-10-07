import * as THREE from "three";
import { config } from "../sim/config";
import { hasCondition } from "../sim/condition";
import { corridors, finishDef } from "../sim/corridors";
import { cropDefs } from "../sim/resources";
import type { Snapshot } from "../sim/snapshot";
import { STORABLE } from "../sim/storage";
import { conditionColor } from "../view/conditionView";
import { conditionNote, constructionInfo, panelRows, seedKitInfo, stopAtInfo, type Row } from "../view/roomPanel";
import { holding, roomSpec } from "../sim/economy";
import type { SimState } from "../sim/state";
import { roomDef } from "../sim/rooms";
import { roomName } from "../sim/roomName";
import { outlineGeometry, roomGeometry } from "../render3d/rooms3d";
import { pickAt } from "../render3d/cylinder";
import { num, resName } from "../ui/format";
import { isProblem, roomState } from "../view/roomState";

// The Godot viewer's room panel: what was clicked, what that room is and how it's doing, and its
// controls, as the web's inspector (ui/Inspector.tsx) has them (the rows from view/roomPanel.ts, shared
// with it), with its outline to draw.

export interface InspectedMessage {
  type: "inspected";
  roomId: number | null;
  title?: string;
  /** The player's name for it ("" when it has its usual one), and that usual name, for renaming. */
  name?: string;
  defaultName?: string;
  subtitle?: string;
  state?: string;
  problem?: boolean;
  /** The room's outline: float32 line segments (xyz pairs), base64. */
  outline?: string;
  /** For its buttons: whether a corridor reaches it, and whether it's still a blueprint or being built. */
  connected?: boolean;
  unbuilt?: boolean;
  /** As the web's inspector (ui/Inspector.tsx), top to bottom; each part only when it applies. */
  construction?: { jobId: number; progress: number; text: string; canPrioritize: boolean };
  condition?: { value: number; color: string; note: string };
  storage?: { space: number; summary: string; goods: { id: string; name: string; on: boolean; amount: number; fill: number }[] };
  /** Connect with a corridor: the finish's name. */
  connect?: { finish: string; name: string };
  before?: Row[];
  kit?: { progress: number; goods: string; button: string | null; note: string; gathering: boolean };
  after?: Row[];
  crop?: { value: string; options: { id: string; label: string }[] };
  /** What a tank holds (clean, gray water or tailings). */
  holds?: { value: string; options: { id: string; label: string }[] };
  priority?: { value: string; options: { id: string; label: string }[] };
  /** Running, and (a room with an output) standing by at a stock of it: resource null when it has none. */
  controls?: { running: boolean; stopAt: number | null; suggested: number; resource: string | null };
  demolish?: string;
}

/** The room at a world point (as the web view picks), or null. */
export function roomAtPoint(state: SimState, [x, y, z]: [number, number, number]): number | null {
  const pick = pickAt(state.layout.hole, x, y, z);
  if (pick.kind !== "slot") return null;
  return state.layout.grid[pick.floor - 1]?.[pick.ring - 1]?.[pick.slot] || null;
}

export function inspect(state: SimState, s: Snapshot, roomId: number | null): InspectedMessage {
  const room = roomId === null ? undefined : state.layout.rooms.find((r) => r.id === roomId);
  if (!room) return { type: "inspected", roomId: null };
  const def = roomDef(room.type);
  const st = state.roomStatus[room.id];
  const spec = roomSpec(room, config);
  const floors = [...new Set(room.cells.map((c) => c.floor))].sort((a, b) => a - b);
  const where = floors.length > 1 ? `floors ${floors[0]}–${floors.at(-1)}` : `floor ${floors[0] ?? "surface"}`;
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

  // Its outline, in world space, as line pairs.
  const geo = roomGeometry(state.layout, room.cells);
  const edges = outlineGeometry(geo);
  const pos = edges.getAttribute("position") as THREE.BufferAttribute;
  const outline = Buffer.from(new Float32Array(pos.array).buffer).toString("base64");
  geo.dispose();
  edges.dispose();

  const msg: InspectedMessage = {
    type: "inspected",
    roomId: room.id,
    title: roomName(room),
    name: room.name ?? "",
    defaultName: def.name,
    subtitle: `${def.name} · ${where}`,
    state: roomState(state.layout, room, st),
    problem: isProblem(room, st),
    outline,
    connected: room.connected,
    unbuilt: room.planned || !!room.building,
    ...panelRows(s, room),
  };
  const job = constructionInfo(s, room.id);
  if (job) msg.construction = job;
  if (!room.planned && !room.building && hasCondition(room)) {
    const value = room.condition ?? 1;
    msg.condition = { value, color: hex(conditionColor(value)), note: conditionNote(s, room.id, room.repair) };
  }
  const space = room.storageUnits ?? def.storage ?? 0;
  if (space) {
    const alloc = room.allocation ?? {};
    const fill = (id: string) => {
      const cap = s.capacities[id] ?? 0;
      return cap > 0 && Number.isFinite(cap) ? Math.min(alloc[id] ?? 0, ((s.resources[id] ?? 0) * (alloc[id] ?? 0)) / cap) : 0;
    };
    const used = Object.values(alloc).reduce((a, b) => a + b, 0);
    const stored = Object.keys(alloc).reduce((n, id) => n + fill(id), 0);
    msg.storage = {
      space,
      summary: `${num(stored)} stored · ${num(used)} of ${space} set aside`,
      goods: STORABLE.map((id) => ({ id, name: resName(id), on: alloc[id] !== undefined, amount: alloc[id] ?? 0, fill: fill(id) })),
    };
  }
  if (!room.connected && room.at.kind === "ring") msg.connect = { finish: corridors.defaultFinish, name: finishDef(corridors.defaultFinish).name.toLowerCase() };
  if (def.stagesSeedKit) msg.kit = { ...seedKitInfo(s), gathering: s.kit.gathering };
  if (def.growsCrops) msg.crop = { value: room.crop ?? "", options: cropDefs.map((c) => ({ id: c.id, label: `${c.name} (${c.group}, ${c.yield}/day)` })) };
  const held = holding(room);
  if (held) msg.holds = { value: held, options: (def.holds ?? []).map((id) => ({ id, label: resName(id) })) };
  if (spec.staff > 0) {
    msg.priority = { value: room.priority, options: config.economy.priorities.map((p) => ({ id: p, label: p[0]!.toUpperCase() + p.slice(1) })) };
    if (def.buildable) {
      const stop = stopAtInfo(s, room);
      msg.controls = stop
        ? { running: !room.paused, stopAt: room.stopAt ?? null, suggested: stop.suggested, resource: resName(stop.resource).toLowerCase() }
        : { running: !room.paused, stopAt: null, suggested: 0, resource: null };
    }
  }
  if (def.buildable) msg.demolish = room.building ? "Cancel construction (full refund)" : `Demolish (${room.planned ? "full refund" : `${config.economy.demolishRefund * 100}% refund`})`;
  return msg;
}

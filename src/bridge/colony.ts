import { cssColor } from "../render2d/palette";
import { roomFloor, roomName } from "../sim/roomName";
import type { Snapshot } from "../sim/snapshot";
import { hoursText, num } from "../ui/format";
import { peopleReport } from "../view/colony";
import { conditionColor } from "../view/conditionView";

// The colony panels for the Godot viewer, as the web's (ui/PeoplePanel.tsx, ConstructionPanel.tsx,
// MaintenancePanel.tsx): people, the construction queue, and upkeep. Rooms come with their ids, so
// the viewer can show one when its name is clicked.

type Snap = Snapshot;
const pct = (v: number) => `${Math.round(v * 100)}%`;

function roomRef(s: Snap, id: number): { id: number; name: string } {
  const room = s.layout.rooms.find((r) => r.id === id);
  if (!room) return { id, name: "?" };
  const f = roomFloor(room);
  return { id, name: `${roomName(room)} (${f === null ? "surface" : `F${f}`})` };
}

export interface PeopleMessage {
  type: "colonyPeople";
  stages: { child: number; adult: number; elder: number };
  report: ReturnType<typeof peopleReport>;
}

export function peopleView(s: Snap): PeopleMessage {
  return { type: "colonyPeople", stages: { child: s.stages.child, adult: s.stages.adult, elder: s.stages.elder }, report: peopleReport(s) };
}

export interface ConstructionMessage {
  type: "colonyConstruction";
  bandwidth: string;
  jobs: { id: number; room: { id: number; name: string } | null; label: string; note: string; when: string; progress: number; first: boolean }[];
}

export function constructionView(s: Snap): ConstructionMessage {
  const ids = new Set(s.layout.rooms.map((r) => r.id));
  return {
    type: "colonyConstruction",
    bandwidth: `${num(s.construction.bandwidth)} work-hours an hour`,
    jobs: s.construction.jobs.map((j, i) => ({
      id: j.id,
      room: j.roomId !== undefined && ids.has(j.roomId) ? roomRef(s, j.roomId) : null,
      label: j.label,
      note: j.note ?? "",
      when: j.hoursLeft === null ? "waits for its floor" : hoursText(j.hoursLeft),
      progress: j.progress,
      first: i === 0,
    })),
  };
}

export interface MaintenanceMessage {
  type: "colonyMaintenance";
  overall: number;
  overallText: string;
  overallColor: string;
  lanes: { by: { id: number; name: string }; icon: string; idle: string | null; target: { id: number; name: string } | null; done: string; condition: number; color: string; progress: number | null }[];
  queue: { room: { id: number; name: string }; text: string; condition: number; color: string; progress: number | null }[];
}

export function maintenanceViewOf(s: Snap): MaintenanceMessage {
  const { overall, queue, lanes } = s.maintenance;
  return {
    type: "colonyMaintenance",
    overall,
    overallText: pct(overall),
    overallColor: cssColor(conditionColor(overall)),
    lanes: lanes.map((l) => ({
      by: roomRef(s, l.by),
      icon: l.kind === "all" ? "🛠" : "🧽",
      idle: l.target === null ? (l.working ? "waiting for work" : "not working") : null,
      target: l.target === null ? null : roomRef(s, l.target),
      done: `${pct(l.progress ?? 0)} done`,
      condition: l.condition ?? 0,
      color: cssColor(conditionColor(l.condition ?? 0)),
      progress: l.progress,
    })),
    queue: queue.map((q) => ({
      room: roomRef(s, q.roomId),
      text: `${q.progress !== null ? `${pct(q.progress)} done · ` : ""}${pct(q.condition)}`,
      condition: q.condition,
      color: cssColor(conditionColor(q.condition)),
      progress: q.progress,
    })),
  };
}

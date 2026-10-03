import { ROOM_NAME_MAX, roomName } from "../sim/roomName";
import type { RoomInstance } from "../sim/placement";
import { RoomName } from "./RoomName";
import { cssColor } from "../render2d/palette";
import { hasCondition } from "../sim/condition";
import { conditionColor } from "../view/conditionView";
import { useState } from "react";
import type { SimCommand } from "../sim/commands";
import { config, type Priority } from "../sim/config";
import { roomSpec } from "../sim/economy";
import { cropDefs } from "../sim/resources";
import { roomDef } from "../sim/rooms";
import type { Snapshot } from "../sim/snapshot";
import { corridors, finishDef } from "../sim/corridors";
import { STORABLE } from "../sim/storage";
import { num, resName } from "./format";
import { conditionNote, constructionInfo, panelRows, seedKitInfo, stopAtInfo, type Row } from "../view/roomPanel";
import { isProblem, roomState } from "../view/roomState";

interface Props {
  s: Snapshot;
  /** The finish Connect carves in: the corridor tool's last one. */
  finish?: string;
  roomId: number;
  onCommand: (cmd: SimCommand) => void;
  onClose: () => void;
}

/** Rows of the panel (view/roomPanel.ts): a dimmed label, then the text. */
function Rows({ rows }: { rows: Row[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <p key={i} className={r.warn ? "warn" : undefined}>
          {r.k && <span className="k">{r.k}</span>} {r.text}
        </p>
      ))}
    </>
  );
}

function SeedKit({ s, onCommand }: { s: Snapshot; onCommand: Props["onCommand"] }) {
  const kit = seedKitInfo(s);
  return (
    <>
      <p>
        <span className="k">Seed kit</span> {Math.floor(kit.progress * 100)}% gathered
      </p>
      <p className="k">{kit.goods}</p>
      {kit.button && <button onClick={() => onCommand({ type: "setGathering", gathering: !s.kit.gathering })}>{kit.button}</button>}
      <p className="k">{kit.note}</p>
    </>
  );
}

/**
 * A storage room's space, shared among the goods chosen for it. Ticking a
 * good gives it the free space (or an even share, if there's none left);
 * the numbers can be set by hand.
 */
function StorageEditor({ s, room, onCommand }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number]; onCommand: Props["onCommand"] }) {
  const space = room.storageUnits ?? roomDef(room.type).storage ?? 0;
  const alloc = room.allocation ?? {};
  const used = Object.values(alloc).reduce((a, b) => a + b, 0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const set = (next: Record<string, number>) => onCommand({ type: "setAllocation", roomId: room.id, allocation: next });
  const toggle = (id: string, on: boolean) => {
    const next = { ...alloc };
    if (!on) delete next[id];
    else {
      const free = space - used;
      if (free >= 1) next[id] = Math.floor(free);
      else {
        // No free space: share it evenly among everything chosen, the new good included.
        const ids = [...Object.keys(next), id];
        const each = Math.floor(space / ids.length);
        for (const k of ids) next[k] = each;
      }
    }
    set(next);
  };
  const even = () => {
    const ids = Object.keys(alloc);
    if (!ids.length) return;
    const each = Math.floor(space / ids.length);
    set(Object.fromEntries(ids.map((k) => [k, each])));
  };
  // How full: this room's share of the hole's stock of each good.
  const fill = (id: string) => {
    const cap = s.capacities[id] ?? 0;
    return cap > 0 && Number.isFinite(cap) ? Math.min(alloc[id] ?? 0, ((s.resources[id] ?? 0) * (alloc[id] ?? 0)) / cap) : 0;
  };
  const stored = Object.keys(alloc).reduce((n, id) => n + fill(id), 0);
  return (
    <div className="storage">
      <p className="summary">
        <span className="k">Storage</span> {num(stored)} stored · {num(used)} of {space} set aside
      </p>
      {STORABLE.map((id) => {
        const on = alloc[id] !== undefined;
        const f = fill(id);
        return (
          <div key={id} className={`good${on ? "" : " off"}`}>
            <input type="checkbox" checked={on} onChange={(e) => toggle(id, e.target.checked)} aria-label={`Store ${resName(id)}`} />
            <span>{resName(id)}</span>
            <input
              type="number"
              min={0}
              step={10}
              disabled={!on}
              value={draft[id] ?? String(alloc[id] ?? 0)}
              onChange={(e) => setDraft({ ...draft, [id]: e.target.value })}
              onBlur={() => {
                const n = Math.max(0, Math.floor(Number(draft[id])));
                if (draft[id] !== undefined && Number.isFinite(n)) set({ ...alloc, [id]: Math.min(n, space - used + (alloc[id] ?? 0)) });
                const { [id]: _, ...rest } = draft;
                setDraft(rest);
              }}
            />
            {on && (
              <div className="fill" title={`${num(f)} / ${alloc[id]}`}>
                <div className={f >= (alloc[id] ?? 0) * 0.97 ? "full" : ""} style={{ width: `${(alloc[id] ? f / alloc[id]! : 0) * 100}%` }} />
              </div>
            )}
          </div>
        );
      })}
      {Object.keys(alloc).length > 1 && <button onClick={even}>Share evenly</button>}
    </div>
  );
}

/** A room (or its next floor) waiting in the construction queue: progress, place, time left, and moving it up. */
function UnderConstruction({ s, roomId, onCommand }: { s: Snapshot; roomId: number; onCommand: Props["onCommand"] }) {
  const job = constructionInfo(s, roomId);
  if (!job) return null;
  return (
    <div className="under-construction">
      <div className="bar">
        <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
      </div>
      <p className="k">{job.text}</p>
      {job.canPrioritize && (
        <button onClick={() => onCommand({ type: "prioritize", jobId: job.jobId })} title="Move it to the front of the construction queue">
          Priority construction
        </button>
      )}
    </div>
  );
}

/** Pause a room, or have it stand by while its output is stocked. */
function Controls({ room, s, onCommand }: { room: Snapshot["layout"]["rooms"][number]; s: Snapshot; onCommand: Props["onCommand"] }) {
  const stop = stopAtInfo(s, room);
  const out = stop?.resource;
  const [draft, setDraft] = useState<string | null>(null);
  const suggested = stop?.suggested ?? 10;
  return (
    <div className="controls">
      <label>
        <input
          type="checkbox"
          checked={!room.paused}
          onChange={(e) => onCommand({ type: "setRoomControl", roomId: room.id, paused: !e.target.checked })}
        />
        Running
      </label>
      {out && (
        <label title="The room stands by, freeing its staff, while there's at least this much in store">
          <input
            type="checkbox"
            checked={room.stopAt !== undefined}
            onChange={(e) => onCommand({ type: "setRoomControl", roomId: room.id, stopAt: e.target.checked ? suggested : null })}
          />
          Stop at
          <input
            type="number"
            min={0}
            step={10}
            disabled={room.stopAt === undefined}
            value={draft ?? room.stopAt ?? suggested}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const n = Number(draft);
              if (draft !== null && Number.isFinite(n)) onCommand({ type: "setRoomControl", roomId: room.id, stopAt: n });
              setDraft(null);
            }}
          />
          {resName(out).toLowerCase()}
        </label>
      )}
    </div>
  );
}

/** The room card's title: its name and floor badge, and a pencil to rename it (empty goes back to its kind's name). */
function RoomTitle({ room, onCommand }: { room: RoomInstance; onCommand: (c: SimCommand) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const commit = () => {
    if (editing !== null) onCommand({ type: "renameRoom", roomId: room.id, name: editing });
    setEditing(null);
  };
  if (editing !== null) {
    return (
      <input
        className="rename"
        autoFocus
        value={editing}
        maxLength={ROOM_NAME_MAX}
        placeholder={roomDef(room.type).name}
        onChange={(e) => setEditing(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(null);
        }}
        aria-label="Room name"
      />
    );
  }
  return (
    <h2>
      <RoomName room={room} />
      <button className="rename-btn" onClick={() => setEditing(room.name ?? roomName(room))} title="Rename it (leave it empty for its usual name)" aria-label="Rename">
        ✎
      </button>
    </h2>
  );
}

/** A room's condition, as a bar, and who's repairing it or where it is in the queue. */
function ConditionRow({ s, roomId, condition, repairing }: { s: Snapshot; roomId: number; condition: number; repairing?: { done: number; work: number } }) {
  const note = conditionNote(s, roomId, repairing);
  return (
    <div className="condition">
      <p>
        <span className="k">Condition</span> {Math.round(condition * 100)}%{note ? <span className="k"> · {note}</span> : null}
      </p>
      <div className="bar">
        <div style={{ width: `${Math.round(condition * 100)}%`, background: cssColor(conditionColor(condition)) }} />
      </div>
    </div>
  );
}

export function Inspector({ s, roomId, onCommand, onClose, finish }: Props) {
  const room = s.layout.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const def = roomDef(room.type);
  const spec = roomSpec(room, config);
  const st = s.roomStatus[room.id];

  const state = roomState(s.layout, room, st);
  const rows = panelRows(s, room);

  return (
    <aside className="inspector">
      <header>
        <RoomTitle room={room} onCommand={onCommand} />
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p className={isProblem(room, st) ? "warn" : ""}>{state}</p>
      <UnderConstruction s={s} roomId={room.id} onCommand={onCommand} />
      {!room.planned && !room.building && hasCondition(room) && <ConditionRow s={s} roomId={room.id} condition={room.condition ?? 1} repairing={room.repair} />}
      {(room.storageUnits ?? def.storage) ? <StorageEditor s={s} room={room} onCommand={onCommand} /> : null}
      {!room.connected && room.at.kind === "ring" && (
        <button
          onClick={() => onCommand({ type: "connectRoom", roomId: room.id, finish: finish ?? corridors.defaultFinish })}
          title="Carve the shortest corridor from the network to this room, along the borders of rooms"
        >
          Connect with a corridor ({finishDef(finish ?? corridors.defaultFinish).name.toLowerCase()})
        </button>
      )}
      <Rows rows={rows.before} />
      {def.stagesSeedKit && <SeedKit s={s} onCommand={onCommand} />}
      <Rows rows={rows.after} />
      {def.growsCrops && (
        <label>
          <span className="k">Crop</span>
          <select value={room.crop} onChange={(e) => onCommand({ type: "setCrop", roomId: room.id, crop: e.target.value })}>
            {cropDefs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.group}, {c.yield}/day)
              </option>
            ))}
          </select>
        </label>
      )}
      {spec.staff > 0 && (
        <label>
          <span className="k">Priority</span>
          <select value={room.priority} onChange={(e) => onCommand({ type: "setPriority", roomId: room.id, priority: e.target.value as Priority })}>
            {config.economy.priorities.map((p) => (
              <option key={p} value={p}>
                {p[0]!.toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </label>
      )}
      {spec.staff > 0 && def.buildable && <Controls room={room} s={s} onCommand={onCommand} />}
      {def.buildable && (
        <button className="danger" onClick={() => onCommand({ type: "demolish", roomId: room.id })}>
          {room.building ? "Cancel construction (full refund)" : `Demolish (${room.planned ? "full refund" : `${config.economy.demolishRefund * 100}% refund`})`}
        </button>
      )}
    </aside>
  );
}

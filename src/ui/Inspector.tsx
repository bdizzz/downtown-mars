import { ROOM_NAME_MAX, roomName } from "../sim/roomName";
import type { RoomInstance } from "../sim/placement";
import { RoomName } from "./RoomName";
import { cssColor } from "../render2d/palette";
import { hasCondition } from "../sim/condition";
import { conditionColor } from "../view/conditionView";
import { useState } from "react";
import type { SimCommand } from "../sim/commands";
import { config, type Priority } from "../sim/config";
import { mainOutput, roomSpec } from "../sim/economy";
import { crowdedAir } from "../sim/happiness";
import { glazedWalls, windowComfort, type Across } from "../sim/windows";
import { amenityFelt } from "../sim/amenities";
import { reachSteps, reachTints } from "../view/reachView";
import { effectName, effectOnRoom, FIELD_TYPES } from "../sim/effects";
import { cropDefs } from "../sim/resources";
import { roomDef } from "../sim/rooms";
import type { Snapshot } from "../sim/snapshot";
import { network } from "../sim/network";
import { corridors, finishDef, floorLinked } from "../sim/corridors";
import { STORABLE } from "../sim/storage";
import { dining, hoursText, num, ordinal, resName, signed } from "./format";

interface Props {
  s: Snapshot;
  /** The finish Connect carves in: the corridor tool's last one. */
  finish?: string;
  roomId: number;
  onCommand: (cmd: SimCommand) => void;
  onClose: () => void;
}

function limitText(limit: string | undefined): string {
  if (!limit) return "";
  if (limit === "staff") return "short of staff";
  if (limit === "paused") return "paused";
  if (limit === "kit") return "idle until you ask for a seed kit";
  if (limit === "standby") return "standing by: nothing to repair";
  // Unhappy colonists work slower (economy.ts).
  if (limit === "morale") return "slowed by low morale";
  // Condition (condition.ts).
  if (limit === "worn") return "slowed: worn out, below 30% condition";
  if (limit === "broken") return "stopped: broken down (0% condition)";
  // A dust storm dims the solar arrays (weather.ts).
  if (limit === "storm") return "dimmed by the dust storm";
  if (limit.startsWith("stocked:")) return `standing by: ${resName(limit.slice(8)).toLowerCase()} stocked`;
  if (limit.startsWith("full:")) return `idling: ${resName(limit.slice(5)).toLowerCase()} storage full`;
  return `short of ${nameOf(limit)}`;
}

/** A resource's name, or the reason as given if it isn't one (so a new reason can't break the panel). */
function nameOf(id: string): string {
  try {
    return resName(id).toLowerCase();
  } catch {
    return id;
  }
}

/** Idling because output storage is full is fine; shortages and missing access aren't. */
function isProblem(room: { planned: boolean; connected: boolean }, st: { rate: number; limit?: string } | undefined): boolean {
  if (!room.planned && !room.connected) return true;
  return !!st && st.rate < 0.999 && !st.limit?.startsWith("full:") && st.limit !== "paused" && st.limit !== "kit" && st.limit !== "standby" && !st.limit?.startsWith("stocked:");
}

function Flows({ label, flows }: { label: string; flows: Record<string, number> }) {
  const entries = Object.entries(flows).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return (
    <p>
      <span className="k">{label}</span> {entries.map(([id, v]) => `${resName(id)} ${num(v)}`).join(", ")}
    </p>
  );
}

/** A service's or amenity's reach on foot: the homes within it (tinted on the map when no overlay is on). */
function Reaches({ s, room }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number] }) {
  const tints = reachTints(s.layout, room.id);
  if (!tints) return null;
  const within = tints.filter((t) => t.steps !== null).sort((a, b) => a.steps! - b.steps!);
  return (
    <p>
      <span className="k">Reaches</span> {within.length} of {tints.length} {tints.length === 1 ? "home" : "homes"} within {reachSteps(room.type)} steps
      {within.length ? `: ${within.slice(0, 4).map((t) => `${roomName(t.room)} ${Math.max(1, Math.round(t.steps!))}`).join(", ")}${within.length > 4 ? "…" : ""}` : ""}
    </p>
  );
}

/** Clinic, school and elder-care places within reach of a home. */
function CareInReach({ s, room }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number] }) {
  const c = s.population.care?.byHome[room.id];
  if (!c) return null;
  const part = (name: string, v: number, who: number) => (who <= 0 ? null : v >= 0.98 ? `${name} ✓` : `${name} ${Math.round(v * 100)}%`);
  const items = [part("clinic", c.care, 1), part("school", c.school, s.care.school.who), part("elder care", c.elders, s.care.elders.who)].filter(Boolean);
  const short = c.care < 0.98 || (s.care.school.who > 0 && c.school < 0.98) || (s.care.elders.who > 0 && c.elders < 0.98);
  return (
    <p className={short ? "warn" : undefined}>
      <span className="k">Within reach</span> {items.join(" · ")}
    </p>
  );
}

/** What a home's people can walk to: seats at a galley or canteen, and the amenities in reach. */
function WithinReach({ s, room }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number] }) {
  const seated = s.population.servedByHome?.[room.id];
  const felt = amenityFelt(s, room);
  return (
    <>
      {seated !== undefined && (
        <p className={seated < 0.98 ? "warn" : undefined}>
          <span className="k">Meals</span> {seated >= 0.98 ? "a seat for everyone within reach" : `${Math.round(seated * 100)}% seated within reach; the rest eat on the go`}
        </p>
      )}
      <CareInReach s={s} room={room} />
      <p>
        <span className="k">On foot</span>
        {felt.from.length
          ? felt.from.map((f) => `${roomDef(f.type).name} ${Math.max(1, Math.round(f.steps))} steps (${[f.comfort ? `comfort ${signed(f.comfort)}` : "", f.health ? `health ${signed(f.health)}` : ""].filter(Boolean).join(", ")})`).join(" · ")
          : "no park, plaza or gym in reach"}
      </p>
    </>
  );
}

const ACROSS: Record<Across, string> = { shaft: "the shaft", corridor: "a corridor", public: "a walk-through room" };

/** A room's windows: what they look out on, and (a home) the comfort they give. None until the player puts them in. */
function Windows({ s, room }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number] }) {
  const walls = glazedWalls(s.layout, room);
  const home = !!roomDef(room.type).houses;
  if (!walls.length) {
    return home ? (
      <p>
        <span className="k">Windows</span> none yet: add them with Build → Corridors → Windows, on a wall facing the shaft, a corridor or a plaza
      </p>
    ) : null;
  }
  const onto = [...new Set(walls.map((w) => ACROSS[w.across]))].join(", ");
  return (
    <p>
      <span className="k">Windows</span> onto {onto}
      {home ? `: ${signed(windowComfort(s.layout, room, config))} comfort` : ""}
    </p>
  );
}

function Neighborhood({ s, room }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number] }) {
  const felt = FIELD_TYPES.map((t) => [t, effectOnRoom(s.effects, t, room)] as const).filter(([, v]) => Math.abs(v) >= 0.05);
  return (
    <p>
      <span className="k">Felt here</span>
      {felt.length ? felt.map(([t, v]) => `${effectName(t)} ${signed(v)}`).join(", ") : "nothing"}
    </p>
  );
}

function SeedKit({ s, onCommand }: { s: Snapshot; onCommand: Props["onCommand"] }) {
  const goods = Object.entries(network.seedKit.goods);
  return (
    <>
      <p>
        <span className="k">Seed kit</span> {Math.floor(s.kit.progress * 100)}% gathered
      </p>
      <p className="k">
        {goods.map(([id, want]) => `${resName(id)} ${num(s.kit.loaded[id] ?? 0)}/${want}`).join(" · ")}
      </p>
      {s.kit.progress < 0.999 && (
        <button onClick={() => onCommand({ type: "setGathering", gathering: !s.kit.gathering })}>
          {s.kit.gathering ? "Stop gathering" : s.kit.progress > 0 ? "Resume gathering" : "Gather a seed kit"}
        </button>
      )}
      <p className="k">
        {s.kit.gathering
          ? "The bay's crew is moving goods into the kit, never leaving less than a reserve in store."
          : s.kit.progress >= 0.999
            ? `Ready. Pick a site on the map (M) and send ${network.seedKit.volunteers} volunteers to found a new hole.`
            : "The bay stands idle, its crew free for other work, until you ask for a kit."}
      </p>
    </>
  );
}

function Home({ s, roomId, capacity }: { s: Snapshot; roomId: number; capacity: number }) {
  const pool = s.happiness.pools.find((p) => p.roomId === roomId);
  if (!pool) {
    return (
      <p>
        <span className="k">Houses</span> {capacity}
      </p>
    );
  }
  const f = pool.factors;
  const trend = pool.target > pool.happiness + 1 ? " ↑" : pool.target < pool.happiness - 1 ? " ↓" : "";
  return (
    <>
      <p>
        <span className="k">Residents</span> {pool.residents} / {capacity}
      </p>
      <p className={pool.happiness < 50 ? "warn" : ""}>
        <span className="k">Happiness</span> {Math.round(pool.happiness)}
        {trend} (heading for {Math.round(pool.target)})
      </p>
      <p>
        <span className="k">Noise</span> {signed(f.noise)} <span className="k">Comfort</span> {signed(f.comfort)}{" "}
        <span className="k">Health</span> {signed(f.health)}
      </p>
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
  const index = s.construction.jobs.findIndex((j) => j.roomId === roomId);
  const job = s.construction.jobs[index];
  if (!job) return null;
  return (
    <div className="under-construction">
      <div className="bar">
        <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
      </div>
      <p className="k">
        {job.kind === "extend" ? "Another floor: " : ""}
        {job.phase === "excavating" ? "Excavating · " : ""}
        {Math.round(job.progress * 100)}% · {ordinal(index + 1)} in the queue ·{" "}
        {job.hoursLeft === null ? "waits for its floor to be dug" : `done in about ${hoursText(job.hoursLeft)}`}
      </p>
      {index > 0 && (
        <button onClick={() => onCommand({ type: "prioritize", jobId: job.id })} title="Move it to the front of the construction queue">
          Priority construction
        </button>
      )}
    </div>
  );
}

/** Pause a room, or have it stand by while its output is stocked. */
function Controls({ room, s, onCommand }: { room: Snapshot["layout"]["rooms"][number]; s: Snapshot; onCommand: Props["onCommand"] }) {
  const out = mainOutput(room, config);
  const [draft, setDraft] = useState<string | null>(null);
  const suggested = Math.max(10, Math.round(((s.resources[out ?? ""] ?? 0) + 20) / 10) * 10);
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
  const lane = s.maintenance.lanes.find((l) => l.target === roomId);
  const place = s.maintenance.queue.findIndex((q) => q.roomId === roomId);
  const note = lane
    ? `${lane.kind === "all" ? "🛠 Being repaired" : "🧽 Being cleaned"}: ${Math.round((lane.progress ?? 0) * 100)}% done`
    : place >= 0
      ? `In the maintenance queue: ${place === 0 ? "next" : ordinal(place + 1)}${repairing ? ", part repaired" : ""}`
      : "";
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

  let state = "";
  if (room.planned) state = "Blueprint: builds when its floor is dug";
  else if (room.building) state = "Under construction";
  else if (!room.connected) {
    const floor = room.cells[0]?.floor ?? 1;
    state = floor > 1 && !floorLinked(s.layout, floor) ? `No access: no stairs reach floor ${floor} from the entrance` : "No access: connect it with a corridor";
  }
  else if (st?.limit === "paused") state = "Paused: its crew is free for other work";
  else if (st?.limit === "kit") state = "Idle until you ask for a seed kit";
  else if (st?.limit === "standby") state = "Standing by: nothing to repair";
  else if (st?.limit?.startsWith("stocked:")) state = `Standing by: ${resName(st.limit.slice(8)).toLowerCase()} is stocked to ${num(room.stopAt ?? 0)}`;
  else if (st) state = `Running at ${Math.round(st.rate * 100)}%${st.limit ? ` · ${limitText(st.limit)}` : ""}`;

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
      {spec.staff > 0 && (
        <p>
          <span className="k">Staff</span> {st?.staff ?? 0} / {spec.staff}
        </p>
      )}
      <Flows label="Uses/day" flows={spec.uses} />
      <Flows label="Makes/day" flows={spec.makes} />
      <Flows label="Scrubs/day" flows={spec.scrubs} />
      <Flows label="Stores" flows={spec.stores} />
      {def.stagesSeedKit && <SeedKit s={s} onCommand={onCommand} />}
      {def.houses ? <Home s={s} roomId={room.id} capacity={def.houses} /> : null}
      {def.teaches ? (
        <p>
          <span className="k">Teaches</span> up to {def.teaches} children · {s.care.school.who} in the hole,{" "}
          {s.care.school.missing > 0 ? `${num(s.care.school.missing)} without a place` : "all with a place"}
        </p>
      ) : null}
      {def.rests ? (
        <p>
          <span className="k">Rests</span> up to {def.rests} · {s.rest.interred} laid to rest here, {s.rest.space} places left
        </p>
      ) : null}
      {def.caresForElders ? (
        <p>
          <span className="k">Cares for</span> up to {def.caresForElders} elders · {s.care.elders.who} in the hole,{" "}
          {s.care.elders.missing > 0 ? `${num(s.care.elders.missing)} without care` : "all cared for"}
        </p>
      ) : null}
      {spec.sanitation > 0 && (
        <p>
          <span className="k">Sanitation for</span> {num(spec.sanitation)}
        </p>
      )}
      {spec.serves > 0 && (
        <p>
          <span className="k">Seats</span> {num(spec.serves)} diners · {dining(s)}
        </p>
      )}
      {room.at.kind === "ring" && !def.public ? <Windows s={s} room={room} /> : null}
      {def.houses && crowdedAir(s, room) < -0.01 ? (
        <p className="warn">
          <span className="k">Crowded</span> air {signed(crowdedAir(s, room))}: more than {config.effects.crowding.perCell} to a cell gets stuffy
        </p>
      ) : null}
      {def.houses ? <WithinReach s={s} room={room} /> : null}
      <Reaches s={s} room={room} />
      {room.at.kind === "ring" && <Neighborhood s={s} room={room} />}
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

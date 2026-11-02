import { ROOM_NAME_MAX, roomName } from "../sim/roomName";
import type { RoomInstance } from "../sim/placement";
import { RoomName } from "./RoomName";
import { cssColor } from "../render2d/palette";
import { hasCondition } from "../sim/condition";
import { conditionColor } from "../view/conditionView";
import { useState, type ReactNode } from "react";
import type { SimCommand } from "../sim/commands";
import { config, type Priority } from "../sim/config";
import { holding, roomSpec } from "../sim/economy";
import { cropDefs } from "../sim/resources";
import { roomDef } from "../sim/rooms";
import type { Snapshot } from "../sim/snapshot";
import { corridors, finishDef } from "../sim/corridors";
import { num, resName } from "./format";
import { Icon } from "./Icon";
import { useOpenSections } from "./settings";
import { conditionNote, constructionInfo, fillsTanks, floorOptions, panelModel, refitOptions, seedKitInfo, stopAtInfo, storageInfo, type Alert, type Chip, type Row, type Section, type SectionId } from "../view/roomPanel";

interface Props {
  s: Snapshot;
  /** The finish Connect carves in: the corridor tool's last one. */
  finish?: string;
  roomId: number;
  onCommand: (cmd: SimCommand) => void;
  onClose: () => void;
}

/** Rows of a section (view/roomPanel.ts): an icon, a dimmed label, then the text, in its tone. */
function Rows({ rows }: { rows: Row[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <p key={i} className={`row${r.tone ? ` tone-${r.tone}` : ""}`} title={r.tip}>
          {r.icon && <Icon id={r.icon} size={13} />}
          <span>
            {r.k && <span className="k">{r.k}</span>} {r.text}
          </span>
        </p>
      ))}
    </>
  );
}

/** The header's status pill: a few words in the room's tone, the whole state sentence as its tooltip. */
function StatusPill({ status }: { status: { text: string; tone: string; tip: string } }) {
  if (!status.text) return null;
  return (
    <span className={`pill tone-${status.tone}`} title={status.tip}>
      {status.text}
    </span>
  );
}

/** A headline chip: an icon and a short value, its label (and any tip) as the tooltip. */
function ChipView({ chip }: { chip: Chip }) {
  return (
    <span className={`chip${chip.tone ? ` tone-${chip.tone}` : ""}`} title={chip.tip ? `${chip.label}: ${chip.tip}` : chip.label}>
      <Icon id={chip.icon} size={13} />
      {chip.value}
    </span>
  );
}

/** The alerts band: every warning in the panel, each pointing at its section (a click opens it), and Connect beside "cut off". */
function Alerts({ alerts, sections, onOpen, connect }: { alerts: Alert[]; sections: Section[]; onOpen: (id: SectionId) => void; connect: ReactNode }) {
  if (!alerts.length) return null;
  const title = (id: SectionId) => sections.find((x) => x.id === id)?.title;
  return (
    <div className="alerts">
      {alerts.map((a, i) => (
        <div key={i} className={`alert tone-${a.tone}`}>
          <Icon id="alert" size={13} />
          <span className="text" title={a.text}>
            {a.text}
          </span>
          {title(a.section) && (
            <button className="to" onClick={() => onOpen(a.section)} title={`Open ${title(a.section)}`}>
              → {title(a.section)}
            </button>
          )}
          {a.action === "connect" && connect}
        </div>
      ))}
    </div>
  );
}

/** A section that folds open and closed: its header shows a warning dot or, while closed, how many rows it has. */
function SectionView({ section, open, onToggle, children }: { section: Section; open: boolean; onToggle: () => void; children?: ReactNode }) {
  const warns = section.rows.some((r) => r.warn);
  return (
    <section className={`fold${open ? " open" : ""}`} data-section={section.id}>
      <button className="fold-head" onClick={onToggle} aria-expanded={open}>
        <Icon id="chevron" size={12} className="chev" />
        <Icon id={section.icon} size={13} />
        <span className="title">{section.title}</span>
        {warns ? <span className="dot tone-warn" aria-label="Has a warning" /> : !open && section.rows.length > 0 ? <span className="count">{section.rows.length}</span> : null}
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
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
 * A storage room: a bar of what it holds, and the goods it allows. Goods take
 * the space first come, first served, nearest to where they were made.
 */
function StorageEditor({ room, onCommand }: { room: Snapshot["layout"]["rooms"][number]; onCommand: Props["onCommand"] }) {
  const info = storageInfo(room);
  if (!info) return null;
  const set = (ids: string[]) => onCommand({ type: "setAllows", roomId: room.id, allows: ids });
  const allowed = info.goods.filter((g) => g.allowed).map((g) => g.id);
  const toggle = (id: string, on: boolean) => set(on ? [...allowed, id] : allowed.filter((k) => k !== id));
  return (
    <div className="storage">
      <p className="summary">
        <span className="k">Storage</span> {info.summary}
      </p>
      <div className="bar" title={info.segments.map((g) => `${g.name} ${num(g.units)}`).join(", ") || "Empty"}>
        {info.segments.map((g) => (
          <div key={g.id} style={{ width: `${(g.units / info.space) * 100}%`, background: g.color }} />
        ))}
      </div>
      <div className="all">
        <button onClick={() => set(info.goods.map((g) => g.id))}>All</button>
        <button onClick={() => set([])}>None</button>
      </div>
      {info.goods.map((g) => (
        <label key={g.id} className={`good${g.allowed ? "" : " off"}`}>
          <input type="checkbox" checked={g.allowed} onChange={(e) => toggle(g.id, e.target.checked)} aria-label={`Allow ${g.name}`} />
          <span className="swatch" style={{ background: g.color }} />
          <span>{g.name}</span>
          <span className="n">{g.stored >= 0.5 ? num(g.stored) : ""}</span>
        </label>
      ))}
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
      {job.canCancel && (
        <button onClick={() => onCommand({ type: "cancelJob", jobId: job.jobId })} title="Call the refit off: the room keeps its walls, and what it cost comes back">
          Cancel the refit (full refund)
        </button>
      )}
    </div>
  );
}

/** Refit the walls in another lining, through the construction queue. */
function Refit({ s, room, onCommand }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number]; onCommand: Props["onCommand"] }) {
  const options = refitOptions(s, room);
  if (!options) return null;
  return (
    <label title="Refit the walls through the construction queue. Once the crews start the room works at half speed (a home is less comfortable) until it's done, then it's as good as new. Taking brick or metal out gives half of it back.">
      <span className="k">Refit</span>
      <select value="" onChange={(e) => {
        const o = options[Number(e.target.value)];
        if (o) onCommand({ type: "upgradeRoom", roomId: room.id, material: o.material, finish: o.finish });
      }}>
        <option value="">Choose new walls…</option>
        {options.map((o, i) => (
          <option key={o.name} value={i} disabled={!!o.refusal}>
            {o.text}
            {o.refusal ? ` (${o.refusal})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Lay a new floor, the walls untouched, through the construction queue; or take it up, free and at once. */
function Floor({ s, room, onCommand }: { s: Snapshot; room: Snapshot["layout"]["rooms"][number]; onCommand: Props["onCommand"] }) {
  const options = floorOptions(s, room);
  if (!options) return null;
  return (
    <label title="Lay a new floor through the construction queue: the walls stay as they are. While the crews work the room runs at half speed (a home is less comfortable). Taking a floor up, back to matching the walls, is free and at once.">
      <span className="k">Floor</span>
      <select value="" onChange={(e) => {
        const o = options[Number(e.target.value)];
        if (o) onCommand({ type: "upgradeFloor", roomId: room.id, flooring: o.flooring });
      }}>
        <option value="">Choose a new floor…</option>
        {options.map((o, i) => (
          <option key={o.name} value={i} disabled={!!o.refusal}>
            {o.text}
            {o.refusal ? ` (${o.refusal})` : ""}
          </option>
        ))}
      </select>
    </label>
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
  const [remembered, setOpen] = useOpenSections();
  const room = s.layout.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const def = roomDef(room.type);
  const spec = roomSpec(room, config);
  const model = panelModel(s, room);
  // The player's own open or close wins over the model's default (docs/PLAN-M18.md §5).
  const isOpen = (x: Section) => remembered[x.id] ?? x.open;
  const openSection = (id: SectionId) => {
    setOpen(id, true);
    requestAnimationFrame(() => document.querySelector(`.room-panel [data-section="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  const connectFinish = finish ?? corridors.defaultFinish;
  const connect = room.at.kind === "ring" && (
    <button
      className="connect"
      onClick={() => onCommand({ type: "connectRoom", roomId: room.id, finish: connectFinish })}
      title={`Carve the shortest corridor from the network to this room, along the borders of rooms (${finishDef(connectFinish).name.toLowerCase()})`}
    >
      Connect
    </button>
  );

  // What each section holds besides its rows: the room's controls, where they belong.
  const body = (x: Section): ReactNode => {
    switch (x.id) {
      case "work":
        return (
          <>
            <Rows rows={x.rows} />
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
            {holding(room) && (
              <label title="What this tank holds. Whatever no longer fits when it changes over is lost.">
                <span className="k">Holds</span>
                <select value={holding(room)!} onChange={(e) => onCommand({ type: "setHolds", roomId: room.id, holds: e.target.value })}>
                  {def.holds!.map((id) => (
                    <option key={id} value={id}>
                      {resName(id)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {fillsTanks(room) && (
              <label title="Hole-wide: once the air is at its target, electrolyzers fill the O2 tanks this far, a reserve for digging and breakdowns. The water it takes is gone for good.">
                <span className="k">Tank fill</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={Math.round(s.air.tankFill * 100)}
                  aria-valuetext={`${Math.round(s.air.tankFill * 100)}% of the O2 tanks`}
                  onChange={(e) => onCommand({ type: "setTankFill", fill: Number(e.target.value) / 100 })}
                />
                <output>{s.air.tankFill > 0 ? `${Math.round(s.air.tankFill * 100)}%` : "Off"}</output>
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
          </>
        );
      case "building":
        return (
          <>
            <UnderConstruction s={s} roomId={room.id} onCommand={onCommand} />
            <Rows rows={x.rows} />
            <Refit s={s} room={room} onCommand={onCommand} />
            <Floor s={s} room={room} onCommand={onCommand} />
            {def.buildable && (
              <button className="danger" onClick={() => onCommand({ type: "demolish", roomId: room.id })}>
                {room.building ? "Cancel construction (full refund)" : `Demolish (${room.planned ? "full refund" : `${config.economy.demolishRefund * 100}% refund`})`}
              </button>
            )}
          </>
        );
      case "kit":
        return <SeedKit s={s} onCommand={onCommand} />;
      case "storage":
        return <StorageEditor room={room} onCommand={onCommand} />;
      default:
        return <Rows rows={x.rows} />;
    }
  };

  return (
    <aside className="inspector room-panel">
      <header>
        <RoomTitle room={room} onCommand={onCommand} />
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {(model.status.text || model.headline.length > 0) && (
        <div className="headline">
          <StatusPill status={model.status} />
          {model.headline.map((c, i) => (
            <ChipView key={i} chip={c} />
          ))}
        </div>
      )}
      <Alerts alerts={model.alerts} sections={model.sections} onOpen={openSection} connect={connect} />
      {/* At a glance: condition for now; the rest of the glance band comes with #309. */}
      {!room.planned && !room.building && hasCondition(room) && <ConditionRow s={s} roomId={room.id} condition={room.condition ?? 1} repairing={room.repair} />}
      {model.sections.map((x) => (
        <SectionView key={x.id} section={x} open={isOpen(x)} onToggle={() => setOpen(x.id, !isOpen(x))}>
          {body(x)}
        </SectionView>
      ))}
    </aside>
  );
}

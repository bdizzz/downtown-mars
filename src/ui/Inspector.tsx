import type { SimCommand } from "../sim/commands";
import { config, type Priority } from "../sim/config";
import { roomSpec } from "../sim/economy";
import { cropDefs } from "../sim/resources";
import { roomDef } from "../sim/rooms";
import type { Snapshot } from "../sim/snapshot";
import { num, resName } from "./format";

interface Props {
  s: Snapshot;
  roomId: number;
  onCommand: (cmd: SimCommand) => void;
  onClose: () => void;
}

function limitText(limit: string | undefined): string {
  if (!limit) return "";
  if (limit === "staff") return "short of staff";
  if (limit.startsWith("full:")) return `idling: ${resName(limit.slice(5)).toLowerCase()} storage full`;
  return `short of ${resName(limit).toLowerCase()}`;
}

/** Idling because output storage is full is fine; shortages and missing access aren't. */
function isProblem(room: { planned: boolean; connected: boolean }, st: { rate: number; limit?: string } | undefined): boolean {
  if (!room.planned && !room.connected) return true;
  return !!st && st.rate < 0.999 && !st.limit?.startsWith("full:");
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

export function Inspector({ s, roomId, onCommand, onClose }: Props) {
  const room = s.layout.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const def = roomDef(room.type);
  const spec = roomSpec(room, config);
  const st = s.roomStatus[room.id];

  let state = "";
  if (room.planned) state = "Blueprint: builds when its floor is dug";
  else if (!room.connected) state = "No access: connect it with a corridor";
  else if (st) state = `Running at ${Math.round(st.rate * 100)}%${st.limit ? ` · ${limitText(st.limit)}` : ""}`;

  return (
    <aside className="inspector">
      <header>
        <h2>{def.name}</h2>
        <button onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <p className={isProblem(room, st) ? "warn" : ""}>{state}</p>
      {spec.staff > 0 && (
        <p>
          <span className="k">Staff</span> {st?.staff ?? 0} / {spec.staff}
        </p>
      )}
      <Flows label="Uses/day" flows={spec.uses} />
      <Flows label="Makes/day" flows={spec.makes} />
      <Flows label="Scrubs/day" flows={spec.scrubs} />
      <Flows label="Stores" flows={spec.stores} />
      {def.houses ? (
        <p>
          <span className="k">Houses</span> {def.houses}
        </p>
      ) : null}
      {spec.sanitation > 0 && (
        <p>
          <span className="k">Sanitation for</span> {num(spec.sanitation)}
        </p>
      )}
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
      {def.buildable && (
        <button className="danger" onClick={() => onCommand({ type: "demolish", roomId: room.id })}>
          Demolish ({room.planned ? "full refund" : `${config.economy.demolishRefund * 100}% refund`})
        </button>
      )}
    </aside>
  );
}

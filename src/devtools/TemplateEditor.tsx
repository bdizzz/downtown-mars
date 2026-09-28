import { useEffect, useMemo, useRef, useState } from "react";
import { config } from "../sim/config";
import { createHole } from "../sim/geometry";
import { createLayout, placeRoom, type Layout, type RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { fit, frameOf, layouts, unplace, type Fitted, type Frame, type Placement, type Template, type Wall } from "../view/furnish";
import { furniture, itemDef } from "../view/furniture";
import { Preview3D } from "./Preview3D";
import { accentFor } from "./scene";

// The template editor: one room type and shape at a time, previewed in any
// ring (and with corridors along its sides), in a top-down plan you can drag
// items around in, and in 3D. Save writes data/layouts.json through the dev
// server.

const WALLS: Wall[] = ["back", "front", "left", "right", "center"];
const SNAP = 0.1;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** The shapes a room of this type can take ("2x1", ...). */
function shapesOf(type: string): [number, number][] {
  const size = roomDef(type).size;
  return ((config.shapes as Record<string, [number, number][]>)[size] ?? [[1, 1]]).map(([w, d]) => [w, d]);
}

/** A hole with one room of this type and shape in the given ring, on floor 2 (so a cargo elevator's stop works too). */
export function sampleRoom(type: string, [w, d]: [number, number], ring: number, halls: { left: boolean; right: boolean }): { layout: Layout; room: RoomInstance } | null {
  const layout = createLayout(createHole(10, 2, 6, config.geometry));
  const r = Math.min(ring, 7 - d);
  const placed = placeRoom(layout, type, { kind: "ring", floor: 2, ring: r, slot: 0, w, d });
  if (!placed.ok) return null;
  const room = layout.rooms.find((x) => x.id === placed.id)!;
  const n = layout.hole.ringSlots[r - 1]!;
  for (let k = r; k < r + d; k++) {
    // Corridors along the room's sides, ring by ring (the outer rings' slots under the room's angle range).
    const cells = room.cells.filter((c) => c.ring === k);
    const m = layout.hole.ringSlots[k - 1]!;
    const slots = cells.map((c) => c.slot);
    if (halls.left && slots.length) layout.corridors[`R2.${k}.${Math.min(...slots)}`] = "rock";
    if (halls.right && slots.length) layout.corridors[`R2.${k}.${(Math.max(...slots) + 1) % m}`] = "rock";
  }
  void n;
  return { layout, room };
}

export function TemplateEditor({ room: type }: { room: string }) {
  const [templates, setTemplates] = useState<Record<string, Template>>(() => structuredClone(layouts.templates));
  const shapes = shapesOf(type);
  const [shapeIdx, setShapeIdx] = useState(0);
  const shape = shapes[Math.min(shapeIdx, shapes.length - 1)]!;
  const [ring, setRing] = useState(1);
  const [halls, setHalls] = useState({ left: false, right: false });
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  const key = `${type}:${shape[0]}x${shape[1]}`;
  const template = templates[key] ?? [];

  useEffect(() => {
    setShapeIdx(0);
    setSelected(null);
  }, [type]);

  const sample = useMemo(() => sampleRoom(type, shape, ring, halls), [type, shape[0], shape[1], ring, halls.left, halls.right]);
  const frame = sample ? frameOf(sample.layout, sample.room) : null;
  const fitted = useMemo(() => (frame ? fit(frame, template) : []), [frame, template]);

  const update = (next: Template) => {
    setTemplates((t) => ({ ...t, [key]: next }));
    setDirty(true);
  };
  const change = (i: number, patch: Partial<Placement>) => update(template.map((p, j) => (j === i ? clean({ ...p, ...patch }) : p)));
  const add = (item: string) => {
    update([...template, { item, wall: "back", y: 0.1 }]);
    setSelected(template.length);
  };
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= template.length) return;
    const next = [...template];
    [next[i], next[j]] = [next[j]!, next[i]!];
    update(next);
    setSelected(j);
  };
  const remove = (i: number) => {
    update(template.filter((_, j) => j !== i));
    setSelected(null);
  };
  const save = async () => {
    setStatus("Saving…");
    const res = await fetch("/__dev/layouts", { method: "POST", body: JSON.stringify(templates) });
    setStatus(res.ok ? "Saved to data/layouts.json" : `Not saved: ${await res.text()}`);
    if (res.ok) setDirty(false);
  };

  const sel = selected !== null ? template[selected] : undefined;
  const count = (i: number) => fitted.filter((f) => f.placement === i).length;

  return (
    <>
      <aside className="dev-side dev-side-right">
        <h2>
          Template <code>{key}</code>
        </h2>
        <div className="dev-row">
          {shapes.map((s, i) => (
            <button key={i} className={i === shapeIdx ? "on" : ""} onClick={() => setShapeIdx(i)}>
              {s[0]}×{s[1]}
            </button>
          ))}
        </div>
        <div className="dev-row">
          Ring{" "}
          {[1, 2, 3, 4, 5, 6].map((r) => (
            <button key={r} className={r === ring ? "on" : ""} onClick={() => setRing(r)} disabled={r + shape[1] - 1 > 6}>
              {r}
            </button>
          ))}
        </div>
        <div className="dev-row">
          Corridor{" "}
          <button className={halls.left ? "on" : ""} onClick={() => setHalls((h) => ({ ...h, left: !h.left }))}>
            left
          </button>
          <button className={halls.right ? "on" : ""} onClick={() => setHalls((h) => ({ ...h, right: !h.right }))}>
            right
          </button>
        </div>
        <h2>Add</h2>
        <div className="dev-add">
          {(furniture.rooms[type] ?? []).map((id) => (
            <button key={id} onClick={() => add(id)} title={`${itemDef(id).size.join(" × ")} m`}>
              + {itemDef(id).name}
            </button>
          ))}
        </div>
        <h2>Placements (in priority order)</h2>
        <ol className="dev-items">
          {template.map((p, i) => (
            <li key={i} className={i === selected ? "on" : ""} onClick={() => setSelected(i)}>
              {itemDef(p.item).name} <span className="k">
                {p.wall}
                {p.repeat ? ` ×${count(i)}` : count(i) ? "" : " · doesn't fit"}
              </span>
            </li>
          ))}
        </ol>
        {sel && selected !== null && (
          <div className="dev-props">
            <label>
              Wall{" "}
              <select value={sel.wall} onChange={(e) => change(selected, { wall: e.target.value as Wall })}>
                {WALLS.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
            <Num label="Along (x)" value={sel.x ?? 0} onChange={(x) => change(selected, { x })} />
            <Num label="Out (y)" value={sel.y ?? 0} onChange={(y) => change(selected, { y })} />
            <Num label="Turn °" value={sel.turn ?? 0} step={15} onChange={(turn) => change(selected, { turn })} />
            <label title="Chairs at a desk, stools at a table: only keep from overlapping, not a walking aisle">
              <input type="checkbox" checked={!!sel.snug} onChange={(e) => change(selected, { snug: e.target.checked })} /> Snug (goes with its neighbours)
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!sel.repeat}
                onChange={(e) => change(selected, { repeat: e.target.checked ? { every: Math.ceil(itemDef(sel.item).size[0] + 0.6), max: 6 } : undefined })}
              />{" "}
              Repeat along the wall
            </label>
            {sel.repeat && (
              <>
                <Num label="Every (m)" value={sel.repeat.every} onChange={(every) => change(selected, { repeat: { ...sel.repeat!, every: Math.max(0.2, every) } })} />
                <Num label="At most" value={sel.repeat.max ?? 12} step={1} onChange={(max) => change(selected, { repeat: { ...sel.repeat!, max: Math.max(1, Math.round(max)) } })} />
              </>
            )}
            <div className="dev-row">
              <button onClick={() => move(selected, -1)}>↑ Earlier</button>
              <button onClick={() => move(selected, 1)}>↓ Later</button>
              <button onClick={() => update([...template.slice(0, selected + 1), { ...sel }, ...template.slice(selected + 1)])}>Duplicate</button>
              <button onClick={() => remove(selected)}>Delete</button>
            </div>
          </div>
        )}
        <div className="dev-row">
          <button className={dirty ? "on" : ""} onClick={save}>
            Save all templates
          </button>
        </div>
        <p className="k">{status || (dirty ? "Unsaved changes" : "")}</p>
        <p className="k">Drag items in the plan. Placed {fitted.length}; the template has {template.length} placements.</p>
      </aside>
      <div className="dev-views">
        {frame ? (
          <PlanView frame={frame} fitted={fitted} template={template} selected={selected} onSelect={setSelected} accent={accentFor(type)} onDrag={(i, pos) => {
            const p = template[i]!;
            const at = unplace(frame, p, pos);
            // A repeated item drags its whole row by the copy that was grabbed.
            change(i, { x: snap(at.x), y: snap(Math.max(0, at.y)) });
          }} />
        ) : (
          <p className="k">This room can't go in ring {ring}.</p>
        )}
        {sample && <Preview3D layout={sample.layout} room={sample.room} fitted={fitted} accent={accentFor(type)} />}
      </div>
    </>
  );
}

/** Drop unset and zero fields, so saved templates stay short. */
function clean(p: Placement): Placement {
  const out: Placement = { item: p.item, wall: p.wall };
  if (p.x) out.x = Math.round(p.x * 100) / 100;
  if (p.y) out.y = Math.round(p.y * 100) / 100;
  if (p.turn) out.turn = p.turn;
  if (p.repeat) out.repeat = p.repeat;
  if (p.snug) out.snug = true;
  return out;
}

function Num({ label, value, onChange, step = 0.1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label>
      {label}{" "}
      <input type="number" step={step} value={Math.round(value * 100) / 100} onChange={(e) => onChange(Number(e.target.value) || 0)} style={{ width: 70 }} />
    </label>
  );
}

/** The room from above: its floor, doorway and fitted items. Drag an item to move its placement. */
function PlanView({ frame, fitted, template, selected, onSelect, onDrag, accent }: {
  frame: Frame;
  fitted: Fitted[];
  template: Template;
  selected: number | null;
  onSelect: (i: number) => void;
  onDrag: (i: number, pos: [number, number]) => void;
  accent: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ i: number; dx: number; dz: number } | null>(null);
  // The floor's outline, sampled along its four walls.
  const outline = useMemo(() => {
    const pts: [number, number][] = [];
    const N = 24;
    const at = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
    for (let i = 0; i <= N; i++) {
      const r = frame.rIn;
      pts.push(at(r, frame.left(r) + ((frame.right(r) - frame.left(r)) * i) / N));
    }
    for (let i = 0; i <= N; i++) {
      const r = frame.rOut;
      pts.push(at(r, frame.right(r) - ((frame.right(r) - frame.left(r)) * i) / N));
    }
    return pts;
  }, [frame]);
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  const pad = 1;
  const box = [Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...zs) - Math.min(...zs) + 2 * pad];
  const toWorld = (e: React.PointerEvent): [number, number] => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x, p.y];
  };
  const door = frame.door;
  return (
    <svg
      ref={svg}
      className="dev-plan"
      viewBox={box.join(" ")}
      onPointerMove={(e) => {
        if (!drag) return;
        const [x, z] = toWorld(e);
        onDrag(drag.i, [x - drag.dx, z - drag.dz]);
      }}
      onPointerUp={() => setDrag(null)}
    >
      <polygon points={outline.map((p) => p.join(",")).join(" ")} fill="#4a3a30" stroke="#8a7060" strokeWidth={0.05} />
      {/* Which way is which: the front faces the shaft (or the inner ring), the back is the outer wall. */}
      {(["front", "back", "left", "right"] as const).map((w) => {
        const rMid = (frame.rIn + frame.rOut) / 2;
        const [r, a] =
          w === "front" ? [frame.rIn - 0.5, (frame.left(frame.rIn) + frame.right(frame.rIn)) / 2]
          : w === "back" ? [frame.rOut + 0.5, (frame.left(frame.rOut) + frame.right(frame.rOut)) / 2]
          : w === "left" ? [rMid, frame.left(rMid) - 0.6 / rMid]
          : [rMid, frame.right(rMid) + 0.6 / rMid];
        return (
          <text key={w} x={r * Math.cos(a)} y={r * Math.sin(a)} fontSize={0.45} fill="#e07a3f" textAnchor="middle" dominantBaseline="middle">
            {w === "front" ? "front (shaft side)" : w}
          </text>
        );
      })}
      {door !== null && (
        <circle cx={(frame.rIn + 0.8) * Math.cos(door)} cy={(frame.rIn + 0.8) * Math.sin(door)} r={0.9} fill="none" stroke="#e07a3f" strokeWidth={0.05} strokeDasharray="0.2 0.15" />
      )}
      {fitted.map((f, k) => {
        const on = f.placement === selected;
        return (
          <g
            key={k}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              onSelect(f.placement);
              const [x, z] = toWorld(e);
              // A repeated item moves as a row: keep the pointer's offset from the row's own spot (its first copy).
              const base = fitted.find((o) => o.placement === f.placement)!;
              setDrag({ i: f.placement, dx: x - base.x, dz: z - base.z });
            }}
            style={{ cursor: "grab" }}
          >
            <polygon points={f.corners.map((c) => c.join(",")).join(" ")} fill={on ? "#e07a3f" : accent} fillOpacity={0.75} stroke={on ? "#fff" : "#1a0f0d"} strokeWidth={0.04} />
            {/* Its front: a tick from the centre toward where it faces. */}
            <line x1={f.x} y1={f.z} x2={f.x + Math.sin(f.turn) * 0.4} y2={f.z + Math.cos(f.turn) * 0.4} stroke="#fff" strokeWidth={0.05} />
            <text x={f.x} y={f.z} fontSize={0.35} fill="#f6efe6" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
              {itemDef(f.item).name}
            </text>
          </g>
        );
      })}
      {template.length === 0 && (
        <text x={box[0]! + box[2]! / 2} y={box[1]! + box[3]! / 2} fontSize={0.6} fill="#a89080" textAnchor="middle">
          Add items from the list
        </text>
      )}
    </svg>
  );
}

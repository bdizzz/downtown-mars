import { useEffect, useMemo, useRef, useState } from "react";
import { config } from "../sim/config";
import { createHole } from "../sim/geometry";
import { createLayout, depthsFor, placeRoom, targetArea, type Layout, type RoomInstance } from "../sim/placement";
import { spanArea } from "../sim/geometry";
import { touch } from "../sim/space";
import { roomDef } from "../sim/rooms";
import { fit, frameOf, layouts, templateKey, unplace, type Fitted, type Frame, type Placement, type Template, type Wall } from "../view/furnish";
import { furniture, itemDef } from "../view/furniture";
import { Preview3D } from "./Preview3D";
import { accentFor } from "./scene";

// The template editor: one room type and depth at a time, previewed in any
// ring (and with corridors along its sides), in a top-down plan you can drag
// items around in, and in 3D. Save writes data/layouts.json through the dev
// server.

const WALLS: Wall[] = ["back", "front", "left", "right", "center"];
const SNAP = 0.1;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/**
 * A hole with one room of this type in the given ring, `depth` rings deep, on floor 2 of three dug
 * floors (so a cargo elevator's stop works, and stairs or an elevator reach floor 3), with corridors
 * along its sides if asked. `area` is a multiple of its target area (1: exactly its target), anywhere
 * in its leeway; `target` tries another target area altogether, m² (before it's saved to rooms.json).
 */
export function sampleRoom(type: string, depth: number, ring: number, halls: { left: boolean; right: boolean }, area = 1, target?: number): { layout: Layout; room: RoomInstance } | null {
  const layout = createLayout(createHole(10, 3, 6, config.geometry));
  const r = Math.min(ring, 7 - depth);
  const per = spanArea(layout.hole.shaftRadiusM, r, depth, 1, config.geometry);
  const span = Math.max(1, Math.round(((target ?? targetArea(type)) * area) / per));
  const placed = placeRoom(layout, type, { kind: "ring", floor: 2, ring: r, start: 0, span, depth, fixed: true });
  if (!placed.ok) return null;
  const room = layout.rooms.find((x) => x.id === placed.id)!;
  // Corridors along the room's sides, on every floor and ring it covers.
  for (const c of room.cells) {
    if (halls.left) layout.corridors[`R${c.floor}.${c.ring}.${c.a0}`] = "rock";
    if (halls.right) layout.corridors[`R${c.floor}.${c.ring}.${c.a1 % config.geometry.notchesPerTurn}`] = "rock";
  }
  touch(layout);
  return { layout, room };
}

/** Which of a stairwell's or elevator's floors a template is for: any, or its top or bottom floor's own. */
type Role = "" | "top" | "bottom";

export function TemplateEditor({ room: type }: { room: string }) {
  const [templates, setTemplates] = useState<Record<string, Template>>(() => structuredClone(layouts.templates));
  const depths = depthsFor(type);
  const [depthIdx, setDepthIdx] = useState(0);
  const depth = depths[Math.min(depthIdx, depths.length - 1)]!;
  // How big the previewed room is, as a share of its target area (anywhere in its leeway), and the target itself.
  const [area, setArea] = useState(1);
  const [target, setTarget] = useState(() => targetArea(type));
  const leeway = config.placement.leeway;
  const [ring, setRing] = useState(1);
  const [halls, setHalls] = useState({ left: false, right: false });
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  // Stairs and elevators span floors: each role (top floor, bottom floor) may have its own template.
  const stacks = !!roomDef(type).stacks;
  const [role, setRole] = useState<Role>("");
  const base = templateKey(type, depth);
  const key = stacks && role ? `${base}:${role}` : base;
  const template = templates[key] ?? [];

  useEffect(() => {
    setDepthIdx(0);
    setArea(1);
    setTarget(targetArea(type));
    setRole("");
    setSelected(null);
  }, [type]);

  const sample = useMemo(() => sampleRoom(type, depth, ring, halls, area, target), [type, depth, ring, halls.left, halls.right, area, target]);
  // The floor to preview: a stack spans floors 2 (top) and 3 (bottom); "any floor" shows one without its own template.
  const floor = !stacks ? undefined : role === "top" ? 2 : role === "bottom" ? 3 : templates[`${base}:bottom`] ? 2 : 3;
  const frame = sample ? frameOf(sample.layout, sample.room, floor) : null;
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
  /** Set this room type's target area: written to data/rooms.json (cleared when it's the size's own). */
  const saveArea = async () => {
    const own = config.sizes[roomDef(type).size as "S"];
    const res = await fetch("/__dev/room-area", { method: "POST", body: JSON.stringify({ room: type, area: target === own ? null : target }) });
    setStatus(res.ok ? `Target area ${target} m² saved to data/rooms.json` : `Not saved: ${await res.text()}`);
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
          {depths.map((d, i) => (
            <button key={i} className={i === depthIdx ? "on" : ""} onClick={() => setDepthIdx(i)} title="How many rings deep the room is">
              {d === 1 ? "1 ring deep" : `${d} rings deep`}
            </button>
          ))}
        </div>
        <div className="dev-row" title={`A room may be built anywhere within ${Math.round(leeway * 100)}% of its target area: check the template at both ends`}>
          Area{" "}
          <input type="range" min={1 - leeway} max={1 + leeway} step={0.01} value={area} onChange={(e) => setArea(Number(e.target.value))} />
          <span className="k">
            {Math.round(target * area)} m² ({area > 1 ? "+" : ""}
            {Math.round((area - 1) * 100)}%)
          </span>
          <button onClick={() => setArea(1)} disabled={area === 1}>
            Target
          </button>
        </div>
        <div className="dev-row" title="This room type's target floor area. Its size's area unless set here; saved to data/rooms.json as `area`.">
          Target{" "}
          <input type="number" min={20} max={2000} step={5} value={target} style={{ width: "5em" }} onChange={(e) => setTarget(Math.max(20, Number(e.target.value) || 0))} />
          <span className="k">m² (size {roomDef(type).size}: {config.sizes[roomDef(type).size as "S"] ?? "?"})</span>
          <button className={target !== targetArea(type) ? "on" : ""} onClick={saveArea} disabled={target === targetArea(type)}>
            Save area
          </button>
        </div>
        {stacks && (
          <div className="dev-row">
            Floor{" "}
            {(["", "top", "bottom"] as const).map((r) => (
              <button key={r} className={r === role ? "on" : ""} onClick={() => (setRole(r), setSelected(null))} title={r ? `Its own template for the ${r} floor (else the any-floor one is used)` : "Every floor without its own template"}>
                {r ? `${r}${templates[`${base}:${r}`] ? "" : " (none)"}` : "any"}
              </button>
            ))}
            {role && !templates[key] && templates[base] && (
              <button onClick={() => update(structuredClone(templates[base]!))}>Copy from any floor</button>
            )}
          </div>
        )}
        <div className="dev-row">
          Ring{" "}
          {[1, 2, 3, 4, 5, 6].map((r) => (
            <button key={r} className={r === ring ? "on" : ""} onClick={() => setRing(r)} disabled={r + depth - 1 > 6}>
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
        {sample && <Preview3D layout={sample.layout} room={sample.room} floor={floor} fitted={fitted} accent={accentFor(type)} />}
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
      {frame.doors.map((d, k) => (
        <polygon key={`door${k}`} points={d.map((p) => p.join(",")).join(" ")} fill="none" stroke="#e07a3f" strokeWidth={0.05} strokeDasharray="0.2 0.15" />
      ))}
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

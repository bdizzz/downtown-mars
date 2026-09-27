import { useState } from "react";
import type React from "react";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import type { Tool } from "../view/types";
import { config } from "../sim/config";
import { missingCost, siteRefusal } from "../sim/costs";
import { roomDefs, type RoomDef } from "../sim/rooms";
import { RoomCard } from "./RoomCard";
import { corridors } from "../sim/corridors";
import { resName } from "./format";

/** Keyboard shortcuts for the build tools. R, X, Z and Space are taken. */
export const HOTKEYS: Record<string, string> = {
  bunk_dorm: "D",
  galley: "G",
  farm: "F",
  composter: "J",
  water_tank: "T",
  water_recycler: "Y",
  restroom: "W",
  life_support: "L",
  clinic: "K",
  school: "E",
  elder_care: "Q",
  admin_office: "A",
  battery_bank: "B",
  solar_array: "S",
  landing_pad: "P",
  deep_well_pump: "U",
  smelter: "O",
  machine_shop: "H",
  silicon_refinery: "I",
  electronics_fab: "N",
};
export const DEMOLISH_KEY = "X";
export const CORRIDOR_KEY = "C";

const CATEGORY_ORDER = ["circulation", "public", "housing", "food", "water", "air", "power", "health", "admin", "industry", "logistics"];
const CATEGORY_NAMES: Record<string, string> = {
  circulation: "Access",
  public: "Public spaces",
  housing: "Housing",
  food: "Food",
  water: "Water",
  air: "Air",
  power: "Power",
  health: "Health and care",
  admin: "Administration",
  industry: "Industry",
  logistics: "Logistics",
};

export function shapesFor(def: RoomDef): [number, number][] {
  if (def.size === "surface") return [[1, 1]];
  return config.shapes[def.size] ?? [[1, 1]];
}

export function buildTool(def: RoomDef): Tool {
  return { kind: "build", room: def.id, shape: shapesFor(def)[0]! };
}

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  resources: Record<string, number>;
  rotate: () => void;
  canUndo: boolean;
  undo: () => void;
  /** Tutorial highlight, e.g. "room:galley". */
  highlight: string | null;
  /** What this hole sits on: rooms needing a deposit it lacks are greyed out. */
  deposits: string[];
  /** The finish the corridor tool last used. */
  lastFinish: string;
}

/** The corridor tool, its finishes and costs, and the eraser. */
function CorridorTool({ tool, setTool, resources }: Pick<Props, "tool" | "setTool" | "resources">) {
  const on = tool?.kind === "corridor";
  return (
    <>
      {on && (
        <div className="finishes">
          {corridors.finishes.map((f) => {
            const short = Object.entries(f.cost).some(([id, v]) => (resources[id] ?? 0) < v);
            const picked = tool.finish === f.id && !tool.erase;
            return (
              <button
                key={f.id}
                className={`finish${picked ? " on" : ""}${short ? " short" : ""}`}
                title={f.hint}
                onClick={() => setTool({ kind: "corridor", finish: f.id, erase: false })}
              >
                <span className="chip" style={{ background: f.color, borderColor: f.accent }} />
                <span className="name">{f.name}</span>
                <span className="k">{Object.entries(f.cost).map(([id, v]) => `${v} ${resName(id).toLowerCase()}`).join(", ")}</span>
              </button>
            );
          })}
          <button
            className={`finish erase${tool.erase ? " on" : ""}`}
            title="Fill corridors in. It costs as much as carving them: the walls around them are rebuilt. Or hold Shift while drawing."
            onClick={() => setTool({ ...tool, erase: !tool.erase })}
          >
            <span className="name">Erase</span>
            <kbd>⇧</kbd>
          </button>
          <p className="k">Per 10 m. Drag along the borders between rooms; each finish is just a look, for now.</p>
        </div>
      )}
    </>
  );
}

export function BuildPalette({ tool, setTool, resources, rotate, canUndo, undo, highlight, deposits, lastFinish }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const buildable = roomDefs.filter((d) => d.buildable);
  const selected = tool?.kind === "build" ? tool.room : null;
  const shown = hovered ?? selected;
  const shownDef = shown ? roomDefs.find((d) => d.id === shown) : undefined;

  // Access always shows, for the corridor tool.
  const groups = CATEGORY_ORDER.map((cat) => [cat, buildable.filter((d) => d.category === cat)] as const).filter(
    ([cat, ds]) => ds.length || cat === "circulation",
  );
  const corridorOn = tool?.kind === "corridor";

  return (
    <aside className="palette">
      <div className="palette-list">
        {groups.map(([cat, defs]) => (
          <section key={cat}>
            <h2>{CATEGORY_NAMES[cat] ?? cat}</h2>
            {cat === "circulation" && (
              <>
                <button
                  className={`room-btn${corridorOn ? " on" : ""}${highlight === "tool:corridors" && !corridorOn ? " pulse" : ""}`}
                  style={{ "--cat": cssColor(CATEGORY_COLORS.circulation!) } as React.CSSProperties}
                  onClick={() => setTool(corridorOn ? null : { kind: "corridor", finish: lastFinish, erase: false })}
                  title="Carve corridors along the borders between rooms, back to the shaft"
                >
                  <span className="swatch" />
                  <span className="name">Corridors</span>
                  <kbd>{CORRIDOR_KEY}</kbd>
                </button>
                <CorridorTool tool={tool} setTool={setTool} resources={resources} />
              </>
            )}
            {defs.map((def) => {
              const on = def.id === selected;
              const missing = siteRefusal(def.id, deposits) ?? missingCost(resources, def.id);
              return (
                <button
                  key={def.id}
                  className={`room-btn${on ? " on" : ""}${missing ? " short" : ""}${highlight === `room:${def.id}` && !on ? " pulse" : ""}`}
                  style={{ "--cat": cssColor(CATEGORY_COLORS[def.category] ?? 0x888888) } as React.CSSProperties}
                  onClick={() => setTool(on ? null : buildTool(def))}
                  onMouseEnter={() => setHovered(def.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="swatch" />
                  <span className="name">{def.name}</span>
                  {HOTKEYS[def.id] && <kbd>{HOTKEYS[def.id]}</kbd>}
                </button>
              );
            })}
          </section>
        ))}
        <section>
          <button
            className={`room-btn demolish${tool?.kind === "demolish" ? " on" : ""}`}
            onClick={() => setTool(tool?.kind === "demolish" ? null : { kind: "demolish" })}
          >
            <span className="name">Demolish</span>
            <kbd>{DEMOLISH_KEY}</kbd>
          </button>
          <button className="room-btn" disabled={!canUndo} onClick={undo} title="Undo your last placement for a full refund, within a few game hours">
            <span className="name">Undo placement</span>
            <kbd>⌘Z</kbd>
          </button>
        </section>
      </div>
      {shownDef && (
        <RoomCard
          def={shownDef}
          resources={resources}
          siteNote={siteRefusal(shownDef.id, deposits)}
          shape={tool?.kind === "build" && tool.room === shownDef.id ? tool.shape : shapesFor(shownDef)[0]!}
          onRotate={tool?.kind === "build" && tool.room === shownDef.id && shapesFor(shownDef).length > 1 ? rotate : undefined}
        />
      )}
      {!shownDef && (
        <p className="hint">
          Pick a room, or press its key. <kbd>R</kbd> rotates, <kbd>Esc</kbd> or right-click cancels. Rooms past ring 1 need a corridor (<kbd>C</kbd>) back to the shaft.
        </p>
      )}
    </aside>
  );
}

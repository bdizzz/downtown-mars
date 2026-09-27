import { useState } from "react";
import type React from "react";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import type { Tool } from "../view/types";
import { config } from "../sim/config";
import { missingCost, siteRefusal } from "../sim/costs";
import { roomDefs, type RoomDef } from "../sim/rooms";
import { RoomCard } from "./RoomCard";

/** Keyboard shortcuts for the build tools. R, X, Z and Space are taken. */
export const HOTKEYS: Record<string, string> = {
  corridor: "C",
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

const CATEGORY_ORDER = ["circulation", "housing", "food", "water", "air", "power", "health", "admin", "industry", "logistics"];
const CATEGORY_NAMES: Record<string, string> = {
  circulation: "Access",
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
}

export function BuildPalette({ tool, setTool, resources, rotate, canUndo, undo, highlight, deposits }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const buildable = roomDefs.filter((d) => d.buildable);
  const selected = tool?.kind === "build" ? tool.room : null;
  const shown = hovered ?? selected;
  const shownDef = shown ? roomDefs.find((d) => d.id === shown) : undefined;

  const groups = CATEGORY_ORDER.map((cat) => [cat, buildable.filter((d) => d.category === cat)] as const).filter(([, ds]) => ds.length);

  return (
    <aside className="palette">
      <div className="palette-list">
        {groups.map(([cat, defs]) => (
          <section key={cat}>
            <h2>{CATEGORY_NAMES[cat] ?? cat}</h2>
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
          Pick a room, or press its key. <kbd>R</kbd> rotates, <kbd>Esc</kbd> or right-click cancels. Drag to paint corridors.
        </p>
      )}
    </aside>
  );
}

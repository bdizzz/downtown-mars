import { useEffect, useRef, useState } from "react";
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

const CATEGORY_ORDER = ["circulation", "excavation", "construction", "storage", "public", "housing", "food", "water", "air", "power", "health", "admin", "industry", "logistics"];
export const CATEGORY_NAMES: Record<string, string> = {
  circulation: "Access",
  excavation: "Excavation",
  public: "Public",
  construction: "Construction",
  storage: "Storage",
  housing: "Housing",
  food: "Food",
  water: "Water",
  air: "Air",
  power: "Power",
  health: "Health",
  admin: "Admin",
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

/** The category a tool belongs to: its room's, or Access for corridors. */
function categoryOf(tool: Tool): string | null {
  if (tool?.kind === "build") return roomDefs.find((d) => d.id === tool.room)?.category ?? null;
  if (tool?.kind === "corridor") return "circulation";
  return null;
}

/** The corridor tool's finishes and costs, and the eraser. */
function Finishes({ tool, setTool, resources }: Pick<Props, "tool" | "setTool" | "resources">) {
  if (tool?.kind !== "corridor") return null;
  return (
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
      <p className="k">Costs are per 10 m. Drag along the borders between rooms.</p>
    </div>
  );
}

/**
 * The Build mode's strip: a button per category of room along the bottom.
 * Opening one (only one at a time) pops its rooms up above it, with the
 * details of the room under the pointer or in hand; choosing a room (or its
 * key) opens its category. Demolish and undo sit at the end.
 */
export function BuildStrip({ tool, setTool, resources, rotate, canUndo, undo, highlight, deposits, lastFinish }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(() => categoryOf(tool));
  // Groups in the right half of the screen open their popup leftward.
  const [leftward, setLeftward] = useState(false);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const openAt = (cat: string | null) => {
    const b = cat ? buttons.current[cat] : null;
    if (b) setLeftward(b.getBoundingClientRect().left > window.innerWidth / 2);
    setOpen(cat);
  };
  const buildable = roomDefs.filter((d) => d.buildable);
  const selected = tool?.kind === "build" ? tool.room : null;
  // A room chosen by its key opens its category.
  const toolCategory = categoryOf(tool);
  useEffect(() => {
    if (toolCategory) openAt(toolCategory);
  }, [toolCategory]);

  // Access always shows, for the corridor tool.
  const groups = CATEGORY_ORDER.map((cat) => [cat, buildable.filter((d) => d.category === cat)] as const).filter(
    ([cat, ds]) => ds.length || cat === "circulation",
  );
  const corridorOn = tool?.kind === "corridor";
  const wanted = (cat: string, defs: readonly RoomDef[]) =>
    defs.some((d) => highlight === `room:${d.id}` && d.id !== selected) || (cat === "circulation" && highlight === "tool:corridors" && !corridorOn);

  return (
    <div className="dock-strip build-strip" role="toolbar" aria-label="Build">
      {groups.map(([cat, defs]) => {
        const isOpen = open === cat;
        const color = cssColor(CATEGORY_COLORS[cat] ?? 0x888888);
        const shown = defs.find((d) => d.id === (hovered ?? selected));
        return (
          <div key={cat} className={`dock-group${isOpen && leftward ? " leftward" : ""}`}>
            <button
              className={`dock-btn category${isOpen ? " open" : ""}${toolCategory === cat ? " on" : ""}${wanted(cat, defs) && !isOpen ? " pulse" : ""}`}
              style={{ "--cat": color } as React.CSSProperties}
              ref={(b) => {
                buttons.current[cat] = b;
              }}
              onClick={() => openAt(isOpen ? null : cat)}
              aria-expanded={isOpen}
            >
              <span className="swatch" />
              {CATEGORY_NAMES[cat] ?? cat}
            </button>
            {isOpen && (
              <div className="dock-popup">
                {shown && (
                  <RoomCard
                    def={shown}
                    resources={resources}
                    siteNote={siteRefusal(shown.id, deposits)}
                    shape={tool?.kind === "build" && tool.room === shown.id ? tool.shape : shapesFor(shown)[0]!}
                    onRotate={tool?.kind === "build" && tool.room === shown.id && shapesFor(shown).length > 1 ? rotate : undefined}
                  />
                )}
                {cat === "circulation" && !shown && <Finishes tool={tool} setTool={setTool} resources={resources} />}
                <div className="dock-popup-row">
                  {cat === "circulation" && (
                    <button
                      className={`room-btn${corridorOn ? " on" : ""}${highlight === "tool:corridors" && !corridorOn ? " pulse" : ""}`}
                      style={{ "--cat": color } as React.CSSProperties}
                      onClick={() => setTool(corridorOn ? null : { kind: "corridor", finish: lastFinish, erase: false })}
                      title="Carve corridors along the borders between rooms, back to the gallery"
                    >
                      <span className="swatch" />
                      <span className="name">Corridors</span>
                      <kbd>{CORRIDOR_KEY}</kbd>
                    </button>
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
                        title={missing ?? undefined}
                      >
                        <span className="swatch" />
                        <span className="name">{def.name}</span>
                        {HOTKEYS[def.id] && <kbd>{HOTKEYS[def.id]}</kbd>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <span className="dock-sep" />
      <button
        className={`dock-btn demolish${tool?.kind === "demolish" ? " on" : ""}`}
        onClick={() => {
          openAt(null);
          setTool(tool?.kind === "demolish" ? null : { kind: "demolish" });
        }}
        title="Demolish a room (half its cost back)"
      >
        Demolish <kbd>{DEMOLISH_KEY}</kbd>
      </button>
      <button className="dock-btn" disabled={!canUndo} onClick={undo} title="Undo your last placement for a full refund, within a few game hours">
        Undo <kbd>⌘Z</kbd>
      </button>
      <span className="dock-hint">
        <kbd>R</kbd> rotates · <kbd>Esc</kbd> or right-click cancels
      </span>
    </div>
  );
}

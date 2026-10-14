import { useEffect, useRef, useState } from "react";
import type React from "react";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import type { Tool } from "../view/types";
import { config } from "../sim/config";
import { missingCost, siteRefusal } from "../sim/costs";
import { roomDefs, type RoomDef } from "../sim/rooms";
import { CATEGORY_NAMES, CATEGORY_ORDER, CORRIDOR_KEY, DEMOLISH_KEY, HOTKEYS, shapesFor } from "../view/buildCatalog";
import { RoomCard } from "./RoomCard";
import { corridors, finishDef } from "../sim/corridors";
import { liningCost, liningId, MATERIALS } from "../sim/materials";
import { resName } from "./format";

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
  /** The shaft dome: not yet, under way, or built. */
  dome?: "none" | "building" | "built";
  onBuildDome?: () => void;
}

/** Why the dome can't be started, as the hole stands (null: it can). */
function domeRefusal(dome: Props["dome"], gates: string[], resources: Record<string, number>): string | null {
  if (dome === "built") return "Built: the shaft is air";
  if (dome === "building") return "Under construction (Charts → Construction)";
  if (!gates.includes("dome")) return `Unlocks at ${config.dome.population} colonists in this hole`;
  const short = Object.entries(config.dome.cost).filter(([id, v]) => (resources[id] ?? 0) < v);
  return short.length ? `Needs ${short.map(([id, v]) => `${Math.ceil(v - (resources[id] ?? 0))} more ${resName(id).toLowerCase()}`).join(", ")}` : null;
}

/** The dome's card: what it costs and what it does. */
function DomeCard({ dome, deposits, resources }: { dome: Props["dome"]; deposits: string[]; resources: Record<string, number> }) {
  const why = domeRefusal(dome, deposits, resources);
  const d = config.dome;
  return (
    <div className="room-card">
      <h3>Shaft dome</h3>
      <p className="k">A glass dome sealing the top of the shaft: a hole's crowning work. One per hole.</p>
      <p>
        {Object.entries(d.cost)
          .map(([id, v]) => `${resName(id)} ${v}`)
          .join(", ")}
      </p>
      <p className="k">Takes {d.workHours} work-hours to build</p>
      <p className="good">Every floor's gallery becomes open walkway: no tubes to lay</p>
      <p className="good">The shaft is an atrium: comfort +{d.atriumComfort} for every room facing it</p>
      <p className="good">Air quality +{d.air} everywhere; storms no longer drive dust through the airlock</p>
      {why ? <p className={dome === "built" ? "good" : "bad"}>{why}.</p> : <p className="good">Click to start building it.</p>}
    </div>
  );
}

/** The category a tool belongs to: its room's, or Access for corridors. */
function categoryOf(tool: Tool): string | null {
  if (tool?.kind === "build") return roomDefs.find((d) => d.id === tool.room)?.category ?? null;
  if (tool?.kind === "corridor") return "circulation";
  return null;
}

/** The lining the refit tool last used, this session. */
let lastRefit = "brick";

/** The corridor tool's finishes and costs (or with Refit, the linings), bulkheads, windows, and the eraser. */
function Finishes({ tool, setTool, resources }: Pick<Props, "tool" | "setTool" | "resources">) {
  if (tool?.kind !== "corridor") return null;
  // Every other mode off: drawing in the corridor's finish, or the mode asked for.
  const { refit, bulkhead: _bulkhead, windows: _windows, ...plain } = tool;
  const { refit: _refit, ...noRefit } = tool;
  if (refit) lastRefit = refit;
  const per10m = MATERIALS.corridor.perSegment;
  return (
    <div className="finishes">
      {tool.refit
        ? MATERIALS.walls.map((w) => {
            const id = liningId(w);
            const f = finishDef(id);
            const cost = Object.entries(liningCost(w)).map(([r, v]) => [r, Math.round(v * per10m * 10) / 10] as const);
            return (
              <button
                key={id}
                className={`finish${tool.refit === id ? " on" : ""}${cost.some(([r, v]) => (resources[r] ?? 0) < v) ? " short" : ""}`}
                title={`${w.name}: comfort +${w.comfort} in a room lined with it, wears ${Math.round((1 - w.wear) * 100)}% slower. A corridor only looks it, for now.`}
                onClick={() => setTool({ ...plain, erase: false, refit: id })}
              >
                <span className={`chip${w.finish === "fine" ? " fine" : ""}`} style={{ background: f.color, borderColor: f.accent }} />
                <span className="name">{w.name}</span>
                <span className="k">{cost.length ? cost.map(([r, v]) => `${v} ${resName(r).toLowerCase()}`).join(", ") : "free"}</span>
              </button>
            );
          })
        : corridors.finishes.map((f) => {
        const short = Object.entries(f.cost).some(([id, v]) => (resources[id] ?? 0) < v);
        const picked = tool.finish === f.id && !tool.erase && !tool.bulkhead && !tool.windows;
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
        className={`finish${tool.bulkhead ? " on" : ""}${Object.entries(corridors.bulkhead.cost).some(([id, v]) => (resources[id] ?? 0) < v) ? " short" : ""}`}
        title={`${corridors.bulkhead.hint}. Click a built corridor to fit one; Shift-click (or Erase) to take one out, free.`}
        onClick={() => setTool(tool.bulkhead ? plain : { ...plain, bulkhead: true, erase: false })}
      >
        <span className="chip bulkhead" />
        <span className="name">{corridors.bulkhead.name}</span>
        <span className="k">{Object.entries(corridors.bulkhead.cost).map(([id, v]) => `${v} ${resName(id).toLowerCase()}`).join(", ")} each</span>
      </button>
      <button
        className={`finish${tool.windows ? " on" : ""}${Object.entries(config.windows.costPer10m).some(([id, v]) => (resources[id] ?? 0) < v) ? " short" : ""}`}
        title="Put windows in a room's wall, where it faces the shaft, a corridor or a walk-through room: a home's comfort goes up. Click a wall to glaze it all; Shift-click (or Erase) to take them out, free."
        onClick={() => setTool(tool.windows ? plain : { ...plain, windows: true, erase: false })}
      >
        <span className="chip windows" />
        <span className="name">Windows</span>
        <span className="k">{Object.entries(config.windows.costPer10m).map(([id, v]) => `${v} ${resName(id).toLowerCase()}`).join(", ")} per 10 m</span>
      </button>
      <button
        className={`finish${tool.refit ? " on" : ""}`}
        title="Refit built corridors in another lining, as rooms are: their walls and floor take its look. Pick a lining, then click a corridor or drag along several. Back to bare rock salvages half the old lining."
        onClick={() => setTool(tool.refit ? plain : { ...plain, erase: false, refit: lastRefit })}
      >
        <span className="chip refit" />
        <span className="name">Refit</span>
        <span className="k">{tool.refit ? "per 10 m from bare rock" : "linings"}</span>
      </button>
      <button
        className={`finish erase${tool.erase ? " on" : ""}`}
        title="Fill corridors in. It costs as much as carving them: the walls around them are rebuilt. Or hold Shift while drawing."
        onClick={() => setTool({ ...noRefit, erase: !tool.erase })}
      >
        <span className="name">Erase</span>
        <kbd>⇧</kbd>
      </button>
      <p className="k">
        {tool.windows
          ? "Hover a room's wall: it lights up where windows can go. Click to glaze it."
          : tool.bulkhead
            ? "Click a corridor to seal it: air and smell stop there."
            : tool.refit
              ? "Click a built corridor to refit it, or drag along several. The crews do it as they get to it."
              : "Costs are per 10 m. Drag along the borders between rooms."}
      </p>
    </div>
  );
}

/**
 * The Build mode's strip: a button per category of room along the bottom.
 * Opening one (only one at a time) pops its rooms up above it, with the
 * details of the room under the pointer or in hand; choosing a room (or its
 * key) opens its category. Demolish and undo sit at the end.
 */
export function BuildStrip({ tool, setTool, resources, rotate, canUndo, undo, highlight, deposits, lastFinish, dome = "none", onBuildDome }: Props) {
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
  // A finger on the view folds the popup away, so it doesn't hide where the room goes (the tool stays in hand).
  useEffect(() => {
    const fold = (e: PointerEvent) => {
      if (e.pointerType === "touch" && e.target instanceof HTMLCanvasElement) setOpen(null);
    };
    window.addEventListener("pointerdown", fold, { capture: true });
    return () => window.removeEventListener("pointerdown", fold, { capture: true });
  }, []);

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
                {/* The room's details float above the popup, so they never move the buttons under the pointer. */}
                {shown && (
                  <div className="dock-card">
                    <RoomCard
                      def={shown}
                      resources={resources}
                      siteNote={siteRefusal(shown.id, deposits)}
                      shape={tool?.kind === "build" && tool.room === shown.id ? tool.shape : shapesFor(shown)[0]!}
                      onRotate={tool?.kind === "build" && tool.room === shown.id && shapesFor(shown).length > 1 ? rotate : undefined}
                    />
                  </div>
                )}
                {cat === "circulation" && !shown && <Finishes tool={tool} setTool={setTool} resources={resources} />}
                {cat === "public" && hovered === "shaft_dome" && (
                  <div className="dock-card">
                    <DomeCard dome={dome} deposits={deposits} resources={resources} />
                  </div>
                )}
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
                  {cat === "public" && (
                    <button
                      className={`room-btn${dome === "built" ? " on" : ""}${domeRefusal(dome, deposits, resources) && dome !== "built" ? " short" : ""}`}
                      style={{ "--cat": color } as React.CSSProperties}
                      onClick={() => !domeRefusal(dome, deposits, resources) && onBuildDome?.()}
                      onMouseEnter={() => setHovered("shaft_dome")}
                      onMouseLeave={() => setHovered(null)}
                      title={domeRefusal(dome, deposits, resources) ?? "Start building the dome over the shaft"}
                    >
                      <span className="swatch" />
                      <span className="name">Shaft dome{dome === "built" ? " ✓" : dome === "building" ? " …" : ""}</span>
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

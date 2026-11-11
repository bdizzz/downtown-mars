import { FLOW_NETS } from "../render3d/flows3d";
import type React from "react";
import type { Snapshot } from "../sim/snapshot";
import { FIELD_TYPES } from "../sim/effects";
import { CAMERAS, type View3d } from "../view/cameras";
import type { ViewMode } from "./settings";
import { hoursText } from "./format";
import { freshClass, SHOW_ALL, type Reveal } from "./reveal";
import { Icon } from "./Icon";
import type { IconId } from "../view/icons";

// The bottom of the screen: a few mode buttons at the bottom right, and the
// chosen mode's options in a strip along the bottom. Choosing the open mode
// again closes it, so no mode is open at all. Build mode is the only one that
// places rooms and corridors; it opens from its rail down the left edge, and
// its strip here is the tool bar, there while something is in hand.

export type Mode = "build" | "view" | "map" | "charts";
export type Chart = "people" | "flows" | "network" | "construction" | "maintenance" | "trends" | "directory" | "milestones";

/** Each mode's key, anywhere in the game (as KeyboardEvent codes). */
export const MODE_KEYS: Record<Mode, string> = { build: "KeyB", view: "KeyV", map: "KeyM", charts: "KeyC" };

// Build has no button here: its rail runs down the left edge (ui/BuildPalette.tsx), and B opens it.
const MODES: { id: Mode; name: string; icon: IconId; hint: string }[] = [
  { id: "view", name: "View", icon: "eye", hint: "Cameras, the plan and unrolled views, walls down and overlays (V)" },
  { id: "map", name: "Map", icon: "globe", hint: "The planet: terrain, deposits and your holes (M)" },
  { id: "charts", name: "Charts", icon: "charts", hint: "People, trends, flows, your network, the construction and maintenance queues, a directory of every room, and milestones (C)" },
];

/** Where a tutorial highlight lives: which mode holds it. */
export function modeFor(highlight: string | null): Mode | null {
  if (!highlight) return null;
  if (highlight.startsWith("room:") || highlight.startsWith("tool:")) return "build";
  if (highlight === "hud:view" || highlight.startsWith("overlay:")) return "view";
  if (highlight === "hud:map") return "map";
  if (highlight === "hud:flows") return "charts";
  return null;
}

interface DockProps {
  mode: Mode | null;
  setMode: (m: Mode | null) => void;
  highlight: string | null;
  /** Construction jobs waiting, for a badge on Charts. */
  jobs: number;
  /** Which modes show (the guided tutorial's unlocks, T-084). */
  reveal?: Reveal;
  children?: React.ReactNode;
}

/** The mode buttons, and whatever strip the open mode shows. */
export function Dock({ mode, setMode, highlight, jobs, reveal = SHOW_ALL, children }: DockProps) {
  const wanted = modeFor(highlight);
  const modes = MODES.filter((m) => reveal.shown(`mode:${m.id}`));
  return (
    <div className="dock">
      {children}
      <div className="dock-modes" role="toolbar" aria-label="Modes" hidden={!modes.length}>
        {modes.map((m) => (
          <button
            key={m.id}
            className={`mode-btn${mode === m.id ? " on" : ""}${wanted === m.id && mode !== m.id ? " pulse" : ""}${freshClass(reveal, `mode:${m.id}`)}`}
            onClick={() => setMode(mode === m.id ? null : m.id)}
            title={m.hint}
            aria-pressed={mode === m.id}
          >
            <Icon id={m.icon} size={18} />
            <span>
              {m.name} <kbd>{MODE_KEYS[m.id].slice(3)}</kbd>
            </span>
            {m.id === "charts" && jobs > 0 && <span className="badge" title="Construction jobs waiting">{jobs}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const OVERLAYS: Record<string, string> = { noise: "Noise", smell: "Smell", health: "Wellbeing", comfort: "Comfort", airQuality: "Air", happiness: "Happiness", condition: "Condition" };

interface ViewProps {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  view3d: View3d;
  setView3d: (v: View3d) => void;
  overlay: string | null;
  setOverlay: (t: string | null) => void;
  highlight: string | null;
  reveal?: Reveal;
}

/** The View mode: the 3D cameras; the plan and unrolled views; walls down; overlays. */
export function ViewStrip({ view, setView, view3d, setView3d, overlay, setOverlay, highlight, reveal = SHOW_ALL }: ViewProps) {
  const in3d = view === "3d";
  const part = (id: string) => reveal.shown(`view:${id}`);
  // Off, then the overlays unlocked so far (none: no Overlay section at all).
  const kinds = [...FIELD_TYPES, "happiness", "condition"].filter((t) => reveal.shown(`overlay:${t}`));
  const overlays = kinds.length ? [null, ...kinds] : [];
  return (
    <div className="dock-strip view-strip" role="toolbar" aria-label="View">
      {/* One camera at a time, 3D or flat: one set of buttons. */}
      {(part("cameras") || part("2d")) && (
        <span className="tool-group" role="group" aria-label="Camera">
          <span className="dock-label">Camera</span>
          <span className={`seg${freshClass(reveal, "view:cameras")}${freshClass(reveal, "view:2d")}`}>
            {part("cameras") &&
              CAMERAS.map((c) => (
                <button
                  key={c.id}
                  className={`${in3d && view3d.camera === c.id ? "on" : ""}${highlight === "hud:view" && c.id === "cutaway" && !(in3d && view3d.camera === c.id) ? " pulse" : ""}`}
                  title={c.hint}
                  aria-pressed={in3d && view3d.camera === c.id}
                  onClick={() => {
                    setView3d({ ...view3d, camera: c.id });
                    setView("3d");
                  }}
                >
                  {c.name}
                </button>
              ))}
            {part("2d") && (
              <>
                <button className={view === "plan" ? "on" : ""} aria-pressed={view === "plan"} onClick={() => setView("plan")} title="One floor from above, rings around the shaft (2D)">
                  Plan
                </button>
                <button className={view === "2d" ? "on" : ""} aria-pressed={view === "2d"} onClick={() => setView("2d")} title="Every floor, the ring unrolled flat (2D)">
                  Unrolled
                </button>
              </>
            )}
          </span>
        </span>
      )}
      {/* What the 3D views show: each on or off. */}
      {part("see") && (
        <span className={`tool-group${freshClass(reveal, "view:see")}`} role="group" aria-label="Show">
          <span className="dock-label">Show</span>
          <button
            className={`toggle${in3d && view3d.wallsDown ? " on" : ""}`}
            disabled={!in3d}
            onClick={() => setView3d({ ...view3d, wallsDown: !view3d.wallsDown })}
            title={in3d ? "Lower the walls between you and the rooms behind them, to see inside" : "In the 3D views"}
            aria-pressed={view3d.wallsDown}
          >
            Walls down
          </button>
          <button
            className={`toggle${in3d && view3d.roomColors ? " on" : ""}`}
            disabled={!in3d}
            onClick={() => setView3d({ ...view3d, roomColors: !view3d.roomColors })}
            title={in3d ? "Rooms in their kind's colour; off, in what their walls are lined with: rock, brick or metal, plain or finely finished" : "In the 3D views (the plan and unrolled views always show room colours)"}
            aria-pressed={view3d.roomColors}
          >
            Colours
          </button>
          <button
            className={`toggle${in3d && view3d.roomTints ? " on" : ""}`}
            disabled={!in3d}
            onClick={() => setView3d({ ...view3d, roomTints: !view3d.roomTints })}
            title={in3d ? "Rooms brighten when hovered or picked, and pulse amber or red when in trouble; off, they're outlined in those colours instead" : "In the 3D views"}
            aria-pressed={view3d.roomTints}
          >
            Tints
          </button>
          <button
            className={`toggle${in3d && view3d.flows ? " on" : ""}`}
            disabled={!in3d}
            onClick={() => setView3d({ ...view3d, flows: !view3d.flows })}
            title={in3d ? "Power, water, air and food as pipes, flowing from what makes them to what uses them" : "In the 3D views"}
            aria-pressed={view3d.flows}
          >
            Flows
          </button>
          {in3d && view3d.flows && (
            <span className="legend">
              {FLOW_NETS.map((n) => (
                <span key={n.id}>
                  <i style={{ background: n.color }} /> {n.name}{" "}
                </span>
              ))}
            </span>
          )}
        </span>
      )}
      {overlays.length > 0 && (
        <span className="tool-group" role="group" aria-label="Overlay">
          <span className="dock-label">Overlay</span>
          <span className="seg">
            {overlays.map((t) => (
              <button
                key={t ?? "off"}
                className={`${t === overlay ? "on" : ""}${t && highlight === `overlay:${t}` && t !== overlay ? " pulse" : ""}${t ? freshClass(reveal, `overlay:${t}`) : ""}`}
                aria-pressed={t === overlay}
                onClick={() => setOverlay(t)}
              >
                {t ? (OVERLAYS[t] ?? t) : "Off"}
              </button>
            ))}
          </span>
          {overlay && (
            <span className="legend">
              <i className="bad" /> {overlay === "happiness" ? "unhappy" : overlay === "condition" ? "worn out" : "hurts"} <i className="good" />{" "}
              {overlay === "happiness" ? "happy" : overlay === "condition" ? "good repair" : "helps"}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

interface ChartsProps {
  s: Snapshot | null;
  chart: Chart | null;
  toggle: (c: Chart) => void;
  highlight: string | null;
  reveal?: Reveal;
}

/** The Charts mode: each opens its panel on the right (again to close it). */
export function ChartsStrip({ s, chart, toggle, highlight, reveal = SHOW_ALL }: ChartsProps) {
  const jobs = s?.construction.jobs ?? [];
  const oneHole = (s?.holes.length ?? 1) < 2;
  const btn = (c: Chart, label: React.ReactNode, title: string, disabled = false, pulse = false) => reveal.shown(`chart:${c}`) && (
    <button className={`dock-btn${chart === c ? " on" : ""}${pulse && chart !== c ? " pulse" : ""}${freshClass(reveal, `chart:${c}`)}`} onClick={() => toggle(c)} title={title} disabled={disabled} aria-pressed={chart === c}>
      {label}
    </button>
  );
  return (
    <div className="dock-strip" role="toolbar" aria-label="Charts">
      {btn("people", "People", "Children, adults and elders; births and what's coming")}
      {btn("trends", "Trends", "How resources, happiness and everything else have been changing over time")}
      {btn("flows", "Flows", "Where resources come from and go", false, highlight === "hud:flows")}
      {btn("network", "Network", oneHole ? "Your holes, rovers and trade routes: found a second hole first (Map)" : "Your holes, rovers and trade routes", oneHole)}
      {btn(
        "construction",
        jobs.length ? `Construction · ${jobs.length} · ${hoursText(jobs.reduce((m, j) => Math.max(m, j.hoursLeft ?? 0), 0))}` : "Construction",
        "The construction queue: what's being built, in order",
      )}
      {btn(
        "maintenance",
        s ? `Maintenance · ${Math.round(s.maintenance.overall * 100)}%${s.maintenance.queue.length ? ` · ${s.maintenance.queue.length} waiting` : ""}` : "Maintenance",
        "Room condition: what the maintenance and cleaning crews are repairing, and the queue",
      )}
      {btn("directory", "Directory", "Every floor and the rooms on it: find one and jump to it")}
      {btn("milestones", s ? `Milestones · ${s.milestones.length}` : "Milestones", "What this hole has achieved, and what's still ahead")}
    </div>
  );
}

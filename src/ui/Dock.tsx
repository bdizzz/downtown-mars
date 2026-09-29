import type React from "react";
import type { Snapshot } from "../sim/snapshot";
import { FIELD_TYPES } from "../sim/effects";
import { CAMERAS, type View3d } from "../view/cameras";
import type { ViewMode } from "./settings";
import { hoursText } from "./format";

// The bottom of the screen, as in SimCity: a handful of mode buttons at the
// bottom right, and the chosen mode's options in a strip along the bottom.
// Choosing the open mode again closes it, so no mode is open at all. Build
// mode is the only one that places rooms and corridors.

export type Mode = "build" | "view" | "map" | "charts";
export type Chart = "people" | "flows" | "network" | "construction";

const MODES: { id: Mode; name: string; icon: string; hint: string }[] = [
  { id: "build", name: "Build", icon: "⚒", hint: "Rooms, corridors and demolition (a room's key opens it too)" },
  { id: "view", name: "View", icon: "◉", hint: "Cameras, the plan and unrolled views, X-ray, walls down and overlays (V cycles views)" },
  { id: "map", name: "Map", icon: "◍", hint: "The planet: terrain, deposits and your holes (M)" },
  { id: "charts", name: "Charts", icon: "▤", hint: "People, flows, your network and the construction queue" },
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
  /** Build mode is off while walking in first person. */
  walking: boolean;
  highlight: string | null;
  /** Construction jobs waiting, for a badge on Charts. */
  jobs: number;
  children?: React.ReactNode;
}

/** The mode buttons, and whatever strip the open mode shows. */
export function Dock({ mode, setMode, walking, highlight, jobs, children }: DockProps) {
  const wanted = modeFor(highlight);
  return (
    <div className="dock">
      {children}
      <div className="dock-modes" role="toolbar" aria-label="Modes">
        {MODES.map((m) => {
          const off = m.id === "build" && walking;
          return (
            <button
              key={m.id}
              className={`mode-btn${mode === m.id ? " on" : ""}${wanted === m.id && mode !== m.id ? " pulse" : ""}`}
              onClick={() => setMode(mode === m.id ? null : m.id)}
              disabled={off}
              title={off ? "No building while walking: switch to another camera" : m.hint}
              aria-pressed={mode === m.id}
            >
              <span className="icon">{m.icon}</span>
              {m.name}
              {m.id === "charts" && jobs > 0 && <span className="badge" title="Construction jobs waiting">{jobs}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const OVERLAYS: Record<string, string> = { noise: "Noise", smell: "Smell", health: "Health", comfort: "Comfort", happiness: "Happiness" };

interface ViewProps {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  view3d: View3d;
  setView3d: (v: View3d) => void;
  overlay: string | null;
  setOverlay: (t: string | null) => void;
  highlight: string | null;
}

/** The View mode: the 3D cameras; the plan and unrolled views; X-ray and walls down; overlays. */
export function ViewStrip({ view, setView, view3d, setView3d, overlay, setOverlay, highlight }: ViewProps) {
  const in3d = view === "3d";
  return (
    <div className="dock-strip" role="toolbar" aria-label="View">
      <span className="dock-section" aria-label="3D cameras">
        <span className="dock-label">3D</span>
        {CAMERAS.map((c) => (
          <button
            key={c.id}
            className={`dock-btn${in3d && view3d.camera === c.id ? " on" : ""}${highlight === "hud:view" && c.id === "cutaway" && !(in3d && view3d.camera === c.id) ? " pulse" : ""}`}
            title={c.hint}
            onClick={() => {
              setView3d({ ...view3d, camera: c.id });
              setView("3d");
            }}
          >
            {c.name}
          </button>
        ))}
      </span>
      <span className="dock-sep" />
      <span className="dock-section" aria-label="2D views">
        <span className="dock-label">2D</span>
        <button className={`dock-btn${view === "plan" ? " on" : ""}`} onClick={() => setView("plan")} title="One floor from above, rings around the shaft">
          Plan
        </button>
        <button className={`dock-btn${view === "2d" ? " on" : ""}`} onClick={() => setView("2d")} title="Every floor, the ring unrolled flat">
          Unrolled
        </button>
      </span>
      <span className="dock-sep" />
      <span className="dock-section" aria-label="See through">
        <button
          className={`dock-btn${in3d && view3d.xray ? " on" : ""}`}
          disabled={!in3d}
          onClick={() => setView3d({ ...view3d, xray: !view3d.xray })}
          title={in3d ? "Fade the shaft wall and ring 1 to see deeper rings" : "In the 3D views"}
          aria-pressed={view3d.xray}
        >
          X-ray
        </button>
        <button
          className={`dock-btn${in3d && view3d.wallsDown ? " on" : ""}`}
          disabled={!in3d}
          onClick={() => setView3d({ ...view3d, wallsDown: !view3d.wallsDown })}
          title={in3d ? "Lower the walls between you and the rooms behind them, to see inside" : "In the 3D views"}
          aria-pressed={view3d.wallsDown}
        >
          Walls down
        </button>
      </span>
      <span className="dock-sep" />
      <span className="dock-section" aria-label="Overlay">
        <span className="dock-label">Overlay</span>
        {[null, ...FIELD_TYPES, "happiness"].map((t) => (
          <button
            key={t ?? "off"}
            className={`dock-btn${t === overlay ? " on" : ""}${t && highlight === `overlay:${t}` && t !== overlay ? " pulse" : ""}`}
            onClick={() => setOverlay(t)}
          >
            {t ? (OVERLAYS[t] ?? t) : "Off"}
          </button>
        ))}
        {overlay && (
          <span className="legend">
            <i className="bad" /> {overlay === "happiness" ? "unhappy" : "hurts"} <i className="good" /> {overlay === "happiness" ? "happy" : "helps"}
          </span>
        )}
      </span>
    </div>
  );
}

interface ChartsProps {
  s: Snapshot | null;
  chart: Chart | null;
  toggle: (c: Chart) => void;
  highlight: string | null;
}

/** The Charts mode: each opens its panel on the right (again to close it). */
export function ChartsStrip({ s, chart, toggle, highlight }: ChartsProps) {
  const jobs = s?.construction.jobs ?? [];
  const oneHole = (s?.holes.length ?? 1) < 2;
  const btn = (c: Chart, label: React.ReactNode, title: string, disabled = false, pulse = false) => (
    <button className={`dock-btn${chart === c ? " on" : ""}${pulse && chart !== c ? " pulse" : ""}`} onClick={() => toggle(c)} title={title} disabled={disabled} aria-pressed={chart === c}>
      {label}
    </button>
  );
  return (
    <div className="dock-strip" role="toolbar" aria-label="Charts">
      {btn("people", "People", "Children, adults and elders; births and what's coming")}
      {btn("flows", "Flows", "Where resources come from and go", false, highlight === "hud:flows")}
      {btn("network", "Network", oneHole ? "Your holes, rovers and trade routes: found a second hole first (Map)" : "Your holes, rovers and trade routes", oneHole)}
      {btn(
        "construction",
        jobs.length ? `Construction · ${jobs.length} · ${hoursText(jobs.reduce((m, j) => Math.max(m, j.hoursLeft ?? 0), 0))}` : "Construction",
        "The construction queue: what's being built, in order",
      )}
    </div>
  );
}

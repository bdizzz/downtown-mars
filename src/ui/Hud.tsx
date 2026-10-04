import { useEffect, useRef } from "react";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { topExtras } from "../view/hudItems";

interface Props {
  snapshot: Snapshot | null;
  speed: number;
  setSpeed: (speed: number) => void;
  setDrill: (active: boolean) => void;
  toggleOffice: () => void;
  setActiveHole: (holeId: number) => void;
  openMenu: () => void;
  /** Tutorial highlight, e.g. "hud:office". */
  highlight: string | null;
  /** Off while a menu is open, so Space can't unpause behind it. */
  keysEnabled: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** −1 for the minus key, +1 for plus (or = unshifted, and the keypad's), else 0. */
export function speedStep(e: Pick<KeyboardEvent, "code" | "key">): number {
  if (e.code === "Minus" || e.code === "NumpadSubtract" || e.key === "-" || e.key === "_") return -1;
  if (e.code === "Equal" || e.code === "NumpadAdd" || e.key === "+" || e.key === "=") return 1;
  return 0;
}

/** The running speed one step from `from` (1×, 2×, 4×), or null past either end. */
export function nextSpeed(from: number, step: number): number | null {
  const running = config.speeds.filter((s) => s > 0);
  const i = running.indexOf(from);
  const j = (i < 0 ? 0 : i) + step;
  return j < 0 || j >= running.length ? null : running[j]!;
}

// The top bar: the menu, where and when you are, speed, the drill, the next
// supply drop and the office. Everything else lives in the dock's modes.
export function Hud({ snapshot, speed, setSpeed, setDrill, toggleOffice, setActiveHole, openMenu, keysEnabled, highlight }: Props) {
  const pulse = (id: string) => (highlight === `hud:${id}` ? " pulse" : "");
  // Space toggles pause, remembering the last running speed; − and + step the speed down and up
  // (from paused, they start at one step from the remembered speed). Past either end, nothing.
  const resumeRef = useRef(1);
  if (speed) resumeRef.current = speed;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!keysEnabled || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpeed(speed ? 0 : resumeRef.current);
        return;
      }
      const step = speedStep(e);
      if (!step) return;
      e.preventDefault();
      const next = nextSpeed(speed || resumeRef.current, step);
      if (next !== null && (next !== speed || !speed)) setSpeed(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speed, setSpeed, keysEnabled]);

  const t = snapshot?.time;
  const extras = snapshot ? topExtras(snapshot) : null;
  return (
    <header className="hud">
      <button className="menu-btn" onClick={openMenu} title="Menu (Esc)">
        ☰
      </button>
      <span className="title">Downtown Mars</span>
      {snapshot && snapshot.holes.length > 1 ? (
        <select className="hole-picker" value={snapshot.holeId} onChange={(e) => setActiveHole(Number(e.target.value))} title="Which hole you're looking at">
          {snapshot.holes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}{h.domed ? " ◓" : ""} · {h.population}
              {h.waiting ? ` · ${h.waiting} waiting` : ""}
            </option>
          ))}
        </select>
      ) : (
        snapshot && (
          <span className="hole-name" title={snapshot.holeDeposits.length ? `Sits on: ${snapshot.holeDeposits.join(", ")}` : "Sits on plain rock"}>
            {snapshot.holeName}
          </span>
        )
      )}
      <span className="clock">
        {t ? `Day ${t.day} · ${pad(t.hour)}:${pad(t.minute)}` : "Connecting…"}
      </span>
      <span className={`speeds${pulse("speed")}`}>
        {config.speeds.map((s) => (
          <button key={s} className={s === speed ? "on" : ""} onClick={() => setSpeed(s)}>
            {s === 0 ? "❚❚" : `${s}×`}
          </button>
        ))}
      </span>
      {extras?.drill && (
        <span className="drill">
          {extras.drill.canPause ? (
            <>
              <span title={extras.drill.tip}>{extras.drill.text}</span>
              <button onClick={() => setDrill(!extras.drill!.active)}>{extras.drill.active ? "Pause drill" : "Resume drill"}</button>
            </>
          ) : (
            extras.drill.text
          )}
        </span>
      )}
      {extras?.storm && (
        <span className="drop warn" title={extras.storm.tip}>
          {extras.storm.text}
        </span>
      )}
      {extras && (
        <span className={`drop${extras.drop.warn ? " warn" : ""}`} title="Next Earth supply drop">
          {extras.drop.text}
        </span>
      )}
      {snapshot && (
        <button className={`office-btn${snapshot.office.waiting.length ? " waiting" : ""}${pulse("office")}`} onClick={toggleOffice}>
          Office{snapshot.office.waiting.length ? ` · ${snapshot.office.waiting.length} waiting` : ""}
        </button>
      )}
      <span className="tick">tick {snapshot?.tick ?? 0}</span>
    </header>
  );
}

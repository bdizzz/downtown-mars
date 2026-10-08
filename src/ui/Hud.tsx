import { useEffect, useRef } from "react";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";
import { needs, NEEDS_SHOWN, topExtras, type Need } from "../view/hudItems";
import { Icon } from "./Icon";
import { monthLabel } from "../view/months";
import { SunDial } from "./SunDial";

interface Props {
  snapshot: Snapshot | null;
  speed: number;
  setSpeed: (speed: number) => void;
  setDrill: (active: boolean) => void;
  toggleOffice: () => void;
  setActiveHole: (holeId: number) => void;
  openMenu: () => void;
  /** A Trends series to open, from the "needs you" slot. */
  openTrend: (key: string) => void;
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

/** One thing in the "needs you" slot: its icon and a few words, opening what it's about. */
function NeedChip({ need, onOpen }: { need: Need; onOpen: (n: Need) => void }) {
  return (
    <button className={`need ${need.level}`} data-hud={`need:${need.id}`} title={need.tip} onClick={() => onOpen(need)} disabled={!need.open}>
      <Icon id={need.level === "bad" ? "alert" : need.icon} />
      {need.text}
    </button>
  );
}

// The top bar: the menu, where and when you are, speed, what needs you first, the drill, the next
// supply drop and the office. Everything else lives in the dock's modes. Each element has a stable
// id (data-hud, view/hudItems.ts HUD_IDS) for the tutorial.
export function Hud({ snapshot, speed, setSpeed, setDrill, toggleOffice, setActiveHole, openMenu, openTrend, keysEnabled, highlight }: Props) {
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
  const list = snapshot ? needs(snapshot) : [];
  const open = (n: Need) => {
    if (!n.open) return;
    if ("office" in n.open) toggleOffice();
    else openTrend(n.open.trend);
  };
  const waiting = snapshot?.office.waiting.length ?? 0;
  return (
    <header className="hud">
      <button className="menu-btn" data-hud="menu" onClick={openMenu} title="Menu (Esc)" aria-label="Menu">
        <Icon id="menu" />
      </button>
      {snapshot && snapshot.holes.length > 1 ? (
        <select className="hole-picker" data-hud="hole" value={snapshot.holeId} onChange={(e) => setActiveHole(Number(e.target.value))} title="Which hole you're looking at">
          {snapshot.holes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}{h.domed ? " ◓" : ""} · {h.population}
              {h.waiting ? ` · ${h.waiting} waiting` : ""}
            </option>
          ))}
        </select>
      ) : (
        snapshot && (
          <span className="hole-name" data-hud="hole" title={snapshot.holeDeposits.length ? `Sits on: ${snapshot.holeDeposits.join(", ")}` : "Sits on plain rock"}>
            {snapshot.holeName}
          </span>
        )
      )}
      <span className="clock" data-hud="clock">
        {t ? `${monthLabel(t.day)} · ${pad(t.hour)}:${pad(t.minute)}` : "Connecting…"}
        {t && <SunDial dayFraction={t.dayFraction} />}
      </span>
      <span className={`speeds${pulse("speed")}`} data-hud="speed">
        {config.speeds.map((s) => (
          <button key={s} className={s === speed ? "on" : ""} onClick={() => setSpeed(s)} aria-label={s === 0 ? "Pause" : `${s}× speed`}>
            {s === 0 ? "❚❚" : `${s}×`}
          </button>
        ))}
      </span>
      {/* What needs you first: loud and few; nothing at all when all is well. */}
      <span className={`needs${list.length ? "" : " calm"}`} data-hud="needs" aria-live="polite">
        {list.slice(0, NEEDS_SHOWN).map((n) => (
          <NeedChip key={n.id} need={n} onOpen={open} />
        ))}
        {list.length > NEEDS_SHOWN && (
          <span className="need more" title={list.slice(NEEDS_SHOWN).map((n) => n.text).join("\n")}>
            +{list.length - NEEDS_SHOWN}
          </span>
        )}
      </span>
      {extras && (
        <span className={`drill${extras.drill.active ? "" : " paused"}`} data-hud="drill" title={extras.drill.tip}>
          <Icon id="drill" />
          {extras.drill.text}
          {extras.drill.canPause && (
            <button onClick={() => setDrill(!extras.drill.active)} title={extras.drill.active ? "Pause the drill" : "Resume the drill"} aria-label={extras.drill.active ? "Pause the drill" : "Resume the drill"}>
              {extras.drill.active ? "❚❚" : "▶"}
            </button>
          )}
        </span>
      )}
      {extras && (
        <span className={`drop${extras.drop.warn ? " warn" : ""}`} data-hud="drop" title={extras.drop.tip}>
          <Icon id="drop" />
          {extras.drop.text}
        </span>
      )}
      {snapshot && (
        <button className={`office-btn${waiting ? " waiting" : ""}${pulse("office")}`} data-hud="office" onClick={toggleOffice} title="The office: visits, promises, ordinances and notables (O)">
          <Icon id="office" />
          <span className="office-label">Office</span>
          {waiting ? <span className="badge">{waiting}</span> : null}
        </button>
      )}
      {import.meta.env.DEV && <span className="tick">tick {snapshot?.tick ?? 0}</span>}
    </header>
  );
}

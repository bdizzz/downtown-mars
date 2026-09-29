import { useEffect, useRef } from "react";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";

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

/** Game-time estimate, e.g. "~1.2 days" or "~5 h". */
function gameDuration(ticks: number): string {
  const days = ticks / config.ticksPerDay;
  return days >= 1 ? `~${days.toFixed(1)} days` : `~${Math.ceil(days * 24)} h`;
}

// The top bar: the menu, where and when you are, speed, the drill, the next
// supply drop and the office. Everything else lives in the dock's modes.
export function Hud({ snapshot, speed, setSpeed, setDrill, toggleOffice, setActiveHole, openMenu, keysEnabled, highlight }: Props) {
  const pulse = (id: string) => (highlight === `hud:${id}` ? " pulse" : "");
  // Space toggles pause, remembering the last running speed.
  const resumeRef = useRef(1);
  if (speed) resumeRef.current = speed;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !keysEnabled) return;
      e.preventDefault();
      setSpeed(speed ? 0 : resumeRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speed, setSpeed, keysEnabled]);

  const t = snapshot?.time;
  const drill = snapshot?.drill;
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
              {h.name} · {h.population}
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
      {drill && (
        <span className="drill">
          {drill.floor ? (
            <>
              <span title={`${gameDuration(drill.ticksLeft)} left`}>
                ⛏ F{drill.floor} {Math.floor(drill.progress * 100)}%
              </span>
              <button onClick={() => setDrill(!drill.active)}>{drill.active ? "Pause drill" : "Resume drill"}</button>
            </>
          ) : (
            "⛏ Max depth"
          )}
        </span>
      )}
      {snapshot && (snapshot.weather.storm > 0 || snapshot.weather.dueInDays !== null) && (
        <span className="drop warn" title="Dust storms cut what the solar arrays make">
          {snapshot.weather.storm > 0 ? "🌪 Dust storm" : `🌪 Storm in ~${snapshot.weather.dueInDays!.toFixed(1)} days`}
        </span>
      )}
      {snapshot && (
        <span className={`drop${snapshot.earth.waiting ? " warn" : ""}`} title="Next Earth supply drop">
          {snapshot.earth.waiting ? "🚀 Drop waiting: pad needs staff and power" : `🚀 Drop in ${gameDuration(snapshot.earth.ticksToDrop)}`}
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

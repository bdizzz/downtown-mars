import { useEffect, useRef } from "react";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";

interface Props {
  snapshot: Snapshot | null;
  speed: number;
  setSpeed: (speed: number) => void;
  setDrill: (active: boolean) => void;
  toggleOffice: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Game-time estimate, e.g. "~1.2 days" or "~5 h". */
function gameDuration(ticks: number): string {
  const days = ticks / config.ticksPerDay;
  return days >= 1 ? `~${days.toFixed(1)} days` : `~${Math.ceil(days * 24)} h`;
}

export function Hud({ snapshot, speed, setSpeed, setDrill, toggleOffice }: Props) {
  // Space toggles pause, remembering the last running speed.
  const resumeRef = useRef(1);
  if (speed) resumeRef.current = speed;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      setSpeed(speed ? 0 : resumeRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speed, setSpeed]);

  const t = snapshot?.time;
  const drill = snapshot?.drill;
  return (
    <header className="hud">
      <span className="title">Downtown Mars</span>
      <span className="clock">
        {t ? `Day ${t.day} · ${pad(t.hour)}:${pad(t.minute)}` : "Connecting…"}
      </span>
      <span className="speeds">
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
      {snapshot && (
        <span className={`drop${snapshot.earth.waiting ? " warn" : ""}`} title="Next Earth supply drop">
          {snapshot.earth.waiting ? "🚀 Drop waiting: pad needs staff and power" : `🚀 Drop in ${gameDuration(snapshot.earth.ticksToDrop)}`}
        </span>
      )}
      {snapshot && (
        <button className={`office-btn${snapshot.office.waiting.length ? " waiting" : ""}`} onClick={toggleOffice}>
          Office{snapshot.office.waiting.length ? ` · ${snapshot.office.waiting.length} waiting` : ""}
        </button>
      )}
      <span className="tick">tick {snapshot?.tick ?? 0}</span>
    </header>
  );
}

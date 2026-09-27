import { useEffect, useRef } from "react";
import { config } from "../sim/config";
import type { Snapshot } from "../sim/snapshot";

interface Props {
  snapshot: Snapshot | null;
  speed: number;
  setSpeed: (speed: number) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Hud({ snapshot, speed, setSpeed }: Props) {
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
      <span className="tick">tick {snapshot?.tick ?? 0}</span>
    </header>
  );
}

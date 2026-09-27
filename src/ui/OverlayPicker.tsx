import { FIELD_TYPES } from "../sim/effects";

const LABELS: Record<string, string> = { noise: "Noise", smell: "Smell", health: "Health", comfort: "Comfort", happiness: "Happiness" };
const TYPES = [...FIELD_TYPES, "happiness"];

interface Props {
  overlay: string | null;
  setOverlay: (t: string | null) => void;
}

export function OverlayPicker({ overlay, setOverlay }: Props) {
  return (
    <div className="overlay-picker">
      <span className="k">Overlay</span>
      {[null, ...TYPES].map((t) => (
        <button key={t ?? "off"} className={t === overlay ? "on" : ""} onClick={() => setOverlay(t)}>
          {t ? LABELS[t] ?? t : "Off"}
        </button>
      ))}
      {overlay && (
        <span className="legend">
          {overlay === "happiness" ? (
            <>
              <i className="bad" /> unhappy <i className="good" /> happy
            </>
          ) : (
            <>
              <i className="bad" /> hurts <i className="good" /> helps
            </>
          )}
        </span>
      )}
    </div>
  );
}

import { FIELD_TYPES } from "../sim/effects";

const LABELS: Record<string, string> = { noise: "Noise", smell: "Smell", health: "Health", comfort: "Comfort" };

interface Props {
  overlay: string | null;
  setOverlay: (t: string | null) => void;
}

export function OverlayPicker({ overlay, setOverlay }: Props) {
  return (
    <div className="overlay-picker">
      <span className="k">Overlay</span>
      {[null, ...FIELD_TYPES].map((t) => (
        <button key={t ?? "off"} className={t === overlay ? "on" : ""} onClick={() => setOverlay(t)}>
          {t ? LABELS[t] ?? t : "Off"}
        </button>
      ))}
      {overlay && (
        <span className="legend">
          <i className="bad" /> hurts <i className="good" /> helps
        </span>
      )}
    </div>
  );
}

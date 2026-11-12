import { useEffect, useState } from "react";
import { FPS_HISTORY, fpsHistory, isLowFps, LOW_FPS, onFps, recentFps } from "../view/fps";
import { FURNITURE_DETAILS, GRAPHICS_PRESETS, lighterFurniture, lowerPreset, presetOf, PRESET_NAMES, type Graphics } from "../view/graphics";

/** The chart tops out at 60 fps, the usual screen. */
const TOP = 60;
const W = 240;
const H = 56;

/**
 * The recent frame rate (#391): a chart of the last couple of minutes, one reading a second, and,
 * when it has been low for a while, what to turn down. It fills in while the 3D view is drawing.
 */
export function FpsPanel({ graphics: g, onGraphics }: { graphics: Graphics; onGraphics: (g: Graphics) => void }) {
  const [, tick] = useState(0);
  useEffect(() => onFps(() => tick((n) => n + 1)), []);
  const h = fpsHistory();
  const now = h.length ? h[h.length - 1]! : null;
  const span = Math.min(h.length, LOW_FPS.seconds);
  const typical = recentFps(h, span);
  const low = isLowFps(h);
  const lighter = lighterFurniture(g.furniture);
  const lowerTo = lowerPreset(presetOf(g));
  const points = h.map((v, i) => `${(((i + FPS_HISTORY - h.length) / (FPS_HISTORY - 1)) * W).toFixed(1)},${(H - Math.min(1, v / TOP) * H).toFixed(1)}`).join(" ");
  const lowY = H - (LOW_FPS.below / TOP) * H;
  return (
    <div className="set-row set-fps" role="group" aria-label="Frame rate">
      <span className="set-text">
        <span className="set-name">Frame rate</span>
        <span className="set-hint">{now === null || typical === null ? "Measuring: it fills in while the 3D view is drawing" : `${now} fps now, ${typical} typical over the last ${span} seconds`}</span>
        <svg className="fps-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Frame rate over the last ${h.length} seconds`} preserveAspectRatio="none">
          <line x1="0" x2={W} y1={lowY} y2={lowY} className="fps-low" />
          {h.length > 1 && <polyline points={points} className="fps-line" fill="none" vectorEffect="non-scaling-stroke" />}
        </svg>
        {low && (
          <span className="fps-advice" role="status">
            It has been under {LOW_FPS.below} fps for a while. {lighter || lowerTo ? "To help, try:" : "Everything here is already as light as it goes; closing other tabs and apps may help."}
            <span className="fps-actions">
              {lighter && <button onClick={() => onGraphics({ ...g, furniture: lighter })}>Scale back furniture to “{FURNITURE_DETAILS.find((f) => f.id === lighter)!.name}”</button>}
              {lowerTo && <button onClick={() => onGraphics({ ...g, ...GRAPHICS_PRESETS[lowerTo] })}>Lower graphics to {PRESET_NAMES.find((p) => p.id === lowerTo)!.name}</button>}
            </span>
          </span>
        )}
      </span>
    </div>
  );
}

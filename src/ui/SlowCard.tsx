import { useEffect, useState } from "react";
import { isVeryLowFps, fpsHistory, onFps, resetFps, VERY_LOW_FPS } from "../view/fps";
import { GRAPHICS_PRESETS, presetOf, type Graphics } from "../view/graphics";

interface Props {
  graphics: Graphics;
  onGraphics: (g: Graphics) => void;
  /** Only in a running game: not on the title or behind a menu. */
  active: boolean;
}

/** What one click does: the lightest settings there are. */
function lightened(g: Graphics): Graphics {
  return { ...g, ...GRAPHICS_PRESETS.low, furniture: "basic" };
}

/**
 * Over the game when the frame rate has been very low for a while (#391): one click to the lightest
 * graphics and simple furniture, so the player needn't go to Settings (which still has the finer
 * choices and the chart). Dismissed for the rest of the session; after a click the readings start over.
 */
export function SlowCard({ graphics, onGraphics, active }: Props) {
  const [, tick] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => onFps(() => tick((n) => n + 1)), []);
  // Nothing lighter to offer: already Low with simple shapes.
  const already = presetOf(graphics) === "low" && graphics.furniture === "basic";
  if (!active || dismissed || already || !isVeryLowFps(fpsHistory())) return null;
  return (
    <div className="slow-card" role="status">
      <span>
        The game is running slowly (under {VERY_LOW_FPS} fps). Lighter graphics and simple furniture should help.
      </span>
      <button
        className="primary"
        onClick={() => {
          onGraphics(lightened(graphics));
          resetFps();
        }}
        title="Sets Low graphics and simple furniture shapes; you can change either in Settings → Display"
      >
        Lighten graphics
      </button>
      <button className="slow-later" onClick={() => setDismissed(true)} aria-label="Not now">
        ✕
      </button>
    </div>
  );
}

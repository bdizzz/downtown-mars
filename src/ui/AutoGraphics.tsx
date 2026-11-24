import { useEffect, useRef, useState } from "react";
import { AUTO, autoGraphicsToast, decideAutoGraphics, type AutoGraphicsMemory } from "../view/autoGraphics";
import { fpsHistory, onFps } from "../view/fps";
import { GRAPHICS_PRESETS, presetOf, type Graphics, type Preset } from "../view/graphics";

interface Props {
  graphics: Graphics;
  /** Settings → Display → Adjust graphics automatically. */
  on: boolean;
  memory: AutoGraphicsMemory;
  /** On the title screen (the only place it turns the graphics down). */
  onTitle: boolean;
  update: (patch: { graphics?: Graphics; autoGraphicsMemory: AutoGraphicsMemory }) => void;
}

/** How long a toast stays. */
const TOAST_MS = 9000;

/**
 * Automatic graphics (#591): watches the frame rate and, by the rules in view/autoGraphics.ts, turns
 * the graphics down on a slow title or up when there's room to spare, with a toast saying so. Draws
 * nothing but the toast.
 */
export function AutoGraphics({ graphics, on, memory, onTitle, update }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  /** Readings since the graphics last changed. */
  const fresh = useRef(0);
  /** Raised from this preset and still watching (cleared after AUTO.watchSeconds of readings). */
  const watching = useRef<Preset | null>(null);
  /** The graphics auto-adjust itself just set, so its own change isn't taken for the player's. */
  const ours = useRef<string | null>(null);
  const latest = useRef({ graphics, on, memory, onTitle, update });
  latest.current = { graphics, on, memory, onTitle, update };

  // A change to the graphics starts the count again; one the player made after an auto change stops raising.
  const key = JSON.stringify(graphics);
  const lastKey = useRef(key);
  useEffect(() => {
    if (key === lastKey.current) return;
    lastKey.current = key;
    fresh.current = 0;
    if (key === ours.current) {
      ours.current = null;
      return;
    }
    watching.current = null;
    const m = latest.current.memory;
    if (m.set !== null && presetOf(graphics) !== m.set) latest.current.update({ autoGraphicsMemory: { set: null, noRaise: true } });
  }, [key, graphics]);

  useEffect(
    () =>
      onFps(() => {
        fresh.current++;
        const { graphics: g, on: enabled, memory: m, onTitle: title, update: up } = latest.current;
        if (watching.current && fresh.current >= AUTO.watchSeconds) watching.current = null;
        if (!enabled) return;
        const preset = presetOf(g);
        const a = decideAutoGraphics({ history: fpsHistory(), fresh: fresh.current, preset, onTitle: title, noRaise: m.noRaise, watching: watching.current });
        if (!a || preset === "custom") return;
        const next = { ...g, ...GRAPHICS_PRESETS[a.to] };
        ours.current = JSON.stringify(next);
        watching.current = a.kind === "raise" ? preset : null;
        up({ graphics: next, autoGraphicsMemory: { set: a.to, noRaise: m.noRaise || a.kind === "back" } });
        setToast(autoGraphicsToast(a, preset));
      }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="auto-gfx-toast" role="status">
      <span>{toast}</span>
      <button onClick={() => setToast(null)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

// First person on a touch screen: a translucent stick in the bottom-left
// corner to walk with, and stair buttons beside it when you're standing in a
// flight. Looking round stays a drag on the view itself.

/** The stick's reach (px, from the centre to the knob's furthest), and how far out it starts to run (0–1). */
const STICK = { reach: 44, run: 0.9, dead: 0.12 };

export interface WalkPad {
  /** Where the stick points: x right, y forward, each −1…1 (0, 0 at rest). */
  vector(): { x: number; y: number };
  /** Pushed all the way: run. */
  running(): boolean;
  show(on: boolean): void;
  /** Which stair buttons to offer where the walker stands. */
  setStairs(up: boolean, down: boolean): void;
  dispose(): void;
}

export function createWalkPad(host: HTMLElement, onStairs: (dir: "up" | "down") => void): WalkPad {
  const pad = document.createElement("div");
  pad.className = "walk-pad";
  pad.hidden = true;
  const base = document.createElement("div");
  base.className = "walk-stick";
  base.setAttribute("aria-label", "Walk");
  const knob = document.createElement("div");
  knob.className = "walk-knob";
  base.appendChild(knob);
  pad.appendChild(base);

  const stairs = document.createElement("div");
  stairs.className = "walk-stairs";
  const button = (dir: "up" | "down", label: string) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.title = dir === "up" ? "Up the stairs" : "Down the stairs";
    b.hidden = true;
    b.addEventListener("click", () => onStairs(dir));
    stairs.appendChild(b);
    return b;
  };
  const up = button("up", "▲ Up");
  const down = button("down", "▼ Down");
  pad.appendChild(stairs);
  host.appendChild(pad);

  let at = { x: 0, y: 0 };
  let finger: number | null = null;
  let centre = { x: 0, y: 0 };

  const place = (e: PointerEvent) => {
    let dx = e.clientX - centre.x;
    let dy = e.clientY - centre.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK.reach) {
      dx *= STICK.reach / len;
      dy *= STICK.reach / len;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const x = dx / STICK.reach;
    const y = -dy / STICK.reach;
    at = Math.hypot(x, y) < STICK.dead ? { x: 0, y: 0 } : { x, y };
  };
  const release = () => {
    finger = null;
    at = { x: 0, y: 0 };
    knob.style.transform = "";
    base.classList.remove("on");
  };

  base.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (finger !== null) return;
    finger = e.pointerId;
    const r = base.getBoundingClientRect();
    centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    base.classList.add("on");
    place(e);
    // Keep the finger even when it slides off the stick (it can fail for a pointer that's already gone).
    try {
      base.setPointerCapture(e.pointerId);
    } catch {
      // Not captured: moves still arrive while the finger stays over the stick.
    }
  });
  base.addEventListener("pointermove", (e) => {
    if (e.pointerId === finger) place(e);
  });
  const onUp = (e: PointerEvent) => {
    if (e.pointerId === finger) release();
  };
  base.addEventListener("pointerup", onUp);
  base.addEventListener("pointercancel", onUp);
  base.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    vector: () => at,
    running: () => Math.hypot(at.x, at.y) >= STICK.run,
    show(on) {
      pad.hidden = !on;
      if (!on) release();
    },
    setStairs(canUp, canDown) {
      up.hidden = !canUp;
      down.hidden = !canDown;
    },
    dispose: () => pad.remove(),
  };
}

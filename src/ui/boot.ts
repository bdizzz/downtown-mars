// The loading screen's bar (T-090). index.html draws the screen and creeps the
// bar while the game's code downloads; from here on each part of startup
// reports in as it finishes, the bar moves by that part's share, and once all
// are in the screen fades away over the title menu. The steps can finish in
// any order; the label names the first one still running.

/** What startup waits for, in the order the label names them, with each one's share of the bar. */
const STEPS = {
  code: { share: 0.27, label: "Loading the game" },
  font: { share: 0.08, label: "Setting the type" },
  world: { share: 0.2, label: "Waking the colony" },
  view: { share: 0.3, label: "Lighting the hole" },
  map: { share: 0.15, label: "Charting Mars" },
} as const;

export type BootStep = keyof typeof STEPS;

/** Never wait longer than this for the title: a step that hangs shouldn't keep the player out. */
const GIVE_UP_MS = 20000;
/** How long the screen takes to fade (matches #boot's transition in index.html). */
const FADE_MS = 600;
/** How far the bar creeps toward a running step's share before it's done. */
const CREEP = 0.85;
/** At the end, the screen fades once the bar is this full, or after this long, whichever comes first. */
const FULL = 0.98;
const MAX_FILL_MS = 800;

interface Bar {
  floor: number;
  ceil: number;
  at: number;
}

const done = new Set<BootStep>();
let finished = false;

const bar = (): Bar | undefined => (globalThis as { __boot?: Bar }).__boot;
const el = (id: string) => (typeof document === "undefined" ? null : document.getElementById(id));

function redraw(): void {
  const b = bar();
  const steps = Object.keys(STEPS) as BootStep[];
  const sum = (list: BootStep[]) => list.reduce((s, k) => s + STEPS[k].share, 0);
  const finishedShare = sum(steps.filter((k) => done.has(k)));
  const running = steps.filter((k) => !done.has(k));
  if (b) {
    b.floor = Math.max(b.floor, finishedShare);
    b.ceil = finishedShare + CREEP * sum(running);
  }
  const label = el("boot-step");
  if (label) label.textContent = running.length ? STEPS[running[0]!].label : "Ready";
}

/** One part of startup has finished. */
export function bootStep(step: BootStep): void {
  if (finished || done.has(step)) return;
  done.add(step);
  redraw();
  if (done.size === Object.keys(STEPS).length) finish();
}

/** Everything's in (or we've waited long enough): fill the bar, then fade the screen away. */
export function finish(): void {
  if (finished) return;
  finished = true;
  const b = bar();
  if (b) b.floor = b.ceil = 1;
  const screen = el("boot");
  if (!screen) return;
  // The bar reaches the end before the screen goes (but never holds it up for long).
  const start = performance.now();
  const fade = () => {
    if ((b?.at ?? 1) < FULL && performance.now() - start < MAX_FILL_MS) return void requestAnimationFrame(fade);
    screen.classList.add("boot-out");
    setTimeout(() => screen.remove(), FADE_MS);
  };
  fade();
}

/** Has the loading screen gone (or started going)? */
export const booted = (): boolean => finished;

if (typeof document !== "undefined") {
  setTimeout(finish, GIVE_UP_MS);
  // The code is here: that's the first step.
  bootStep("code");
}

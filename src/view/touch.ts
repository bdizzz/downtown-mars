import type { Tool } from "./types";

// Touch for the views: fingers on a phone or tablet. One finger still goes
// through each view's own pointer handlers (a drag, a tap, a corridor snake);
// a second finger takes over as a gesture: pinch to zoom, twist to turn, both
// together to pan. Long-pressing shows what hovering shows with a mouse, and
// with a tool in hand a tap first shows where it would land; a second tap
// on the same spot does it.

/** How long a still finger is held before it counts as a long press (ms), and how far it may drift (px). */
export const LONG_PRESS = { ms: 450, slop: 10 };
/** A finger wobbles more than a mouse: how far a tap may move and still be a tap (px). */
export const TAP_SLOP = 12;

/** One frame of a two-finger gesture, relative to the frame before. */
export interface Gesture {
  /** Spread now over spread before: above 1 the fingers moved apart (zoom in). */
  scale: number;
  /** How far the line between the fingers turned, in radians (clockwise on screen is positive). */
  turn: number;
  /** How far the point between the fingers moved, in pixels. */
  dx: number;
  dy: number;
  /** The point between the fingers, in client pixels. */
  cx: number;
  cy: number;
}

export function isTouch(e: PointerEvent): boolean {
  return e.pointerType === "touch";
}

/**
 * Tracks the fingers on a canvas. Each view calls down/move/up from its own
 * pointer handlers; while two or more fingers are down it reports gestures and
 * the view should ignore the one-finger meaning (drag, tap, snake).
 */
export class Touches {
  private readonly at = new Map<number, { x: number; y: number }>();
  /** A second finger came down: stays set until every finger is up, so the last one left doesn't tap or drag. */
  gesturing = false;

  get count(): number {
    return this.at.size;
  }

  /** A finger came down. Returns true if this starts a two-finger gesture. */
  down(e: PointerEvent): boolean {
    if (!isTouch(e)) return false;
    this.at.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.at.size >= 2 && !this.gesturing) {
      this.gesturing = true;
      return true;
    }
    return false;
  }

  /** A finger moved. Returns the gesture since the last move, if two fingers are down. */
  move(e: PointerEvent): Gesture | null {
    const was = this.at.get(e.pointerId);
    if (!was) return null;
    const pair = [...this.at.entries()].slice(0, 2);
    const before = pair.map(([, p]) => p);
    this.at.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pair.length < 2 || !pair.some(([id]) => id === e.pointerId)) return null;
    const after = pair.map(([id]) => this.at.get(id)!);
    const [a0, b0] = before as [{ x: number; y: number }, { x: number; y: number }];
    const [a1, b1] = after as [{ x: number; y: number }, { x: number; y: number }];
    const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
    const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
    let turn = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn < -Math.PI) turn += 2 * Math.PI;
    const cx = (a1.x + b1.x) / 2;
    const cy = (a1.y + b1.y) / 2;
    return { scale: d0 > 1 && d1 > 1 ? d1 / d0 : 1, turn, dx: cx - (a0.x + b0.x) / 2, dy: cy - (a0.y + b0.y) / 2, cx, cy };
  }

  /** A finger lifted (or was cancelled). Returns true if a gesture just ended, with every finger up. */
  up(e: PointerEvent): boolean {
    if (!this.at.delete(e.pointerId)) return false;
    if (this.at.size === 0 && this.gesturing) {
      this.gesturing = false;
      return true;
    }
    return false;
  }
}

/**
 * A long press: calls back once a finger has been held still for a while.
 * The view shows its hover for it; the lift that follows isn't a tap.
 */
export class LongPress {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private from: { x: number; y: number } | null = null;
  /** The press became a long press: the lift should not count as a tap. */
  fired = false;

  constructor(private readonly onFire: () => void) {}

  start(e: PointerEvent): void {
    this.cancel();
    this.fired = false;
    if (!isTouch(e)) return;
    this.from = { x: e.clientX, y: e.clientY };
    this.timer = setTimeout(() => {
      this.timer = null;
      this.fired = true;
      this.onFire();
    }, LONG_PRESS.ms);
  }

  move(e: PointerEvent): void {
    if (this.from && Math.hypot(e.clientX - this.from.x, e.clientY - this.from.y) > LONG_PRESS.slop) this.cancel();
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.from = null;
  }
}

/**
 * Tap to aim, tap again to act. With a tool in hand, a finger can't hover
 * first, so the first tap only shows the ghost (the view's hover); a second
 * tap on the same spot (the same hover key) builds, digs or demolishes.
 * With no tool, a tap selects straight away.
 */
export class TapToAim {
  private armed: string | null = null;

  /** Should this tap act now? `key` is the view's hover key for the tapped spot. */
  tap(tool: Tool, key: string): boolean {
    if (!tool) return true;
    if (this.armed === key) {
      this.armed = null;
      return true;
    }
    this.armed = key;
    return false;
  }

  reset(): void {
    this.armed = null;
  }
}

/** Is this a touch-first device (a phone or tablet), where hints should talk about fingers, not keys and clicks? */
export function touchFirst(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}

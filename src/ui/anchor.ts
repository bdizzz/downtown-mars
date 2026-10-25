// Placing the guided tutorial's card next to what its step is about, with an arrow to it: beside a
// target in a strip down the side of the screen (the floor picker, marked data-anchor="side"), else
// below one in the top half and above one in the bottom half; always kept on screen. All in real pixels (getBoundingClientRect), so the
// interface-size zoom doesn't matter.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the card sits relative to its target; the arrow is on the card's opposite edge. */
export type Side = "below" | "above" | "left" | "right";

export interface Anchor {
  left: number;
  top: number;
  side: Side;
  /** Where the arrow meets the card's edge: from its left (below, above) or its top (left, right). */
  arrow: number;
}

/** Space between the target and the card (the arrow fills it), and from the screen's edges. */
const GAP = 12;
const MARGIN = 8;
/** How far the arrow keeps from the card's corners. */
const ARROW_INSET = 16;

/** `v` kept within lo..hi; lo wins when they cross (a card wider than the screen). */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * `avoid`: something else on screen the card mustn't cover (the room details over the build
 * palette): the card clears it as well as the target, and the arrow still points at the target.
 * `beside`: the target is in a strip down the side of the screen: the card goes beside it, toward
 * the middle, the arrow pointing sideways.
 */
export function place(target: Box, card: Pick<Box, "width" | "height">, view: Pick<Box, "width" | "height">, avoid?: Box | null, beside = false): Anchor {
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const maxLeft = view.width - card.width - MARGIN;
  const maxTop = view.height - card.height - MARGIN;
  if (beside) {
    const side = cx > view.width / 2 ? "left" : "right";
    const left = side === "left" ? target.left - GAP - card.width : target.left + target.width + GAP;
    const top = clamp(cy - card.height / 2, MARGIN, maxTop);
    return {
      left: Math.round(clamp(left, MARGIN, maxLeft)),
      top: Math.round(top),
      side,
      arrow: Math.round(clamp(cy - top, ARROW_INSET, card.height - ARROW_INSET)),
    };
  }
  const below = cy < view.height / 2;
  const upper = Math.min(target.top, avoid?.top ?? Infinity);
  const lower = Math.max(target.top + target.height, avoid ? avoid.top + avoid.height : -Infinity);
  const top = below ? lower + GAP : upper - GAP - card.height;
  const left = clamp(cx - card.width / 2, MARGIN, maxLeft);
  return {
    left: Math.round(left),
    top: Math.round(clamp(top, MARGIN, maxTop)),
    side: below ? "below" : "above",
    arrow: Math.round(clamp(cx - left, ARROW_INSET, card.width - ARROW_INSET)),
  };
}

/** The room details floating over the build palette, while one shows. */
export function obstacle(): Box | null {
  const e = document.querySelector(".dock-card");
  const r = e?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r : null;
}

export const sameAnchor = (a: Anchor | null, b: Anchor | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.side === b.side && a.arrow === b.arrow);

/**
 * What a guided step points at on screen: whatever is pulsing (the next thing to click on the way
 * to it: the Build button, then the category, then the room), else the top-bar element its
 * highlight names. Null when there's nothing to point at (a room in the scene, say).
 */
export function findTarget(highlight: string | null): Element | null {
  const visible = (e: Element) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const pulsing = [...document.querySelectorAll(".pulse")].find((e) => !e.closest(".tutorial") && visible(e));
  if (pulsing) return pulsing;
  if (highlight?.startsWith("hud:")) {
    const e = document.querySelector(`[data-hud="${highlight.slice(4)}"]`);
    if (e && visible(e)) return e;
  }
  return null;
}

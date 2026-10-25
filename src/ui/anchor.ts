// Placing the guided tutorial's card next to what its step is about, with an arrow to it: below the
// target when it's in the top half of the screen, above it otherwise, kept on screen. All in real
// pixels (getBoundingClientRect), so the interface-size zoom doesn't matter.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Anchor {
  left: number;
  top: number;
  /** The card sits below the target (the arrow on its top edge, pointing up), else above. */
  below: boolean;
  /** Where the arrow meets the card's edge, from its left. */
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
 */
export function place(target: Box, card: Pick<Box, "width" | "height">, view: Pick<Box, "width" | "height">, avoid?: Box | null): Anchor {
  const cx = target.left + target.width / 2;
  const below = target.top + target.height / 2 < view.height / 2;
  const upper = Math.min(target.top, avoid?.top ?? Infinity);
  const lower = Math.max(target.top + target.height, avoid ? avoid.top + avoid.height : -Infinity);
  const top = below ? lower + GAP : upper - GAP - card.height;
  const left = clamp(cx - card.width / 2, MARGIN, view.width - card.width - MARGIN);
  return {
    left: Math.round(left),
    top: Math.round(clamp(top, MARGIN, view.height - card.height - MARGIN)),
    below,
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
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.below === b.below && a.arrow === b.arrow);

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

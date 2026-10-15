import { portraitSvg, type PortraitPerson } from "../view/portrait";

/** A notable's headshot (view/portrait.ts) in the round `.face` frame. Decorative: their name sits beside it. */
export function Portrait({ who, small }: { who: PortraitPerson | undefined; small?: boolean }) {
  const cls = `face${small ? " small" : ""}`;
  if (!who) return <span className={cls}>?</span>;
  // The SVG is the game's own markup, built from numbers and its palettes, never from text a player typed.
  return <span className={cls} aria-hidden="true" dangerouslySetInnerHTML={{ __html: portraitSvg(who) }} />;
}

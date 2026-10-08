import { ICONS, iconAttrs, type IconId } from "../view/icons";

/** One of the game's icons (view/icons.ts), in the text's colour, at `size` px. Decorative: name the thing beside it. */
export function Icon({ id, size = 16, className }: { id: IconId; size?: number; className?: string }) {
  // The icons are the game's own constant markup, not anything a player typed.
  const markup = `<svg width="${size}" height="${size}" ${iconAttrs()}>${ICONS[id]}</svg>`;
  return <span className={`ico${className ? ` ${className}` : ""}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}

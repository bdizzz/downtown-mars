// The game's icon set: one small, simple set drawn for the top bar (T-089), on a 16-unit grid with a
// 1.5 stroke, readable at 16–20 px. Each icon is its own shape, so none relies on colour alone; colour
// (amber, red) only adds to it. Shared by the web (ui/Icon.tsx) and the Godot viewer, which gets the
// same SVGs through the bridge and rasterizes them (godot/src/Icons.cs).

/** Each icon's SVG body, drawn in currentColor: stroked unless an element fills itself. */
export const ICONS = {
  // The colony.
  colonists: '<circle cx="8" cy="4.5" r="2.5"/><path d="M3 14c0-3 2.2-5 5-5s5 2 5 5"/>',
  health: '<path d="M8 13.5S2 10 2 6a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 7.5-6 7.5z"/>',
  happiness: '<circle cx="8" cy="8" r="6"/><path d="M5.5 9.5c1.3 1.5 3.7 1.5 5 0M6 6v.5M10 6v.5"/>',
  condition: '<path d="M10.5 2a3.5 3.5 0 0 0-3.3 4.6L2 11.8 4.2 14l5.2-5.2A3.5 3.5 0 0 0 14 5.5l-2.2 1.2-2-2L11 2.2z"/>',
  workers: '<path d="M1.5 12.5h13M3 12.5a5 5 0 0 1 10 0M6.5 8V5.5M9.5 8V5.5"/>',
  power: '<path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z" fill="currentColor"/>',
  // Life.
  o2: '<circle cx="6" cy="9.5" r="4"/><circle cx="12" cy="4" r="2"/>',
  co2: '<path d="M4.5 12.5h7a2.5 2.5 0 0 0 .4-5A3.6 3.6 0 0 0 5 6.6a3 3 0 0 0-.5 5.9z"/>',
  water: '<path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z"/>',
  meals: '<path d="M1.5 8.5h13a6.5 6 0 0 1-13 0zM6 2v3.5M10 2v3.5"/>',
  // Food.
  rations: '<rect x="3" y="4" width="10" height="9.5" rx="1"/><path d="M3 7.5h10M6 2h4"/>',
  rawFood: '<path d="M8 14.5V8C8 4.5 5 3 2.5 3c0 3 1.5 5 5.5 5M8 10c0-3 2.5-4.5 5.5-4.5 0 3-2 4.5-5.5 4.5"/>',
  soil: '<path d="M1.5 13.5c1.5-4 4-6 6.5-6s5 2 6.5 6z"/><circle cx="6" cy="11" r=".6" fill="currentColor"/><circle cx="10" cy="10.5" r=".6" fill="currentColor"/>',
  // Materials.
  rock: '<path d="M2 12.5 4 6l4-3 4.5 2.5 1.5 7zM4 6l3.5 3L12.5 5.5M7.5 9 6.5 12.5"/>',
  brick: '<rect x="1.5" y="3.5" width="13" height="9"/><path d="M1.5 8h13M6 3.5V8M10 8v4.5"/>',
  metal: '<path d="M1.5 13h13l-2-5h-9zM4 8l1.5-4.5h5L12 8"/>',
  machinery: '<circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3"/>',
  electronics: '<rect x="4" y="4" width="8" height="8" rx="1"/><path d="M6.5 1.5V4M9.5 1.5V4M6.5 12v2.5M9.5 12v2.5M1.5 6.5H4M1.5 9.5H4M12 6.5h2.5M12 9.5h2.5"/>',
  ore: '<path d="M8 1.5 12.5 5.5 8 14.5 3.5 5.5zM3.5 5.5h9M6 5.5l2 9 2-9"/>',
  silica: '<circle cx="4.5" cy="11.5" r="1.5"/><circle cx="10.5" cy="12" r="1.5"/><circle cx="7.5" cy="6.5" r="1.5"/><circle cx="12.5" cy="5.5" r="1"/><circle cx="3.5" cy="5" r="1"/>',
  glass: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M5 9l4-4M7.5 11.5l4-4"/>',
  fiber: '<path d="M3 2.5h10M3 13.5h10"/><rect x="5" y="2.5" width="6" height="11"/><path d="M5 5.5l6 2M5 9l6 2"/>',
  // The top bar.
  menu: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
  drill: '<path d="M5 1.5h6v3H5zM6 4.5V8l2 6.5L10 8V4.5M6 7.5l4 1.5M6.5 10.5l3 1"/>',
  storm: '<path d="M1.5 5.5H10a2 2 0 1 0-2-2M1.5 8.5h11a2 2 0 1 1-2 2M1.5 11.5h5"/>',
  drop: '<path d="M8 1.5c2.5 2 3.5 5 3 8.5H5c-.5-3.5.5-6.5 3-8.5zM5 10l-2 3h3M11 10l2 3h-3M8 12v2.5"/><circle cx="8" cy="6" r="1"/>',
  office: '<path d="M2 3h12v7.5H8l-3.5 3v-3H2z"/>',
  alert: '<path d="M8 1.5 14.8 13.5H1.2z"/><path d="M8 6v3.5"/><circle cx="8" cy="11.5" r=".8" fill="currentColor"/>',
  up: '<path d="M8 3.5 13 11.5H3z" fill="currentColor" stroke="none"/>',
  down: '<path d="M8 12.5 3 4.5h10z" fill="currentColor" stroke="none"/>',
} as const;

export type IconId = keyof typeof ICONS;

export const isIcon = (id: string): id is IconId => id in ICONS;

/** The SVG's attributes round an icon's body: the grid and the stroke, in one place. */
export const iconAttrs = (color = "currentColor") =>
  `viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;

/** A whole SVG file for an icon, in one colour (Godot draws them white and tints them). */
export function iconSvg(id: IconId, color = "#ffffff", size = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ${iconAttrs(color)}>${ICONS[id].replaceAll("currentColor", color)}</svg>`;
}

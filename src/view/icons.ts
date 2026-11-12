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
  marscrete: '<path d="M2 5.5 8 3l6 2.5v5L8 13l-6-2.5zM2 5.5 8 8l6-2.5M8 8v5"/><circle cx="5" cy="9" r=".6" fill="currentColor"/><circle cx="11" cy="9.5" r=".6" fill="currentColor"/>',
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
  weather: '<path d="M6.5 9.3V3a1.5 1.5 0 0 1 3 0v6.3a3 3 0 1 1-3 0z"/><circle cx="8" cy="11.8" r="1" fill="currentColor"/><path d="M11.5 4h2M11.5 6.5h2"/>',
  drop: '<path d="M8 1.5c2.5 2 3.5 5 3 8.5H5c-.5-3.5.5-6.5 3-8.5zM5 10l-2 3h3M11 10l2 3h-3M8 12v2.5"/><circle cx="8" cy="6" r="1"/>',
  office: '<path d="M2 3h12v7.5H8l-3.5 3v-3H2z"/>',
  alert: '<path d="M8 1.5 14.8 13.5H1.2z"/><path d="M8 6v3.5"/><circle cx="8" cy="11.5" r=".8" fill="currentColor"/>',
  up: '<path d="M8 3.5 13 11.5H3z" fill="currentColor" stroke="none"/>',
  down: '<path d="M8 12.5 3 4.5h10z" fill="currentColor" stroke="none"/>',
  // The room panel (F-019): what a room feels and does, and its sections.
  comfort: '<path d="M2 12.5V8.5a1.5 1.5 0 0 1 3 0V10h6V8.5a1.5 1.5 0 0 1 3 0v4M5 10V6a3 3 0 0 1 6 0v4M3 12.5v1.5M13 12.5v1.5M2 12.5h12"/>',
  noise: '<path d="M2 6v4h2.5L8 13V3L4.5 6zM10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9"/>',
  smell: '<path d="M4 14c-1.5-2 1.5-3.5 0-6S5 4 4 2M8 14c-1.5-2 1.5-3.5 0-6S9 4 8 2M12 14c-1.5-2 1.5-3.5 0-6s1-4 0-6"/>',
  air: '<path d="M1.5 5.5H10a2 2 0 1 0-2-2M1.5 8.5h12M1.5 11.5H9a2 2 0 1 1-2 2"/>',
  reach: '<path d="M4.5 9.5c-1.5 0-2-1.5-2-3s.6-3.5 2-3.5 2 2 2 3.5-.5 3-2 3zM3 11.5h3M11.5 13c-1.5 0-2-1.5-2-3s.6-3.5 2-3.5 2 2 2 3.5-.5 3-2 3zM10 14.5h3"/>',
  walls: '<path d="M1.5 2.5h13v11h-13zM1.5 6h13M1.5 9.5h13M5.5 2.5V6M10.5 2.5V6M8 6v3.5M3.5 6v3.5M12.5 6v3.5M5.5 9.5v4M10.5 9.5v4"/>',
  window: '<rect x="2.5" y="2" width="11" height="12" rx="1"/><path d="M8 2v12M2.5 8h11"/>',
  seat: '<path d="M4 1.5v12.5M4 8.5h8v5.5M4 8.5V1.5M12 8.5V5"/>',
  school: '<path d="M8 3 1 6.5 8 10l7-3.5zM4 8v3.5c2 1.8 6 1.8 8 0V8M15 6.5V11"/>',
  clinic: '<rect x="2" y="2" width="12" height="12" rx="2"/><path d="M8 5v6M5 8h6"/>',
  restroom: '<path d="M2.5 7.5h11v1a5.5 4 0 0 1-11 0zM4.5 7.5V2.5h3v5M5.5 12.5l-1 2h7l-1-2"/>',
  crate: '<path d="M2 5 8 2l6 3v6.5l-6 3-6-3zM2 5l6 3 6-3M8 8v6.5"/>',
  chevron: '<path d="M6 3.5 10.5 8 6 12.5"/>',
  // The dock and the build rail: modes, tools and the groups of rooms.
  build: '<path d="M9.5 2.5 13.5 6.5 11.5 8.5 7.5 4.5zM8.5 5.5 2.5 11.5 4.5 13.5 10.5 7.5"/>',
  eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/>',
  charts: '<path d="M2 14h12M4 14V9M8 14V3.5M12 14V6.5"/>',
  pause: '<path d="M5.5 3.5v9M10.5 3.5v9"/>',
  play: '<path d="M5 3 12.5 8 5 13z" fill="currentColor"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  rotate: '<path d="M13 8a5 5 0 1 1-1.7-3.7M13 2.5v3h-3"/>',
  undo: '<path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H6M3 6.5l3-3M3 6.5l3 3"/>',
  demolish: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9M7 7v4M9 7v4"/>',
  home: '<path d="M2 8 8 2.5 14 8M3.5 7v6.5h9V7M6.5 13.5V10h3v3.5"/>',
  stairs: '<path d="M2 13.5h3.5V10H9V6.5h3.5V3H14"/>',
  community: '<circle cx="5.5" cy="5" r="2"/><circle cx="11" cy="6" r="1.5"/><path d="M1.5 13c0-2.5 1.8-4 4-4s4 1.5 4 4M10 9.6c.3-.1.7-.1 1-.1 1.9 0 3.5 1.2 3.5 3.5"/>',
  stock: '<path d="M2 4.5h12M2 8h12M2 11.5h12"/><circle cx="5" cy="4.5" r="1.2" fill="currentColor"/><circle cx="10.5" cy="8" r="1.2" fill="currentColor"/><circle cx="7" cy="11.5" r="1.2" fill="currentColor"/>',
  corridor: '<path d="M2 5.5h8.5a2 2 0 0 1 2 2V14M2 9.5h6.5V14"/>',
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

import { CORRIDOR_KEY, DEMOLISH_KEY, HOTKEYS } from "../view/buildCatalog";
import { roomDefs } from "../sim/rooms";
import { touchFirst } from "../view/touch";

const GENERAL: [string, string][] = [
  ["Modes", "Build, View, Map and Charts, bottom right: each opens its buttons along the bottom (again to close). Only Build places rooms and corridors"],
  ["B", "Build mode (the rooms' keys, on the right, work only in Build)"],
  ["V", "View mode: cameras, plan and unrolled views, overlays"],
  ["C", "Charts mode: people, flows, network, construction"],
  ["M", "Map mode: the planet"],
  ["Space", "Pause / resume, at the speed you had"],
  ["− +", "Slower / faster (1×, 2×, 4×)"],
  ["Esc", "Put down the tool, close a panel or mode, or open the menu"],
  ["R", "Rotate the room you're placing (in Build)"],
  ["[ ]", "Previous / next hole"],
  [DEMOLISH_KEY, "Demolish tool (in Build)"],
  [CORRIDOR_KEY, "Corridor tool (in Build): drag to snake a corridor along the borders, confirm on release; Shift fills in"],
  ["⌘Z / Ctrl+Z", "Undo your last placement"],
  ["?", "Show or hide this help"],
  ["Drag", "Pan the view (draws corridors with the corridor tool)"],
  ["Scroll", "Pan up, down and around (zooms the plan)"],
  ["Pinch / Ctrl+scroll", "Zoom"],
  ["Right-click", "Cancel the current tool"],
  ["WASD, Q E", "First person: walk (Shift runs) and turn"],
  ["WASD", "Free view: pan across the floor (not in Build, where they're room keys); Reset camera (top left) goes back"],
  ["↑ ↓ / Page Up, Page Down", "Floor up / down in the Plan and 3D views"],
];

/** On a phone or tablet: what fingers do (the keys still work with a keyboard attached). */
const TOUCH: [string, string][] = [
  ["Tap", "Select a room; with a tool, aim it (the ghost shows where it lands)"],
  ["Tap again", "Place, dig or demolish where you aimed"],
  ["Hold", "Show what's under your finger, as hovering does with a mouse"],
  ["Drag", "3D: turn round the hole (Free view: drag up and down to tilt). Plan and Unrolled: pan. With the corridor tool: draw"],
  ["Two fingers", "Pinch to zoom, twist to turn, move together to pan (in the side-on views, to go up and down)"],
  ["Stick", "First person: the stick bottom left walks (all the way runs); drag elsewhere to look; ▲ ▼ take the stairs"],
  ["Modes", "Build, View, Map and Charts along the bottom; tap the view to fold a room list away"],
];

export function Help({ onClose }: { onClose: () => void }) {
  const finger = touchFirst();
  const rooms = finger ? [] : roomDefs.filter((d) => HOTKEYS[d.id]);
  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu help" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2>Controls</h2>
        <div className="help-cols">
          <dl>
            {(finger ? TOUCH : GENERAL).map(([k, v]) => (
              <div key={k}>
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <dl>
            {rooms.map((d) => (
              <div key={d.id}>
                <dt>
                  <kbd>{HOTKEYS[d.id]}</kbd>
                </dt>
                <dd>{d.name}</dd>
              </div>
            ))}
          </dl>
        </div>
        <button className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

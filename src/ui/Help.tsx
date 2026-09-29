import { CORRIDOR_KEY, DEMOLISH_KEY, HOTKEYS } from "./BuildPalette";
import { roomDefs } from "../sim/rooms";

const GENERAL: [string, string][] = [
  ["Modes", "Build, View, Map and Charts, bottom right: each opens its buttons along the bottom (again to close). Only Build places rooms and corridors"],
  ["B", "Build mode (the rooms' keys, on the right, work only in Build)"],
  ["V", "View mode: cameras, plan and unrolled views, overlays"],
  ["C", "Charts mode: people, flows, network, construction"],
  ["M", "Map mode: the planet"],
  ["Space", "Pause / resume"],
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
];

export function Help({ onClose }: { onClose: () => void }) {
  const rooms = roomDefs.filter((d) => HOTKEYS[d.id]);
  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu help" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2>Controls</h2>
        <div className="help-cols">
          <dl>
            {GENERAL.map(([k, v]) => (
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

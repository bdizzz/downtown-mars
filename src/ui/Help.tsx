import { DEMOLISH_KEY, HOTKEYS } from "./BuildPalette";
import { roomDefs } from "../sim/rooms";

const GENERAL: [string, string][] = [
  ["Space", "Pause / resume"],
  ["Esc", "Cancel, close a panel, or open the menu"],
  ["R", "Rotate the room you're placing"],
  ["V", "Switch between the 2D and 3D views"],
  ["M", "Open or close the map of Mars"],
  ["[ ]", "Previous / next hole"],
  [DEMOLISH_KEY, "Demolish tool"],
  ["⌘Z / Ctrl+Z", "Undo your last placement"],
  ["?", "Show or hide this help"],
  ["Drag", "Pan the view (draws corridors with the corridor tool)"],
  ["C", "Corridor tool: drag to snake a corridor along the borders, confirm on release; Shift fills in"],
  ["Scroll", "Pan up, down and around"],
  ["Pinch / Ctrl+scroll", "Zoom"],
  ["Right-click", "Cancel the current tool"],
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

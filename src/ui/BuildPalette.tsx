import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import type { Tool } from "../render2d/stage";
import type React from "react";
import { config } from "../sim/config";
import { roomDefs, type RoomDef } from "../sim/rooms";

const COST_ABBR: Record<string, string> = { rock: "R", brick: "B", metal: "M", machinery: "Mc", electronics: "E" };

const costText = (def: RoomDef) =>
  Object.entries(def.cost)
    .map(([k, v]) => `${COST_ABBR[k] ?? k} ${v}`)
    .join(", ");

export function shapesFor(def: RoomDef): [number, number][] {
  if (def.size === "surface") return [[1, 1]];
  return config.shapes[def.size] ?? [[1, 1]];
}

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
}

export function BuildPalette({ tool, setTool }: Props) {
  const buildable = roomDefs.filter((d) => d.buildable);
  const selected = tool?.kind === "build" ? tool.room : null;

  return (
    <aside className="palette">
      <h2>Build</h2>
      {buildable.map((def) => {
        const on = def.id === selected;
        return (
          <button
            key={def.id}
            className={`room-btn${on ? " on" : ""}`}
            style={{ "--cat": cssColor(CATEGORY_COLORS[def.category] ?? 0x888888) } as React.CSSProperties}
            onClick={() => setTool(on ? null : { kind: "build", room: def.id, shape: shapesFor(def)[0]! })}
            title={costText(def)}
          >
            <span className="swatch" />
            <span className="name">{def.name}</span>
            <span className="size">{def.size === "surface" ? "surf" : def.size}</span>
          </button>
        );
      })}
      {tool?.kind === "build" && shapesFor(roomDefs.find((d) => d.id === tool.room)!).length > 1 && (
        <p className="hint">
          Shape {tool.shape[0]} wide × {tool.shape[1]} deep · <kbd>R</kbd> to rotate
        </p>
      )}
      <button
        className={`room-btn demolish${tool?.kind === "demolish" ? " on" : ""}`}
        onClick={() => setTool(tool?.kind === "demolish" ? null : { kind: "demolish" })}
      >
        <span className="name">Demolish</span>
      </button>
      <p className="hint">
        <kbd>Esc</kbd> or right-click to cancel
      </p>
    </aside>
  );
}

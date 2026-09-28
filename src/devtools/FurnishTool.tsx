import { useState } from "react";
import { furniture, itemDef } from "../view/furniture";
import { roomDef } from "../sim/rooms";
import { Catalogue } from "./Catalogue";
import "./devtools.css";

// The furnishing tool (dev builds only, at ?furnish): look at the furniture
// models, and lay out the templates that furnish each room type.

const ROOMS = Object.keys(furniture.rooms);

export function FurnishTool() {
  const [room, setRoom] = useState<string | null>(ROOMS[0] ?? null);
  return (
    <div className="dev-tool">
      <aside className="dev-side">
        <h1>Furnishing</h1>
        <label>
          Room{" "}
          <select value={room ?? ""} onChange={(e) => setRoom(e.target.value || null)}>
            <option value="">All items</option>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {roomDef(r).name}
              </option>
            ))}
          </select>
        </label>
        <ul className="dev-items">
          {(room ? (furniture.rooms[room] ?? []) : Object.keys(furniture.items)).map((id) => {
            const [w, d, h] = itemDef(id).size;
            return (
              <li key={id}>
                {itemDef(id).name} <span className="k">{w} × {d} × {h} m</span>
              </li>
            );
          })}
        </ul>
        <p className="k">Drag to turn, scroll to zoom.</p>
      </aside>
      <Catalogue room={room} />
    </div>
  );
}

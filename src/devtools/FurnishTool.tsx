import { useState } from "react";
import { furniture, itemDef } from "../view/furniture";
import { roomDef } from "../sim/rooms";
import { Catalogue } from "./Catalogue";
import { TemplateEditor } from "./TemplateEditor";
import "./devtools.css";

// The furnishing tool (dev builds only, at ?furnish): lay out the templates
// that furnish each room type, and look at the furniture models.

const ROOMS = Object.keys(furniture.rooms);

export function FurnishTool() {
  const [room, setRoom] = useState<string>(ROOMS[0]!);
  const [tab, setTab] = useState<"templates" | "catalogue">("templates");
  return (
    <div className="dev-tool">
      <aside className="dev-side">
        <h1>Furnishing</h1>
        <div className="dev-row">
          <button className={tab === "templates" ? "on" : ""} onClick={() => setTab("templates")}>
            Templates
          </button>
          <button className={tab === "catalogue" ? "on" : ""} onClick={() => setTab("catalogue")}>
            Catalogue
          </button>
        </div>
        <label>
          Room{" "}
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {roomDef(r).name}
              </option>
            ))}
          </select>
        </label>
        <ul className="dev-items">
          {(furniture.rooms[room] ?? []).map((id) => {
            const [w, d, h] = itemDef(id).size;
            return (
              <li key={id}>
                {itemDef(id).name} <span className="k">{w} × {d} × {h} m</span>
              </li>
            );
          })}
        </ul>
        <p className="k">In the 3D views, drag to turn and scroll to zoom.</p>
      </aside>
      {tab === "templates" ? <TemplateEditor key={room} room={room} /> : <Catalogue room={room} />}
    </div>
  );
}

import { roomWork } from "../sim/construction";
import type { EffectDef, RoomDef } from "../sim/rooms";
import { resourceDef } from "../sim/resources";
import { num, resName } from "./format";

interface Props {
  def: RoomDef;
  resources: Record<string, number>;
  shape: [number, number];
  onRotate?: () => void;
  /** Why this hole can't have the room at all (e.g. no ore under it). */
  siteNote?: string | null;
}

const SIZE_NAMES: Record<string, string> = { S: "Small", M: "Medium", L: "Large", H: "Huge", surface: "Surface" };

function effectText(e: EffectDef): string {
  const name = e.type === "airQuality" ? "Air quality" : e.type[0]!.toUpperCase() + e.type.slice(1);
  const v = `${e.strength > 0 ? "+" : "−"}${Math.abs(e.strength)}`;
  if (e.residentsOnly) return `${name} ${v} for its own residents`;
  if (e.radius === 0) return `${name} ${v} in the room`;
  return `${name} ${v}, fading over ${e.radius} ${e.radius === 1 ? "step" : "steps"}`;
}

const flows = (r: Record<string, number>) =>
  Object.entries(r)
    .map(([id, v]) => `${resName(id)} ${num(v)}`)
    .join(", ");

/** Everything a player needs to decide where a room goes, before placing it. */
export function RoomCard({ def, resources, shape, onRotate, siteNote }: Props) {
  return (
    <div className="room-card">
      <h3>{def.name}</h3>
      <p className="k">
        {SIZE_NAMES[def.size]}
        {def.size !== "surface" && ` · ${shape[0]} wide × ${shape[1]} deep`}
        {def.size === "surface" && def.surfaceSlots ? ` · ${def.surfaceSlots} surface ${def.surfaceSlots === 1 ? "slot" : "slots"}` : ""}
        {onRotate && (
          <button className="rotate" onClick={onRotate} title="Rotate (R)">
            ⟳ rotate
          </button>
        )}
      </p>
      <p className="cost">
        {Object.entries(def.cost).map(([id, amt]) => (
          <span key={id} className={(resources[id] ?? 0) < amt ? "short" : ""}>
            {resourceDef(id).name} {amt}
          </span>
        ))}
        {!Object.keys(def.cost).length && <span>Free</span>}
      </p>
      <p className="k">Takes {roomWork(def.id)} work-hours to build</p>
      {def.storage ? <p className="good">Stores {def.storage} units of goods, shared among those you choose</p> : null}
      {def.constructionBandwidth ? <p className="good">Adds {def.constructionBandwidth} to construction bandwidth at full staff</p> : null}
      {def.staff > 0 && <p>Staff {def.staff}</p>}
      {Object.keys(def.uses).length > 0 && <p>Uses {flows(def.uses)} a day</p>}
      {Object.keys(def.makes).length > 0 && <p>Makes {flows(def.makes)} a day</p>}
      {def.stores && <p>Stores {flows(def.stores)}</p>}
      {def.houses ? <p>Houses {def.houses}</p> : null}
      {def.sanitation ? <p>Sanitation for {def.sanitation}</p> : null}
      {def.cares ? <p>Care for {def.cares}</p> : null}
      {def.ordinanceSlots ? <p>{def.ordinanceSlots} ordinance slots</p> : null}
      {def.effects.map((e, i) => (
        <p key={i} className={e.strength < 0 ? "bad" : "good"}>
          {effectText(e)}
        </p>
      ))}
      {siteNote && <p className="bad">{siteNote}.</p>}
      {(def.floors ?? 1) > 1 && <p>Spans {def.floors} floors, linking them</p>}
      {def.public ? (
        <p className="good">Walk-through: its sides count as corridors, so neighbours open onto it</p>
      ) : (
        def.size !== "surface" && <p className="k">Needs the gallery (ring 1) or a corridor to one side.</p>
      )}
    </div>
  );
}

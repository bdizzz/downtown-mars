import type { EffectDef, RoomDef } from "../sim/rooms";
import { resourceDef } from "../sim/resources";
import { num, resName } from "./format";

interface Props {
  def: RoomDef;
  resources: Record<string, number>;
  shape: [number, number];
  onRotate?: () => void;
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
export function RoomCard({ def, resources, shape, onRotate }: Props) {
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
      {def.blocksEffects && <p className="good">Blocks {def.blocksEffects.join(" and ")} passing through</p>}
      {def.size !== "surface" && def.id !== "corridor" && <p className="k">Needs the gallery (ring 1) or a corridor.</p>}
    </div>
  );
}

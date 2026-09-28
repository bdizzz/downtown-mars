import type { Snapshot } from "../sim/snapshot";
import { daysLeft, num, resName, signed } from "./format";
import { isStorable } from "../sim/storage";

// The stocks a player watches, left to right: life, then food, then materials.
const LIFE = ["o2", "water", "meals"] as const;
const FOOD = ["rations", "rawFood", "soil"] as const;
const MATERIALS = ["rock", "brick", "metal", "machinery", "electronics"] as const;
/** Shown only where there's some: they come from the ground under certain sites. */
const REGIONAL = ["ore", "silica"] as const;
const WARN_DAYS = 2;
/** Storage this full, with more coming in, shows as full. */
const FULL_AT = 0.97;

function Stock({ id, s }: { id: string; s: Snapshot }) {
  const v = s.resources[id] ?? 0;
  const cap = s.capacities[id] ?? 0;
  const rate = s.rates[id] ?? 0;
  const left = daysLeft(v, rate);
  const warn = left !== null && left < WARN_DAYS;
  // Dry goods: storage may be full (what arrives is lost) or missing altogether.
  const stored = isStorable(id) && Number.isFinite(cap);
  const full = stored && cap > 0 && v >= cap * FULL_AT && rate > 0;
  const none = stored && cap <= 0;
  const storeNote = !stored ? "" : none ? " · no storage set aside for it" : full ? " · storage full: more is lost" : "";
  const title = `${resName(id)}: ${num(v)} / ${num(cap)} · ${signed(rate)}/day${left !== null ? ` · runs out in ${left.toFixed(1)} days` : ""}${storeNote}`;
  return (
    <span className={`res${warn ? " warn" : ""}${full || (none && rate > 0) ? " full" : ""}`} title={title}>
      <span className="label">{resName(id)}</span>
      <span className="val">{num(v)}</span>
      {Math.abs(rate) >= 0.05 && <span className={`rate ${rate < 0 ? "neg" : "pos"}`}>{signed(rate)}</span>}
    </span>
  );
}

/** "38 adults, 4 children, 2 elders", leaving out stages nobody is in yet. */
function stagesText(st: { child: number; adult: number; elder: number }): string {
  const parts = [
    [st.adult, "adult", "adults"],
    [st.child, "child", "children"],
    [st.elder, "elder", "elders"],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(", ") || "nobody";
}

export function ResourceBar({ s }: { s: Snapshot | null }) {
  if (!s) return <div className="resbar" />;
  const { made, used } = s.power;
  const co2 = s.resources.co2 ?? 0;
  const pop = s.population;
  return (
    <div className="resbar">
      <span className="group">
        <span className={`res${pop.health < 70 ? " warn" : ""}`} title={`Colonists / beds: ${stagesText(s.stages)} · health from oxygen, water, meals, sanitation and CO2`}>
          <span className="label">Colonists</span>
          <span className="val">
            {pop.count}/{s.beds}
          </span>
          <span className="rate">♥ {Math.round(pop.health)}</span>
        </span>
        <span
          className={`res${s.happiness.productivity < 1 ? " warn" : ""}`}
          title={`Average happiness${s.happiness.productivity < 1 ? ` · rooms at ${Math.round(s.happiness.productivity * 100)}% from low morale` : ""}${s.happiness.homeless ? ` · ${s.happiness.homeless} homeless` : ""}`}
        >
          <span className="label">Happy</span>
          <span className="val">{Math.round(s.happiness.average)}</span>
        </span>
        <span className="res" title="Workers employed / total">
          <span className="label">Workers</span>
          <span className="val">
            {s.workforce.employed}/{s.workforce.total}
          </span>
        </span>
        <span className={`res${used > made + 0.01 ? " warn" : ""}`} title={`Power made ${num(made)} · used ${num(used)} per day · battery ${num(s.resources.power ?? 0)}/${num(s.capacities.power ?? 0)}`}>
          <span className="label">Power</span>
          <span className="val">
            {num(used)}/{num(made)}
          </span>
        </span>
      </span>
      <span className="group">
        {LIFE.map((id) => (
          <Stock key={id} id={id} s={s} />
        ))}
        <span className={`res${co2 > 60 ? " warn" : ""}`} title={`CO2 in the air: ${num(co2)}; above 100 harms health`}>
          <span className="label">CO2</span>
          <span className="val">{num(co2)}</span>
        </span>
      </span>
      <span className="group">
        {FOOD.map((id) => (
          <Stock key={id} id={id} s={s} />
        ))}
      </span>
      <span className="group">
        {MATERIALS.map((id) => (
          <Stock key={id} id={id} s={s} />
        ))}
        {REGIONAL.filter((id) => (s.resources[id] ?? 0) > 0 || s.holeDeposits.includes(id)).map((id) => (
          <Stock key={id} id={id} s={s} />
        ))}
      </span>
    </div>
  );
}

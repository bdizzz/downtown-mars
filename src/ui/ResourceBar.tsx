import type { Snapshot } from "../sim/snapshot";
import { daysLeft, num, resName, signed } from "./format";

// The stocks a player watches, left to right: life, then food, then materials.
const LIFE = ["o2", "water", "meals"] as const;
const FOOD = ["rations", "rawFood", "soil"] as const;
const MATERIALS = ["rock", "brick", "metal", "machinery", "electronics"] as const;
const WARN_DAYS = 2;

function Stock({ id, s }: { id: string; s: Snapshot }) {
  const v = s.resources[id] ?? 0;
  const cap = s.capacities[id] ?? 0;
  const rate = s.rates[id] ?? 0;
  const left = daysLeft(v, rate);
  const warn = left !== null && left < WARN_DAYS;
  const title = `${resName(id)}: ${num(v)} / ${num(cap)} · ${signed(rate)}/day${left !== null ? ` · runs out in ${left.toFixed(1)} days` : ""}`;
  return (
    <span className={`res${warn ? " warn" : ""}`} title={title}>
      <span className="label">{resName(id)}</span>
      <span className="val">{num(v)}</span>
      {Math.abs(rate) >= 0.05 && <span className={`rate ${rate < 0 ? "neg" : "pos"}`}>{signed(rate)}</span>}
    </span>
  );
}

export function ResourceBar({ s }: { s: Snapshot | null }) {
  if (!s) return <div className="resbar" />;
  const { made, used } = s.power;
  const co2 = s.resources.co2 ?? 0;
  const pop = s.population;
  return (
    <div className="resbar">
      <span className="group">
        <span className={`res${pop.health < 70 ? " warn" : ""}`} title={`Colonists / beds · health from oxygen, water, meals, sanitation and CO2`}>
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
      </span>
    </div>
  );
}

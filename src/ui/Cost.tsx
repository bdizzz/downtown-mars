import { isIcon } from "../view/icons";
import { num, resName } from "./format";
import { Icon } from "./Icon";

/**
 * Resources as chips: each an icon and an amount (its name too, when it has no icon of its own).
 * With `have`, an amount the stocks are short of shows red. Empty: "Free".
 */
export function Amounts({ amounts, have, free = "Free" }: { amounts: Record<string, number>; have?: Record<string, number>; free?: string }) {
  const list = Object.entries(amounts).filter(([, v]) => v !== 0);
  /** Costs are whole numbers: no "5.0". */
  const n = (v: number) => (Number.isInteger(v) ? String(v) : num(v));
  if (!list.length) return <span className="amounts k">{free}</span>;
  return (
    <span className="amounts">
      {list.map(([id, v]) => {
        const short = !!have && (have[id] ?? 0) < v;
        const name = resName(id);
        return (
          <span key={id} className={`amount${short ? " short" : ""}`} title={have ? `${name}: ${n(v)} (you have ${num(Math.floor(have[id] ?? 0))})` : `${name}: ${n(v)}`}>
            {isIcon(id) && <Icon id={id} size={13} />}
            {n(v)}
            {!isIcon(id) && ` ${name.toLowerCase()}`}
          </span>
        );
      })}
    </span>
  );
}

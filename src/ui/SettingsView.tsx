import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { GRAPHICS_PRESETS, presetOf, PRESET_NAMES, type Graphics, type Preset } from "../view/graphics";
import type { Settings } from "./settings";
import { rowsIn, SECTIONS, type SectionId, type SettingRow } from "./settingsTable";

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  onBack: () => void;
  /** The keys and gestures (Help). */
  onKeys: () => void;
  /** The tutorial's card is kept apart from the other settings (see App). */
  tutorial: boolean;
  onTutorial: (on: boolean) => void;
}

/** Wide enough for tabs; narrower, the sections stack. */
const WIDE = "(min-width: 640px)";

function useWide(): boolean {
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

const SHOWN = SECTIONS.filter((s) => rowsIn(s.id).length > 0);

export function SettingsView({ settings, update, onBack, onKeys, tutorial, onTutorial }: Props) {
  const wide = useWide();
  const [tab, setTab] = useState<SectionId>(SHOWN[0]!.id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const ctx: Ctx = { settings, update, onKeys, tutorial, onTutorial };

  // The tabs, as a tab list: arrows (and Home, End) move between them.
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? SHOWN.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    e.stopPropagation();
    const j = (to + SHOWN.length) % SHOWN.length;
    setTab(SHOWN[j]!.id);
    tabs.current[j]?.focus();
  };

  return (
    <div className="settings">
      {wide ? (
        <>
          <div className="settings-tabs" role="tablist" aria-label="Settings sections">
            {SHOWN.map((s, i) => (
              <button
                key={s.id}
                ref={(el) => void (tabs.current[i] = el)}
                role="tab"
                id={`tab-${s.id}`}
                aria-selected={tab === s.id}
                aria-controls={`sec-${s.id}`}
                tabIndex={tab === s.id ? 0 : -1}
                className={tab === s.id ? "on" : ""}
                onClick={() => setTab(s.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="settings-body" role="tabpanel" id={`sec-${tab}`} aria-labelledby={`tab-${tab}`}>
            {rowsIn(tab).map((r) => (
              <Row key={r.id} row={r} ctx={ctx} />
            ))}
          </div>
        </>
      ) : (
        <div className="settings-body">
          {SHOWN.map((s) => (
            <section key={s.id} aria-labelledby={`sec-${s.id}`}>
              <h3 id={`sec-${s.id}`}>{s.name}</h3>
              {rowsIn(s.id).map((r) => (
                <Row key={r.id} row={r} ctx={ctx} />
              ))}
            </section>
          ))}
        </div>
      )}
      <button className="settings-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

type Ctx = Pick<Props, "settings" | "update" | "onKeys" | "tutorial" | "onTutorial">;

type GraphicsKey = Exclude<keyof Graphics, "pixelRatio" | "life" | "reflections">;

/** What each row reads and sets. A new setting in the table gets a line here. */
function bind(row: SettingRow, { settings, update, tutorial, onTutorial }: Ctx): { value: number | boolean; set: (v: number | boolean) => void } | null {
  const g = settings.graphics;
  const setG = (patch: Partial<Graphics>) => update({ graphics: { ...g, ...patch } });
  switch (row.id) {
    case "tutorial":
      return { value: tutorial, set: (v) => onTutorial(v as boolean) };
    case "graphics.pixelRatio":
      return { value: g.pixelRatio, set: (v) => setG({ pixelRatio: v as Graphics["pixelRatio"] }) };
    case "graphics.reflections":
    case "graphics.life": {
      const k = row.id === "graphics.life" ? "life" : "reflections";
      return { value: g[k], set: (v) => setG({ [k]: v }) };
    }
    default: {
      if (row.id.startsWith("graphics.")) {
        const k = row.id.slice("graphics.".length) as GraphicsKey;
        return { value: g[k], set: (v) => setG({ [k]: v }) };
      }
      const k = row.id as keyof Settings;
      const v = settings[k];
      if (typeof v !== "number" && typeof v !== "boolean") return null;
      return { value: v, set: (nv) => update({ [k]: nv } as Partial<Settings>) };
    }
  }
}

function pct(v: number, row: SettingRow): string {
  return v === 0 && row.id.startsWith("graphics.") ? "Off" : `${Math.round(v * 100)}%`;
}

/** One setting: its name and hint on the left, its control on the right. */
function Row({ row, ctx }: { row: SettingRow; ctx: Ctx }) {
  const id = `set-${row.id.replace(".", "-")}`;
  const text = (
    <span className="set-text">
      <span className="set-name">{row.name}</span>
      <span className="set-hint" id={`${id}-hint`}>
        {row.hint}
      </span>
    </span>
  );
  const wrap = (control: ReactNode) => (
    <div className={`set-row set-${row.control}`}>
      <label htmlFor={id}>{text}</label>
      <span className="set-ctl">{control}</span>
    </div>
  );
  // The two that aren't one value: the graphics preset sets many, and a button opens something.
  if (row.id === "graphics.preset") {
    const g = ctx.settings.graphics;
    const preset = presetOf(g);
    return wrap(
      <select id={id} value={preset} aria-describedby={`${id}-hint`} onChange={(e) => e.target.value !== "custom" && ctx.update({ graphics: { ...g, ...GRAPHICS_PRESETS[e.target.value as Preset] } })}>
        {PRESET_NAMES.map((p) => (
          <option key={p.id} value={p.id} title={p.hint}>
            {p.name}
          </option>
        ))}
        {preset === "custom" && <option value="custom">Custom</option>}
      </select>,
    );
  }
  if (row.control === "button") {
    return wrap(
      <button id={id} aria-describedby={`${id}-hint`} onClick={ctx.onKeys}>
        Show
      </button>,
    );
  }
  const b = bind(row, ctx);
  if (!b) return null;
  switch (row.control) {
    case "toggle":
      return (
        <label className="set-row">
          {text}
          <span className="set-ctl">
            <input
              id={id}
              type="checkbox"
              role="switch"
              checked={b.value as boolean}
              aria-describedby={`${id}-hint`}
              onChange={(e) => b.set(e.target.checked)}
              onKeyDown={(e) => {
                // Enter flips a switch too, as Space does.
                if (e.key === "Enter") {
                  e.preventDefault();
                  b.set(!b.value);
                }
              }}
            />
          </span>
        </label>
      );
    case "slider": {
      const v = b.value as number;
      return wrap(
        <>
          <input
            id={id}
            type="range"
            min={row.min}
            max={row.max}
            step={row.step}
            value={v}
            aria-describedby={`${id}-hint`}
            aria-valuetext={pct(v, row)}
            onChange={(e) => b.set(Number(e.target.value))}
          />
          <output htmlFor={id}>{pct(v, row)}</output>
        </>,
      );
    }
    case "select":
      return wrap(
        <select id={id} value={b.value as number} aria-describedby={`${id}-hint`} onChange={(e) => b.set(Number(e.target.value))}>
          {(row.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.name}
            </option>
          ))}
        </select>,
      );
  }
}

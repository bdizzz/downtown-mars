import type { Settings } from "./settings";

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  onBack: () => void;
}

const SCALES = [0.85, 1, 1.15, 1.3];

export function SettingsView({ settings, update, onBack }: Props) {
  return (
    <div className="settings">
      <label>
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(e) => update({ volume: Number(e.target.value) })}
          aria-valuetext={`${Math.round(settings.volume * 100)}%`}
        />
        <span className="k">{Math.round(settings.volume * 100)}%</span>
      </label>
      <label>
        <input type="checkbox" checked={settings.sfx} onChange={(e) => update({ sfx: e.target.checked })} />
        <span>Sound effects</span>
      </label>
      <label>
        <input type="checkbox" checked={settings.ambient} onChange={(e) => update({ ambient: e.target.checked })} />
        <span>Ambient sound</span>
      </label>
      <label>
        <span>Interface size</span>
        <select value={settings.uiScale} onChange={(e) => update({ uiScale: Number(e.target.value) })}>
          {SCALES.map((s) => (
            <option key={s} value={s}>
              {Math.round(s * 100)}%
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={settings.colorBlind} onChange={(e) => update({ colorBlind: e.target.checked })} />
        <span>Colour-blind friendly overlays (orange and blue)</span>
      </label>
      <label>
        <input type="checkbox" checked={settings.autosave} onChange={(e) => update({ autosave: e.target.checked })} />
        <span>Autosave every game day</span>
      </label>
      <button onClick={onBack}>Back</button>
    </div>
  );
}

import { GRAPHICS_PRESETS, presetOf, PRESET_NAMES, type Graphics, type Preset } from "../view/graphics";
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
      <GraphicsSettings graphics={settings.graphics} set={(g) => update({ graphics: { ...settings.graphics, ...g } })} />
      <button onClick={onBack}>Back</button>
    </div>
  );
}

/** The effects, each a slider from off to full. */
const EFFECTS: { key: "ao" | "bloom" | "haze" | "tiltShift" | "grade"; name: string; hint: string }[] = [
  { key: "ao", name: "Soft shadows", hint: "Shade where things meet: corners, and under furniture" },
  { key: "bloom", name: "Glow", hint: "Light around windows, lamps, screens and furnaces" },
  { key: "haze", name: "Haze", hint: "Warm dust in the air, thicker far off and deep down" },
  { key: "tiltShift", name: "Miniature blur", hint: "In Iso, blur above and below the middle, like a model" },
  { key: "grade", name: "Colour", hint: "A warm colour grade and vignette" },
];

const SHARPNESS: { value: Graphics["pixelRatio"]; name: string }[] = [
  { value: 1, name: "Standard" },
  { value: 1.5, name: "Sharp" },
  { value: 2, name: "Sharpest (high-resolution screens)" },
];

/** 3D graphics: a preset, or each effect set by hand (which makes it custom). */
function GraphicsSettings({ graphics, set }: { graphics: Graphics; set: (g: Partial<Graphics>) => void }) {
  const preset = presetOf(graphics);
  return (
    <fieldset className="settings-graphics">
      <legend>3D graphics</legend>
      <label>
        <span>Preset</span>
        <select value={preset} onChange={(e) => e.target.value !== "custom" && set(GRAPHICS_PRESETS[e.target.value as Preset])}>
          {PRESET_NAMES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}: {p.hint}
            </option>
          ))}
          {preset === "custom" && <option value="custom">Custom</option>}
        </select>
      </label>
      <label>
        <span>Sharpness</span>
        <select value={graphics.pixelRatio} onChange={(e) => set({ pixelRatio: Number(e.target.value) as Graphics["pixelRatio"] })}>
          {SHARPNESS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {EFFECTS.map((fx) => (
        <label key={fx.key} title={fx.hint}>
          <span>{fx.name}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={graphics[fx.key]}
            onChange={(e) => set({ [fx.key]: Number(e.target.value) })}
            aria-valuetext={graphics[fx.key] ? `${Math.round(graphics[fx.key] * 100)}%` : "Off"}
          />
          <span className="k">{graphics[fx.key] ? `${Math.round(graphics[fx.key] * 100)}%` : "Off"}</span>
        </label>
      ))}
      <label title="Metal, glass and screens pick up a soft light">
        <input type="checkbox" checked={graphics.reflections} onChange={(e) => set({ reflections: e.target.checked })} />
        <span>Reflections</span>
      </label>
      <label>
        <input type="checkbox" checked={graphics.life} onChange={(e) => set({ life: e.target.checked })} />
        <span>Colonists and dust</span>
      </label>
    </fieldset>
  );
}

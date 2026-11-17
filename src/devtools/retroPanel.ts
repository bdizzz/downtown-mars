import { paletteSubset, RETRO_PALETTE, RETRO_PRESETS, retroTuning, setRetroTuning, type RetroStyle, type RetroTuning } from "../render3d/lookRetro";

// The retro look's tuning panel (#503): sliders for every number in the repaint,
// shown in the corner whenever the game runs with ?look=snes or ?look=ps1. Changes
// apply at once and are kept per browser; "Copy" puts the values on the clipboard
// as JSON, ready to paste into data/retro.json as a preset.

type Control =
  | { key: keyof RetroTuning; label: string; kind: "range"; min: number; max: number; step: number; when?: (t: RetroTuning) => boolean; note?: string }
  | { key: keyof RetroTuning; label: string; kind: "select"; options: string[]; when?: (t: RetroTuning) => boolean }
  | { key: keyof RetroTuning; label: string; kind: "check"; when?: (t: RetroTuning) => boolean };

const SECTIONS: { title: string; controls: Control[] }[] = [
  {
    title: "Pixels",
    controls: [{ key: "pixel", label: "Pixel size", kind: "range", min: 1, max: 12, step: 0.5 }],
  },
  {
    title: "Colour",
    controls: [
      { key: "colours", label: "Colours", kind: "select", options: ["palette", "bits"] },
      { key: "paletteSize", label: "Palette size", kind: "range", min: 2, max: RETRO_PALETTE.length, step: 1, when: (t) => t.colours === "palette" },
      { key: "bits", label: "Bits / channel", kind: "range", min: 1, max: 8, step: 1, when: (t) => t.colours === "bits" },
      { key: "brightness", label: "Brightness", kind: "range", min: 0.5, max: 2, step: 0.05 },
      { key: "contrast", label: "Contrast", kind: "range", min: 0.5, max: 2, step: 0.05 },
      { key: "saturation", label: "Saturation", kind: "range", min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    title: "Dither",
    controls: [
      { key: "pattern", label: "Pattern", kind: "select", options: ["off", "bayer2", "bayer4", "bayer8", "ps1"] },
      { key: "dither", label: "Strength", kind: "range", min: 0, max: 0.3, step: 0.005 },
    ],
  },
  {
    title: "Outlines",
    controls: [
      { key: "outlines", label: "Outlines", kind: "check" },
      { key: "silhouette", label: "Silhouette at", kind: "range", min: 0.005, max: 0.3, step: 0.005, when: (t) => t.outlines },
      { key: "silhouetteDark", label: "Silhouette dark", kind: "range", min: 0, max: 1, step: 0.02, when: (t) => t.outlines },
      { key: "crease", label: "Crease at", kind: "range", min: 0, max: 0.3, step: 0.005, when: (t) => t.outlines, note: "0 = no creases" },
      { key: "creaseDark", label: "Crease dark", kind: "range", min: 0, max: 1, step: 0.02, when: (t) => t.outlines },
      { key: "creaseRange", label: "Crease range (m)", kind: "range", min: 10, max: 500, step: 10, when: (t) => t.outlines },
    ],
  },
  {
    title: "Wobble",
    controls: [{ key: "wobble", label: "Vertex snap", kind: "range", min: 0, max: 320, step: 10, note: "0 = off · applies on reload" }],
  },
];

const CSS = `
.retro-panel { position: fixed; left: 76px; top: 96px; z-index: 50; width: 268px; max-height: calc(100vh - 150px); overflow: auto;
  background: rgba(24, 16, 14, 0.94); color: #f2e4d4; border: 1px solid #5e3a2c; border-radius: 8px;
  font: 12px/1.3 "Space Grotesk", system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,0.45); }
.retro-panel header { cursor: move; user-select: none; display: flex; align-items: center; gap: 6px; padding: 8px 10px; position: sticky; top: 0; background: rgba(24,16,14,0.98); border-bottom: 1px solid #3a2620; }
.retro-panel header b { flex: 1; color: #e8a862; letter-spacing: 0.04em; }
.retro-panel button { background: #3a2620; color: #f2e4d4; border: 1px solid #5e3a2c; border-radius: 4px; padding: 2px 7px; font: inherit; cursor: pointer; }
.retro-panel button:hover { background: #5e3a2c; }
.retro-panel .body { padding: 4px 10px 10px; }
.retro-panel.closed .body { display: none; }
.retro-panel h4 { margin: 10px 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #b8906c; }
.retro-panel .row { display: grid; grid-template-columns: 96px 1fr 44px; align-items: center; gap: 6px; margin: 3px 0; }
.retro-panel .row input[type=range] { width: 100%; accent-color: #e07a3f; }
.retro-panel .row select { background: #2e1c1c; color: #f2e4d4; border: 1px solid #5e3a2c; border-radius: 4px; font: inherit; grid-column: span 2; }
.retro-panel .row output { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, monospace; font-size: 11px; }
.retro-panel .note { margin: -2px 0 4px 102px; font-size: 10px; color: #9a8070; }
.retro-panel .swatches { display: flex; flex-wrap: wrap; gap: 2px; margin: 4px 0 2px; }
.retro-panel .swatches span { width: 14px; height: 14px; border-radius: 2px; }
.retro-panel .presets { display: flex; gap: 6px; margin-top: 10px; }
`;

/** Show the panel; returns a function that removes it. */
export function mountRetroPanel(style: RetroStyle): () => void {
  const sheet = document.createElement("style");
  sheet.textContent = CSS;
  document.head.appendChild(sheet);
  const panel = document.createElement("div");
  panel.className = "retro-panel";
  // Keep the game from reacting to drags, wheels and keys meant for the panel.
  for (const e of ["pointerdown", "wheel", "keydown", "keyup", "click", "dblclick"]) panel.addEventListener(e, (ev) => ev.stopPropagation());

  const header = document.createElement("header");
  const title = document.createElement("b");
  title.textContent = `RETRO · ${style.toUpperCase()}`;
  const copy = button("Copy", async () => {
    const text = JSON.stringify(retroTuning, null, 1).replace(/\n\s*/g, " ");
    try {
      await navigator.clipboard.writeText(text);
      flash(copy, "Copied");
    } catch {
      window.prompt("The values:", text);
    }
  });
  const fold = button("–", () => {
    panel.classList.toggle("closed");
    fold.textContent = panel.classList.contains("closed") ? "+" : "–";
  });
  header.append(title, copy, fold);
  // Drag it by its header out of the way; where it's left is kept.
  const PLACE = "dm.retroPanelAt";
  const place = (x: number, y: number) => {
    const left = Math.max(0, Math.min(window.innerWidth - 60, x));
    const top = Math.max(0, Math.min(window.innerHeight - 30, y));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    return { left, top };
  };
  try {
    const at = JSON.parse(localStorage.getItem(PLACE) ?? "null") as { left: number; top: number } | null;
    if (at) place(at.left, at.top);
  } catch {
    // Stays in the corner.
  }
  header.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    header.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => place(m.clientX - dx, m.clientY - dy);
    const up = (u: PointerEvent) => {
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(PLACE, JSON.stringify(place(u.clientX - dx, u.clientY - dy)));
      } catch {
        // Not kept.
      }
    };
    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", up);
  });
  const body = document.createElement("div");
  body.className = "body";
  panel.append(header, body);
  document.body.appendChild(panel);

  // The colours in use, redrawn as the palette size slides (the rest of the panel stays, so the drag isn't lost).
  const swatches = document.createElement("div");
  const fillSwatches = () => {
    swatches.replaceChildren();
    for (const hex of paletteSubset(RETRO_PALETTE, retroTuning.paletteSize)) {
      const s = document.createElement("span");
      s.style.background = `#${hex}`;
      s.title = `#${hex}`;
      swatches.append(s);
    }
  };

  const render = () => {
    body.replaceChildren();
    for (const section of SECTIONS) {
      const shown = section.controls.filter((c) => !c.when || c.when(retroTuning));
      const h = document.createElement("h4");
      h.textContent = section.title;
      body.append(h);
      for (const c of shown) body.append(...row(c));
      if (section.title === "Colour" && retroTuning.colours === "palette") {
        swatches.className = "swatches";
        fillSwatches();
        body.append(swatches);
      }
    }
    const presets = document.createElement("div");
    presets.className = "presets";
    presets.append(
      document.createTextNode("Reset to "),
      button("SNES", () => change({ ...RETRO_PRESETS.snes })),
      button("PS1", () => change({ ...RETRO_PRESETS.ps1 })),
    );
    body.append(presets);
  };

  const change = (c: Partial<RetroTuning>) => {
    // Rebuild only when what's shown changes (a mode, the outlines, a preset), never mid-drag.
    const keys = Object.keys(c);
    const relayout = keys.length > 1 || keys[0] === "colours" || keys[0] === "outlines";
    setRetroTuning(style, c);
    if (relayout) render();
    else if (keys[0] === "paletteSize") fillSwatches();
  };

  function row(c: Control): HTMLElement[] {
    const r = document.createElement("label");
    r.className = "row";
    const name = document.createElement("span");
    name.textContent = c.label;
    r.append(name);
    const out: HTMLElement[] = [r];
    if (c.kind === "range") {
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(c.min);
      input.max = String(c.max);
      input.step = String(c.step);
      input.value = String(retroTuning[c.key]);
      const value = document.createElement("output");
      value.textContent = fmt(retroTuning[c.key] as number, c.step);
      input.addEventListener("input", () => {
        value.textContent = fmt(Number(input.value), c.step);
        change({ [c.key]: Number(input.value) });
      });
      r.append(input, value);
      if (c.note) {
        const n = document.createElement("div");
        n.className = "note";
        n.textContent = c.note;
        out.push(n);
      }
    } else if (c.kind === "select") {
      const sel = document.createElement("select");
      for (const o of c.options) sel.append(new Option(o, o, false, retroTuning[c.key] === o));
      sel.addEventListener("change", () => change({ [c.key]: sel.value }));
      r.append(sel);
    } else {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !!retroTuning[c.key];
      box.addEventListener("change", () => change({ [c.key]: box.checked }));
      r.append(box);
    }
    return out;
  }

  render();
  return () => {
    panel.remove();
    sheet.remove();
  };
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function flash(b: HTMLButtonElement, text: string): void {
  const was = b.textContent;
  b.textContent = text;
  setTimeout(() => (b.textContent = was), 1200);
}

function fmt(v: number, step: number): string {
  const places = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return v.toFixed(places);
}

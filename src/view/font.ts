// The UI's typeface: Space Grotesk, geometric and a little retro-future but
// warm, for the cozy sci-fi look. Loaded from Google Fonts (index.html); the
// system's own sans stands in until it arrives, or if it can't.

export const UI_FONT_NAME = "Space Grotesk";
export const UI_FONT = `"${UI_FONT_NAME}", system-ui, sans-serif`;

/** Wait for the typeface (a moment at most), so labels drawn onto canvases don't bake in the stand-in. */
export async function fontReady(timeoutMs = 1500): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const load = Promise.all(["400", "600", "700", "800"].map((w) => document.fonts.load(`${w} 16px "${UI_FONT_NAME}"`))).then(() => undefined);
  await Promise.race([load.catch(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

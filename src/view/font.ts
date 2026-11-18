// The UI's typeface: Space Grotesk, geometric and a little retro-future but
// warm, for the cozy sci-fi look. Loaded from Google Fonts (index.html); the
// system's own sans stands in until it arrives, or if it can't.

export const UI_FONT_NAME = "Space Grotesk";
export const UI_FONT = `"${UI_FONT_NAME}", system-ui, sans-serif`;
/** Room labels in the 3D view are set in the display face, as the UI's headings and buttons are (--font-display). */
export const LABEL_FONT_NAME = "Chakra Petch";
export const LABEL_FONT = `"${LABEL_FONT_NAME}", ${UI_FONT}`;

/** Wait for the typeface (a moment at most), so labels drawn onto canvases don't bake in the stand-in. */
export async function fontReady(timeoutMs = 1500): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const faces = [...["400", "600", "700", "800"].map((w) => `${w} 16px "${UI_FONT_NAME}"`), `600 16px "${LABEL_FONT_NAME}"`];
  const load = Promise.all(faces.map((f) => document.fonts.load(f))).then(() => undefined);
  await Promise.race([load.catch(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

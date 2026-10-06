import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { fontReady } from "../view/font";

const root = createRoot(document.getElementById("root")!);

// Phones and tablets: the views take pinches themselves, so the page never zooms.
// iOS Safari ignores the viewport's user-scalable=no and sends its own gesture events.
for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, (e) => e.preventDefault());

// The typeface first (a moment at most), so labels drawn onto canvases use it.
await fontReady();

// Dev builds only: ?furnish opens the furnishing tool instead of the game (it isn't bundled into a release).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("furnish")) {
  void import("../devtools/FurnishTool").then(({ FurnishTool }) => root.render(<FurnishTool />));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

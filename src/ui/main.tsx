import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { fontReady } from "../view/font";
import { bootStep, finish as finishBoot } from "./boot";
import reliefUrl from "../../data/mars-relief.jpg?url";

// The map of Mars, fetched and decoded now so the Map opens at once (the loading screen waits for it).
const relief = new Image();
relief.src = reliefUrl;
relief.decode().then(
  () => bootStep("map"),
  () => bootStep("map"),
);

const root = createRoot(document.getElementById("root")!);

// Phones and tablets: the views take pinches themselves, so the page never zooms.
// iOS Safari ignores the viewport's user-scalable=no and sends its own gesture events.
for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, (e) => e.preventDefault());

// The typeface first (a moment at most), so labels drawn onto canvases use it.
await fontReady();
bootStep("font");

// Dev builds only: ?furnish opens the furnishing tool instead of the game (it isn't bundled into a release).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("furnish")) {
  finishBoot();
  void import("../devtools/FurnishTool").then(({ FurnishTool }) => root.render(<FurnishTool />));
} else if (new URLSearchParams(location.search).has("faces")) {
  // ?faces: a page of notables' headshots, in PR previews too, so the look can be reviewed there.
  finishBoot();
  void import("../devtools/Faces").then(({ Faces }) => root.render(<Faces />));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

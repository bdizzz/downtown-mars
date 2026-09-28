import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = createRoot(document.getElementById("root")!);

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

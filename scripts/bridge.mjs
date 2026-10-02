// Runs the Godot bridge (src/bridge/main.ts): bundles it for Node with Vite, then starts it.
// npm run bridge -- [--port=7878] [--load=save.json] [--showcase=12] [--speed=1] [--verbose]
import { build } from "vite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const outDir = resolve(root, "godot/.bridge");
await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: { ssr: "src/bridge/main.ts", outDir, emptyOutDir: true, target: "node22", minify: false },
});
await import(pathToFileURL(resolve(outDir, "main.js")).href);

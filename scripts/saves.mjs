// Rebuilds the dev saves in public/ (T-013): bundles scripts/saves.ts for Node
// with Vite, then runs it. It plays the scripted network bot (tests/netbot.ts)
// on the default seed and writes current-version saves at a few moments.
// npm run saves
import { build } from "vite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const outDir = resolve(tmpdir(), "downtown-mars-saves");
await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: { ssr: "scripts/saves.ts", outDir, emptyOutDir: true, target: "node22", minify: false },
});
// The bundle runs from a temp folder: it writes to public/ under the repo, wherever this was run from.
process.chdir(root);
await import(pathToFileURL(resolve(outDir, "saves.js")).href);

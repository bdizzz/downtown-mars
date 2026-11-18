// The benchmark behind docs/PLAN-PEOPLE.md (#522): bundles scripts/bench-people.ts
// for Node with Vite, as saves.mjs does, then runs it. Throwaway; not part of the game.
// node scripts/bench-people.mjs
import { build } from "vite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const outDir = resolve(tmpdir(), "downtown-mars-bench-people");
await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: { ssr: "scripts/bench-people.ts", outDir, emptyOutDir: true, target: "node22", minify: false },
});
process.chdir(root);
await import(pathToFileURL(resolve(outDir, "bench-people.js")).href);

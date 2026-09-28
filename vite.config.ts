import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** Short commit hash for the version stamp, or "dev" outside git. */
function commit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  // Relative paths, so the build runs from any folder (itch.io serves games from a sub-path).
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version} · ${commit()}`),
  },
  build: {
    // Pixi alone is ~535 kB (~155 kB gzipped); it and Three.js each get their own chunk.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Pixi is most of the download and changes rarely: give it its own chunk.
        codeSplitting: {
          groups: [
            { name: (id: string) => (id.includes("node_modules/pixi.js") || id.includes("node_modules/@pixi") ? "pixi" : null) },
            { name: (id: string) => (id.includes("node_modules/three") ? "three" : null) },
          ],
        },
      },
    },
  },
  // Unit tests build instantly (the sandbox switch); construction tests and playthroughs turn it off themselves.
  test: { include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"] },
});

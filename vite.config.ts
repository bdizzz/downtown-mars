import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
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

/**
 * The git branch this dev server is serving (dev server only): GET
 * /__dev/branch returns its name, read fresh each time so it follows a
 * checkout that switches branches; "" outside git, a short hash when detached.
 */
function gitBranch(): Plugin {
  return {
    name: "dev-git-branch",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/branch", (_req, res) => {
        let name = "";
        try {
          name = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
          if (name === "HEAD") name = commit();
        } catch {
          // Not a git checkout: no branch to show.
        }
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Cache-Control", "no-store");
        res.end(name);
      });
    },
  };
}

/**
 * The furnishing tool's save (dev server only): POST the templates to
 * /__dev/layouts and they're written to data/layouts.json, one placement per
 * line, keeping the file's note. Only well-formed templates are accepted.
 */
function saveLayouts(): Plugin {
  const file = new URL("./data/layouts.json", import.meta.url);
  const walls = new Set(["back", "front", "left", "right", "center"]);
  return {
    name: "dev-save-layouts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/layouts", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk: Buffer) => (body += chunk.toString()));
        req.on("end", () => {
          try {
            const templates = JSON.parse(body) as Record<string, Record<string, unknown>[]>;
            const items = (JSON.parse(readFileSync(new URL("./data/furniture.json", import.meta.url), "utf8")) as { items: Record<string, unknown> }).items;
            for (const [key, list] of Object.entries(templates)) {
              if (!/^[a-z_]+:\d+x\d+(:(top|bottom|middle))?$/.test(key) || !Array.isArray(list)) throw new Error(`bad template "${key}"`);
              for (const p of list) if (!(String(p.item) in items) || !walls.has(String(p.wall))) throw new Error(`bad placement in "${key}": ${JSON.stringify(p)}`);
            }
            const note = (JSON.parse(readFileSync(file, "utf8")) as { _note?: string })._note ?? "";
            const keys = Object.keys(templates).sort();
            const lines = ["{", `  "_note": ${JSON.stringify(note)},`, '  "templates": {'];
            keys.forEach((key, i) => {
              const list = templates[key]!;
              lines.push(`    ${JSON.stringify(key)}: [`);
              list.forEach((p, j) => lines.push(`      ${JSON.stringify(p)}${j < list.length - 1 ? "," : ""}`));
              lines.push(`    ]${i < keys.length - 1 ? "," : ""}`);
            });
            lines.push("  }", "}");
            writeFileSync(file, lines.join("\n") + "\n");
            res.end("saved");
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e instanceof Error ? e.message : e));
          }
        });
      });
    },
  };
}

/**
 * The Godot experiment's scene export (dev server only): POST a file to
 * /__dev/godot?name=<file> and it's written to godot/scenes/<file>.
 * See docs/PLAN-GODOT.md and dm.exportGodot().
 */
function saveGodotScene(): Plugin {
  return {
    name: "dev-save-godot-scene",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/godot", (req, res) => {
        const name = new URL(req.url ?? "", "http://x").searchParams.get("name") ?? "";
        if (req.method !== "POST" || !/^[a-z0-9_-]+\.(glb|json)$/.test(name)) {
          res.statusCode = 400;
          res.end("POST with ?name=<a-z0-9_->.glb or .json");
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const dir = new URL("./godot/scenes/", import.meta.url);
          mkdirSync(dir, { recursive: true });
          writeFileSync(new URL(name, dir), Buffer.concat(chunks));
          res.end(`saved godot/scenes/${name}`);
        });
      });
    },
  };
}

export default defineConfig({
  // Relative paths, so the build runs from any folder (itch.io serves games from a sub-path).
  base: "./",
  plugins: [react(), saveLayouts(), saveGodotScene(), gitBranch()],
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

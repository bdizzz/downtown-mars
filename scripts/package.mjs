// Zip the production build for a playtest upload (itch.io: "HTML" project,
// "This file will be played in the browser"). Run via `npm run package`,
// which builds first. Uses the system `zip` tool (macOS and Linux have it).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!existsSync("dist/index.html")) {
  console.error("No build found in dist/. Run `npm run build` first.");
  process.exit(1);
}
mkdirSync("release", { recursive: true });
const out = `release/downtown-mars-v${version}.zip`;
rmSync(out, { force: true });
try {
  // index.html must sit at the top of the zip, so zip from inside dist/.
  execFileSync("zip", ["-r", "-q", `../${out}`, "."], { cwd: "dist", stdio: "inherit" });
} catch {
  console.error("Couldn't run `zip`. Install it, or zip the contents of dist/ by hand.");
  process.exit(1);
}
console.log(`Packaged ${out}`);

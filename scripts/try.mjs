// Try a branch in the browser or the Godot viewer: works out which checkout to
// run and a free port, and prints the exact command for each. /try runs them in
// the Terminal panel, a tab each.
//
//   node scripts/try.mjs [target] [web|godot|both] [--checkout] [--json]
//
// target:
//   T-003, t-003, t3, 3 the worktree on that ticket's t-003-… branch
//   <branch>            the worktree with that branch checked out (main: the main checkout)
//   (nothing)           this worktree, if run from one; else the only other worktree
// web|godot|both        what to start (web if left out)
// --checkout            no worktree for it yet: make one in .claude/worktrees/ from origin
//                       (a PR built on another machine, say)
// --json                print { dir, branch, web?, godot? } for the skill, where
//                       web is { port, url, command, running } and
//                       godot is { port, saves, command, stop, running }
//
// Web ports start at 5174: 5173 is Bryon's own game (and its saves). Each port is
// its own origin, so each branch gets its own saves too. If a dev server is
// already serving that checkout, it's reused (command is null).
//
// Godot: the viewer starts its own bridge, on a port from 7980 (Bryon's is 17878),
// saving to a scratch folder per branch rather than ~/.downtown-mars/saves, with
// its log beside it. The command builds the C#, imports the project the first time,
// runs the viewer and stops its bridge when the viewer closes.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const FIRST_PORT = 5174;
const LAST_PORT = 5199;
const FIRST_BRIDGE_PORT = 7980;
const LAST_BRIDGE_PORT = 7999;
const ENGINES = ["web", "godot", "both"];

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const quiet = (cmd) => {
  try {
    return sh(cmd);
  } catch {
    return "";
  }
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Every worktree of this repo: { dir, branch }; the main checkout first. */
function worktrees() {
  const out = [];
  let cur = null;
  for (const line of sh("git worktree list --porcelain").split("\n")) {
    if (line.startsWith("worktree ")) out.push((cur = { dir: line.slice(9), branch: null }));
    else if (line.startsWith("branch ") && cur) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
  }
  return out;
}

/** A ticket id (T-003, t-3, 3) as its branch prefix (t-003-), or null. */
function ticketPrefix(arg) {
  const m = /^(?:t-?)?0*(\d+)$/i.exec(arg);
  return m ? `t-${m[1].padStart(3, "0")}-` : null;
}

/** The pids listening on each local TCP port, from lsof. */
function listeners() {
  const ports = new Map();
  let pid = null;
  for (const line of quiet("lsof -nP -iTCP -sTCP:LISTEN -Fpn").split("\n")) {
    if (line.startsWith("p")) pid = line.slice(1);
    else if (line.startsWith("n") && pid) {
      const port = Number(line.slice(line.lastIndexOf(":") + 1));
      if (!ports.has(port)) ports.set(port, new Set());
      ports.get(port).add(pid);
    }
  }
  return ports;
}

const cwdOf = (pid) => (quiet(`lsof -a -p ${pid} -d cwd -Fn`).split("\n").find((l) => l.startsWith("n")) ?? "").slice(1);

/** Whether nothing is listening on a port, on IPv4 or IPv6 localhost. */
async function free(port) {
  for (const host of ["127.0.0.1", "::1"]) {
    const ok = await new Promise((done) => {
      const s = createServer();
      s.once("error", (e) => done(e.code === "EADDRNOTAVAIL" || e.code === "EAFNOSUPPORT"));
      s.listen(port, host, () => s.close(() => done(true)));
    });
    if (!ok) return false;
  }
  return true;
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const checkout = args.includes("--checkout");
const engine = args.find((a) => ENGINES.includes(a.toLowerCase()))?.toLowerCase() ?? "web";
const target = args.find((a) => !a.startsWith("--") && !ENGINES.includes(a.toLowerCase()));
const wantWeb = engine !== "godot";
const wantGodot = engine !== "web";

const all = worktrees();
const main = all[0];
const here = resolve(quiet("git rev-parse --show-toplevel") || process.cwd());

let tree;
let wanted = target ?? null;
if (target) {
  const prefix = ticketPrefix(target);
  const matches = all.filter((w) => w.branch && (prefix ? w.branch.startsWith(prefix) : w.branch === target));
  if (matches.length > 1) fail(`More than one worktree for ${target}: ${matches.map((w) => w.branch).join(", ")}`);
  tree = matches[0];
  if (!tree && prefix) {
    // No worktree: is the ticket's branch on GitHub?
    const remote = quiet(`git ls-remote --heads origin "refs/heads/${prefix}*"`)
      .split("\n")
      .map((l) => l.split("refs/heads/")[1])
      .filter(Boolean);
    if (remote.length > 1) fail(`More than one branch for ${target} on origin: ${remote.join(", ")}`);
    if (!remote.length) fail(`No worktree or pushed branch for ${target}. Is it built yet? (node scripts/board.mjs show ${target})`);
    wanted = remote[0];
  }
} else if (here !== resolve(main.dir) && all.some((w) => resolve(w.dir) === here)) {
  tree = all.find((w) => resolve(w.dir) === here);
} else {
  const others = all.slice(1);
  if (others.length === 1) tree = others[0];
  else fail(others.length ? `Which one? ${others.map((w) => w.branch ?? w.dir).join(", ")}` : "No worktrees to try. Name a branch or ticket, or use main.");
}

let install = false;
if (!tree) {
  if (!checkout) fail(`${wanted} has no worktree here. Rerun with --checkout to make one from origin/${wanted}.`);
  const dir = join(main.dir, ".claude", "worktrees", wanted);
  sh(`git fetch --quiet origin "${wanted}"`);
  const local = quiet(`git rev-parse --verify --quiet "refs/heads/${wanted}"`);
  sh(local ? `git worktree add "${dir}" "${wanted}"` : `git worktree add --track -b "${wanted}" "${dir}" "origin/${wanted}"`);
  tree = { dir, branch: wanted };
}
install = !existsSync(join(tree.dir, "node_modules"));

const listening = listeners();
const arg = (s) => (/^[\w./-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`);
const dirArg = arg(tree.dir);

/** The port in a range something started from this checkout is listening on, if any. */
function servedFrom(first, last) {
  for (let port = first; port <= last; port++) {
    for (const pid of listening.get(port) ?? []) if (resolve(cwdOf(pid)) === resolve(tree.dir)) return port;
  }
  return null;
}

async function freePort(first, last) {
  for (let p = first; p <= last; p++) if (!listening.has(p) && (await free(p))) return p;
  fail(`No free port between ${first} and ${last}.`);
}

const result = { dir: tree.dir, branch: tree.branch };

// The web game: already being served? Reuse it.
if (wantWeb) {
  const running = servedFrom(5173, LAST_PORT);
  const port = running ?? (await freePort(FIRST_PORT, LAST_PORT));
  const command = running ? null : `cd ${dirArg} && ${install ? "npm install && " : ""}npm run dev -- --port ${port} --strictPort`;
  result.web = { port, url: `http://localhost:${port}/`, command, running: !!running };
}

// The Godot viewer: its bridge listening from this checkout means it's open already.
// With both, the web tab installs packages, so it goes first.
if (wantGodot) {
  const running = servedFrom(FIRST_BRIDGE_PORT, LAST_BRIDGE_PORT);
  const port = running ?? (await freePort(FIRST_BRIDGE_PORT, LAST_BRIDGE_PORT));
  const saves = join(tmpdir(), "downtown-mars-try", (tree.branch ?? "detached").replace(/[^\w.-]+/g, "-"), "saves");
  const stop = `pkill -f "bridge.mjs --port=${port}"`;
  const steps = [
    `cd ${dirArg}`,
    ...(install && !wantWeb ? ["npm install"] : []),
    "cd godot",
    "dotnet build -nologo -v q",
    "{ [ -d .godot ] || godot-mono --headless --path . --import; }",
    `mkdir -p ${arg(saves)}`,
    `DM_SAVES=${arg(saves)} godot-mono --path . -- --port=${port}`,
  ];
  const command = running ? null : `${steps.join(" && ")}; ${stop}`;
  result.godot = { port, saves, command, stop, running: !!running };
}

if (json) console.log(JSON.stringify(result, null, 2));
else {
  const { web, godot } = result;
  if (web) console.log(web.running ? `${tree.branch} is already being served at ${web.url}` : `${web.command}\n\nThen open ${web.url} (${tree.branch}).`);
  if (web && godot) console.log("");
  if (godot)
    console.log(
      godot.running
        ? `${tree.branch}'s Godot viewer is already open (bridge on ${godot.port}). Stop it: ${godot.stop}`
        : `${godot.command}\n\nThe viewer opens with its bridge on ${godot.port}, saving to ${godot.saves}. Closing it stops the bridge.`,
    );
}

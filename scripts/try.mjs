// Try a branch in the browser: works out which checkout to serve and a free
// port, and prints the exact dev-server command for it. /try runs that
// command in the Terminal panel.
//
//   node scripts/try.mjs [target] [--checkout] [--json]
//
// target:
//   T-003, t-003, 3     the worktree on that ticket's t-003-… branch
//   <branch>            the worktree with that branch checked out (main: the main checkout)
//   (nothing)           this worktree, if run from one; else the only other worktree
// --checkout            no worktree for it yet: make one in .claude/worktrees/ from origin
//                       (a PR built on another machine, say)
// --json                print { dir, branch, port, url, command, running } for the skill
//
// Ports start at 5174: 5173 is Bryon's own game (and its saves). Each port is
// its own origin, so each branch gets its own saves too. If a dev server is
// already serving that checkout, it's reused (command is null).

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

const FIRST_PORT = 5174;
const LAST_PORT = 5199;

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
const target = args.find((a) => !a.startsWith("--"));

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

// Already being served? Reuse it.
const listening = listeners();
let running = null;
for (let port = 5173; port <= LAST_PORT && !running; port++) {
  for (const pid of listening.get(port) ?? []) if (resolve(cwdOf(pid)) === resolve(tree.dir)) running = port;
}

let port = running;
if (!port) {
  for (let p = FIRST_PORT; p <= LAST_PORT && !port; p++) if (!listening.has(p) && (await free(p))) port = p;
  if (!port) fail(`No free port between ${FIRST_PORT} and ${LAST_PORT}.`);
}

const url = `http://localhost:${port}/`;
const dirArg = /^[\w./-]+$/.test(tree.dir) ? tree.dir : `'${tree.dir.replace(/'/g, "'\\''")}'`;
const command = running ? null : `cd ${dirArg} && ${install ? "npm install && " : ""}npm run dev -- --port ${port} --strictPort`;
const result = { dir: tree.dir, branch: tree.branch, port, url, command, running: !!running };

if (json) console.log(JSON.stringify(result, null, 2));
else if (running) console.log(`${tree.branch} is already being served at ${url}`);
else console.log(`${command}\n\nThen open ${url} (${tree.branch}).`);

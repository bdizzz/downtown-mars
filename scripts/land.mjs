// Land a branch after its PR: merge it (if asked and CI is green), stop its
// dev servers, remove its worktree, delete its local and remote branches, and
// bring the main checkout up to date. /land runs this.
//
//   node scripts/land.mjs [target ...] [--merge] [--force] [--dry-run] [--json]
//
// target:
//   T-017, t17, 17, F-001, f1  the ticket's (or feature's) t-017-… / f-001-… branch
//   #10                         that PR's branch
//   <branch>                    that branch (a feature's own feature/f-0NN-… branch is
//                               only ever landed by name or PR, and merges with a
//                               merge commit so its tasks' commits are kept)
//   (nothing)                   sweep: everything whose PR is merged, plus leftover
//                               branches and clean worktrees already in origin/main
// --merge    a named target whose PR is still open: squash-merge it if CI passed
// --force    remove a worktree even if it has uncommitted changes, and drop a
//            named branch whose PR was closed without merging
// --dry-run  say what would happen, change nothing
// --json     print { landed, skipped, open, notes } for the skill
//
// It never touches main, pr-assets or a worktree a live Claude session holds,
// and never loses uncommitted work without --force. Dev servers are found the
// same way /try finds them: a listening process whose working directory is
// inside the worktree.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const KEEP = new Set(["main", "HEAD", "pr-assets"]);

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const quiet = (cmd) => {
  try {
    return sh(cmd);
  } catch {
    return "";
  }
};
const ok = (cmd) => {
  try {
    sh(cmd);
    return true;
  } catch {
    return false;
  }
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const merge = args.includes("--merge");
const force = args.includes("--force");
const dry = args.includes("--dry-run");
const targets = args.filter((a) => !a.startsWith("--"));

const here = resolve(quiet("git rev-parse --show-toplevel") || process.cwd());
const commonDir = resolve(sh("git rev-parse --git-common-dir"));
process.chdir(resolve(commonDir, "..")); // run from the main checkout, wherever we were called

// Even in a dry run: it only refreshes what we know of origin, and GitHub
// deletes merged branches itself.
quiet("git fetch --quiet --prune origin");

/** Every worktree but the main checkout: { dir, branch, head, locked }. */
function worktrees() {
  const out = [];
  let cur = null;
  for (const line of sh("git worktree list --porcelain").split("\n")) {
    if (line.startsWith("worktree ")) out.push((cur = { dir: line.slice(9), branch: null, head: null, locked: null }));
    else if (!cur) continue;
    else if (line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
    else if (line.startsWith("locked")) cur.locked = line.slice(7) || "locked";
  }
  return out.slice(1);
}

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

/** The pid of the session holding a locked worktree, if that session still runs. */
function liveLock(w) {
  if (!w.locked) return null;
  const m = /pid (\d+)/.exec(w.locked);
  if (!m) return "unknown"; // locked by hand: leave it
  return pidAlive(Number(m[1])) ? Number(m[1]) : null;
}

const inside = (path, dir) => resolve(path) === resolve(dir) || resolve(path).startsWith(resolve(dir) + sep);

/** Listening processes whose working directory is inside dir: [{ pid, port }]. */
function servers(dir) {
  const found = new Map();
  let pid = null;
  for (const line of quiet("lsof -nP -iTCP -sTCP:LISTEN -Fpn").split("\n")) {
    if (line.startsWith("p")) pid = line.slice(1);
    else if (line.startsWith("n") && pid && !found.has(pid)) {
      const cwd = (quiet(`lsof -a -p ${pid} -d cwd -Fn`).split("\n").find((l) => l.startsWith("n")) ?? "").slice(1);
      if (cwd && inside(cwd, dir)) found.set(pid, Number(line.slice(line.lastIndexOf(":") + 1)));
    }
  }
  return [...found].map(([pid, port]) => ({ pid: Number(pid), port }));
}

/** Stop a server and the job it belongs to (npm run dev → sh → vite), not the shell around it. */
function stop(pid) {
  const pgid = Number(quiet(`ps -o pgid= -p ${pid}`));
  const leader = pgid ? quiet(`ps -o comm= -p ${pgid}`) : "";
  try {
    if (pgid && !SHELLS.test(leader)) process.kill(-pgid, "SIGTERM");
    else process.kill(pid, "SIGTERM");
  } catch {}
}

const SHELLS = /(^|\/)-?(zsh|bash|sh|fish|login)$/;

/** Other processes still working inside dir (a Claude session, a test watcher), shells aside. */
function busy(dir) {
  const out = [];
  let pid = null;
  let cmd = "";
  for (const line of quiet("lsof -d cwd -Fpcn").split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("c")) cmd = line.slice(1);
    else if (line.startsWith("n") && pid && pid !== process.pid && inside(line.slice(1), dir) && !SHELLS.test(cmd)) out.push(`${cmd} ${pid}`);
  }
  return out;
}

const dirty = (dir) => quiet(`git -C "${dir}" status --porcelain`).split("\n").filter(Boolean);
const inMain = (ref) => ok(`git merge-base --is-ancestor "${ref}" origin/main`);

// --- What exists -----------------------------------------------------------

const trees = worktrees();
const local = quiet("git for-each-ref --format='%(refname:short)' refs/heads").split("\n").filter(Boolean);
const remote = quiet("git for-each-ref --format='%(refname:lstrip=3)' refs/remotes/origin").split("\n").filter(Boolean);
const prs = JSON.parse(
  quiet("gh pr list --state all --limit 200 --json number,headRefName,state,title,url") || "[]",
);
const prFor = (branch) => {
  const mine = prs.filter((p) => p.headRefName === branch);
  return mine.find((p) => p.state === "OPEN") ?? mine.find((p) => p.state === "MERGED") ?? mine[0] ?? null;
};

/** One item per branch (or per detached worktree). */
const items = new Map();
const item = (name) => {
  if (!items.has(name)) items.set(name, { name, tree: null, local: false, remote: false, pr: null, sibling: null });
  return items.get(name);
};
for (const w of trees) item(w.branch ?? `(detached) ${w.dir.split(sep).pop()}`).tree = w;
for (const b of local) if (!KEEP.has(b)) item(b).local = true;
for (const b of remote) if (!KEEP.has(b)) item(b).remote = true;
for (const it of items.values()) {
  it.pr = it.tree && !it.tree.branch ? null : prFor(it.name);
  // EnterWorktree makes worktree-<name> before /build switches to the ticket branch.
  const sib = `worktree-${it.tree?.dir.split(sep).pop()}`;
  if (it.tree && sib !== it.name && local.includes(sib)) it.sibling = sib;
}

// --- Which ones to land -----------------------------------------------------

function resolveTarget(t) {
  if (/^#\d+$/.test(t)) {
    const pr = prs.find((p) => p.number === Number(t.slice(1)));
    if (!pr) fail(`No PR ${t}.`);
    return [pr.headRefName];
  }
  const m = /^([tf])?-?0*(\d+)$/i.exec(t);
  if (m) {
    const prefix = `${(m[1] ?? "t").toLowerCase()}-${m[2].padStart(3, "0")}-`;
    const names = [...items.keys()].filter((n) => n.startsWith(prefix));
    if (!names.length) fail(`Nothing to land for ${t}: no ${prefix}… branch, worktree or PR.`);
    return names;
  }
  if (items.has(t)) return [t];
  fail(`No branch, worktree or PR called ${t}.`);
}

const named = new Set(targets.flatMap(resolveTarget));
const landed = [];
const skipped = [];
const open = [];
const notes = [];

function ciState(n) {
  // GitHub works out mergeability lazily: UNKNOWN at first, so ask again.
  let v = {};
  for (let i = 0; i < 4; i++) {
    v = JSON.parse(quiet(`gh pr view ${n} --json isDraft,mergeStateStatus,statusCheckRollup`) || "{}");
    if (v.mergeStateStatus && v.mergeStateStatus !== "UNKNOWN") break;
    execSync("sleep 2");
  }
  const checks = v.statusCheckRollup ?? [];
  const bad = checks.some((c) => ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"].includes(c.conclusion ?? c.state));
  const pending = checks.some((c) => (c.status && c.status !== "COMPLETED") || c.state === "PENDING");
  const ci = bad ? "failing" : pending ? "pending" : checks.length ? "passing" : "none";
  return { ci, draft: !!v.isDraft, mergeState: v.mergeStateStatus ?? "UNKNOWN" };
}

const gone = new Set(); // branches already deleted as another item's worktree-… sibling

for (const it of items.values()) {
  if (gone.has(it.name) && !it.remote) continue;
  const isNamed = named.has(it.name);
  if (named.size && !isNamed) continue;
  // A feature's own branch is only landed by name: a fresh one (nothing built
  // on it yet) is already "in main", and a sweep mustn't take it for a leftover.
  if (it.name.startsWith("feature/") && !isNamed) continue;
  if (it.name.startsWith("feature/") && !it.pr && !force) {
    skipped.push({ branch: it.name, why: "a feature's branch lands through its PR into main; open one first (--force drops the branch instead)" });
    continue;
  }
  const pr = it.pr;
  const tag = pr ? `PR #${pr.number}` : "no PR";

  if (pr?.state === "OPEN") {
    const s = ciState(pr.number);
    const row = { branch: it.name, pr: pr.number, title: pr.title, url: pr.url, ...s };
    if (!isNamed || !merge) {
      open.push(row);
      continue;
    }
    if (s.draft || s.ci === "failing" || s.ci === "pending" || !["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(s.mergeState)) {
      skipped.push({ branch: it.name, why: `PR #${pr.number} isn't ready to merge (CI ${s.ci}, ${s.draft ? "draft, " : ""}${s.mergeState.toLowerCase()})` });
      continue;
    }
    // A feature's own branch keeps its tasks' commits: a merge commit, not a squash.
    if (!dry) sh(`gh pr merge ${pr.number} ${it.name.startsWith("feature/") ? "--merge" : "--squash"}`);
    it.merged = true;
  } else if (pr?.state === "CLOSED") {
    if (!isNamed || !force) {
      skipped.push({ branch: it.name, why: `PR #${pr.number} was closed without merging; /land it with --force to drop the branch` });
      continue;
    }
  } else if (!pr) {
    // No PR: only leftovers already in main (EnterWorktree's worktree-… branches,
    // a worktree that never got a commit), unless named with --force.
    const ref = it.tree?.head ?? (it.local ? it.name : `origin/${it.name}`);
    if (!inMain(ref) && !(isNamed && force)) {
      if (isNamed) skipped.push({ branch: it.name, why: "no PR and not in main yet (still in flight?); --force drops it anyway" });
      continue;
    }
  }

  // Land it.
  const done = { branch: it.name, pr: pr?.number ?? null, merged: !!it.merged, stopped: [], worktree: null, branches: [] };
  const w = it.tree;
  if (w) {
    const running = servers(w.dir);
    for (const s of running) {
      if (!dry) stop(s.pid);
      done.stopped.push(s.port);
    }
    if (running.length && !dry) execSync("sleep 1"); // let them exit before looking for anything else
    // In a dry run the servers are still up, so their npm and node don't count.
    const others = busy(w.dir).filter((p) => !(dry && running.length && /^(node|npm) /.test(p)));
    const lock = liveLock(w);
    const live = lock ? `a Claude session (pid ${lock})` : others.length ? others.join(", ") : null;
    const changes = dirty(w.dir);
    if (live) {
      // A sweep passing a session's fresh worktree (no PR yet) isn't news.
      if (pr || isNamed) skipped.push({ branch: it.name, why: `${live} still working in ${w.dir}; close or archive that session, then /land again` });
      landed.push(done);
      continue;
    }
    if (inside(here, w.dir)) {
      skipped.push({ branch: it.name, why: `this session is inside ${w.dir}; leave the worktree first` });
      landed.push(done);
      continue;
    }
    if (changes.length && !force) {
      skipped.push({ branch: it.name, why: `${w.dir} has uncommitted changes (${changes.slice(0, 3).join(", ")}${changes.length > 3 ? ", …" : ""}); --force discards them` });
      landed.push(done);
      continue;
    }
    if (!dry) {
      if (w.locked) quiet(`git worktree unlock "${w.dir}"`);
      sh(`git worktree remove ${changes.length ? "--force " : ""}"${w.dir}"`);
    }
    done.worktree = w.dir;
  }
  for (const b of [it.local ? it.name : null, it.sibling].filter((b) => b && !gone.has(b))) {
    if (b.startsWith("(detached)")) continue;
    if (!dry && !ok(`git branch -D "${b}"`)) notes.push(`couldn't delete local branch ${b}`);
    else {
      done.branches.push(b);
      gone.add(b);
    }
  }
  if (it.remote) {
    if (dry || ok(`git push --quiet origin --delete "${it.name}"`)) done.branches.push(`origin/${it.name}`);
    else if (quiet(`git ls-remote --heads origin "refs/heads/${it.name}"`)) notes.push(`couldn't delete origin/${it.name}`);
    else {
      // GitHub deleted it on merge (a merge we just made, say); forget our copy too.
      quiet(`git update-ref -d "refs/remotes/origin/${it.name}"`);
      done.branches.push(`origin/${it.name}`);
    }
  }
  landed.push(done);
}

// --- Tidy up ---------------------------------------------------------------

if (!dry) {
  quiet("git worktree prune");
  const hook = join(process.cwd(), ".claude", "hooks", "fresh-main.sh");
  if (existsSync(hook)) {
    const said = quiet(`CLAUDE_PROJECT_DIR="${process.cwd()}" sh "${hook}"`);
    if (said) notes.push(said);
  }
}

if (json) {
  console.log(JSON.stringify({ dryRun: dry, landed, skipped, open, notes }, null, 2));
} else {
  const would = dry ? " (dry run)" : "";
  if (!landed.length && !skipped.length && !open.length) console.log(`Nothing to land${would}.`);
  for (const d of landed) {
    const bits = [
      d.merged && "merged",
      d.stopped.length && `stopped server on ${d.stopped.map((p) => `:${p}`).join(", ")}`,
      d.worktree && "removed worktree",
      d.branches.length && `deleted ${d.branches.join(", ")}`,
    ].filter(Boolean);
    if (bits.length) console.log(`landed ${d.branch}${d.pr ? ` (#${d.pr})` : ""}: ${bits.join("; ")}${would}`);
  }
  for (const s of skipped) console.log(`skipped ${s.branch}: ${s.why}`);
  for (const o of open) console.log(`open    ${o.branch} (#${o.pr}): CI ${o.ci}, ${o.mergeState.toLowerCase()}${o.draft ? ", draft" : ""}`);
  for (const n of notes) console.log(n);
}

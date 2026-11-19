// Land a branch after its PR: merge it (if asked and CI is green, or turn on
// auto-merge while CI is still running), stop its dev servers, remove its
// worktree, delete its local and remote branches, and bring the main checkout
// up to date. /land runs this.
//
//   node scripts/land.mjs [target ...] [--merge] [--force] [--dry-run] [--json]
//
// target:
//   212, #212                   issue 212's 212-… branch (a bare number is also tried as T-0NN)
//   T-017, t17, 17, F-001, f1  an old id: its issue's branch (142-…, through docs/ticket-ids.json),
//                               or an older t-017-… / f-001-… one
//   #10                         that PR's branch, when 10 is a PR
//   <branch>                    that branch (a feature's own feature/f-0NN-… branch is
//                               only ever landed by name or PR, and merges with a
//                               merge commit so its tasks' commits are kept)
//   (nothing)                   sweep: everything whose PR is merged, plus leftover
//                               branches and clean worktrees already in origin/main
// --merge    a named target whose PR is still open: squash-merge it if CI passed,
//            or turn on GitHub's auto-merge if CI is still running (main's
//            ruleset makes CI pass first; GitHub merges it when it does)
// --force    remove a worktree even if it has uncommitted changes, and drop a
//            named branch whose PR was closed without merging
// --dry-run  say what would happen, change nothing
// --json     print { landed, skipped, open, notes } for the skill (landed lists
//            the issues it closed; open lists auto-merges it turned on)
//
// The board is GitHub issues (F-020). A PR into main closes its issue itself
// ("Closes #N"); GitHub only does that on the default branch, so a task merged
// into a feature's branch has its issue closed here, whether it merged now or
// earlier (by auto-merge, say). And once main has no docs/tickets/ any more, a
// branch that still edits ticket files (from before the move) has those edits
// dropped first: main is merged in keeping the deletion, and that's pushed, so
// its CI runs again before it lands.
//
// Versions (#431): each ticket's PR bumps package.json's version (patch, or
// minor for a feature's last task or a save-version bump). Parallel PRs all
// bump from the same number, and two identical bumps merge cleanly into one,
// so before merging, a PR whose base has moved to a new version since it
// branched is brought up to date: main merged in, and its bump made again on
// top of main's version (same kind: patch, minor or major), then pushed and
// auto-merged once CI passes again.
//
// Worktrees: the desktop app makes its own (`.claude/worktrees/<slug>-<6 hex>`),
// archives a session when its PR closes, and reuses the folder for later
// sessions, so those are left to it: their servers are stopped and their
// branches deleted, but the folder stays. Other worktrees (/try --checkout's,
// the CLI's EnterWorktree ones) are removed as before.
//
// It never touches main, pr-assets or a worktree a live Claude session is in
// (a git lock with a live pid, or a running `claude` process whose working
// directory is inside it), and never loses uncommitted work without --force.
// Dev servers are found the same way /try finds them: a listening process whose
// working directory is inside the worktree, Claude's own processes aside.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const KEEP = new Set(["main", "HEAD", "pr-assets"]);

// The PR list (with bodies) is a few hundred KB and grows; give it room.
const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }).trim();
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

/**
 * A Claude Code session's own process (it listens on a port of its own, for
 * the app and its tools). Never a dev server, and never to be stopped: the app
 * doesn't lock its worktrees, so this is how a live session there is seen.
 */
const CLAUDE = /(^|\/)claude$/i;

/** Listening processes whose working directory is inside dir, Claude's aside: [{ pid, port }]. */
function servers(dir) {
  const found = new Map();
  let pid = null;
  let cmd = "";
  for (const line of quiet("lsof -nP -iTCP -sTCP:LISTEN -Fpcn").split("\n")) {
    if (line.startsWith("p")) pid = line.slice(1);
    else if (line.startsWith("c")) cmd = line.slice(1);
    else if (line.startsWith("n") && pid && !found.has(pid) && !CLAUDE.test(cmd)) {
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

/** A Claude session still running inside dir: "a Claude session (pid N)", or null. */
function liveSession(w) {
  const lock = liveLock(w);
  if (lock) return `a Claude session (pid ${lock})`;
  const claude = busy(w.dir).find((p) => CLAUDE.test(p.split(" ")[0]));
  return claude ? `a Claude session (pid ${claude.split(" ").pop()})` : null;
}

/** Made by the desktop app for a session (`<slug>-<6 hex>`): the app removes or reuses it, not us. */
const appTree = (w) => /-[0-9a-f]{6}$/.test(w.dir.split(sep).pop());

// Untracked Godot .uid files don't count: the viewer writes them on its first
// import, in branches from before they were committed, and makes them again.
const dirty = (dir) =>
  quiet(`git -C "${dir}" status --porcelain`)
    .split("\n")
    .filter((l) => l && !/^\?\? godot\/.*\.uid$/.test(l));
const inMain = (ref) => ok(`git merge-base --is-ancestor "${ref}" origin/main`);

// --- What exists -----------------------------------------------------------

const trees = worktrees();
const local = quiet("git for-each-ref --format='%(refname:short)' refs/heads").split("\n").filter(Boolean);
const remote = quiet("git for-each-ref --format='%(refname:lstrip=3)' refs/remotes/origin").split("\n").filter(Boolean);
/**
 * Every PR. Without them nothing here can be judged (a merged branch would
 * look like one still in flight), so if GitHub can't be reached, after one
 * retry for a passing blip, stop rather than go on as if there were none.
 */
function pullRequests() {
  const cmd = "gh pr list --state all --limit 1000 --json number,headRefName,baseRefName,state,title,url,body";
  let why = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return JSON.parse(sh(cmd));
    } catch (e) {
      why = `${e.stderr ?? ""}`.trim().split("\n")[0] || e.message;
      if (attempt === 1) execSync("sleep 3");
    }
  }
  fail(`Can't reach GitHub to list the PRs (${why}). Nothing was changed; try /land again in a moment.`);
}
const prs = pullRequests();
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

/** Issue numbers by old id (T-017 → 142), from the move to issues. */
const IDS = JSON.parse(readFileSync(new URL("../docs/ticket-ids.json", import.meta.url), "utf8"));

function resolveTarget(t) {
  if (/^#\d+$/.test(t)) {
    const pr = prs.find((p) => p.number === Number(t.slice(1)));
    if (pr) return [pr.headRefName];
    // Not a PR: an issue, built on its 212-… branch.
    const names = [...items.keys()].filter((n) => n.startsWith(`${t.slice(1)}-`));
    if (!names.length) fail(`No PR ${t}, and no ${t.slice(1)}-… branch for an issue ${t}.`);
    return names;
  }
  const m = /^([tf])?-?0*(\d+)$/i.exec(t);
  if (m) {
    // Most likely first: a bare number is an issue, then an old ticket id.
    const old = `${(m[1] ?? "t").toUpperCase()}-${m[2].padStart(3, "0")}`;
    const prefixes = [...(m[1] ? [] : [`${m[2]}-`]), ...(IDS[old] ? [`${IDS[old]}-`] : []), `${old.toLowerCase()}-`];
    const keys = [...items.keys()];
    const names = prefixes.map((p) => keys.filter((n) => n.startsWith(p))).find((x) => x.length) ?? [];
    if (!names.length) fail(`Nothing to land for ${t}: no ${prefixes.join(" or ")}… branch, worktree or PR.`);
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

/**
 * Once its base has no docs/tickets/ (the board moved to issues), a branch that
 * still changes ticket files gets main merged in keeping the deletion, and any
 * ticket files it adds removed, in a throwaway worktree, then pushed. Returns
 * null if there was nothing to drop, else what happened.
 */
function dropTickets(branch, base) {
  if (ok(`git cat-file -e "origin/${base}:docs/tickets"`)) return null;
  const from = quiet(`git merge-base "origin/${base}" "origin/${branch}"`);
  if (!from || !quiet(`git diff --name-only "${from}" "origin/${branch}" -- docs/tickets`)) return null;
  if (dry) return { pushed: false, why: "would drop its docs/tickets/ changes (the board is on issues now) and push" };
  const dir = join(commonDir, "..", ".tracker", `land-${branch.replace(/[^\w.-]+/g, "-")}`);
  if (existsSync(dir)) quiet(`git worktree remove --force "${dir}"`);
  sh(`git worktree add --quiet --detach "${dir}" "origin/${branch}"`);
  try {
    const git = (c) => sh(`git -C "${dir}" ${c}`);
    if (!ok(`git -C "${dir}" merge --no-edit --quiet origin/${base}`)) {
      const conflicts = quiet(`git -C "${dir}" diff --name-only --diff-filter=U`).split("\n").filter(Boolean);
      const others = conflicts.filter((f) => !f.startsWith("docs/tickets/"));
      if (others.length) {
        quiet(`git -C "${dir}" merge --abort`);
        return { pushed: false, why: `merging ${base} conflicts outside docs/tickets/ too (${others.join(", ")}); sort that out on the branch first` };
      }
    }
    if (existsSync(join(dir, "docs", "tickets")) || quiet(`git -C "${dir}" ls-files -u -- docs/tickets`)) git("rm -r --quiet --force -- docs/tickets");
    // A clean merge has already committed; finish a conflicted one, or commit the removal.
    if (ok(`git -C "${dir}" rev-parse -q --verify MERGE_HEAD`) || quiet(`git -C "${dir}" diff --cached --name-only`))
      git(`commit --quiet -m "chore: merge ${base}, keeping docs/tickets/ deleted (the board is on issues)"`);
    git(`push --quiet origin "HEAD:refs/heads/${branch}"`);
    return { pushed: true, why: `dropped its docs/tickets/ changes (the board is on issues now) and pushed; /land again once CI passes` };
  } finally {
    quiet(`git worktree remove --force "${dir}"`);
  }
}

/** package.json's version at a ref, or null. */
const versionAt = (ref) => {
  try {
    return JSON.parse(sh(`git show "${ref}:package.json"`)).version ?? null;
  } catch {
    return null;
  }
};
const parts = (v) => v.split(".").map(Number);
/** Which part a bump from → to changed: "major", "minor", "patch", or null if none. */
function bumpKind(from, to) {
  const [a, b] = [parts(from), parts(to)];
  return a[0] !== b[0] ? "major" : a[1] !== b[1] ? "minor" : a[2] !== b[2] ? "patch" : null;
}
function bump(v, kind) {
  const [M, m, p] = parts(v);
  return kind === "major" ? `${M + 1}.0.0` : kind === "minor" ? `${M}.${m + 1}.0` : `${M}.${m}.${p + 1}`;
}
/** Set the version in a checkout's package.json and package-lock.json (its root and packages[""]), keeping their formatting. */
function setVersion(dir, v) {
  for (const [file, n] of [["package.json", 1], ["package-lock.json", 2]]) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    let left = n;
    writeFileSync(path, readFileSync(path, "utf8").replace(/"version": "[^"]*"/g, (m) => (left-- > 0 ? `"version": "${v}"` : m)));
  }
}

/**
 * A PR that bumped the version from a base that has bumped it too since
 * (another PR landed first) gets its bump made again on top: in a throwaway
 * worktree, the branch takes the base's version (so the version lines merge
 * cleanly), the base is merged in, the version is bumped from the base's by
 * the same kind, and that's pushed. Returns null if nothing needed doing, else
 * { pushed, why }.
 */
function rebump(branch, base) {
  const from = quiet(`git merge-base "origin/${base}" "origin/${branch}"`);
  const [was, mine, theirs] = [versionAt(from), versionAt(`origin/${branch}`), versionAt(`origin/${base}`)];
  if (!was || !mine || !theirs) return null;
  const kind = bumpKind(was, mine);
  if (!kind || theirs === was) return null; // no bump of its own, or the base hasn't moved
  const target = bump(theirs, kind);
  if (dry) return { pushed: false, why: `would merge ${base} in and re-bump ${mine} → ${target} (${base} is at ${theirs}), then push` };
  const dir = join(commonDir, "..", ".tracker", `land-${branch.replace(/[^\w.-]+/g, "-")}`);
  if (existsSync(dir)) quiet(`git worktree remove --force "${dir}"`);
  sh(`git worktree add --quiet --detach "${dir}" "origin/${branch}"`);
  try {
    const git = (c) => sh(`git -C "${dir}" ${c}`);
    setVersion(dir, theirs);
    git(`commit --quiet --allow-empty -am "chore: take ${base}'s version before merging it"`);
    if (!ok(`git -C "${dir}" merge --no-edit --quiet origin/${base}`)) {
      const conflicts = quiet(`git -C "${dir}" diff --name-only --diff-filter=U`).split("\n").filter(Boolean);
      quiet(`git -C "${dir}" merge --abort`);
      return { pushed: false, why: `merging ${base} to re-bump the version conflicts (${conflicts.join(", ")}); merge ${base} into the branch first` };
    }
    setVersion(dir, target);
    git(`commit --quiet -am "chore: bump the version to ${target} (${base} is at ${theirs})"`);
    git(`push --quiet origin "HEAD:refs/heads/${branch}"`);
    return { pushed: true, why: mine === target ? `merged ${base} in (its ${theirs} and this ${mine} clashed)` : `re-bumped ${mine} → ${target} on top of ${base}'s ${theirs}` };
  } finally {
    quiet(`git worktree remove --force "${dir}"`);
  }
}

/**
 * The issues a PR settles: those its body closes ("Closes #212"), else the one
 * its branch names (212-…, or t-0NN-… through docs/ticket-ids.json on its base).
 */
function issuesOf(pr) {
  const closes = [...(pr.body ?? "").matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)].map((m) => Number(m[1]));
  if (closes.length) return [...new Set(closes)];
  const n = /^(\d+)-/.exec(pr.headRefName)?.[1];
  if (n) return [Number(n)];
  const old = /^t-(\d+)-/.exec(pr.headRefName)?.[1];
  const ids = old ? JSON.parse(quiet(`git show "origin/${pr.baseRefName}:docs/ticket-ids.json"`) || "{}") : {};
  return old && ids[`T-${old.padStart(3, "0")}`] ? [ids[`T-${old.padStart(3, "0")}`]] : [];
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
    const dropped = dropTickets(it.name, pr.baseRefName);
    if (dropped) {
      skipped.push({ branch: it.name, why: `PR #${pr.number}: ${dropped.why}` });
      continue;
    }
    // A feature's own branch keeps its tasks' commits: a merge commit, not a squash.
    const how = it.name.startsWith("feature/") ? "--merge" : "--squash";
    const rebumped = !s.draft && s.ci !== "failing" ? rebump(it.name, pr.baseRefName) : null;
    if (rebumped) {
      // A new push: CI runs again, so leave the merge to GitHub once it passes.
      if (!rebumped.pushed || (!dry && !ok(`gh pr merge ${pr.number} ${how} --auto`))) {
        skipped.push({ branch: it.name, why: `PR #${pr.number}: ${rebumped.pushed ? `${rebumped.why}, but couldn't turn on auto-merge` : rebumped.why}` });
        continue;
      }
      notes.push(`PR #${pr.number}: ${rebumped.why}`);
      open.push({ ...row, ci: "pending", autoMerge: true });
      continue;
    }
    const ready = s.ci === "passing" || s.ci === "none";
    if (!s.draft && ready && ["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(s.mergeState)) {
      if (!dry) sh(`gh pr merge ${pr.number} ${how}`);
      it.merged = true;
    } else if (!s.draft && s.ci !== "failing" && !["DIRTY", "UNKNOWN"].includes(s.mergeState)) {
      // CI still running (main's ruleset shows that as BLOCKED): let GitHub merge
      // it when CI passes. Everything else waits for a sweep after the merge.
      if (!dry && !ok(`gh pr merge ${pr.number} ${how} --auto`)) {
        skipped.push({ branch: it.name, why: `PR #${pr.number}: couldn't turn on auto-merge (CI ${s.ci}, ${s.mergeState.toLowerCase()})` });
        continue;
      }
      open.push({ ...row, autoMerge: true });
      continue;
    } else {
      skipped.push({ branch: it.name, why: `PR #${pr.number} isn't ready to merge (CI ${s.ci}, ${s.draft ? "draft, " : ""}${s.mergeState.toLowerCase()})` });
      continue;
    }
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

  // GitHub closes "Closes #N" issues only on merges into main: close a feature
  // task's issues ourselves, whether it merged just now or earlier (auto-merge).
  if ((it.merged || pr?.state === "MERGED") && pr.baseRefName !== "main") {
    it.closed = issuesOf(pr).filter((n) => it.merged || quiet(`gh issue view ${n} --json state --jq .state`) === "OPEN");
    for (const n of it.closed)
      if (!dry && !ok(`gh issue close ${n} --reason completed --comment "Merged into ${pr.baseRefName} in #${pr.number}."`))
        notes.push(`couldn't close issue #${n}`);
  }

  // Land it.
  const done = { branch: it.name, pr: pr?.number ?? null, merged: !!it.merged, closed: it.closed ?? [], stopped: [], worktree: null, branches: [] };
  const w = it.tree;
  if (w) {
    // A live session first, before stopping anything: it may have servers of its own running.
    const session = liveSession(w);
    if (session) {
      // A sweep passing a session's fresh worktree (no PR yet) isn't news.
      if (pr || isNamed)
        skipped.push({ branch: it.name, why: `${session} still working in ${w.dir}; archive that session (the app does once its PR closes), then /land again` });
      landed.push(done);
      continue;
    }
    const running = servers(w.dir);
    for (const s of running) {
      if (!dry) stop(s.pid);
      done.stopped.push(s.port);
    }
    if (running.length && !dry) execSync("sleep 1"); // let them exit before looking for anything else
    // In a dry run the servers are still up, so their npm and node don't count.
    const others = busy(w.dir).filter((p) => !(dry && running.length && /^(node|npm) /.test(p)));
    const changes = dirty(w.dir);
    const app = appTree(w);
    if (others.length) {
      skipped.push({ branch: it.name, why: `${others.join(", ")} still running in ${w.dir}; stop it, then /land again` });
      landed.push(done);
      continue;
    }
    if (inside(here, w.dir)) {
      skipped.push({ branch: it.name, why: `this session is inside ${w.dir}; run /land from another session, or let the app tidy it when it archives this one` });
      landed.push(done);
      continue;
    }
    if (changes.length && !force) {
      skipped.push({ branch: it.name, why: `${w.dir} has uncommitted changes (${changes.slice(0, 3).join(", ")}${changes.length > 3 ? ", …" : ""}); --force discards them` });
      landed.push(done);
      continue;
    }
    if (app) {
      // The app's folder stays for it to reuse or clean up; just let go of the branch.
      if (w.branch && !dry) sh(`git -C "${w.dir}" switch --quiet --detach ${changes.length ? "--discard-changes " : ""}`);
      done.worktree = null;
    } else {
      if (!dry) {
        if (w.locked) quiet(`git worktree unlock "${w.dir}"`);
        // Forced: anything left is either nothing, stray .uid files, or discarded by --force.
        sh(`git worktree remove --force "${w.dir}"`);
      }
      done.worktree = w.dir;
    }
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
      d.closed.length && `closed ${d.closed.map((n) => `#${n}`).join(", ")}`,
      d.stopped.length && `stopped server on ${d.stopped.map((p) => `:${p}`).join(", ")}`,
      d.worktree && "removed worktree",
      d.branches.length && `deleted ${d.branches.join(", ")}`,
    ].filter(Boolean);
    if (bits.length) console.log(`landed ${d.branch}${d.pr ? ` (#${d.pr})` : ""}: ${bits.join("; ")}${would}`);
  }
  for (const s of skipped) console.log(`skipped ${s.branch}: ${s.why}`);
  for (const o of open)
    console.log(
      `open    ${o.branch} (#${o.pr}): CI ${o.ci}, ${o.mergeState.toLowerCase()}${o.draft ? ", draft" : ""}${o.autoMerge ? `; auto-merge ${dry ? "would be " : ""}on, merges when CI passes` : ""}`,
    );
  for (const n of notes) console.log(n);
}

// The playtest board. Notes go into a local inbox; /ingest turns them into
// tickets (or features); /build turns a ticket into a PR.
//
// Tickets and features are GitHub issues (F-020), labeled task or feature; the
// ones moved from docs/tickets/ keep their old id at the front of the title
// ("T-080 · …"), new ones go by their issue number (#212). The issue stores
// only what doesn't churn: the content, open or closed (with its reason),
// labels, its parent feature and its blockers; the history is its comments.
// Live state is derived, never stored:
//   needs answers  unticked "- [ ]" lines under ## Open questions
//   blocked        a blocked-by issue that isn't done (or a PR that isn't
//                  merged), or a feature that's still a draft
//   in flight      a pushed branch for the item (t-0NN-…, or 212-… for new ones) with no PR yet
//   in review      an open PR from that branch, or one that closes the issue
//   done           closed as completed, or that PR merged
//   dropped        closed as not planned
// Hibernating (label hibernating) is set aside for now but not given up: off
// Ready and the dependency graph, listed on its own, and `--status open` wakes
// it. Its feature isn't done while it sleeps, and anything it blocks stays blocked.
//
// Features (the epics) hold the plan for a big item and its Breakdown into
// tasks; tasks are the feature's sub-issues. A feature is labeled draft or
// agreed, closed when done or dropped, and its tasks wait until it's agreed.
// Its Breakdown lines are a checklist, ticked (with "→ #N") once a task exists.
// Live: needs answers (a draft with open questions), plan in flight / in review
// (an f-0NN-… or 212-… branch or PR), in progress (agreed, a task started), done
// (agreed, and every planned task ticketed and finished).
// A feature can be built on its own branch (a "**Branch:** `feature/…`" line in
// its body, made by `feature-branch`): its tasks branch from it and their PRs
// merge into it, and it reaches main in one go at the end (a PR from it, merged
// with a merge commit). Its live state is then "ready to merge" once every task
// is finished, and done only when that PR is merged.
// The inbox and the generated BOARD.md are local, in .tracker/ (gitignored) in
// the main checkout, found from any worktree.
//
//   node scripts/board.mjs note <text>       add a note to the inbox (or text on stdin)
//   node scripts/board.mjs inbox             print notes waiting to be ingested
//   node scripts/board.mjs ingest-start      take the inbox, give each note an id, archive it verbatim
//   node scripts/board.mjs ingest-done       link each archived note to its tickets; clear the ingest file
//   node scripts/board.mjs new task|feature <title> [--size M] [--area sim,ui] [--feature F-1] [--blocked-by T-7,#41]
//                              [--touches a,b] [--notes N-0001] [--breakdown <n>] [--status draft|agreed]
//                                            make an issue, its sections on stdin; prints its id. --breakdown ticks
//                                            line n of the feature's Breakdown (a task made when agreeing it)
//   node scripts/board.mjs log <id> [text] [--status open|done|dropped|hibernating] [--blocked-by T-7,#41|none] [--feature F-1|none]
//                                            comment on the item (and set fields); a feature takes
//                                            --status draft|agreed|done|dropped
//   node scripts/board.mjs body <id>         print the item's body (its sections), to edit
//   node scripts/board.mjs set-body <id> [file]
//                                            replace the item's body with the file (or stdin)
//   node scripts/board.mjs menu              print the board's short view; rewrite BOARD.md
//   node scripts/board.mjs show <id>         print one ticket or feature with its live state and history
//   node scripts/board.mjs graph [--days=7]  print the ticket dependency graph as SVG (done tickets shown for N days)
//   node scripts/board.mjs base <id>         print the branch a ticket's PR goes into: its feature's branch, or main
//   node scripts/board.mjs feature-branch <F-id>
//                                            make the feature's branch from origin/main, push it, record it in the issue
//   node scripts/board.mjs sync <F-id>       merge origin/main into the feature's branch and push it (stops on a conflict)
//   node scripts/board.mjs path              print the local tracker folder
// Ids can be shorthand anywhere: t6, T6, t-6 and 6 mean T-006; f1 means F-001;
// #212 is issue 212 (and so is 212, past the old tickets' ids). Writes go
// through `gh`; nothing about tickets is committed any more.

import { exec, execFileSync, execSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

// Mistakes (a bad id, a wrong status) print one line, not a stack trace.
process.on("uncaughtException", (e) => {
  console.error(`board: ${e.message}`);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error(`board: ${e.message}`);
  process.exit(1);
});

const STORED_STATUSES = ["open", "done", "dropped", "hibernating"];
const FEATURE_STATUSES = ["draft", "agreed", "done", "dropped"];
const SIZES = ["S", "M", "L", "XL"];
const AREAS = ["sim", "data", "ui", "render3d", "render2d", "godot", "bridge", "audio", "docs", "balance", "events", "rooms", "tickets", "devtools"];
const COLUMNS = [
  ["ready", "Ready"],
  ["noted", "Needs answers"],
  ["blocked", "Blocked"],
  ["in-flight", "In flight"],
  ["in-review", "In review"],
  ["hibernating", "Hibernating"],
  ["done", "Done"],
];
/** Done tickets shown on BOARD.md; older ones drop off the view. */
const DONE_SHOWN = 15;
/** t-0NN-… builds a ticket; f-0NN-… writes a feature's plan; 212-… is issue 212 (GitHub's "create a branch"). */
const BRANCH_RE = /^(?:([tf])-(\d+)|(\d+))-/;
/** The old id at the front of a migrated issue's title. */
const TITLE_ID = /^([TF]-\d{3}) · ([\s\S]*)$/;
/** The migration's history comment (scripts/migrate-issues.mjs). */
const HISTORY_MARK = "<!-- migrated: history -->";
const FEATURE_LABELS = {
  draft: "draft",
  noted: "needs answers",
  "in-flight": "plan in flight",
  "in-review": "plan in review",
  agreed: "agreed",
  "in-progress": "in progress",
  "ready-to-merge": "ready to merge",
  done: "done",
  dropped: "dropped",
};

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const trySh = (cmd) => {
  try {
    return sh(cmd);
  } catch {
    return null;
  }
};
const shAsync = promisify(exec);
const tryShAsync = (cmd) =>
  shAsync(cmd, { encoding: "utf8", maxBuffer: 64 << 20 }).then(
    (r) => r.stdout.trim(),
    () => null,
  );

// The notes archive and the local tracker belong to the main checkout, even
// when run from a worktree.
const MAIN = dirname(resolve(sh("git rev-parse --git-common-dir")));
const ARCHIVE = join(MAIN, "docs", "tickets", "notes-archive.md");
const LOCAL = join(MAIN, ".tracker");
const INBOX = join(LOCAL, "inbox.md");
const INGESTING = join(LOCAL, "ingesting.md");
const BOARD = join(LOCAL, "BOARD.md");
mkdirSync(LOCAL, { recursive: true });
const REPO = sh("git remote get-url origin").match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1];
if (!REPO) throw new Error("origin isn't a GitHub repository");
const [OWNER, NAME] = REPO.split("/");

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDate = (s) => new Date(/^\d{4}-\d\d-\d\d \d/.test(s) ? s.replace(" ", "T") : s);
const ago = (s) => {
  if (!s) return "";
  const mins = (Date.now() - toDate(s).getTime()) / 60000;
  if (mins < 60) return `${Math.max(0, Math.round(mins))}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 60 / 24)}d`;
};
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---- notes ----------------------------------------------------------------

/** Entries are "## <stamp>" (inbox) or "## N-0001 · <stamp>" (archive) headings, then the note verbatim. */
function parseNotes(text) {
  return text
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const nl = chunk.indexOf("\n");
      const head = (nl < 0 ? chunk : chunk.slice(0, nl)).trim();
      const body = nl < 0 ? "" : chunk.slice(nl + 1).trim();
      const m = head.match(/^(N-\d+) · (.*)$/);
      return m ? { id: m[1], at: m[2], body } : { id: null, at: head, body };
    })
    .filter((n) => n.body);
}
const pendingNotes = () => parseNotes(read(INBOX)).length + parseNotes(read(INGESTING)).length;

// ---- GitHub writes ----------------------------------------------------------

function gh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 << 20 });
}
/** A REST call; the body goes as JSON. */
function api(method, path, body) {
  try {
    const out = gh(["api", "-X", method, `repos/${REPO}/${path}`, ...(body ? ["--input", "-"] : [])], body ? JSON.stringify(body) : undefined);
    return out.trim() ? JSON.parse(out) : null;
  } catch (e) {
    throw new Error(`${method} ${path}: ${`${e.stderr ?? ""}${e.stdout ?? ""}`.trim() || e.message}`);
  }
}

// ---- tickets as issues ------------------------------------------------------

const ISSUE_FIELDS = `number databaseId title body url state stateReason createdAt closedAt
  labels(first:30){nodes{name}}
  parent{number}
  blockedBy(first:50){nodes{number databaseId}}
  firstComment: comments(first:1){nodes{body createdAt}}
  lastComment: comments(last:1){nodes{body createdAt}}
  closedByPullRequestsReferences(first:10, includeClosedPrs:true){nodes{number state headRefName baseRefName createdAt mergedAt url}}`;

/** Every issue on the repo, a hundred to a page. */
async function fetchIssues() {
  const query = `query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){issues(first:100,after:$after,states:[OPEN,CLOSED]){pageInfo{hasNextPage endCursor} nodes{${ISSUE_FIELDS}}}}}`;
  const out = [];
  let after = null;
  do {
    const vars = `-F owner=${OWNER} -F name=${NAME}${after ? ` -F after=${after}` : ""}`;
    const text = await tryShAsync(`gh api graphql -f query='${query}' ${vars}`);
    if (text === null) throw new Error("can't read the board: GitHub unreachable (or gh not signed in)");
    const page = JSON.parse(text).data.repository.issues;
    out.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return out;
}

/** The short header above an issue's sections: "> From … · opened … · notes …" and "**Key:** value" lines. */
function header(body) {
  const head = body.split(/^## /m)[0];
  const field = (key) => head.match(new RegExp(`^\\*\\*${key}:\\*\\* (.*)$`, "m"))?.[1].trim() ?? null;
  const list = (v) => (v ? v.split(",").map((s) => s.trim().replace(/^`|`$/g, "")).filter(Boolean) : []);
  return {
    created: head.match(/opened (\d{4}-\d\d-\d\d \d\d:\d\d)/)?.[1] ?? null,
    notes: head.match(/notes ((?:N-\d+(?:, )?)+)/)?.[1].split(", ") ?? [],
    touches: list(field("Touches")),
    plan: field("Plan")?.replace(/`/g, "") ?? null,
    branch: field("Branch")?.replace(/`/g, "") ?? null,
    blockedPrs: list(field("Blocked by PR")).map((s) => s.replace("#", "")).map(Number),
  };
}

/** Set (or with null, remove) one "**Key:** value" header line, keeping the rest of the body. */
function setHeaderLine(body, key, value) {
  const at = body.search(/^## /m);
  let head = at < 0 ? body : body.slice(0, at);
  const rest = at < 0 ? "" : body.slice(at);
  const re = new RegExp(`^\\*\\*${key}:\\*\\* .*\\n?`, "m");
  head = head.replace(re, "");
  if (value !== null) {
    const lines = head.replace(/\s*$/, "").split("\n").filter((l, i, a) => l || i < a.length - 1);
    // After the "> From …" line and the other header lines, before the blank line.
    let i = 0;
    while (i < lines.length && (lines[i].startsWith(">") || lines[i].startsWith("**"))) i++;
    lines.splice(i, 0, `**${key}:** ${value}`);
    head = `${lines.join("\n")}\n\n`;
  }
  return head.trim() ? `${head.replace(/\s*$/, "")}\n\n${rest}` : rest;
}

/** The newest "- <stamp>" line in the migrated history, or the newest comment, or when it closed. */
function since(i, created) {
  const times = [created];
  const first = i.firstComment.nodes[0];
  const migrated = first?.body.startsWith(HISTORY_MARK);
  if (migrated) {
    const last = [...first.body.matchAll(/^- (\d{4}-\d\d-\d\d \d\d:\d\d)/gm)].pop()?.[1];
    if (last) times.push(last);
  }
  const last = i.lastComment.nodes[0];
  if (last && !last.body.startsWith(HISTORY_MARK)) times.push(last.createdAt);
  // The migration closed done items as it made them; that isn't when they were done.
  const closedByMigration = migrated && i.closedAt && toDate(i.closedAt) - toDate(first.createdAt) < 86400000;
  if (i.closedAt && !closedByMigration) times.push(i.closedAt);
  return times.filter(Boolean).sort((a, b) => toDate(a) - toDate(b)).pop();
}

/**
 * An issue as the board's item: `meta` as the ticket files had it (id, title,
 * status, size, area, feature, branch, blocked_by …), `body` its sections.
 * Null for issues that aren't tickets or features.
 */
function toItem(i, idOf) {
  const labels = new Set(i.labels.nodes.map((l) => l.name));
  const kind = labels.has("feature") ? "feature" : labels.has("task") ? "task" : null;
  if (!kind) return null;
  const old = i.title.match(TITLE_ID);
  const h = header(i.body);
  const closed = i.state === "CLOSED" ? (i.stateReason === "NOT_PLANNED" ? "dropped" : "done") : null;
  const status =
    kind === "feature"
      ? (closed ?? (labels.has("agreed") ? "agreed" : "draft"))
      : (closed ?? (labels.has("hibernating") ? "hibernating" : "open"));
  const created = h.created ?? i.createdAt;
  return {
    kind,
    number: i.number,
    databaseId: i.databaseId,
    url: i.url,
    labels,
    closingPrs: i.closedByPullRequestsReferences.nodes,
    meta: {
      id: idOf(i.number) ?? old?.[1] ?? `#${i.number}`,
      title: old ? old[2] : i.title,
      status,
      size: SIZES.find((s) => labels.has(`size:${s}`)) ?? "",
      area: AREAS.filter((a) => labels.has(`area:${a}`)).join(", "),
      feature: i.parent ? idOf(i.parent.number) : null,
      plan: h.plan,
      branch: h.branch,
      touches: h.touches,
      notes: h.notes,
      blocked_by: i.blockedBy.nodes.sort((a, b) => a.number - b.number).map((b) => idOf(b.number)).filter(Boolean),
      blocked_prs: h.blockedPrs,
      created,
    },
    since: since(i, created),
    body: i.body.replace(/\r\n/g, "\n"),
  };
}

/** Ids: T-006, t-6, t6, T6 are T-006; F-001, f1, F1 are F-001; #212 is issue 212; a bare 6 is T-006 if there is one, else #6. */
function parseId(s) {
  const x = String(s ?? "").trim();
  let m = /^#(\d+)$/.exec(x);
  if (m) return { number: Number(m[1]) };
  m = /^([tf])-?0*(\d+)$/i.exec(x);
  if (m) return { old: `${m[1].toUpperCase()}-${m[2].padStart(3, "0")}` };
  m = /^0*(\d+)$/.exec(x);
  if (m) return { old: `T-${m[1].padStart(3, "0")}`, number: Number(m[1]) };
  return null;
}

/** An item by id, shorthand or issue number, from the loaded board. */
function findIn(items, s) {
  const p = parseId(s);
  if (!p) throw new Error(`"${s}" isn't a ticket or feature id (T-006, t6 or 6; F-001 or f1; #212)`);
  const it = (p.old && items.find((x) => x.meta.id === p.old)) || (p.number && items.find((x) => x.number === p.number));
  if (!it) throw new Error(`no ticket or feature ${s} on ${REPO}`);
  return it;
}

/** The text of one "## <name>" section of a ticket or feature. */
const section = (t, name) => t.body.split(/^(?=## )/m).find((s) => s.startsWith(`## ${name}\n`))?.slice(name.length + 4) ?? "";
const openQuestions = (t) => (section(t, "Open questions").match(/^- \[ \]/gm) ?? []).length;
/** A feature's planned tasks: the top-level "- " lines under ## Breakdown, with the task each became ("→ T-0NN" or "→ #212"). */
const breakdown = (f) =>
  section(f, "Breakdown")
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => ({ line: l.slice(2), ticket: l.match(/→\s*(T-\d+|#\d+)/)?.[1] ?? null }));
const lastHistory = (t) => t.since;

// ---- GitHub reads -----------------------------------------------------------

/** The item a branch belongs to: t-0NN-… and f-0NN-… by old id, 212-… by issue number. */
function branchItem(name, items) {
  const m = name?.match(BRANCH_RE);
  if (!m) return null;
  if (m[3]) return items.find((x) => x.number === Number(m[3]))?.meta.id ?? null;
  const old = `${m[1].toUpperCase()}-${m[2].padStart(3, "0")}`;
  return items.some((x) => x.meta.id === old) ? old : null;
}

/** Issues, PRs and pushed branches, read together. */
async function github() {
  const [issues, list, heads] = await Promise.all([
    fetchIssues(),
    tryShAsync("gh pr list --state all --limit 1000 --json number,state,headRefName,baseRefName,createdAt,mergedAt,url"),
    tryShAsync("git ls-remote --heads origin 't-*' 'f-*' '[0-9]*'"),
  ]);
  const oldIds = Object.fromEntries(issues.map((i) => [i.number, i.title.match(TITLE_ID)?.[1] ?? null]));
  const known = new Set(issues.filter((i) => i.labels.nodes.some((l) => ["task", "feature"].includes(l.name))).map((i) => i.number));
  const idOf = (n) => (known.has(n) ? (oldIds[n] ?? `#${n}`) : null);
  const items = issues.map((i) => toItem(i, idOf)).filter(Boolean).sort((a, b) => a.number - b.number);

  const prs = {};
  const branches = {};
  const all = list ? JSON.parse(list) : [];
  // Keep the most telling PR per item: open beats merged beats closed.
  const rank = { OPEN: 3, MERGED: 2, CLOSED: 1 };
  const offer = (id, pr) => {
    if (id && (!prs[id] || rank[pr.state] > rank[prs[id].state])) prs[id] = pr;
  };
  for (const pr of all) offer(branchItem(pr.headRefName, items), pr);
  for (const it of items) for (const pr of it.closingPrs) offer(it.meta.id, pr);
  for (const line of (heads ?? "").split("\n")) {
    const name = line.split("refs/heads/")[1];
    const id = branchItem(name, items);
    if (id) branches[id] = name;
  }
  return { items, prs, branches, all, online: list !== null };
}

/** The PR that takes a feature's own branch into main: open beats merged beats closed. */
function branchPr(gh, branch) {
  const mine = gh.all.filter((p) => p.headRefName === branch && p.baseRefName === "main");
  return mine.find((p) => p.state === "OPEN") ?? mine.find((p) => p.state === "MERGED") ?? mine[0] ?? null;
}

/** The ticket's live state, from the issue, its feature and GitHub. */
function liveState(t, gh, byId) {
  const id = t.meta.id;
  const pr = gh.prs[id];
  if (t.meta.status === "dropped") return { state: "dropped", since: lastHistory(t) };
  if (t.meta.status === "hibernating") return { state: "hibernating", since: lastHistory(t) };
  if (t.meta.status === "done" || pr?.state === "MERGED")
    return { state: "done", since: pr?.mergedAt ?? lastHistory(t), pr };
  if (pr?.state === "OPEN") return { state: "in-review", since: pr.createdAt, pr };
  if (gh.branches[id]) return { state: "in-flight", since: lastHistory(t), branch: gh.branches[id] };
  const waiting = t.meta.blocked_by.filter((b) => {
    const other = byId[b];
    return !other || liveState(other, gh, byId).state !== "done";
  });
  for (const n of t.meta.blocked_prs) if (gh.all.find((p) => p.number === n)?.state !== "MERGED") waiting.push(`#${n}`);
  // A feature's tasks wait until it's agreed. Only its stored status counts
  // here, so the feature's live state can depend on its tasks' without a loop.
  const feature = t.meta.feature && byId[t.meta.feature];
  if (feature?.meta.status === "draft") waiting.push(`${feature.meta.id} (draft)`);
  if (waiting.length) return { state: "blocked", since: lastHistory(t), waiting };
  if (openQuestions(t)) return { state: "noted", since: lastHistory(t) };
  return { state: "ready", since: lastHistory(t) };
}

/** A feature's live state, from the issue, its tasks' states and GitHub. */
function featureState(f, gh, rows) {
  const id = f.meta.id;
  const tasks = rows.filter((r) => r.t.meta.feature === id);
  const planned = breakdown(f);
  const unticketed = planned.filter((p) => !p.ticket || !tasks.some((r) => r.t.meta.id === p.ticket || `#${r.t.number}` === p.ticket)).length;
  const out = { tasks, planned: planned.length, unticketed, since: lastHistory(f) };
  const pr = gh.prs[id];
  const finished = (r) => ["done", "dropped"].includes(r.state);
  if (f.meta.status === "dropped") return { ...out, state: "dropped" };
  const allFinished = f.meta.status === "agreed" && tasks.length && !unticketed && tasks.every(finished);
  // On its own branch, a feature is done only once that branch is merged into main.
  if (f.meta.branch) {
    const into = branchPr(gh, f.meta.branch);
    const withBranch = { ...out, branch: f.meta.branch, branchPr: into };
    if (f.meta.status === "done" || into?.state === "MERGED") return { ...withBranch, state: "done" };
    if (allFinished) return { ...withBranch, state: "ready-to-merge" };
    const started = tasks.some((r) => ["in-flight", "in-review", "done"].includes(r.state));
    return { ...withBranch, state: started ? "in-progress" : "agreed" };
  }
  if (f.meta.status === "done" || allFinished) return { ...out, state: "done" };
  if (pr?.state === "OPEN") return { ...out, state: "in-review", since: pr.createdAt, pr };
  // A merged plan PR leaves the feature where its issue says (draft until Bryon agrees it).
  if (gh.branches[id] && pr?.state !== "MERGED") return { ...out, state: "in-flight", branch: gh.branches[id] };
  if (f.meta.status === "agreed") {
    const started = tasks.some((r) => ["in-flight", "in-review", "done"].includes(r.state));
    return { ...out, state: started ? "in-progress" : "agreed" };
  }
  return { ...out, state: openQuestions(f) ? "noted" : "draft" };
}

async function board() {
  const gh = await github();
  const tickets = gh.items.filter((x) => x.kind === "task");
  const features = gh.items.filter((x) => x.kind === "feature");
  const byId = Object.fromEntries(gh.items.map((t) => [t.meta.id, t]));
  const rows = tickets.map((t) => ({ t, ...liveState(t, gh, byId) }));
  return { gh, items: gh.items, rows, features: features.map((f) => ({ f, ...featureState(f, gh, rows) })) };
}

// ---- views ----------------------------------------------------------------

function extras(r) {
  const out = [];
  const feature = r.t.meta.feature;
  if (feature && !r.waiting?.some((w) => w.startsWith(feature))) out.push(feature);
  if (r.waiting) out.push(`waits on ${r.waiting.join(", ")}`);
  if (r.state === "noted") out.push(plural(openQuestions(r.t), "open question"));
  if (r.branch) out.push(r.branch);
  if (r.pr && r.state !== "ready") out.push(`PR #${r.pr.number}`);
  return out;
}

/** A feature's tasks and what's left to ticket, e.g. "T-005 ready, T-006 blocked · 1 not ticketed". */
function featureExtras(fr) {
  const out = [];
  const state = (r) => (r.state === "noted" ? "needs answers" : r.state);
  if (fr.tasks.length) out.push(fr.tasks.map((r) => `${r.t.meta.id} ${state(r)}`).join(", "));
  if (fr.unticketed) out.push(`${fr.unticketed} not ticketed`);
  if (!fr.planned && !fr.tasks.length) out.push("no breakdown yet");
  if (fr.state === "noted") out.push(plural(openQuestions(fr.f), "open question"));
  if (fr.branch) out.push(fr.branch);
  if (fr.pr && !fr.branchPr) out.push(`PR #${fr.pr.number}`);
  if (fr.branchPr) out.push(`into main: PR #${fr.branchPr.number}${fr.branchPr.state === "OPEN" ? "" : ` (${fr.branchPr.state.toLowerCase()})`}`);
  return out;
}
const openFeatures = (features) => features.filter((x) => !["done", "dropped"].includes(x.state));

/** Small before big, then oldest first. */
const byPickOrder = (a, b) =>
  SIZES.indexOf(a.t.meta.size) - SIZES.indexOf(b.t.meta.size) || toDate(a.t.meta.created) - toDate(b.t.meta.created);

function columns(rows) {
  return COLUMNS.map(([state, label]) => {
    let col = rows.filter((r) => r.state === state);
    const total = col.length;
    col = state === "done" ? col.sort((a, b) => toDate(b.since) - toDate(a.since)).slice(0, DONE_SHOWN) : col.sort(byPickOrder);
    return { state, label, total, col };
  });
}

function writeBoard({ gh, rows, features }) {
  let out = `# Board\n\nGenerated ${stamp()} by \`node scripts/board.mjs menu\` from GitHub Issues on ${REPO}. Don't edit.\n\n`;
  if (!gh.online) out += "**GitHub PRs unreachable: in review and merged states may be missing.**\n\n";
  if (pendingNotes()) out += `**${plural(pendingNotes(), "note")} waiting in the inbox.** Run /ingest.\n\n`;
  const link = (t) => `[${t.meta.id}](${t.url})`;
  out += `## Features (${openFeatures(features).length})\n\n`;
  if (!features.length) out += "—\n\n";
  else {
    out += "| Id | Feature | State | In this state | Tasks |\n| --- | --- | --- | --- | --- |\n";
    for (const fr of features)
      out += `| ${link(fr.f)} | ${fr.f.meta.title} | ${FEATURE_LABELS[fr.state]} | ${ago(fr.since)} | ${featureExtras(fr).join(" · ")} |\n`;
    out += "\n";
  }
  for (const { label, total, col } of columns(rows)) {
    out += `## ${label} (${total})\n\n`;
    if (!col.length) {
      out += "—\n\n";
      continue;
    }
    out += "| Id | Size | Item | In this state | Notes |\n| --- | --- | --- | --- | --- |\n";
    for (const r of col) {
      out += `| ${link(r.t)} | ${r.t.meta.size || "?"} | ${r.t.meta.title} | ${ago(r.since)} | ${extras(r).join(" · ")} |\n`;
    }
    out += "\n";
  }
  writeFileSync(BOARD, out);
}

async function menu() {
  const b = await board();
  writeBoard(b);
  const lines = [];
  if (!b.gh.online) lines.push("(GitHub PRs unreachable: in review and merged states may be missing.)", "");
  if (pendingNotes()) lines.push(`${plural(pendingNotes(), "note")} waiting in the inbox (not on the board until /ingest).`, "");
  const feats = openFeatures(b.features);
  if (feats.length) {
    lines.push(`Features (${feats.length})`);
    const w = Math.max(...feats.map((x) => x.f.meta.title.length));
    const sw = Math.max(...feats.map((x) => FEATURE_LABELS[x.state].length));
    for (const fr of feats) {
      lines.push(`  ${fr.f.meta.id}  ${FEATURE_LABELS[fr.state].padEnd(sw)}  ${fr.f.meta.title.padEnd(w)}  ${ago(fr.since).padStart(3)}`);
      const x = featureExtras(fr);
      if (x.length) lines.push(`         ${x.join(" · ")}`);
    }
  }
  for (const { state, label, total, col } of columns(b.rows)) {
    if (!total || state === "done") continue;
    lines.push(`${label} (${total})`);
    const w = Math.max(...col.map((r) => r.t.meta.title.length));
    for (const r of col) {
      const x = extras(r);
      lines.push(`  ${r.t.meta.id}  ${(r.t.meta.size || "?").padEnd(2)}  ${r.t.meta.title.padEnd(w)}  ${ago(r.since).padStart(3)}${x.length ? `  · ${x.join(" · ")}` : ""}`);
    }
  }
  if (!b.rows.some((r) => !["done", "dropped"].includes(r.state)) && !feats.length) lines.push("Nothing open on the board.");
  const done = b.rows.filter((r) => r.state === "done").length;
  const featuresDone = b.features.filter((x) => x.state === "done").length;
  lines.push("", `${done} done${featuresDone ? ` (and ${plural(featuresDone, "feature")})` : ""}. Full board: ${BOARD}`);
  console.log(lines.join("\n"));
}

// ---- commands -------------------------------------------------------------

function flags(args) {
  const out = { rest: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) out[args[i].slice(2)] = args[++i];
    else out.rest.push(args[i]);
  }
  return out;
}

// ---- dependency graph -----------------------------------------------------

/**
 * Box colours by live state, as the Claude UI's diagram ramps (they follow
 * light and dark mode): unblocked purple, blocked gray, in flight blue, done
 * green. Needs answers is purple with a dashed border.
 */
const GRAPH_RAMP = { ready: "c-purple", noted: "c-purple", blocked: "c-gray", "in-flight": "c-blue", "in-review": "c-blue", done: "c-green" };
const GRAPH_LEGEND = [["ready", "Ready"], ["noted", "Needs answers"], ["blocked", "Blocked"], ["in-flight", "In flight or review"], ["done", "Done"]];
// Sized for the Claude UI's 680-wide diagrams: six cards to a row, small text
// wrapped so a card shows its whole title (about 16 characters a line).
const G = { width: 680, pad: 10, legend: 50, w: 97, gapX: 6, gapY: 22, inset: 6, boxGap: 10, chars: 15, line: 12 };
const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (x, n) => (x.length > n ? `${x.slice(0, n - 1)}…` : x);
/** A title broken into lines of about `n` characters, at spaces where it can. */
function wrap(x, n) {
  const lines = [];
  let rest = x.trim();
  while (rest.length > n) {
    // The last space that fits, else just after the last hyphen, else a hard cut.
    const space = rest.lastIndexOf(" ", n);
    const hyphen = rest.lastIndexOf("-", n - 1);
    const at = space > 0 ? space : hyphen > 0 ? hyphen + 1 : n;
    lines.push(rest.slice(0, at));
    rest = rest.slice(at).trim();
  }
  if (rest) lines.push(rest);
  return lines;
}
const cardH = (lines) => 20 + lines * G.line + 4;

/**
 * Tickets as cards and blocked-by as arrows. A feature's tasks sit in a shaded
 * box titled with the feature, laid out top-down by depth within it (a task
 * one row below its deepest blocker in the same feature), six cards to a row;
 * feature boxes are packed side by side where they fit. Tickets outside any
 * feature go in a box of their own at the end. Done tickets merged more than
 * `days` ago, and dropped ones, are left out. Returns an SVG string.
 */
async function graphSvg(days) {
  const b = await board();
  const now = Date.now();
  const shown = b.rows.filter((r) => {
    if (r.state === "dropped" || r.state === "hibernating") return false;
    if (r.state !== "done") return true;
    const at = Date.parse(String(r.since).replace(" ", "T"));
    return Number.isFinite(at) && now - at <= days * 86400000;
  });
  const byId = Object.fromEntries(shown.map((r) => [r.t.meta.id, r]));
  const deps = Object.fromEntries(shown.map((r) => [r.t.meta.id, r.t.meta.blocked_by.filter((x) => byId[x])]));
  const featureOf = (id) => byId[id].t.meta.feature ?? null;
  const lines = Object.fromEntries(shown.map((r) => [r.t.meta.id, wrap(r.t.meta.title, G.chars)]));
  const numberOf = Object.fromEntries(b.items.map((x) => [x.meta.id, x.number]));

  // Boxes: one per feature with tickets shown, in id order, then everything else.
  const groups = new Map();
  for (const r of shown) {
    const f = featureOf(r.t.meta.id) ?? "~";
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(r.t.meta.id);
  }
  const titles = Object.fromEntries(b.features.map((x) => [x.f.meta.id, x.f.meta.title]));
  const order = [...groups.keys()].sort((a, z) => (a === "~") - (z === "~") || numberOf[a] - numberOf[z]);

  const depth = {};
  const depthOf = (id, seen = new Set()) => {
    if (depth[id] !== undefined) return depth[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const inside = deps[id].filter((d) => featureOf(d) === featureOf(id));
    return (depth[id] = inside.length ? 1 + Math.max(...inside.map((d) => depthOf(d, seen))) : 0);
  };
  const stepX = G.w + G.gapX;
  /** A box's layout with rows wrapped at `cap` cards (six at most). */
  const layoutBox = (key, cap) => {
    const ids = groups.get(key);
    // Rows by depth; a row longer than the cap wraps onto the next.
    const byDepth = [];
    for (const id of ids) (byDepth[depthOf(id)] ??= []).push(id);
    const rows = [];
    const local = {};
    for (const row of byDepth.filter(Boolean)) {
      const avg = (id) => (deps[id].length ? deps[id].reduce((s, d) => s + (local[d]?.x ?? 0), 0) / deps[id].length : 0);
      row.sort((a, z) => avg(a) - avg(z) || numberOf[a] - numberOf[z]);
      for (let i = 0; i < row.length; i += cap) rows.push(row.slice(i, i + cap));
      rows.slice(-Math.ceil(row.length / cap)).forEach((r) => r.forEach((id, i) => (local[id] = { x: i * stepX })));
    }
    const cols = Math.max(...rows.map((r) => r.length));
    const w = cols * stepX - G.gapX + 2 * G.inset;
    const per = Math.floor((w - 2 * G.inset) / 6.8);
    const title = wrap(key === "~" ? "Not part of a feature" : `${key} · ${titles[key] ?? ""}`, per);
    if (title.length > 2) title.splice(1, title.length, clip(`${title[1]} ${title.slice(2).join(" ")}`, per));
    let y = 8 + title.length * 15 + 4;
    for (const row of rows) {
      const h = Math.max(...row.map((id) => cardH(lines[id].length)));
      for (const id of row) local[id].y = y;
      y += h + G.gapY;
    }
    return { key, cols, local, w, h: y - G.gapY + G.inset, title };
  };

  // Packing, the same for every box (features and the rest): try it at each
  // width from six cards down, put each where it sits highest (then furthest
  // left) beside or under the boxes already placed, and keep the width whose
  // bottom edge ends highest (the wider one on a tie).
  const pos = {};
  const placed = [];
  const top = G.pad + G.legend;
  const spot = (box) => {
    let best = null;
    for (const cx of [G.pad, ...placed.map((p) => p.x + p.w + G.boxGap)]) {
      if (cx + box.w > G.width - G.pad) continue;
      const under = placed.filter((p) => p.x < cx + box.w + G.boxGap && cx < p.x + p.w + G.boxGap);
      const cy = Math.max(top, ...under.map((p) => p.y + p.h + G.boxGap));
      if (!best || cy < best.y || (cy === best.y && cx < best.x)) best = { x: cx, y: cy };
    }
    return best ?? { x: G.pad, y: Math.max(top, ...placed.map((p) => p.y + p.h + G.boxGap)) };
  };
  for (const key of order) {
    let best = null;
    for (let cap = 6; cap >= 1; cap--) {
      const box = layoutBox(key, cap);
      if (best && box.cols === best.box.cols) continue;
      const at = spot(box);
      if (!best || at.y + box.h < best.at.y + best.box.h) best = { box, at };
    }
    const { box, at } = best;
    placed.push({ ...box, ...at });
    for (const [id, p] of Object.entries(box.local)) pos[id] = { x: at.x + G.inset + p.x, y: at.y + p.y };
  }
  const height = Math.max(top, ...placed.map((p) => p.y + p.h)) + G.pad;

  const counts = { ready: 0, noted: 0, blocked: 0, "in-flight": 0, done: 0 };
  for (const r of shown) counts[r.state === "in-review" ? "in-flight" : r.state] = (counts[r.state === "in-review" ? "in-flight" : r.state] ?? 0) + 1;
  const out = [];
  out.push(`<svg width="100%" viewBox="0 0 ${G.width} ${Math.ceil(height)}" role="img">`);
  out.push(`<title>Ticket dependencies</title><desc>${shown.length} tickets as cards coloured by state, grouped by feature, with arrows from each ticket to the ones it unblocks.</desc>`);
  out.push(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`);
  GRAPH_LEGEND.forEach(([st, label], i) => {
    const lx = G.pad + 4 + (i % 3) * 220;
    const ly = G.pad + Math.floor(i / 3) * 20;
    out.push(`<rect class="${GRAPH_RAMP[st]}" x="${lx}" y="${ly}" width="14" height="14" rx="3" stroke-width="0.5"${st === "noted" ? ' stroke-dasharray="3 2"' : ""}/>`);
    out.push(`<text class="ts" x="${lx + 20}" y="${ly + 11}">${esc(`${label} (${counts[st]})`)}</text>`);
  });
  out.push(`<text class="ts" x="${G.pad + 444}" y="${G.pad + 31}">Done: last ${days} day${days === 1 ? "" : "s"}</text>`);
  // Feature boxes, behind everything.
  for (const p of placed) {
    out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8" fill="var(--bg2)" stroke="var(--b)" stroke-width="0.5"/>`);
    p.title.forEach((line, i) => out.push(`<text class="th" x="${p.x + G.inset}" y="${p.y + 18 + i * 15}" style="font-size:12px">${esc(line)}</text>`));
  }
  for (const [id, ds] of Object.entries(deps))
    for (const d of ds) {
      const a = pos[d];
      const z = pos[id];
      const x1 = a.x + G.w / 2;
      const y1 = a.y + cardH(lines[d].length);
      const x2 = z.x + G.w / 2;
      const y2 = z.y - 2;
      const my = y2 > y1 ? (y1 + y2) / 2 : Math.max(y1, y2) + 10;
      out.push(`<path d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}" fill="none" stroke="#888780" stroke-width="1" marker-end="url(#arrow)"/>`);
    }
  for (const r of shown) {
    const id = r.t.meta.id;
    const { x, y } = pos[id];
    const extra = r.pr && r.state === "in-review" ? ` · PR #${r.pr.number}` : "";
    out.push(`<g class="${GRAPH_RAMP[r.state] ?? "c-purple"}"><title>${esc(`${id} ${r.t.meta.title} (${r.state}${r.waiting ? `; waits on ${r.waiting.join(", ")}` : ""})`)}</title>`);
    out.push(`<rect x="${x}" y="${y}" width="${G.w}" height="${cardH(lines[id].length)}" rx="4" stroke-width="0.5"${r.state === "noted" ? ' stroke-dasharray="4 3"' : ""}/>`);
    out.push(`<text class="th" x="${x + 6}" y="${y + 14}" style="font-size:11px">${esc(id)}<tspan class="ts" style="font-size:10px"> ${esc(`${r.t.meta.size || "?"}${extra}`)}</tspan></text>`);
    lines[id].forEach((line, i) => out.push(`<text class="ts" x="${x + 6}" y="${y + 28 + i * G.line}" style="font-size:10px">${esc(line)}</text>`));
    out.push("</g>");
  }
  out.push("</svg>");
  return out.join("\n");
}

// ---- writes -----------------------------------------------------------------

/** Add and remove labels on an issue. */
function relabel(t, add = [], remove = []) {
  const toAdd = add.filter((l) => !t.labels.has(l));
  if (toAdd.length) api("POST", `issues/${t.number}/labels`, { labels: toAdd });
  for (const l of remove) if (t.labels.has(l)) api("DELETE", `issues/${t.number}/labels/${encodeURIComponent(l)}`);
}

/** Open, close or relabel an item for a stored status. */
function setStatus(t, status) {
  const allowed = t.kind === "feature" ? FEATURE_STATUSES : STORED_STATUSES;
  if (!allowed.includes(status)) throw new Error(`status must be one of ${allowed.join(", ")}`);
  const closed = { done: "completed", dropped: "not_planned" }[status];
  const isClosed = ["done", "dropped"].includes(t.meta.status);
  if (closed) api("PATCH", `issues/${t.number}`, { state: "closed", state_reason: closed });
  else if (isClosed) api("PATCH", `issues/${t.number}`, { state: "open", state_reason: "reopened" });
  if (t.kind === "feature") {
    if (status === "draft") relabel(t, ["draft"], ["agreed"]);
    if (status === "agreed") relabel(t, ["agreed"], ["draft"]);
  } else if (status === "hibernating") relabel(t, ["hibernating"]);
  else relabel(t, [], ["hibernating"]);
}

/**
 * Blockers as given ("T-7,#41"): items become native blocked-by links; a #N
 * that isn't one of the board's issues is a PR, kept as a header line (and the
 * label blocked while it's open). Replaces what was there.
 */
function setBlockers(t, list, items, prs) {
  const issues = [];
  const prNums = [];
  for (const s of list) {
    const p = parseId(s);
    const it = p && ((p.old && items.find((x) => x.meta.id === p.old)) || (p.number && items.find((x) => x.number === p.number)));
    if (it) issues.push(it);
    else if (/^#\d+$/.test(s)) {
      // A PR from an item's branch stands for that item.
      const pr = prs.find((x) => x.number === Number(s.slice(1)));
      const owner = pr && branchItem(pr.headRefName, items);
      if (owner) issues.push(items.find((x) => x.meta.id === owner));
      else prNums.push(Number(s.slice(1)));
    } else throw new Error(`no ticket ${s} to be blocked by`);
  }
  const want = new Set(issues.map((x) => x.number));
  const byNumber = Object.fromEntries(items.map((x) => [x.number, x]));
  for (const b of t.meta.blocked_by.map((id) => items.find((x) => x.meta.id === id)).filter(Boolean))
    if (!want.has(b.number)) api("DELETE", `issues/${t.number}/dependencies/blocked_by/${b.databaseId}`);
  const have = new Set(t.meta.blocked_by.map((id) => items.find((x) => x.meta.id === id)?.number));
  for (const n of want) if (!have.has(n)) api("POST", `issues/${t.number}/dependencies/blocked_by`, { issue_id: byNumber[n].databaseId });
  const body = setHeaderLine(t.body, "Blocked by PR", prNums.length ? prNums.map((n) => `#${n}`).join(", ") : null);
  if (body !== t.body) api("PATCH", `issues/${t.number}`, { body });
  const open = prNums.some((n) => prs.find((x) => x.number === n)?.state !== "MERGED");
  if (open) relabel(t, ["blocked"]);
  else relabel(t, [], ["blocked"]);
}

/** Make the item a sub-issue of a feature, or with null take it out of its feature. */
function setFeature(t, feature, items) {
  if (feature) {
    if (feature.kind !== "feature") throw new Error(`${feature.meta.id} isn't a feature`);
    api("POST", `issues/${feature.number}/sub_issues`, { sub_issue_id: t.databaseId, replace_parent: true });
  } else if (t.meta.feature) {
    const parent = items.find((x) => x.meta.id === t.meta.feature);
    api("DELETE", `issues/${parent.number}/sub_issue`, { sub_issue_id: t.databaseId });
  }
}

/** A feature's Breakdown line n (1-based) ticked, pointing at the new task. */
function tickBreakdown(f, n, task) {
  const at = f.body.search(/^## Breakdown\n/m);
  if (at < 0) throw new Error(`${f.meta.id} has no ## Breakdown`);
  const end = f.body.slice(at + 1).search(/^## /m);
  const stop = end < 0 ? f.body.length : at + 1 + end;
  let seen = 0;
  const part = f.body.slice(at, stop).replace(/^- (?:\[[ x]\] )?(.*)$/gm, (line, text) => {
    if (++seen !== n) return line;
    return `- [x] ${text.replace(/\s*→\s*(T-\d+|#\d+).*$/, "")} → #${task.number}`;
  });
  if (seen < n) throw new Error(`${f.meta.id}'s Breakdown has ${plural(seen, "line")}, not ${n}`);
  api("PATCH", `issues/${f.number}`, { body: f.body.slice(0, at) + part + f.body.slice(stop) });
}

const readStdin = () => (process.stdin.isTTY ? "" : readFileSync(0, "utf8"));

// `--here` edited a checkout's own ticket files; with issues there's nothing to point it at.
const [cmd, ...args] = process.argv.slice(2).filter((a) => a !== "--here");
switch (cmd) {
  case "note": {
    let text = args.join(" ").trim();
    if (!text && !process.stdin.isTTY) text = readFileSync(0, "utf8").trim();
    if (!text) throw new Error("nothing to note");
    appendFileSync(INBOX, `${read(INBOX) ? "\n" : ""}## ${stamp()}\n${text}\n`);
    console.log(`Noted (${parseNotes(read(INBOX)).length} in the inbox).`);
    break;
  }
  case "inbox": {
    const waiting = [...parseNotes(read(INGESTING)), ...parseNotes(read(INBOX))];
    if (!waiting.length) console.log("The inbox is empty.");
    for (const n of waiting) console.log(`## ${n.id ? `${n.id} · ` : ""}${n.at}\n${n.body}\n`);
    break;
  }
  case "ingest-start": {
    // Resumes an interrupted ingest; otherwise takes the whole inbox. Renaming
    // the file first means a /note during ingestion lands in a fresh inbox.
    if (!existsSync(INGESTING)) {
      if (!parseNotes(read(INBOX)).length) {
        console.log("The inbox is empty.");
        break;
      }
      renameSync(INBOX, INGESTING);
      let n = Math.max(0, ...parseNotes(read(ARCHIVE)).map((x) => Number(x.id.replace(/\D/g, ""))));
      const notes = parseNotes(read(INGESTING)).map((x) => ({ ...x, id: `N-${String(++n).padStart(4, "0")}` }));
      const entries = notes.map((x) => `## ${x.id} · ${x.at}\n${x.body}\n`).join("\n");
      writeFileSync(INGESTING, entries);
      appendFileSync(
        ARCHIVE,
        `${read(ARCHIVE) ? "\n" : "# Notes archive\n\nEvery playtest note, verbatim, with the tickets it became.\n\n"}${entries}`,
      );
    } else console.log("(Resuming an ingest that didn't finish.)\n");
    console.log(read(INGESTING));
    console.log("New tickets and features get their numbers from `board.mjs new`.");
    break;
  }
  case "ingest-done": {
    const notes = parseNotes(read(INGESTING));
    const ids = new Set(notes.map((n) => n.id));
    const b = await board();
    const unlinked = [];
    // Rebuild the archive entry by entry, adding "→ tickets" under each note just ingested.
    const [preamble, ...entries] = read(ARCHIVE).split(/^(?=## )/m);
    const archive =
      preamble +
      entries
        .map((entry) => {
          const id = entry.match(/^## (N-\d+)/)?.[1];
          if (!ids.has(id) || /^→ /m.test(entry)) return entry;
          const into = b.items.filter((t) => t.meta.notes.includes(id)).map((t) => t.meta.id);
          if (!into.length) unlinked.push(id);
          return `${entry.replace(/\s*$/, "")}\n→ ${into.length ? into.join(", ") : "no ticket"}\n\n`;
        })
        .join("");
    writeFileSync(ARCHIVE, archive.replace(/\s*$/, "\n"));
    if (existsSync(INGESTING)) unlinkSync(INGESTING);
    writeBoard(b);
    console.log(`Ingested ${plural(notes.length, "note")}.${unlinked.length ? ` No ticket for: ${unlinked.join(", ")}.` : ""}`);
    break;
  }
  case "new": {
    const f = flags(args);
    const [kind, ...words] = f.rest;
    if (!["task", "feature"].includes(kind)) throw new Error("new needs a kind: task or feature");
    const title = words.join(" ").trim();
    if (!title) throw new Error("new needs a title");
    const sections = readStdin().trim();
    const areas = (f.area ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const a of areas) if (!AREAS.includes(a)) throw new Error(`area must be among ${AREAS.join(", ")}`);
    if (f.size && !SIZES.includes(f.size)) throw new Error(`size must be one of ${SIZES.join(", ")}`);
    const status = f.status ?? (kind === "feature" ? "draft" : null);
    if (kind === "feature" && !["draft", "agreed"].includes(status)) throw new Error("a new feature is draft or agreed");
    const head = [];
    if (f.notes) head.push(`> From notes ${f.notes.split(",").map((s) => s.trim()).join(", ")}`);
    if (f.touches) head.push(`**Touches:** ${f.touches.split(",").map((s) => `\`${s.trim()}\``).join(", ")}`);
    const body = `${head.length ? `${head.join("\n")}\n\n` : ""}${sections}\n`;
    const labels = [kind, ...(f.size ? [`size:${f.size}`] : []), ...areas.map((a) => `area:${a}`), ...(kind === "feature" ? [status] : [])];
    const made = api("POST", "issues", { title, body, labels });
    console.log(`#${made.number} ${made.html_url}`);
    if (f.feature || f["blocked-by"] || f.breakdown) {
      const b = await board();
      const t = findIn(b.items, `#${made.number}`);
      const feature = f.feature ? findIn(b.items, f.feature) : null;
      if (feature) setFeature(t, feature, b.items);
      if (f["blocked-by"]) setBlockers(t, f["blocked-by"].split(",").map((s) => s.trim()), b.items, b.gh.all);
      if (f.breakdown) {
        if (!feature) throw new Error("--breakdown needs --feature");
        tickBreakdown(feature, Number(f.breakdown), t);
      }
    }
    break;
  }
  case "log": {
    const f = flags(args);
    const [id, ...words] = f.rest;
    const b = await board();
    const t = findIn(b.items, id);
    if (f.status) setStatus(t, f.status);
    if (f.feature) setFeature(t, f.feature === "none" ? null : findIn(b.items, f.feature), b.items);
    if (f["blocked-by"]) setBlockers(t, f["blocked-by"] === "none" ? [] : f["blocked-by"].split(",").map((s) => s.trim()), b.items, b.gh.all);
    const text = words.join(" ").trim();
    if (text) api("POST", `issues/${t.number}/comments`, { body: text });
    console.log(`${t.meta.id}: ${stamp()} ${text}`.trimEnd());
    break;
  }
  case "body": {
    const b = await board();
    process.stdout.write(findIn(b.items, args[0]).body);
    break;
  }
  case "set-body": {
    const b = await board();
    const t = findIn(b.items, args[0]);
    const body = args[1] && args[1] !== "-" ? readFileSync(args[1], "utf8") : readStdin();
    if (!body.trim()) throw new Error("set-body needs the new body (a file, or stdin)");
    api("PATCH", `issues/${t.number}`, { body });
    console.log(`${t.meta.id}: body updated`);
    break;
  }
  case "menu":
    await menu();
    break;
  case "graph": {
    const d = args.find((a) => a.startsWith("--days="));
    const days = d ? Number(d.slice(7)) : 7;
    if (!Number.isFinite(days) || days < 0) throw new Error("--days takes a number of days (0 or more)");
    console.log(await graphSvg(days));
    break;
  }
  case "show": {
    const b = await board();
    const t = findIn(b.items, args[0]);
    let head;
    if (t.kind === "feature") {
      const fr = b.features.find((x) => x.f === t);
      const x = featureExtras(fr);
      head = `Live state: ${FEATURE_LABELS[fr.state]}${x.length ? ` (${x.join(" · ")})` : ""}`;
      for (const r of fr.tasks) head += `\n  ${r.t.meta.id}  ${(r.t.meta.size || "?").padEnd(2)}  ${r.t.meta.title}  · ${r.state}`;
    } else {
      const r = b.rows.find((x) => x.t === t);
      const x = extras(r);
      head = `Live state: ${r.state}${x.length ? ` (${x.join(" · ")})` : ""}`;
      if (t.meta.feature) head += `\nPart of ${t.meta.feature}; read it first: node scripts/board.mjs show ${t.meta.feature}`;
    }
    // The item as its file read: the fields, its sections, then its history (the comments).
    const m = t.meta;
    const fields = [
      ["id", m.id],
      ["issue", `#${t.number}`],
      ["title", m.title],
      ["status", m.status],
      ["size", m.size],
      ["area", m.area],
      ["feature", m.feature],
      ["plan", m.plan],
      ["branch", m.branch],
      ["touches", m.touches.length ? `[${m.touches.join(", ")}]` : null],
      ["blocked_by", m.blocked_by.length || m.blocked_prs.length ? `[${[...m.blocked_by, ...m.blocked_prs.map((n) => `#${n}`)].join(", ")}]` : null],
      ["notes", m.notes.length ? `[${m.notes.join(", ")}]` : null],
      ["created", m.created],
    ].filter(([, v]) => v);
    const comments = JSON.parse(gh(["api", "--paginate", `repos/${REPO}/issues/${t.number}/comments?per_page=100`, "--slurp"])).flat();
    const history = comments.flatMap((c) =>
      c.body.startsWith(HISTORY_MARK)
        ? c.body.split("\n").filter((l) => l.startsWith("- "))
        : [`- ${stamp(new Date(c.created_at))} ${c.body.trim().replace(/\n+/g, " ")}`],
    );
    const body = t.body.replace(/^>[^\n]*\n/, "").trim();
    console.log(`${t.url}\n${head}\n\n---\n${fields.map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n${body}\n\n## History\n${history.join("\n") || "- (none)"}`);
    break;
  }
  case "path":
    console.log(LOCAL);
    break;
  case "base": {
    const b = await board();
    const t = findIn(b.items, args[0]);
    const feature = t.kind === "task" && t.meta.feature ? findIn(b.items, t.meta.feature) : null;
    console.log(feature?.meta.branch || "main");
    break;
  }
  case "feature-branch": {
    const b = await board();
    const f = findIn(b.items, args[0] ?? "");
    if (f.kind !== "feature") throw new Error("feature-branch needs a feature id (F-004, f4 or #212)");
    if (f.meta.branch) {
      console.log(`${f.meta.id} is already on ${f.meta.branch}.`);
      break;
    }
    const slug = f.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").split("-").filter(Boolean).slice(0, 4).join("-");
    const name = f.meta.id.startsWith("#") ? f.meta.id.slice(1) : f.meta.id.toLowerCase();
    const branch = `feature/${name}${slug ? `-${slug}` : ""}`;
    sh("git fetch --quiet origin main");
    if (trySh(`git ls-remote --exit-code --heads origin "refs/heads/${branch}"`) === null)
      sh(`git push --quiet origin "origin/main:refs/heads/${branch}"`);
    api("PATCH", `issues/${f.number}`, { body: setHeaderLine(f.body, "Branch", `\`${branch}\``) });
    api("POST", `issues/${f.number}/comments`, { body: `built on ${branch}` });
    console.log(`${f.meta.id}: ${branch}, from origin/main.`);
    break;
  }
  case "sync": {
    // In a throwaway worktree, so no checkout (or the session in it) is disturbed.
    const b = await board();
    const f = findIn(b.items, args[0] ?? "");
    if (f.kind !== "feature") throw new Error("sync needs a feature id (F-004, f4 or #212)");
    const branch = f.meta.branch;
    if (!branch) throw new Error(`${f.meta.id} isn't built on a branch of its own`);
    sh(`git fetch --quiet origin main "${branch}"`);
    const behind = Number(sh(`git rev-list --count "origin/${branch}..origin/main"`));
    if (!behind) {
      console.log(`${branch} already has everything on main.`);
      break;
    }
    const dir = join(LOCAL, `sync-${f.meta.id.replace("#", "").toLowerCase()}`);
    if (existsSync(dir)) sh(`git worktree remove --force "${dir}"`);
    sh(`git worktree add --quiet --detach "${dir}" "origin/${branch}"`);
    try {
      const merged = trySh(`git -C "${dir}" merge --no-edit --quiet -m "chore: merge main into ${branch}" origin/main`);
      if (merged === null) {
        const conflicts = trySh(`git -C "${dir}" diff --name-only --diff-filter=U`) ?? "";
        trySh(`git -C "${dir}" merge --abort`);
        throw new Error(`merging main into ${branch} conflicts in: ${conflicts.split("\n").join(", ")}. Nothing was pushed.`);
      }
      sh(`git -C "${dir}" push --quiet origin "HEAD:refs/heads/${branch}"`);
      console.log(`Merged ${plural(behind, "commit")} from main into ${branch} and pushed it.`);
    } finally {
      trySh(`git worktree remove --force "${dir}"`);
    }
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n"));
}

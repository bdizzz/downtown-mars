// The playtest board. Notes go into a local inbox; /ingest turns them into
// tickets (or features); /build turns a ticket into a PR.
//
// Tickets live in docs/tickets/ (checked in, so any machine can build one) and
// store only what doesn't churn: the content, a coarse status (open, done,
// dropped) and a history. Live state is derived, never stored:
//   needs answers  unticked "- [ ]" lines under ## Open questions
//   blocked        a blocked_by ticket that isn't done (or PR that isn't merged),
//                  or a feature that's still a draft
//   in flight      a pushed t-0NN-… branch with no PR yet
//   in review      an open PR from a t-0NN-… branch
//   done           status: done, or a merged PR from a t-0NN-… branch
//
// Features (F-0NN-….md, the epics) hold the plan for a big item and its
// Breakdown into tasks; tickets name theirs with `feature: F-0NN`. A feature
// stores draft, agreed, done or dropped, and its tasks wait until it's agreed.
// Live: needs answers (a draft with open questions), plan in flight / in review
// (an f-0NN-… branch or PR), in progress (agreed, a task started), done (agreed,
// and every planned task ticketed and finished).
// A feature can be built on its own branch (`branch: feature/f-0NN-…` in its
// file, made by `feature-branch`): its tasks branch from it and their PRs merge
// into it, and it reaches main in one go at the end (a PR from it, merged with a
// merge commit). Its live state is then "ready to merge" once every task is
// finished, and done only when that PR is merged.
// The inbox and the generated BOARD.md are local, in .tracker/ (gitignored) in
// the main checkout, found from any worktree.
//
//   node scripts/board.mjs note <text>       add a note to the inbox (or text on stdin)
//   node scripts/board.mjs inbox             print notes waiting to be ingested
//   node scripts/board.mjs ingest-start      take the inbox, give each note an id, archive it verbatim
//   node scripts/board.mjs ingest-done       link each archived note to its tickets; clear the ingest file
//   node scripts/board.mjs next-id [F]       print the next free ticket id (F: feature id)
//   node scripts/board.mjs log <id> <text> [--status open|done|dropped] [--blocked-by T-7,#41|none] [--feature F-1|none]
//                                            append a timestamped history line (and set fields); a feature
//                                            takes --status draft|agreed|done|dropped
//   node scripts/board.mjs menu              print the board's short view; rewrite BOARD.md
//   node scripts/board.mjs show <id>         print one ticket or feature with its live state
//   node scripts/board.mjs graph [--days=7]  print the ticket dependency graph as SVG (done tickets shown for N days)
//   node scripts/board.mjs publish <message> commit docs/tickets/ alone on main and push it
//   node scripts/board.mjs base <id>         print the branch a ticket's PR goes into: its feature's branch, or main
//   node scripts/board.mjs feature-branch <F-id>
//                                            make the feature's branch from origin/main, push it, record it in the file
//   node scripts/board.mjs sync <F-id>       merge origin/main into the feature's branch and push it (stops on a conflict)
//   node scripts/board.mjs path              print the local tracker folder
// Ids can be shorthand anywhere: t6, T6, t-6 and 6 mean T-006; f1 means F-001.
// Everything works on the main checkout's tickets; add --here to edit this
// checkout's copy instead.

import { execSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

// Mistakes (a bad id, a wrong status) print one line, not a stack trace.
process.on("uncaughtException", (e) => {
  console.error(`board: ${e.message}`);
  process.exit(1);
});

const STORED_STATUSES = ["open", "done", "dropped"];
const FEATURE_STATUSES = ["draft", "agreed", "done", "dropped"];
const SIZES = ["S", "M", "L", "XL"];
const COLUMNS = [
  ["ready", "Ready"],
  ["noted", "Needs answers"],
  ["blocked", "Blocked"],
  ["in-flight", "In flight"],
  ["in-review", "In review"],
  ["done", "Done"],
];
/** Done tickets shown on BOARD.md; older ones drop off the view. */
const DONE_SHOWN = 15;
/** t-0NN-… builds a ticket; f-0NN-… writes a feature's plan. */
const BRANCH_RE = /^([tf])-(\d+)-/;
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

// Tickets, the archive and the local tracker all default to the main checkout,
// even when run from a worktree; `--here` points ticket edits at this checkout
// instead (a /build branch changing its own ticket).
const MAIN = dirname(resolve(sh("git rev-parse --git-common-dir")));
const HERE = process.argv.includes("--here");
const CHECKOUT = HERE ? sh("git rev-parse --show-toplevel") : MAIN;
const TICKETS = join(CHECKOUT, "docs", "tickets");
const ARCHIVE = join(TICKETS, "notes-archive.md");
const LOCAL = join(MAIN, ".tracker");
const INBOX = join(LOCAL, "inbox.md");
const INGESTING = join(LOCAL, "ingesting.md");
const BOARD = join(LOCAL, "BOARD.md");
mkdirSync(TICKETS, { recursive: true });
mkdirSync(LOCAL, { recursive: true });

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

// ---- tickets --------------------------------------------------------------

/** Tickets are markdown with a small frontmatter: `key: value`, lists as `[a, b]`. */
function parseTicket(file) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no frontmatter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].replace(/\s+#.*$/, "").trim();
    if (v.startsWith("[")) v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    meta[kv[1]] = v;
  }
  // Lists default to empty, but only fields the file had are written back
  // (features have no touches or blocked_by).
  const written = new Set(Object.keys(meta));
  for (const k of ["touches", "notes", "blocked_by"]) if (!Array.isArray(meta[k])) meta[k] = meta[k] ? [meta[k]] : [];
  return { file, meta, written, body: m[2] };
}

function writeTicket(t) {
  const order = ["id", "title", "status", "size", "area", "feature", "plan", "branch", "touches", "blocked_by", "notes", "created"];
  const keep = (k) => t.written.has(k) || !(Array.isArray(t.meta[k]) && !t.meta[k].length);
  const keys = [...order, ...Object.keys(t.meta).filter((k) => !order.includes(k))].filter((k) => k in t.meta && keep(k));
  const fm = keys
    .map((k) => {
      const v = t.meta[k];
      return `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : (v ?? "")}`.trimEnd();
    })
    .join("\n");
  writeFileSync(t.file, `---\n${fm}\n---\n${t.body}`);
}

const idNum = (id) => Number(String(id).replace(/\D/g, ""));
/** Ids in full or shorthand: T-006, t-6, t6, T6 and 6 are T-006; F-001, f1 and F1 are F-001. Null if it isn't one. */
function parseId(s) {
  const m = /^([tf])?-?0*(\d+)$/i.exec(String(s).trim());
  return m ? `${(m[1] ?? "T").toUpperCase()}-${m[2].padStart(3, "0")}` : null;
}
function normId(s) {
  const id = parseId(s);
  if (!id) throw new Error(`"${s}" isn't a ticket or feature id (T-006, t6 or 6; F-001 or f1)`);
  return id;
}
const isFeature = (s) => parseId(s)?.startsWith("F") ?? false;

function load(prefix) {
  return readdirSync(TICKETS)
    .filter((f) => new RegExp(`^${prefix}-\\d+.*\\.md$`).test(f))
    .map((f) => parseTicket(join(TICKETS, f)))
    .sort((a, b) => idNum(a.meta.id) - idNum(b.meta.id));
}
const loadTickets = () => load("T");
const loadFeatures = () => load("F");

/** A ticket or a feature, by id. */
function findItem(id) {
  const kind = isFeature(id) ? "feature" : "ticket";
  const t = (isFeature(id) ? loadFeatures() : loadTickets()).find((x) => x.meta.id === normId(id));
  if (!t) throw new Error(`no ${kind} ${normId(id)} in ${TICKETS}`);
  return t;
}

/** The text of one "## <name>" section of a ticket or feature. */
const section = (t, name) => t.body.split(/^(?=## )/m).find((s) => s.startsWith(`## ${name}\n`))?.slice(name.length + 4) ?? "";
const openQuestions = (t) => (section(t, "Open questions").match(/^- \[ \]/gm) ?? []).length;
/** A feature's planned tasks: the top-level "- " lines under ## Breakdown, with the ticket each became ("→ T-0NN"). */
const breakdown = (f) =>
  section(f, "Breakdown")
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => ({ line: l.slice(2), ticket: l.match(/→\s*(T-\d+)/)?.[1] ?? null }));
/** The last "- <stamp> …" line under ## History, for "how long in this state". */
const lastHistory = (t) => [...t.body.matchAll(/^- (\d{4}-\d\d-\d\d \d\d:\d\d)/gm)].pop()?.[1] ?? t.meta.created;

// ---- GitHub ---------------------------------------------------------------

/** The ticket or feature a t-0NN-… or f-0NN-… branch belongs to. */
const branchId = (name) => {
  const m = name?.match(BRANCH_RE);
  return m ? normId(`${m[1]}-${m[2]}`) : null;
};

/** PRs and pushed branches named t-0NN-… or f-0NN-…, by id (T-012, F-001). Empty if GitHub can't be reached. */
function github() {
  const prs = {};
  const branches = {};
  const list = trySh("gh pr list --state all --limit 300 --json number,state,headRefName,baseRefName,createdAt,mergedAt,url");
  const all = list ? JSON.parse(list) : [];
  for (const pr of all) {
    const id = branchId(pr.headRefName);
    if (!id) continue;
    // Keep the most telling PR per item: open beats merged beats closed.
    const rank = { OPEN: 3, MERGED: 2, CLOSED: 1 };
    if (!prs[id] || rank[pr.state] > rank[prs[id].state]) prs[id] = pr;
  }
  for (const line of (trySh("git ls-remote --heads origin 't-*' 'f-*'") ?? "").split("\n")) {
    const name = line.split("refs/heads/")[1];
    const id = branchId(name);
    if (id) branches[id] = name;
  }
  return { prs, branches, all, online: list !== null };
}

/** The PR that takes a feature's own branch into main: open beats merged beats closed. */
function branchPr(gh, branch) {
  const mine = gh.all.filter((p) => p.headRefName === branch && p.baseRefName === "main");
  return mine.find((p) => p.state === "OPEN") ?? mine.find((p) => p.state === "MERGED") ?? mine[0] ?? null;
}

/** The ticket's live state, from the file, its feature and GitHub. */
function liveState(t, gh, byId) {
  const id = t.meta.id;
  const pr = gh.prs[id];
  if (t.meta.status === "dropped") return { state: "dropped", since: lastHistory(t) };
  if (t.meta.status === "done" || pr?.state === "MERGED")
    return { state: "done", since: pr?.mergedAt ?? lastHistory(t), pr };
  if (pr?.state === "OPEN") return { state: "in-review", since: pr.createdAt, pr };
  if (gh.branches[id]) return { state: "in-flight", since: lastHistory(t), branch: gh.branches[id] };
  const waiting = t.meta.blocked_by.filter((b) => {
    if (/^#?\d+$/.test(b)) {
      const pr = Object.values(gh.prs).find((p) => p.number === Number(b.replace("#", "")));
      return pr?.state !== "MERGED";
    }
    const other = byId[parseId(b)];
    return !other || liveState(other, gh, byId).state !== "done";
  });
  // A feature's tasks wait until it's agreed. Only its stored status counts
  // here, so the feature's live state can depend on its tasks' without a loop.
  const feature = t.meta.feature && byId[normId(t.meta.feature)];
  if (feature?.meta.status === "draft") waiting.push(`${feature.meta.id} (draft)`);
  if (waiting.length) return { state: "blocked", since: lastHistory(t), waiting };
  if (openQuestions(t)) return { state: "noted", since: lastHistory(t) };
  return { state: "ready", since: lastHistory(t) };
}

/** A feature's live state, from the file, its tasks' states and GitHub. */
function featureState(f, gh, rows) {
  const id = f.meta.id;
  const tasks = rows.filter((r) => r.t.meta.feature && normId(r.t.meta.feature) === id);
  const planned = breakdown(f);
  const unticketed = planned.filter((p) => !p.ticket || !tasks.some((r) => r.t.meta.id === normId(p.ticket))).length;
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
  // A merged plan PR leaves the feature where its file says (draft until Bryon agrees it).
  if (gh.branches[id] && pr?.state !== "MERGED") return { ...out, state: "in-flight", branch: gh.branches[id] };
  if (f.meta.status === "agreed") {
    const started = tasks.some((r) => ["in-flight", "in-review", "done"].includes(r.state));
    return { ...out, state: started ? "in-progress" : "agreed" };
  }
  return { ...out, state: openQuestions(f) ? "noted" : "draft" };
}

function board() {
  const gh = github();
  const tickets = loadTickets();
  const features = loadFeatures();
  const byId = Object.fromEntries([...tickets, ...features].map((t) => [t.meta.id, t]));
  const rows = tickets.map((t) => ({ t, ...liveState(t, gh, byId) }));
  return { gh, rows, features: features.map((f) => ({ f, ...featureState(f, gh, rows) })) };
}

// ---- views ----------------------------------------------------------------

function extras(r) {
  const out = [];
  const feature = r.t.meta.feature && normId(r.t.meta.feature);
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
  let out = `# Board\n\nGenerated ${stamp()} by \`node scripts/board.mjs menu\` from \`docs/tickets/\` and GitHub. Don't edit.\n\n`;
  if (!gh.online) out += "**GitHub unreachable: in flight, in review and merged states may be missing.**\n\n";
  if (pendingNotes()) out += `**${plural(pendingNotes(), "note")} waiting in the inbox.** Run /ingest.\n\n`;
  const link = (t) => `[${t.meta.id}](${CHECKOUT}/docs/tickets/${t.file.split("/").pop()})`;
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

function menu() {
  const b = board();
  writeBoard(b);
  const lines = [];
  if (!b.gh.online) lines.push("(GitHub unreachable: in flight, in review and merged states may be missing.)", "");
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
 * Tickets as cards and blocked_by as arrows. A feature's tasks sit in a shaded
 * box titled with the feature, laid out top-down by depth within it (a task
 * one row below its deepest blocker in the same feature), six cards to a row;
 * feature boxes are packed side by side where they fit. Tickets outside any
 * feature go in a box of their own at the end. Done tickets merged more than
 * `days` ago, and dropped ones, are left out. Returns an SVG string.
 */
function graphSvg(days) {
  const b = board();
  const now = Date.now();
  const shown = b.rows.filter((r) => {
    if (r.state === "dropped") return false;
    if (r.state !== "done") return true;
    const at = Date.parse(String(r.since).replace(" ", "T"));
    return Number.isFinite(at) && now - at <= days * 86400000;
  });
  const byId = Object.fromEntries(shown.map((r) => [r.t.meta.id, r]));
  const deps = Object.fromEntries(
    shown.map((r) => [r.t.meta.id, r.t.meta.blocked_by.filter((x) => !/^#?\d+$/.test(x)).map(parseId).filter((x) => byId[x])]),
  );
  const featureOf = (id) => (byId[id].t.meta.feature ? normId(byId[id].t.meta.feature) : null);
  const lines = Object.fromEntries(shown.map((r) => [r.t.meta.id, wrap(r.t.meta.title, G.chars)]));

  // Boxes: one per feature with tickets shown, in id order, then everything else.
  const groups = new Map();
  for (const r of shown) {
    const f = featureOf(r.t.meta.id) ?? "~";
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(r.t.meta.id);
  }
  const titles = Object.fromEntries(b.features.map((x) => [x.f.meta.id, x.f.meta.title]));
  const order = [...groups.keys()].sort((a, z) => (a === "~") - (z === "~") || idNum(a) - idNum(z));

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
      row.sort((a, z) => avg(a) - avg(z) || idNum(a) - idNum(z));
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

function nextId(prefix = "T") {
  const n = (prefix === "F" ? loadFeatures() : loadTickets()).reduce((max, t) => Math.max(max, idNum(t.meta.id)), 0);
  return normId(`${prefix}-${n + 1}`);
}

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
      let n = Math.max(0, ...parseNotes(read(ARCHIVE)).map((x) => idNum(x.id)));
      const notes = parseNotes(read(INGESTING)).map((x) => ({ ...x, id: `N-${String(++n).padStart(4, "0")}` }));
      const entries = notes.map((x) => `## ${x.id} · ${x.at}\n${x.body}\n`).join("\n");
      writeFileSync(INGESTING, entries);
      appendFileSync(
        ARCHIVE,
        `${read(ARCHIVE) ? "\n" : "# Notes archive\n\nEvery playtest note, verbatim, with the tickets it became.\n\n"}${entries}`,
      );
    } else console.log("(Resuming an ingest that didn't finish.)\n");
    console.log(read(INGESTING));
    console.log(`Next free ids: ticket ${nextId()}, feature ${nextId("F")}`);
    break;
  }
  case "ingest-done": {
    const notes = parseNotes(read(INGESTING));
    const ids = new Set(notes.map((n) => n.id));
    const tickets = [...loadTickets(), ...loadFeatures()];
    const unlinked = [];
    // Rebuild the archive entry by entry, adding "→ tickets" under each note just ingested.
    const [preamble, ...entries] = read(ARCHIVE).split(/^(?=## )/m);
    const archive =
      preamble +
      entries
        .map((entry) => {
          const id = entry.match(/^## (N-\d+)/)?.[1];
          if (!ids.has(id) || /^→ /m.test(entry)) return entry;
          const into = tickets.filter((t) => t.meta.notes.includes(id)).map((t) => t.meta.id);
          if (!into.length) unlinked.push(id);
          return `${entry.replace(/\s*$/, "")}\n→ ${into.length ? into.join(", ") : "no ticket"}\n\n`;
        })
        .join("");
    writeFileSync(ARCHIVE, archive.replace(/\s*$/, "\n"));
    if (existsSync(INGESTING)) unlinkSync(INGESTING);
    writeBoard(board());
    console.log(`Ingested ${plural(notes.length, "note")}.${unlinked.length ? ` No ticket for: ${unlinked.join(", ")}.` : ""}`);
    break;
  }
  case "next-id":
    console.log(nextId(/^f/i.test(args[0] ?? "") ? "F" : "T"));
    break;
  case "log": {
    const f = flags(args);
    const [id, ...words] = f.rest;
    const t = findItem(id);
    if (f.status) {
      const allowed = isFeature(id) ? FEATURE_STATUSES : STORED_STATUSES;
      if (!allowed.includes(f.status)) throw new Error(`status must be one of ${allowed.join(", ")}`);
      t.meta.status = f.status;
    }
    if (f.feature === "none") delete t.meta.feature;
    else if (f.feature) t.meta.feature = normId(`F-${idNum(f.feature)}`);
    // "#41" is a PR; anything else is a ticket id, shorthand allowed (t7 → T-007).
    const blocker = (s) => (s.startsWith("#") ? s : normId(s));
    if (f["blocked-by"])
      t.meta.blocked_by = f["blocked-by"] === "none" ? [] : f["blocked-by"].split(",").map((s) => blocker(s.trim()));
    const line = `- ${stamp()} ${words.join(" ")}`.trimEnd();
    t.body = /^## History\s*$/m.test(t.body)
      ? t.body.replace(/\s*$/, `\n${line}\n`)
      : `${t.body.replace(/\s*$/, "")}\n\n## History\n${line}\n`;
    writeTicket(t);
    console.log(`${t.meta.id}: ${line.slice(2)}`);
    break;
  }
  case "menu":
    menu();
    break;
  case "graph": {
    const d = args.find((a) => a.startsWith("--days="));
    const days = d ? Number(d.slice(7)) : 7;
    if (!Number.isFinite(days) || days < 0) throw new Error("--days takes a number of days (0 or more)");
    console.log(graphSvg(days));
    break;
  }
  case "show": {
    const t = findItem(args[0]);
    const b = board();
    let head;
    if (isFeature(t.meta.id)) {
      const fr = b.features.find((x) => x.f.meta.id === t.meta.id);
      const x = featureExtras(fr);
      head = `Live state: ${FEATURE_LABELS[fr.state]}${x.length ? ` (${x.join(" · ")})` : ""}`;
      for (const r of fr.tasks) head += `\n  ${r.t.meta.id}  ${(r.t.meta.size || "?").padEnd(2)}  ${r.t.meta.title}  · ${r.state}`;
    } else {
      const r = b.rows.find((x) => x.t.meta.id === t.meta.id);
      const x = extras(r);
      head = `Live state: ${r.state}${x.length ? ` (${x.join(" · ")})` : ""}`;
      const feature = t.meta.feature && normId(t.meta.feature);
      if (feature) head += `\nPart of ${feature}; read it first: node scripts/board.mjs show ${feature}`;
    }
    console.log(`${t.file}\n${head}\n\n${readFileSync(t.file, "utf8")}`);
    break;
  }
  case "publish": {
    // Ticket-only commits go straight to main so other machines see them;
    // only docs/tickets/ is committed, whatever else is staged or changed.
    const message = args.join(" ").trim();
    if (!message) throw new Error("publish needs a commit message");
    const git = (c) => sh(`git -C "${MAIN}" ${c}`);
    if (git("branch --show-current") !== "main") throw new Error(`the main checkout (${MAIN}) isn't on main`);
    if (!git("status --porcelain -- docs/tickets")) {
      console.log("No ticket changes to publish.");
      break;
    }
    git("fetch --quiet origin main");
    if (git("rev-list --count origin/main..HEAD") !== "0")
      throw new Error("main has local commits that aren't on GitHub; push or sort those out first");
    if (git("rev-list --count HEAD..origin/main") !== "0") git("merge --ff-only --quiet origin/main");
    git("add -- docs/tickets");
    execSync(`git -C "${MAIN}" commit --quiet -F - -- docs/tickets`, { input: message });
    git("push --quiet origin main");
    console.log(`Published: ${git("log --oneline -1")}`);
    break;
  }
  case "path":
    console.log(LOCAL);
    break;
  case "base": {
    const t = findItem(args[0]);
    const feature = !isFeature(t.meta.id) && t.meta.feature ? findItem(t.meta.feature) : null;
    console.log(feature?.meta.branch || "main");
    break;
  }
  case "feature-branch": {
    if (!isFeature(args[0] ?? "")) throw new Error("feature-branch needs a feature id (F-004 or f4)");
    const f = findItem(args[0]);
    if (f.meta.branch) {
      console.log(`${f.meta.id} is already on ${f.meta.branch}.`);
      break;
    }
    const slug = f.file.split("/").pop().replace(/^F-\d+-?/, "").replace(/\.md$/, "");
    const branch = `feature/${f.meta.id.toLowerCase()}${slug ? `-${slug}` : ""}`;
    sh("git fetch --quiet origin main");
    if (trySh(`git ls-remote --exit-code --heads origin "refs/heads/${branch}"`) === null)
      sh(`git push --quiet origin "origin/main:refs/heads/${branch}"`);
    f.meta.branch = branch;
    f.written.add("branch");
    f.body = f.body.replace(/\s*$/, `\n- ${stamp()} built on ${branch}\n`);
    writeTicket(f);
    console.log(`${f.meta.id}: ${branch}, from origin/main. Publish the feature file so every machine sees it.`);
    break;
  }
  case "sync": {
    // In a throwaway worktree, so no checkout (or the session in it) is disturbed.
    if (!isFeature(args[0] ?? "")) throw new Error("sync needs a feature id (F-004 or f4)");
    const f = findItem(args[0]);
    const branch = f.meta.branch;
    if (!branch) throw new Error(`${f.meta.id} isn't built on a branch of its own`);
    sh(`git fetch --quiet origin main "${branch}"`);
    const behind = Number(sh(`git rev-list --count "origin/${branch}..origin/main"`));
    if (!behind) {
      console.log(`${branch} already has everything on main.`);
      break;
    }
    const dir = join(LOCAL, `sync-${f.meta.id.toLowerCase()}`);
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

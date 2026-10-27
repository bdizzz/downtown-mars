// Copies the board in docs/tickets/ to GitHub Issues (F-020, T-186): every
// ticket and feature becomes an issue with its state, labels, parent feature,
// blockers and history.
//
//   node scripts/migrate-issues.mjs                  dry run: print what it would do
//   node scripts/migrate-issues.mjs --apply          do it
//   node scripts/migrate-issues.mjs --only T-186,F-020 [--apply]
//                                                    just these items (a pilot run)
//   node scripts/migrate-issues.mjs --show T-180     print one item's issue as it would be made
//
// Idempotent: an item is found by the id at the front of its title
// ("T-080 · The tutorial's office step …"), so a second run only updates what
// changed in the files since (bodies, labels, open or closed, parent, blockers,
// the history comment). The files win while main still runs on them.
//
// How a file maps (F-020's Design has the table):
//   T-0NN, open            an open issue labeled task
//   done / dropped         closed as completed / not planned (done also when a
//                          PR from its t-0NN-… branch, or naming it, has merged)
//   hibernating            open, label hibernating
//   F-0NN draft / agreed   label feature plus draft or agreed; closed when done
//   feature: F-0NN         a sub-issue of that feature
//   blocked_by             native blocked-by links; a PR (#41) counts as the
//                          ticket its branch belongs to, else a header line and,
//                          until it merges, label blocked
//   size, area             labels size:M, area:sim …
//   ## History             the first comment, marked so reruns can edit it
// The body keeps the file's own sections under a short header (where it came
// from, when it was opened, touches, plan, branch, shipped in); a feature's
// Breakdown lines become a checklist, ticked once a ticket exists for them.
// Writes are paced a second apart and wait out GitHub's rate limits. The map
// from old ids to issue numbers is written to docs/ticket-ids.json.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

process.on("uncaughtException", (e) => {
  console.error(`migrate: ${e.message}`);
  process.exit(1);
});

const APPLY = process.argv.includes("--apply");
const onlyArg = process.argv[process.argv.indexOf("--only") + 1];
const ONLY = process.argv.includes("--only") ? new Set(onlyArg.split(",").map((s) => s.trim().toUpperCase())) : null;

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const TICKETS = join(ROOT, "docs", "tickets");
const IDS_FILE = join(ROOT, "docs", "ticket-ids.json");
const REPO = execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { encoding: "utf8" }).trim();
const [OWNER, NAME] = REPO.split("/");

/** A second between writes keeps well under GitHub's limits on creating content. */
const PACE_MS = 1000;
const HISTORY_MARK = "<!-- migrated: history -->";
const AREAS = ["sim", "data", "ui", "render3d", "render2d", "godot", "bridge", "audio", "docs", "balance", "events", "rooms", "tickets", "devtools"];
const SIZES = ["S", "M", "L", "XL"];
const LABELS = {
  task: ["1d76db", "A ticket: one PR's worth of work"],
  feature: ["5319e7", "A big item: a plan and its tasks (sub-issues)"],
  draft: ["fbca04", "A feature whose plan isn't agreed yet"],
  agreed: ["0e8a16", "A feature Bryon has agreed; its tasks can be built"],
  hibernating: ["c5def5", "Set aside for now, not given up"],
  blocked: ["b60205", "Waits on a PR that has no issue of its own"],
  note: ["fef2c0", "A playtest note waiting for /ingest"],
  ...Object.fromEntries(SIZES.map((s) => [`size:${s}`, ["ededed", `Size ${s}`]])),
  ...Object.fromEntries(AREAS.map((a) => [`area:${a}`, ["d4c5f9", `Area: ${a}`]])),
};
/** Labels this script owns; any others on an issue are left alone. */
const managed = (name) => name in LABELS && name !== "note";

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let writes = 0;

// ---- GitHub ---------------------------------------------------------------

function gh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 << 20 });
}

/** One write through the REST API, paced, retried when GitHub asks us to slow down. */
function write(method, path, body) {
  writes++;
  if (!APPLY) return null;
  for (let attempt = 0; ; attempt++) {
    sleep(PACE_MS);
    try {
      const out = gh(["api", "-X", method, path, ...(body ? ["--input", "-"] : [])], body ? JSON.stringify(body) : undefined);
      return out.trim() ? JSON.parse(out) : null;
    } catch (e) {
      const msg = `${e.stderr ?? ""}${e.stdout ?? ""}`;
      if (attempt < 6 && /rate limit|abuse|secondary|HTTP 403|HTTP 429|HTTP 502|HTTP 503/i.test(msg)) {
        const wait = 60 * (attempt + 1);
        console.log(`  … GitHub says slow down; waiting ${wait}s`);
        sleep(wait * 1000);
        continue;
      }
      throw new Error(`${method} ${path}: ${msg.trim()}`);
    }
  }
}

/** Every issue on the repo with what a rerun compares against. */
function existingIssues() {
  const query = `query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){issues(first:100,after:$after,states:[OPEN,CLOSED]){pageInfo{hasNextPage endCursor} nodes{number databaseId title body state stateReason labels(first:30){nodes{name}} parent{number} blockedBy(first:50){nodes{number databaseId}} comments(first:10){nodes{databaseId body}}}}}}`;
  const out = [];
  let after = null;
  do {
    const args = ["api", "graphql", "-f", `query=${query}`, "-F", `owner=${OWNER}`, "-F", `name=${NAME}`];
    if (after) args.push("-F", `after=${after}`);
    const page = JSON.parse(gh(args)).data.repository.issues;
    out.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return out;
}

/** Merged PRs, for "Shipped in #N" and for PR blockers. */
function pullRequests() {
  return JSON.parse(gh(["pr", "list", "--state", "all", "--limit", "1000", "--json", "number,state,title,headRefName,mergedAt"]));
}

// ---- tickets (parsed as board.mjs does) -----------------------------------

function parseTicket(file) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no frontmatter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].replace(/\s+#.*$/, "").trim();
    if (/^"[\s\S]*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"');
    if (v.startsWith("[")) v = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    meta[kv[1]] = v;
  }
  for (const k of ["touches", "notes", "blocked_by"]) if (!Array.isArray(meta[k])) meta[k] = meta[k] ? [meta[k]] : [];
  return { file: file.slice(ROOT.length + 1), meta, body: m[2] };
}

const idNum = (id) => Number(String(id).replace(/\D/g, ""));
const normId = (s) => {
  const m = /^([tf])?-?0*(\d+)$/i.exec(String(s).trim());
  if (!m) throw new Error(`"${s}" isn't a ticket or feature id`);
  return `${(m[1] ?? "T").toUpperCase()}-${m[2].padStart(3, "0")}`;
};
const load = (prefix) =>
  readdirSync(TICKETS)
    .filter((f) => new RegExp(`^${prefix}-\\d+.*\\.md$`).test(f))
    .map((f) => parseTicket(join(TICKETS, f)))
    .sort((a, b) => idNum(a.meta.id) - idNum(b.meta.id));

/** The body split into its "## History" lines and everything else. */
function splitHistory(body) {
  const parts = body.split(/^(?=## )/m);
  const history = parts.find((s) => s.startsWith("## History\n"));
  return {
    rest: parts.filter((s) => s !== history).join("").trim(),
    history: history ? history.slice("## History\n".length).trim() : "",
  };
}

// ---- what each item should look like --------------------------------------

/** Tickets a PR shipped: its t-0NN-… branch, plus any ids its title names ("(T-104, T-101)"). */
function shippedIds(pr) {
  const ids = new Set();
  const b = pr.headRefName.match(/^t-(\d+)-/);
  if (b) ids.add(normId(`T-${b[1]}`));
  for (const m of pr.title.matchAll(/\bT-(\d{3})\b/g)) ids.add(`T-${m[1]}`);
  return ids;
}

function plan(tickets, features, prs) {
  const merged = prs.filter((p) => p.state === "MERGED");
  const shippedIn = {};
  for (const pr of merged.sort((a, b) => a.number - b.number))
    for (const id of shippedIds(pr)) (shippedIn[id] ??= []).push(pr.number);
  const branchPr = (head) => merged.find((p) => p.headRefName === head);
  /** Tickets whose own t-0NN-… branch has merged: done, as board.mjs sees it. */
  const branchMerged = new Set(merged.map((p) => p.headRefName.match(/^t-(\d+)-/)?.[1]).filter(Boolean).map((n) => normId(`T-${n}`)));

  const items = [];
  for (const t of tickets) {
    const m = t.meta;
    const done = m.status === "done" || (m.status === "open" && branchMerged.has(m.id));
    const blockers = [];
    const prBlockers = [];
    for (const b of m.blocked_by) {
      if (/^#?\d+$/.test(b)) {
        const n = Number(b.replace("#", ""));
        const pr = prs.find((p) => p.number === n);
        const owner = pr?.headRefName.match(/^t-(\d+)-/);
        if (owner) blockers.push(normId(`T-${owner[1]}`));
        else prBlockers.push({ n, merged: pr?.state === "MERGED" });
      } else blockers.push(normId(b));
    }
    const areas = String(m.area ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const labels = ["task", ...(SIZES.includes(m.size) ? [`size:${m.size}`] : []), ...areas.filter((a) => AREAS.includes(a)).map((a) => `area:${a}`)];
    if (m.status === "hibernating") labels.push("hibernating");
    if (prBlockers.some((p) => !p.merged) && !done && m.status !== "dropped") labels.push("blocked");
    items.push({
      id: m.id,
      t,
      title: `${m.id} · ${m.title}`,
      labels,
      closed: m.status === "dropped" ? "not_planned" : done ? "completed" : null,
      parent: m.feature ? normId(m.feature) : null,
      blockers,
      prBlockers: prBlockers.map((p) => p.n),
      shipped: shippedIn[m.id] ?? [],
      ...splitHistory(t.body),
    });
  }
  for (const f of features) {
    const m = f.meta;
    const tasks = items.filter((x) => x.parent === m.id);
    const lines = breakdownLines(f.body);
    const ticketed = lines.every((l) => l.ticket && tasks.some((x) => x.id === l.ticket));
    const intoMain = m.branch ? !!branchPr(m.branch) : true;
    // Done as board.mjs sees it: stored done, or agreed with every planned task finished (and its branch merged).
    const allFinished = m.status === "agreed" && tasks.length && ticketed && tasks.every((x) => x.closed) && intoMain;
    const labels = ["feature", ...(["draft", "agreed"].includes(m.status) ? [m.status] : [])];
    items.unshift({
      id: m.id,
      t: f,
      title: `${m.id} · ${m.title}`,
      labels,
      closed: m.status === "dropped" ? "not_planned" : m.status === "done" || allFinished ? "completed" : null,
      parent: null,
      blockers: [],
      prBlockers: [],
      shipped: m.branch ? [branchPr(m.branch)?.number].filter(Boolean) : [],
      ...splitHistory(f.body),
    });
  }
  return items.sort((a, b) => (a.id[0] === b.id[0] ? idNum(a.id) - idNum(b.id) : a.id[0] === "F" ? -1 : 1));
}

const breakdownLines = (body) => {
  const s = body.split(/^(?=## )/m).find((x) => x.startsWith("## Breakdown\n")) ?? "";
  return s
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => ({ line: l, ticket: l.match(/→\s*(T-\d+)/)?.[1] ?? null }));
};

/** The issue body: a short header, then the file's own sections (a feature's Breakdown as a checklist). */
function render(item, numbers) {
  const m = item.t.meta;
  const head = [`> From \`${item.t.file}\` · opened ${m.created}${m.notes.length ? ` · notes ${m.notes.join(", ")}` : ""}`];
  if (m.touches.length) head.push(`**Touches:** ${m.touches.map((x) => `\`${x}\``).join(", ")}`);
  if (m.plan) head.push(`**Plan:** \`${m.plan}\``);
  if (m.branch) head.push(`**Branch:** \`${m.branch}\``);
  if (item.prBlockers.length) head.push(`**Blocked by PR:** ${item.prBlockers.map((n) => `#${n}`).join(", ")}`);
  if (item.shipped.length) head.push(`**Shipped in:** ${item.shipped.map((n) => `#${n}`).join(", ")}`);
  let rest = item.rest;
  if (item.id.startsWith("F")) {
    rest = rest.replace(/^(## Breakdown\n)([\s\S]*?)(?=^## |(?![\s\S]))/m, (_, h, s) =>
      h +
      s.replace(/^- (.*)$/gm, (line, text) => {
        const ticket = text.match(/→\s*(T-\d+)/)?.[1];
        const n = ticket && numbers[ticket];
        return `- [${ticket ? "x" : " "}] ${text}${n ? ` (#${n})` : ""}`;
      }),
    );
  }
  return `${head.join("\n")}\n\n${rest}\n`;
}

const renderHistory = (item) =>
  `${HISTORY_MARK}\n**History** (from \`${item.t.file}\`)\n\n${item.history || "- (none)"}\n`;

// ---- run --------------------------------------------------------------------

const TITLE_ID = /^([TF]-\d{3}) · /;
const prs = pullRequests();
let items = plan(load("T"), load("F"), prs);
const ids = new Set(items.map((x) => x.id));
if (ONLY) {
  for (const id of ONLY) if (!ids.has(id)) throw new Error(`no ${id} in docs/tickets/`);
  items = items.filter((x) => ONLY.has(x.id));
}
if (process.argv.includes("--show")) {
  const id = normId(process.argv[process.argv.indexOf("--show") + 1]);
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error(`no ${id} in docs/tickets/`);
  const { t, rest, history, ...fields } = item;
  console.log(`${JSON.stringify(fields)}\n\n${render(item, {})}\n---- first comment ----\n${renderHistory(item)}`);
  process.exit(0);
}
const existing = new Map();
for (const issue of existingIssues()) {
  const id = issue.title.match(TITLE_ID)?.[1];
  if (id) existing.set(id, issue);
}
/** Old id → issue number and database id, filled as issues are found or made. */
const numbers = Object.fromEntries([...existing].map(([id, i]) => [id, i.number]));
const dbIds = Object.fromEntries([...existing].map(([id, i]) => [id, i.databaseId]));
const log = (s) => console.log(`${APPLY ? "" : "(dry run) "}${s}`);
const ref = (id) => (numbers[id] ? `${id} (#${numbers[id]})` : id);

// Labels.
const haveLabels = new Set(JSON.parse(gh(["label", "list", "--limit", "200", "--json", "name"])).map((l) => l.name));
for (const [name, [color, description]] of Object.entries(LABELS)) {
  if (haveLabels.has(name)) continue;
  log(`label ${name}`);
  write("POST", `repos/${REPO}/labels`, { name, color, description });
}

// Issues: create what's missing, then bring every body, title, label set and state in line.
for (const item of items) {
  if (existing.has(item.id)) continue;
  log(`create ${item.title}`);
  const made = write("POST", `repos/${REPO}/issues`, { title: item.title, body: render(item, numbers), labels: item.labels });
  if (made) {
    numbers[item.id] = made.number;
    dbIds[item.id] = made.id;
    existing.set(item.id, { ...made, labels: { nodes: item.labels.map((name) => ({ name })) }, state: "OPEN", blockedBy: { nodes: [] }, comments: { nodes: [] }, parent: null, fresh: true });
  }
}
for (const item of items) {
  const issue = existing.get(item.id);
  const n = numbers[item.id];
  if (!issue && APPLY) throw new Error(`${item.id} has no issue`);
  const body = render(item, numbers);
  const have = new Set((issue?.labels.nodes ?? []).map((l) => l.name));
  const labels = [...[...have].filter((l) => !managed(l)), ...item.labels];
  const patch = {};
  if (issue && issue.title !== item.title) patch.title = item.title;
  if (issue && issue.body.trim() !== body.trim()) patch.body = body;
  if (issue && (labels.length !== have.size || labels.some((l) => !have.has(l)))) patch.labels = labels;
  if (Object.keys(patch).length) {
    log(`update ${ref(item.id)}: ${Object.keys(patch).join(", ")}`);
    write("PATCH", `repos/${REPO}/issues/${n}`, patch);
  }

  // History, as the first comment.
  const comment = issue?.comments.nodes.find((c) => c.body.startsWith(HISTORY_MARK));
  const history = renderHistory(item);
  if (!comment) {
    log(`history ${ref(item.id)}`);
    write("POST", `repos/${REPO}/issues/${n}/comments`, { body: history });
  } else if (comment.body.trim() !== history.trim()) {
    log(`history ${ref(item.id)}: updated`);
    write("PATCH", `repos/${REPO}/issues/comments/${comment.databaseId}`, { body: history });
  }
}

// Sub-issues, then blockers (both need every issue to exist).
for (const item of items) {
  if (!item.parent) continue;
  const issue = existing.get(item.id);
  const parent = numbers[item.parent];
  if (!parent && APPLY) throw new Error(`${item.id}: its feature ${item.parent} has no issue`);
  if (issue?.parent?.number === parent && parent) continue;
  log(`sub-issue ${ref(item.id)} of ${ref(item.parent)}`);
  write("POST", `repos/${REPO}/issues/${parent}/sub_issues`, { sub_issue_id: dbIds[item.id], replace_parent: true });
}
for (const item of items) {
  const issue = existing.get(item.id);
  const have = new Map((issue?.blockedBy.nodes ?? []).map((b) => [b.number, b.databaseId]));
  const want = item.blockers.filter((b) => {
    if (numbers[b] || !APPLY) return true;
    console.log(`  ${item.id}: blocker ${b} has no issue; skipped`);
    return false;
  });
  for (const b of want) {
    if (numbers[b] && have.has(numbers[b])) continue;
    log(`blocked-by ${ref(item.id)} ← ${ref(b)}`);
    write("POST", `repos/${REPO}/issues/${numbers[item.id]}/dependencies/blocked_by`, { issue_id: dbIds[b] });
  }
  const wanted = new Set(want.map((b) => numbers[b]));
  for (const [num, dbId] of have) {
    if (wanted.has(num)) continue;
    log(`unblock ${ref(item.id)} from #${num}`);
    write("DELETE", `repos/${REPO}/issues/${numbers[item.id]}/dependencies/blocked_by/${dbId}`);
  }
}

// Open or closed, with the right reason. Last, so a closed issue's links are already in place.
for (const item of items) {
  const issue = existing.get(item.id);
  const state = issue?.state ?? "OPEN";
  const reason = issue?.stateReason?.toLowerCase();
  if (item.closed && (state !== "CLOSED" || reason !== item.closed)) {
    log(`close ${ref(item.id)} as ${item.closed === "completed" ? "completed" : "not planned"}`);
    write("PATCH", `repos/${REPO}/issues/${numbers[item.id]}`, { state: "closed", state_reason: item.closed });
  } else if (!item.closed && state === "CLOSED") {
    log(`reopen ${ref(item.id)}`);
    write("PATCH", `repos/${REPO}/issues/${numbers[item.id]}`, { state: "open", state_reason: "reopened" });
  }
}

// The id map, the whole board's (not just --only's).
if (APPLY) {
  const all = Object.fromEntries(Object.entries(numbers).sort(([a], [b]) => (a[0] === b[0] ? idNum(a) - idNum(b) : a < b ? -1 : 1)));
  writeFileSync(IDS_FILE, `${JSON.stringify(all, null, 2)}\n`);
}
console.log(`\n${APPLY ? "Done" : "Dry run"}: ${items.length} items, ${writes} write${writes === 1 ? "" : "s"}${APPLY ? `; ${IDS_FILE.slice(ROOT.length + 1)} written` : ""}.`);

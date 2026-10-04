// The playtest board. Notes go into a local inbox; /ingest turns them into
// tickets; /build turns a ticket into a PR.
//
// Tickets live in docs/tickets/ (checked in, so any machine can build one) and
// store only what doesn't churn: the content, a coarse status (open, done,
// dropped) and a history. Live state is derived, never stored:
//   needs answers  unticked "- [ ]" open questions
//   blocked        a blocked_by ticket that isn't done (or PR that isn't merged)
//   in flight      a pushed t-0NN-… branch with no PR yet
//   in review      an open PR from a t-0NN-… branch
//   done           status: done, or a merged PR from a t-0NN-… branch
// The inbox and the generated BOARD.md are local, in .tracker/ (gitignored) in
// the main checkout, found from any worktree.
//
//   node scripts/board.mjs note <text>       add a note to the inbox (or text on stdin)
//   node scripts/board.mjs inbox             print notes waiting to be ingested
//   node scripts/board.mjs ingest-start      take the inbox, give each note an id, archive it verbatim
//   node scripts/board.mjs ingest-done       link each archived note to its tickets; clear the ingest file
//   node scripts/board.mjs next-id           print the next free ticket id
//   node scripts/board.mjs log <id> <text> [--status open|done|dropped] [--blocked-by T-7,#41|none]
//                                            append a timestamped history line (and set fields) in this checkout
//   node scripts/board.mjs menu              print the board's short view; rewrite BOARD.md
//   node scripts/board.mjs show <id>         print one ticket with its live state
//   node scripts/board.mjs publish <message> commit docs/tickets/ alone on main and push it
//   node scripts/board.mjs path              print the local tracker folder
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

const STORED_STATUSES = ["open", "done", "dropped"];
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
const BRANCH_RE = /^t-(\d+)-/;

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
  for (const k of ["touches", "notes", "blocked_by"]) if (!Array.isArray(meta[k])) meta[k] = meta[k] ? [meta[k]] : [];
  return { file, meta, body: m[2] };
}

function writeTicket(t) {
  const order = ["id", "title", "status", "size", "area", "touches", "blocked_by", "notes", "created"];
  const keys = [...order.filter((k) => k in t.meta), ...Object.keys(t.meta).filter((k) => !order.includes(k))];
  const fm = keys
    .map((k) => {
      const v = t.meta[k];
      return `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : (v ?? "")}`.trimEnd();
    })
    .join("\n");
  writeFileSync(t.file, `---\n${fm}\n---\n${t.body}`);
}

const idNum = (id) => Number(String(id).replace(/\D/g, ""));
const normId = (id) => `T-${String(idNum(id)).padStart(3, "0")}`;

function loadTickets() {
  return readdirSync(TICKETS)
    .filter((f) => /^T-\d+.*\.md$/.test(f))
    .map((f) => parseTicket(join(TICKETS, f)))
    .sort((a, b) => idNum(a.meta.id) - idNum(b.meta.id));
}

function findTicket(id) {
  const t = loadTickets().find((x) => x.meta.id === normId(id));
  if (!t) throw new Error(`no ticket ${normId(id)} in ${TICKETS}`);
  return t;
}

const openQuestions = (t) => (t.body.match(/^- \[ \]/gm) ?? []).length;
/** The last "- <stamp> …" line under ## History, for "how long in this state". */
const lastHistory = (t) => [...t.body.matchAll(/^- (\d{4}-\d\d-\d\d \d\d:\d\d)/gm)].pop()?.[1] ?? t.meta.created;

// ---- GitHub ---------------------------------------------------------------

/** PRs and pushed branches named t-0NN-…, by ticket number. Empty if GitHub can't be reached. */
function github() {
  const prs = {};
  const branches = {};
  const list = trySh("gh pr list --state all --limit 300 --json number,state,headRefName,createdAt,mergedAt,url");
  for (const pr of list ? JSON.parse(list) : []) {
    const n = pr.headRefName.match(BRANCH_RE)?.[1];
    if (!n) continue;
    // Keep the most telling PR per ticket: open beats merged beats closed.
    const rank = { OPEN: 3, MERGED: 2, CLOSED: 1 };
    if (!prs[+n] || rank[pr.state] > rank[prs[+n].state]) prs[+n] = pr;
  }
  for (const line of (trySh("git ls-remote --heads origin 't-*'") ?? "").split("\n")) {
    const name = line.split("refs/heads/")[1];
    const n = name?.match(BRANCH_RE)?.[1];
    if (n) branches[+n] = name;
  }
  return { prs, branches, online: list !== null };
}

/** The ticket's live state, from the file plus GitHub. */
function liveState(t, gh, byNum) {
  const n = idNum(t.meta.id);
  const pr = gh.prs[n];
  if (t.meta.status === "dropped") return { state: "dropped", since: lastHistory(t) };
  if (t.meta.status === "done" || pr?.state === "MERGED")
    return { state: "done", since: pr?.mergedAt ?? lastHistory(t), pr };
  if (pr?.state === "OPEN") return { state: "in-review", since: pr.createdAt, pr };
  if (gh.branches[n]) return { state: "in-flight", since: lastHistory(t), branch: gh.branches[n] };
  const waiting = t.meta.blocked_by.filter((b) => {
    if (/^#?\d+$/.test(b) && !/^T-/i.test(b)) {
      const pr = Object.values(gh.prs).find((p) => p.number === Number(b.replace("#", "")));
      return pr?.state !== "MERGED";
    }
    const other = byNum[idNum(b)];
    return !other || liveState(other, gh, byNum).state !== "done";
  });
  if (waiting.length) return { state: "blocked", since: lastHistory(t), waiting };
  if (openQuestions(t)) return { state: "noted", since: lastHistory(t) };
  return { state: "ready", since: lastHistory(t) };
}

function board() {
  const gh = github();
  const tickets = loadTickets();
  const byNum = Object.fromEntries(tickets.map((t) => [idNum(t.meta.id), t]));
  return { gh, rows: tickets.map((t) => ({ t, ...liveState(t, gh, byNum) })) };
}

// ---- views ----------------------------------------------------------------

function extras(r) {
  const out = [];
  if (r.waiting) out.push(`waits on ${r.waiting.join(", ")}`);
  if (r.state === "noted") out.push(plural(openQuestions(r.t), "open question"));
  if (r.branch) out.push(r.branch);
  if (r.pr && r.state !== "ready") out.push(`PR #${r.pr.number}`);
  return out;
}

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

function writeBoard({ gh, rows }) {
  let out = `# Board\n\nGenerated ${stamp()} by \`node scripts/board.mjs menu\` from \`docs/tickets/\` and GitHub. Don't edit.\n\n`;
  if (!gh.online) out += "**GitHub unreachable: in flight, in review and merged states may be missing.**\n\n";
  if (pendingNotes()) out += `**${plural(pendingNotes(), "note")} waiting in the inbox.** Run /ingest.\n\n`;
  for (const { label, total, col } of columns(rows)) {
    out += `## ${label} (${total})\n\n`;
    if (!col.length) {
      out += "—\n\n";
      continue;
    }
    out += "| Id | Size | Item | In this state | Notes |\n| --- | --- | --- | --- | --- |\n";
    for (const r of col) {
      const link = `${CHECKOUT}/docs/tickets/${r.t.file.split("/").pop()}`;
      out += `| [${r.t.meta.id}](${link}) | ${r.t.meta.size || "?"} | ${r.t.meta.title} | ${ago(r.since)} | ${extras(r).join(" · ")} |\n`;
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
  for (const { state, label, total, col } of columns(b.rows)) {
    if (!total || state === "done") continue;
    lines.push(`${label} (${total})`);
    const w = Math.max(...col.map((r) => r.t.meta.title.length));
    for (const r of col) {
      const x = extras(r);
      lines.push(`  ${r.t.meta.id}  ${(r.t.meta.size || "?").padEnd(2)}  ${r.t.meta.title.padEnd(w)}  ${ago(r.since).padStart(3)}${x.length ? `  · ${x.join(" · ")}` : ""}`);
    }
  }
  if (!b.rows.some((r) => !["done", "dropped"].includes(r.state))) lines.push("Nothing open on the board.");
  const done = b.rows.filter((r) => r.state === "done").length;
  lines.push("", `${done} done. Full board: ${BOARD}`);
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

function nextId() {
  return normId(loadTickets().reduce((max, t) => Math.max(max, idNum(t.meta.id)), 0) + 1);
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
    console.log(`Next free ticket id: ${nextId()}`);
    break;
  }
  case "ingest-done": {
    const notes = parseNotes(read(INGESTING));
    const ids = new Set(notes.map((n) => n.id));
    const tickets = loadTickets();
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
    console.log(nextId());
    break;
  case "log": {
    const f = flags(args);
    const [id, ...words] = f.rest;
    const t = findTicket(id);
    if (f.status) {
      if (!STORED_STATUSES.includes(f.status)) throw new Error(`status must be one of ${STORED_STATUSES.join(", ")}`);
      t.meta.status = f.status;
    }
    if (f["blocked-by"]) t.meta.blocked_by = f["blocked-by"] === "none" ? [] : f["blocked-by"].split(",").map((s) => s.trim());
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
  case "show": {
    const t = findTicket(args[0]);
    const b = board();
    const r = b.rows.find((x) => x.t.meta.id === t.meta.id);
    const x = extras(r);
    console.log(`${t.file}\nLive state: ${r.state}${x.length ? ` (${x.join(" · ")})` : ""}\n\n${readFileSync(t.file, "utf8")}`);
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
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n"));
}

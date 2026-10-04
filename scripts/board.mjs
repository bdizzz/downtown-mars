// The playtest board: notes go into an inbox, /ingest turns them into item
// cards, /build turns a card into a PR. Everything lives in .tracker/ in the
// main checkout (gitignored), found from any worktree through git, so status
// changes never collide across branches. The skills in .claude/skills drive it.
//
//   node scripts/board.mjs note <text>          add a note to the inbox (or text on stdin)
//   node scripts/board.mjs inbox                print notes waiting to be ingested
//   node scripts/board.mjs ingest-start         move the inbox to ingesting.md, give each note an id, archive it verbatim
//   node scripts/board.mjs ingest-done          record which cards each note became; clear ingesting.md
//   node scripts/board.mjs next-id              print the next free card id
//   node scripts/board.mjs move <id> <status> [--pr N] [--branch b] [--blocked-by T-1,T-2] [--why text]
//   node scripts/board.mjs sync                 move cards whose PR merged or closed; rewrite BOARD.md
//   node scripts/board.mjs menu                 sync, then print the short pick-something menu
//   node scripts/board.mjs show <id>            print one card's path and contents
//
// Card statuses: noted (has open questions), ready, blocked, in-flight,
// in-review, done, dropped.

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

const STATUSES = ["noted", "ready", "blocked", "in-flight", "in-review", "done", "dropped"];
const SIZES = ["S", "M", "L", "XL"];
const COLUMNS = [
  ["ready", "Ready"],
  ["noted", "Needs answers"],
  ["blocked", "Blocked"],
  ["in-flight", "In flight"],
  ["in-review", "In review"],
  ["done", "Done"],
];
/** An in-flight card untouched this long is probably an abandoned session. */
const STALE_IN_FLIGHT_DAYS = 2;
/** Done cards shown on BOARD.md; older ones stay in items/ but drop off the view. */
const DONE_SHOWN = 15;

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// The main checkout, even when run from a worktree: the parent of the shared .git dir.
const gitCommon = resolve(sh("git rev-parse --git-common-dir"));
const ROOT = join(dirname(gitCommon), ".tracker");
const ITEMS = join(ROOT, "items");
const INBOX = join(ROOT, "inbox.md");
const INGESTING = join(ROOT, "ingesting.md");
const ARCHIVE = join(ROOT, "notes-archive.md");
const BOARD = join(ROOT, "BOARD.md");
mkdirSync(ITEMS, { recursive: true });

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseStamp = (s) => new Date(s.replace(" ", "T"));
const ago = (s) => {
  const mins = (Date.now() - parseStamp(s).getTime()) / 60000;
  if (mins < 60) return `${Math.max(0, Math.round(mins))}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 60 / 24)}d`;
};
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// ---- notes ----------------------------------------------------------------

/** Inbox entries are "## <stamp>" headings followed by the note, verbatim. */
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

function lastNoteNumber() {
  const ids = [...read(ARCHIVE).matchAll(/^## N-(\d+)/gm)].map((m) => Number(m[1]));
  return ids.length ? Math.max(...ids) : 0;
}

// ---- cards ----------------------------------------------------------------

/** Cards are markdown with a small frontmatter: `key: value`, lists as `[a, b]`. */
function parseCard(file) {
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

function writeCard(card) {
  const order = ["id", "title", "status", "size", "area", "touches", "blocked_by", "pr", "branch", "notes", "created", "updated"];
  const keys = [...order.filter((k) => k in card.meta), ...Object.keys(card.meta).filter((k) => !order.includes(k))];
  const fm = keys
    .map((k) => {
      const v = card.meta[k];
      return `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : (v ?? "")}`.trimEnd();
    })
    .join("\n");
  writeFileSync(card.file, `---\n${fm}\n---\n${card.body}`);
}

function loadCards() {
  return readdirSync(ITEMS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseCard(join(ITEMS, f)))
    .sort((a, b) => idNum(a.meta.id) - idNum(b.meta.id));
}
const idNum = (id) => Number(String(id).replace(/\D/g, ""));
const normId = (id) => `T-${String(idNum(id)).padStart(3, "0")}`;

function findCard(id) {
  const card = loadCards().find((c) => c.meta.id === normId(id));
  if (!card) throw new Error(`no card ${normId(id)}`);
  return card;
}

/** Sets status (and friends) and appends a timestamped line to ## History. */
function move(card, status, { pr, branch, blockedBy, why } = {}) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(", ")}`);
  const from = card.meta.status;
  const now = stamp();
  card.meta.status = status;
  card.meta.updated = now;
  if (pr !== undefined) card.meta.pr = pr;
  if (branch !== undefined) card.meta.branch = branch;
  if (blockedBy !== undefined) card.meta.blocked_by = blockedBy;
  if (status !== "blocked" && blockedBy === undefined) card.meta.blocked_by = [];
  let line = `- ${now} ${from} → ${status}`;
  if (status === "blocked" && card.meta.blocked_by.length) line += ` (waits on ${card.meta.blocked_by.join(", ")})`;
  if (pr) line += ` · PR #${pr}`;
  if (why) line += ` · ${why}`;
  card.body = card.body.match(/^## History\s*$/m)
    ? card.body.replace(/\s*$/, `\n${line}\n`)
    : `${card.body.replace(/\s*$/, "")}\n\n## History\n${line}\n`;
  writeCard(card);
  return line;
}

// ---- GitHub ---------------------------------------------------------------

function prState(n) {
  try {
    return JSON.parse(sh(`gh pr view ${n} --json state,mergedAt,url`));
  } catch {
    return null;
  }
}

/** Moves in-review cards whose PR merged to done, and closed-unmerged ones back to ready. */
function sync() {
  const log = [];
  for (const card of loadCards()) {
    const { status, pr } = card.meta;
    if (status !== "in-review" || !pr) continue;
    const s = prState(pr);
    if (s?.state === "MERGED") log.push(`${card.meta.id} ${move(card, "done", { why: "PR merged" }).slice(2)}`);
    else if (s?.state === "CLOSED") log.push(`${card.meta.id} ${move(card, unblockedStatus(card), { why: "PR closed without merging" }).slice(2)}`);
  }
  // A blocked card whose blockers are all done (or whose PRs merged) is ready again.
  const cards = loadCards();
  const byId = Object.fromEntries(cards.map((c) => [c.meta.id, c]));
  for (const card of cards) {
    if (card.meta.status !== "blocked" || !card.meta.blocked_by.length) continue;
    const clear = card.meta.blocked_by.every((b) =>
      /^#?\d+$/.test(b) ? prState(b.replace("#", ""))?.state === "MERGED" : byId[normId(b)]?.meta.status === "done",
    );
    if (clear) log.push(`${card.meta.id} ${move(card, unblockedStatus(card), { why: "blockers cleared" }).slice(2)}`);
  }
  writeBoard();
  return log;
}

// ---- views ----------------------------------------------------------------

const openQuestions = (card) => (card.body.match(/^- \[ \]/gm) ?? []).length;
/** Where a card goes when nothing outside it holds it up: ready, unless it still has questions. */
const unblockedStatus = (card) => (openQuestions(card) ? "noted" : "ready");

function rowFor(card) {
  const m = card.meta;
  const bits = [`${m.id}`, `${m.size || "?"}`, m.title];
  const extra = [];
  if (m.status === "blocked" && m.blocked_by.length) extra.push(`waits on ${m.blocked_by.join(", ")}`);
  if (m.status === "noted") extra.push(`${openQuestions(card)} open question${openQuestions(card) === 1 ? "" : "s"}`);
  if (m.pr) extra.push(`PR #${m.pr}`);
  if (m.status === "in-flight" && parseStamp(m.updated) < Date.now() - STALE_IN_FLIGHT_DAYS * 864e5) extra.push("stale?");
  return { bits, extra, age: ago(m.updated || m.created) };
}

/** Ready first: small before big, then oldest first. */
function sortForPicking(cards) {
  return [...cards].sort(
    (a, b) =>
      SIZES.indexOf(a.meta.size) - SIZES.indexOf(b.meta.size) ||
      parseStamp(a.meta.created) - parseStamp(b.meta.created),
  );
}

function writeBoard() {
  const cards = loadCards();
  const pending = parseNotes(read(INBOX)).length + parseNotes(read(INGESTING)).length;
  let out = `# Board\n\nGenerated ${stamp()} by \`node scripts/board.mjs sync\`. Don't edit; edit the cards in \`items/\`.\n\n`;
  if (pending) out += `**${pending} note${pending === 1 ? "" : "s"} waiting in the inbox.** Run /ingest.\n\n`;
  for (const [status, label] of COLUMNS) {
    let col = cards.filter((c) => c.meta.status === status);
    col = status === "done" ? col.sort((a, b) => parseStamp(b.meta.updated) - parseStamp(a.meta.updated)).slice(0, DONE_SHOWN) : sortForPicking(col);
    out += `## ${label} (${cards.filter((c) => c.meta.status === status).length})\n\n`;
    if (!col.length) {
      out += "—\n\n";
      continue;
    }
    out += "| Id | Size | Item | In this state | Notes |\n| --- | --- | --- | --- | --- |\n";
    for (const c of col) {
      const r = rowFor(c);
      out += `| [${c.meta.id}](items/${c.file.split("/").pop()}) | ${r.bits[1]} | ${r.bits[2]} | ${r.age} | ${r.extra.join(" · ")} |\n`;
    }
    out += "\n";
  }
  writeFileSync(BOARD, out);
}

function menu() {
  const log = sync();
  const cards = loadCards();
  const pending = parseNotes(read(INBOX)).length + parseNotes(read(INGESTING)).length;
  const lines = [];
  if (log.length) lines.push("Synced with GitHub:", ...log.map((l) => `  ${l}`), "");
  if (pending) lines.push(`${pending} note${pending === 1 ? "" : "s"} waiting in the inbox (not on the board until /ingest).`, "");
  const section = (status, label, all = true) => {
    const col = sortForPicking(cards.filter((c) => c.meta.status === status));
    if (!col.length) return;
    lines.push(`${label} (${col.length})`);
    if (!all) {
      lines.push(`  ${col.map((c) => c.meta.id).join(", ")}`);
      return;
    }
    const w = Math.max(...col.map((c) => c.meta.title.length));
    for (const c of col) {
      const r = rowFor(c);
      lines.push(`  ${r.bits[0]}  ${r.bits[1].padEnd(2)}  ${r.bits[2].padEnd(w)}  ${r.age.padStart(3)} ago${r.extra.length ? `  · ${r.extra.join(" · ")}` : ""}`);
    }
  };
  section("ready", "Ready");
  section("noted", "Needs answers");
  section("blocked", "Blocked");
  section("in-flight", "In flight");
  section("in-review", "In review");
  if (lines.length === 0 || !cards.some((c) => !["done", "dropped"].includes(c.meta.status))) lines.push("The board is empty.");
  lines.push("", `Board: ${BOARD}`);
  console.log(lines.join("\n"));
}

// ---- commands -------------------------------------------------------------

function flags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    out[a.slice(2)] = args[i + 1];
    i++;
  }
  return out;
}

const [cmd, ...args] = process.argv.slice(2);
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
      let n = lastNoteNumber();
      const notes = parseNotes(read(INGESTING)).map((note) => ({ ...note, id: `N-${String(++n).padStart(4, "0")}` }));
      const entries = notes.map((x) => `## ${x.id} · ${x.at}\n${x.body}\n`).join("\n");
      writeFileSync(INGESTING, entries);
      appendFileSync(ARCHIVE, `${read(ARCHIVE) ? "\n" : "# Notes archive\n\nEvery playtest note, verbatim, with the cards it became.\n\n"}${entries}`);
    } else console.log("(Resuming an ingest that didn't finish.)\n");
    console.log(read(INGESTING));
    console.log(`Next free card id: ${nextId()}`);
    break;
  }
  case "ingest-done": {
    const notes = parseNotes(read(INGESTING));
    const cards = loadCards();
    const ids = new Set(notes.map((n) => n.id));
    const unlinked = [];
    // Rebuild the archive entry by entry, adding "→ cards" under each note just ingested.
    const [preamble, ...entries] = read(ARCHIVE).split(/^(?=## )/m);
    const archive =
      preamble +
      entries
        .map((entry) => {
          const id = entry.match(/^## (N-\d+)/)?.[1];
          if (!ids.has(id) || /^→ /m.test(entry)) return entry;
          const into = cards.filter((c) => c.meta.notes.includes(id)).map((c) => c.meta.id);
          if (!into.length) unlinked.push(id);
          return `${entry.replace(/\s*$/, "")}\n→ ${into.length ? into.join(", ") : "no card"}\n\n`;
        })
        .join("");
    writeFileSync(ARCHIVE, archive);
    if (existsSync(INGESTING)) unlinkSync(INGESTING);
    writeBoard();
    console.log(`Ingested ${notes.length} note${notes.length === 1 ? "" : "s"}.${unlinked.length ? ` No card for: ${unlinked.join(", ")}.` : ""}`);
    break;
  }
  case "next-id":
    console.log(nextId());
    break;
  case "move": {
    const [id, status, ...rest] = args;
    const f = flags(rest);
    const card = findCard(id);
    const line = move(card, status, {
      pr: f.pr?.replace("#", ""),
      branch: f.branch,
      blockedBy: f["blocked-by"]?.split(",").map((s) => s.trim()).filter(Boolean),
      why: f.why,
    });
    writeBoard();
    console.log(`${card.meta.id}: ${line.slice(2)}`);
    break;
  }
  case "sync": {
    const log = sync();
    console.log(log.length ? log.join("\n") : "Nothing changed.");
    break;
  }
  case "menu":
    menu();
    break;
  case "show": {
    const card = findCard(args[0]);
    console.log(`${card.file}\n\n${readFileSync(card.file, "utf8")}`);
    break;
  }
  case "path":
    console.log(ROOT);
    break;
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n"));
}

function nextId() {
  const n = loadCards().reduce((max, c) => Math.max(max, idNum(c.meta.id)), 0);
  return normId(n + 1);
}

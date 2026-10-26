---
id: F-020
title: Move the board to GitHub Issues
status: agreed
branch: feature/f-020-github-issues
notes: []
created: 2026-10-26 10:00
---
## Goal
Bryon: "we've outgrown the current process of creating bespoke tickets inside of files within the repo". Move tickets, features and the note inbox to GitHub Issues on `bdizzz/downtown-mars`, as both the store and the backbone of the process, and bring every existing ticket along, closed ones included. The skills (`/note`, `/ingest`, `/board`, `/deps`, `/build`, `/try`, `/land`) keep their names and jobs; what changes is where they read and write.

Done: `docs/tickets/` is gone, every T and F item is an issue with its state, parent, blockers and history, `board.mjs` reads the board from GitHub, and a note jotted from the GitHub app on a phone shows up in `/ingest`.

## Design
**Where it is now.** 185 tickets (103 done, 77 open, 4 dropped, 1 hibernating), 19 features and a 43 KB `notes-archive.md` live in `docs/tickets/`. `scripts/board.mjs` (825 lines) parses them and works out each item's live state from GitHub anyway (a pushed `t-0NN-…` branch is in flight, an open PR in review, a merged one done). Ticket edits are commits: straight to main via `board.mjs publish`, or on a branch with `--here`, which is why ticket files keep conflicting with in-flight branches. The inbox is local to each machine (`.tracker/`). The repo is a user repo (no issue types; sub-issues and blocked-by relationships work, checked Oct 26).

**How each piece maps:**

| Now | On GitHub |
| --- | --- |
| `T-0NN` file, `status: open` | An open issue labeled `task` |
| `status: done` / `dropped` | Closed as completed / closed as not planned |
| `status: hibernating` | Open, label `hibernating` |
| `F-0NN`, `draft` / `agreed` | An issue labeled `feature` plus `draft` or `agreed`; done = closed |
| `feature: F-0NN`, Breakdown "→ T-0NN" | The task is a **sub-issue** of the feature; the Breakdown lines with no ticket yet stay in the feature's body as a checklist |
| `blocked_by: [T-007]` | A native **blocked by** relationship |
| `blocked_by: ["#41"]` (a PR) | Blocked by that PR's issue if it has one; otherwise label `blocked` and a comment naming the PR |
| `size`, `area` | Labels `size:S` … `size:XL`, `area:sim` … (one per area in CLAUDE.md's scope list) |
| `touches` | A `**Touches:**` line at the top of the body |
| Open questions | Stay a `## Open questions` checklist in the body; any unticked box means "needs answers", as now (no label to drift) |
| `## History` | Comments, plus GitHub's own timeline (branch created, PR linked, closed) |
| Inbox note `N-0NN` | An issue labeled `note` (see below) |
| `notes-archive.md` | Kept, frozen, moved to `docs/notes-archive.md`; new notes are their own archive |

**Live state stays derived, with the same rules.** One GraphQL query fetches every issue (about 250, two pages) with labels, parent, blockers, linked PRs and state, alongside the branch list `board.mjs` already reads. In flight = a pushed branch for the item; in review = an open PR that names it (`Closes #N`); done = closed. The board, menu and `/deps` graph look as they do now.

**Ids.** New items are plain issue numbers: `#212`, branch `212-<slug>` (GitHub's own "create a branch" form), PR body `Closes #212`. Issues and PRs share numbers, so migrated items can't keep theirs: each keeps its old id at the front of its title (`T-080 · The tutorial's office step …`), and `docs/ticket-ids.json` maps every `T-`/`F-` id to its issue. `board.mjs` takes either form (`t80`, `T-080`, `212`, `#212`), and still recognizes `t-0NN-…` and `f-0NN-…` branches, so the 216 old ids in docs, code comments and commit history stay meaningful and in-flight branches keep their names.

**Notes.** `/note <text>` creates an issue labeled `note`, the text verbatim as its body and the first few words as its title. That ends the per-machine inbox, and a note can come from anywhere GitHub runs (the phone app, the web). `/ingest` reads the open `note` issues, makes tickets and features as now, and closes each note with a comment linking what it became ("→ #212, #213"); the new items link back ("from #208"). The repo is public, so notes are too; they already were, through `notes-archive.md`.

**Features on a branch of their own** still work: `feature/f-0NN-…` and `board.mjs feature-branch`, `base`, `sync` are unchanged, with the branch recorded in the feature's body instead of frontmatter. One catch: `Closes #N` only fires when a PR merges into the default branch, so `land.mjs` closes a task's issue itself when it merges that task's PR into a feature branch.

**Writes go through `gh`, never git.** `board.mjs log` becomes a comment (plus label or state changes for `--status`, `--blocked-by`, `--feature`); `publish` and `--here` are dropped, since nothing to do with tickets is committed any more. `/build` claims an item by pushing its branch and adding a "building on …" comment. Agreeing a feature creates its tasks as sub-issues and ticks their Breakdown lines.

**The migration** (`scripts/migrate-issues.mjs`, kept afterwards as a record):
- Dry run by default (prints what it would create); `--apply` does it. Idempotent: it finds existing items by the id at the front of their titles, so a second run only updates what changed in the files since.
- Order: labels → features → tickets in id order → sub-issue links → blocked-by links → close done and dropped ones with the right reason → write `docs/ticket-ids.json`.
- Each body is the ticket's own sections, unchanged, under a short header: original id, created date (GitHub will show the import date), size, area, touches, and the notes it came from. History becomes the first comment, so the timeline reads in order. Done items get a "Shipped in #N" line from the merged PR whose branch matches (`t-0NN-…`).
- Paced to stay under GitHub's limits on creating content (about a second per write, 600-odd writes: roughly 15 minutes).

**Cutover.** The feature is built on its own branch (`feature/f-020-github-issues`), so main keeps working on files until everything lands at once. Just before that branch merges: freeze ticket edits, rerun the migration (it picks up whatever changed since the first run), add `Closes #N` to every open PR it maps, and merge. Branches already in flight still carry `--here` edits to `docs/tickets/`; once main deletes the folder, `land.mjs` resolves those conflicts by keeping the deletion, and drops ticket-file changes from any PR it lands.

**Projects board.** A GitHub Project ("Downtown Mars board") with a Status column for Ready, Needs answers, Blocked, In flight, In review and Done, for a visual Kanban alongside `/board`. GitHub's built-in automations only know open and closed, so `board.mjs menu` writes each item's derived state to the Status field when it runs. It needs the `project` scope on Bryon's `gh` token (`gh auth refresh -s project`), which it doesn't have yet. Last and optional: nothing else depends on it.

**What we give up.** Tickets are no longer grep-able offline files, and reading the board needs the network (one query, a second or two). `board.mjs show` prints the full issue so builds read it as they read files now.

## Breakdown
Built in order on `feature/f-020-github-issues`; main keeps using files until the feature branch merges.
- The migration script: labels, issues, sub-issues, blocked-by, closed states, shipped-in PR links, `docs/ticket-ids.json`; dry run by default, idempotent; run it for real once, and check a sample of 10 items against their files (M) → T-186
- `board.mjs` on issues: read the board with one GraphQL query (menu, show, graph, base); writes through `gh` (log as comments, status, blocked-by, feature parent, agree into sub-issues, feature-branch); id resolution for `#212`, `212`, `t80`; drop `publish` and `--here`; same output as today against the migrated issues (L) → T-187
- Notes as issues: `/note` creates a `note` issue; `/ingest` reads open notes, creates issues and closes notes with links; remove `.tracker/` inbox handling (M) → T-188
- The other skills and scripts: `/board`, `/deps`, `/build` (`212-slug` branches, `Closes #N`, a claim comment), `/try` and `land.mjs` (close issues on feature-branch merges, keep the deletion when `docs/tickets/` conflicts), settings permissions (M) → T-189
- Docs and cutover: rewrite `docs/WORKFLOW.md` and the board sections of `CLAUDE.md`, move `notes-archive.md` to `docs/`, delete `docs/tickets/`, rerun the migration, add `Closes #N` to open PRs, merge the feature branch (S) → T-190
- The Projects board: create the Project, its Status field, and have `board.mjs menu` sync each item's state to it (S, optional; needs `gh auth refresh -s project`) → T-191

## Open questions
- [x] A GitHub Projects board? → Default: yes, as an extra view kept in sync by `board.mjs`, built last and optional.
- [x] Notes as issues, or keep the local inbox? → Default: issues labeled `note`, closed by `/ingest` with links to what they became.
- [x] Ids for new items? → Default: plain issue numbers (`#212`, branch `212-<slug>`); migrated items keep `T-0NN` at the front of their titles, with `docs/ticket-ids.json` as the map.
- [x] Build it on a feature branch? → Default: yes, so main never runs half on files and half on issues.
- [x] What happens to `notes-archive.md`? → Default: kept, frozen, in `docs/`.
- [x] Do ticket bodies keep their sections (Problem, Context, Approach, Docs to update, Open questions)? → Default: yes, as an issue template for `/ingest`; History moves to comments.

## History
- 2026-10-26 10:00 opened from a chat with Bryon
- 2026-10-26 18:57 planning on f-020-github-issues
- 2026-10-26 19:03 agreed
- 2026-10-26 19:03 built on feature/f-020-github-issues

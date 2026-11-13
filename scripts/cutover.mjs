// The last step of F-020 (T-190): move the board off docs/tickets/ for good,
// right before the feature's branch merges into main.
//
//   node scripts/cutover.mjs            dry run: what it would do
//   node scripts/cutover.mjs --apply    do it
//
// Run it from a clean checkout of the feature's branch (a worktree), after
// telling Bryon to stop editing tickets on main. It:
//   1. merges origin/main into the branch, so the newest ticket files are here
//      (stops on a conflict);
//   2. reruns the migration (scripts/migrate-issues.mjs) against those files,
//      so the issues match them: the files win one last time;
//   3. moves docs/tickets/notes-archive.md to docs/notes-archive.md, deletes
//      docs/tickets/, keeps the docs/ticket-ids.json the migration wrote, and
//      commits and pushes that;
//   4. adds "Closes #N" to each open PR whose branch names a ticket or feature
//      (t-0NN-…, f-0NN-…, feature/f-0NN-…), so merging it closes the issue.
// Then `/land feature/f-020-…` merges the branch into main.

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

process.on("uncaughtException", (e) => {
  console.error(`cutover: ${e.message}`);
  process.exit(1);
});

const APPLY = process.argv.includes("--apply");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ok = (cmd) => {
  try {
    sh(cmd);
    return true;
  } catch {
    return false;
  }
};
const ROOT = sh("git rev-parse --show-toplevel");
const say = (s) => console.log(`${APPLY ? "" : "(dry run) "}${s}`);

const branch = sh("git branch --show-current");
if (!branch.startsWith("feature/")) throw new Error(`run this on the feature's branch, not ${branch || "a detached HEAD"}`);
if (sh("git status --porcelain")) throw new Error("the checkout has uncommitted changes; commit or clear them first");
if (!existsSync(join(ROOT, "docs", "tickets"))) throw new Error("docs/tickets/ is already gone: the cutover has been done");

// 1. Main's newest ticket files.
sh(`git fetch --quiet origin main "${branch}"`);
if (sh(`git rev-list --count HEAD..origin/${branch}`) !== "0") throw new Error(`origin/${branch} has commits this checkout doesn't; pull them first`);
const behind = Number(sh("git rev-list --count HEAD..origin/main"));
if (behind) {
  say(`merge ${behind} commit${behind === 1 ? "" : "s"} from main`);
  if (APPLY && !ok(`git merge --no-edit --quiet -m "chore: merge main into ${branch}" origin/main`)) {
    const conflicts = sh("git diff --name-only --diff-filter=U");
    sh("git merge --abort");
    throw new Error(`merging main conflicts in: ${conflicts.split("\n").join(", ")}. Nothing was changed.`);
  }
} else say("main is already merged in");

// 2. The issues, brought in line with the files one last time.
say("rerun the migration");
const migrate = execFileSync("node", [join(ROOT, "scripts", "migrate-issues.mjs"), ...(APPLY ? ["--apply"] : [])], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const changes = migrate.trim().split("\n");
console.log(changes.filter((l) => !/^(\(dry run\) )?$/.test(l)).map((l) => `  ${l}`).join("\n"));

// 3. No more ticket files.
say("move docs/tickets/notes-archive.md to docs/notes-archive.md, delete docs/tickets/, commit and push");
if (APPLY) {
  sh("git mv docs/tickets/notes-archive.md docs/notes-archive.md");
  sh("git rm -r --quiet docs/tickets");
  sh("git add docs/ticket-ids.json");
  execSync("git commit --quiet -F -", {
    input: "chore(tickets): cut the board over to GitHub Issues (T-190)\n\nThe migration ran one last time against the ticket files; docs/tickets/ is gone\nand the notes archive is docs/notes-archive.md.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n",
  });
  sh(`git push --quiet origin "HEAD:refs/heads/${branch}"`);
}

// 4. Open PRs close their issues when they merge.
const ids = JSON.parse(readFileSync(join(ROOT, "docs", "ticket-ids.json"), "utf8"));
const prs = JSON.parse(sh("gh pr list --state open --limit 200 --json number,headRefName,body"));
for (const pr of prs) {
  const m = pr.headRefName.match(/^(?:feature\/)?([tf])-(\d+)-/);
  const n = m && ids[`${m[1].toUpperCase()}-${m[2].padStart(3, "0")}`];
  if (!n || new RegExp(`\\bcloses #${n}\\b`, "i").test(pr.body)) continue;
  say(`PR #${pr.number} (${pr.headRefName}): add "Closes #${n}"`);
  if (APPLY) execFileSync("gh", ["pr", "edit", String(pr.number), "--body-file", "-"], { input: `${pr.body.trimEnd()}\n\nCloses #${n}\n` });
}

console.log(`\n${APPLY ? "Done." : "Dry run done; --apply does it."} Next: /land ${branch} merges it into main.`);

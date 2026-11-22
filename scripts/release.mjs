// Tag and publish a GitHub release for each minor version (#580). Every PR
// bumps the patch, so releases go by major.minor: the first commit on main
// that reached 0.7.x gets the tag (v0.7.0) and a release whose notes list
// the commits since the previous one, grouped by Conventional Commit type.
// Minors that never got a release (the backfill on its first run, or a
// missed run) are tagged where they began, oldest first.
//
//   node scripts/release.mjs              dry run: print what would be released, with notes
//   node scripts/release.mjs --check      print zip=true when HEAD itself starts a new minor
//                                         (for the workflow: build the zip only then)
//   node scripts/release.mjs --publish    create the tags and releases (needs gh, GH_TOKEN in CI);
//                                         attaches release/downtown-mars-v<version>.zip when it exists
//
// Run from main with full history and tags (CI checks out with fetch-depth 0).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_LINES = 150; // longer ranges (the early milestones) end with "…and N more"
const SECTIONS = [
  ["breaking", "Breaking changes"],
  ["feat", "Features"],
  ["fix", "Fixes"],
  ["perf", "Performance"],
  ["other", "Other changes"],
];

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const lines = (s) => (s ? s.split("\n") : []);
const minorOf = (v) => v.split(".").slice(0, 2).join(".");

/** Where each major.minor began on main's first-parent history, oldest first. */
export function minorStarts() {
  const shas = lines(git("log", "--first-parent", "--reverse", "--format=%H", "HEAD", "--", "package.json"));
  const starts = [];
  const seen = new Set();
  for (const sha of shas) {
    let version;
    try {
      version = JSON.parse(git("show", `${sha}:package.json`)).version;
    } catch {
      continue; // package.json missing or unreadable at that commit
    }
    if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) continue;
    const minor = minorOf(version);
    if (seen.has(minor)) continue;
    seen.add(minor);
    starts.push({ minor, version, sha });
  }
  return starts;
}

/** The release title: the commit's summary without its type prefix or PR numbers. */
export function titleOf(version, subject) {
  const summary = subject
    .replace(/^\w+(\([^)]*\))?!?:\s*/, "")
    .replace(/(\s*\(#\d+(,\s*#\d+)*\))+$/, "")
    .trim();
  return summary ? `v${version}: ${summary}` : `v${version}`;
}

/** Release notes from commit subjects, grouped by Conventional Commit type. */
export function notesFor(subjects, compareUrl) {
  const groups = Object.fromEntries(SECTIONS.map(([k]) => [k, []]));
  for (const s of subjects) {
    const m = s.match(/^(\w+)(\([^)]*\))?(!)?:\s*(.*)$/);
    const key = !m ? "other" : m[3] ? "breaking" : groups[m[1]] && m[1] !== "other" ? m[1] : "other";
    groups[key].push(s);
  }
  const out = [];
  let shown = 0;
  for (const [key, heading] of SECTIONS) {
    if (!groups[key].length || shown >= MAX_LINES) continue;
    const take = groups[key].slice(0, MAX_LINES - shown);
    shown += take.length;
    out.push(`## ${heading}`, "", ...take.map((s) => `- ${s}`), "");
  }
  if (shown < subjects.length) out.push(`…and ${subjects.length - shown} more.`, "");
  if (compareUrl) out.push(`**Full changelog:** ${compareUrl}`);
  return out.join("\n").trim() + "\n";
}

function repoUrl() {
  const url = git("remote", "get-url", "origin");
  const m = url.match(/github\.com[:/](.+?)(\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}

/** The releases still to make: minors with no v<major>.<minor>.* tag, with their notes. */
export function plan() {
  const tags = new Set(lines(git("tag", "-l", "v*")));
  const tagged = new Set([...tags].map((t) => minorOf(t.slice(1))));
  const starts = minorStarts();
  const repo = repoUrl();
  const pending = [];
  starts.forEach((s, i) => {
    if (tagged.has(s.minor)) return;
    const prev = starts[i - 1];
    const range = prev ? [`${prev.sha}..${s.sha}`] : ["-1", s.sha];
    const subjects = lines(git("log", "--first-parent", "--format=%s", ...range));
    const prevTag = prev && [...tags].find((t) => minorOf(t.slice(1)) === prev.minor);
    const from = prevTag ?? (prev && `v${prev.version}`);
    const compare = repo && from ? `${repo}/compare/${from}...v${s.version}` : null;
    pending.push({
      ...s,
      tag: `v${s.version}`,
      title: titleOf(s.version, git("log", "-1", "--format=%s", s.sha)),
      notes: notesFor(subjects, compare),
    });
  });
  return pending;
}

function publish(pending) {
  const head = git("rev-parse", "HEAD");
  const newestMinor = minorStarts().at(-1)?.minor;
  const dir = mkdtempSync(join(tmpdir(), "release-"));
  try {
    for (const r of pending) {
      const file = join(dir, `${r.tag}.md`);
      writeFileSync(file, r.notes);
      const zip = `release/downtown-mars-v${r.version}.zip`;
      const args = ["release", "create", r.tag, "--target", r.sha, "--title", r.title, "--notes-file", file];
      args.push(`--latest=${r.minor === newestMinor}`);
      // Only HEAD's own build matches its commit; older minors go without a download.
      if (r.sha === head && existsSync(zip)) args.push(zip);
      execFileSync("gh", args, { stdio: "inherit" });
      console.log(`Released ${r.tag} at ${r.sha.slice(0, 7)}${args.includes(zip) ? ` with ${zip}` : ""}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pending = plan();
  if (process.argv.includes("--check")) {
    const head = git("rev-parse", "HEAD");
    console.log(`zip=${pending.some((r) => r.sha === head)}`);
  } else if (process.argv.includes("--publish")) {
    if (!pending.length) console.log("Every minor version already has a release.");
    publish(pending);
  } else {
    if (!pending.length) console.log("Every minor version already has a release.");
    for (const r of pending) console.log(`=== ${r.tag} at ${r.sha.slice(0, 7)}\n${r.title}\n\n${r.notes}`);
  }
}

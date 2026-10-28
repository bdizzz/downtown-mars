// Drops the old id from open tickets' and features' titles (#331): "T-080 · The
// tutorial's office step" becomes "The tutorial's office step", and open
// features' Breakdown links "→ T-080" become "→ #205". Closed issues keep their
// prefix as history; board.mjs reads every old id from docs/ticket-ids.json.
//
//   node scripts/retitle-issues.mjs           dry run: print what it would change
//   node scripts/retitle-issues.mjs --apply   do it
//
// Idempotent: a second run finds nothing left to change. A one-off, kept as a
// record, like migrate-issues.mjs.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.on("uncaughtException", (e) => {
  console.error(`retitle: ${e.message}`);
  process.exit(1);
});

const apply = process.argv.includes("--apply");
const TITLE_ID = /^[TF]-\d{3} · ([\s\S]*)$/;
const LINK = /→\s*(T-\d{3})\b/g;
const ids = JSON.parse(readFileSync(new URL("../docs/ticket-ids.json", import.meta.url), "utf8"));
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 << 20 });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const open = [];
for (const label of ["task", "feature"])
  open.push(
    ...JSON.parse(gh("issue", "list", "--state", "open", "--label", label, "--limit", "1000", "--json", "number,title,body")).map((i) => ({
      ...i,
      feature: label === "feature",
    })),
  );
open.sort((a, b) => a.number - b.number);

let titles = 0;
let links = 0;
const missing = new Set();
for (const i of open) {
  const edit = [];
  const title = i.title.match(TITLE_ID)?.[1];
  if (title) {
    edit.push("--title", title);
    titles++;
    console.log(`#${i.number}  ${i.title}\n   → ${title}`);
  }
  if (i.feature) {
    let n = 0;
    const body = i.body.replace(LINK, (whole, old) => {
      if (!ids[old]) {
        missing.add(old);
        return whole;
      }
      n++;
      return `→ #${ids[old]}`;
    });
    if (n) {
      const file = join(tmpdir(), `retitle-${i.number}.md`);
      writeFileSync(file, body);
      edit.push("--body-file", file);
      links += n;
      console.log(`#${i.number}  ${n} Breakdown link${n === 1 ? "" : "s"} → #N`);
    }
  }
  if (apply && edit.length) {
    gh("issue", "edit", String(i.number), ...edit);
    await sleep(1000);
  }
}
if (missing.size) console.log(`Not in docs/ticket-ids.json, left as they are: ${[...missing].join(", ")}`);
console.log(`${apply ? "Changed" : "Would change"} ${titles} title${titles === 1 ? "" : "s"} and ${links} Breakdown link${links === 1 ? "" : "s"}.`);

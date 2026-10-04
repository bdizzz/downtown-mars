#!/bin/sh
# SessionStart: fetch main from GitHub, and fast-forward the checkout when it's
# on main with nothing uncommitted. On any other branch (a worktree, a feature
# branch) it only fetches, so origin/main is fresh to branch from or merge.
# Whatever it prints goes into the session's context.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! git fetch origin main --quiet 2>/dev/null; then
  echo "fresh-main: couldn't reach GitHub; working from the local copy."
  exit 0
fi

branch=$(git branch --show-current)
behind=$(git rev-list --count HEAD..origin/main)
ahead=$(git rev-list --count origin/main..HEAD)

if [ "$branch" != "main" ]; then
  [ "$behind" -gt 0 ] && echo "fresh-main: on $branch; origin/main has $behind commit(s) this branch doesn't."
  exit 0
fi
[ "$behind" -eq 0 ] && exit 0
if [ "$ahead" -gt 0 ]; then
  echo "fresh-main: main and origin/main have diverged ($ahead local, $behind on GitHub); not pulling. Ask Bryon how to reconcile."
elif ! git diff --quiet || ! git diff --cached --quiet; then
  echo "fresh-main: origin/main is $behind commit(s) ahead, but main has uncommitted changes; not pulling."
elif git merge --ff-only --quiet origin/main 2>/dev/null; then
  echo "fresh-main: pulled $behind new commit(s) from GitHub into main."
else
  echo "fresh-main: fast-forward to origin/main failed; not pulling."
fi
exit 0

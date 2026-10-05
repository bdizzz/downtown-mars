#!/bin/sh
# Publish a folder to the gh-pages branch that GitHub Pages serves, at one
# path inside it, leaving the rest of the branch alone; or remove that path.
# The Pages and Preview workflows run this (plain git, so no third-party
# actions: the repo only allows GitHub's own).
#
#   sh scripts/gh-pages.sh publish <dir> <path> "<message>"
#   sh scripts/gh-pages.sh remove <path> "<message>"
#
# <path> "." is the site root: main's build, which replaces everything there
# except pr-preview/. Any other path (pr-preview/pr-12) is replaced whole.
set -eu

action=$1
if [ "$action" = publish ]; then
  src=$2 path=$3 message=$4
else
  path=$2 message=$3
fi

site=$(mktemp -d)
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if git ls-remote --exit-code --heads origin gh-pages >/dev/null; then
  git fetch --quiet --depth 50 origin gh-pages
  git worktree add --quiet --detach "$site" FETCH_HEAD
else
  [ "$action" = remove ] && exit 0
  git worktree add --quiet --orphan -b gh-pages "$site"
fi

if [ "$path" = . ]; then
  find "$site" -mindepth 1 -maxdepth 1 ! -name .git ! -name pr-preview -exec rm -rf {} +
else
  rm -rf "${site:?}/$path"
fi
if [ "$action" = publish ]; then
  mkdir -p "$site/$path"
  cp -R "$src/." "$site/$path/"
  touch "$site/.nojekyll"
fi

cd "$site"
git add -A
if git diff --cached --quiet; then
  echo "gh-pages: nothing changed"
  exit 0
fi
git commit --quiet -m "$message"

# Another deploy may have pushed meanwhile; they touch different paths, so
# replaying ours on top of theirs is safe.
for try in 1 2 3 4 5; do
  git push --quiet origin HEAD:gh-pages && exit 0
  echo "gh-pages: push rejected (try $try), rebasing"
  git pull --quiet --rebase origin gh-pages
done
echo "gh-pages: couldn't push after 5 tries" >&2
exit 1

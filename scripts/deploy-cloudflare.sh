#!/usr/bin/env bash
# Deploy the committed site (HEAD) to Cloudflare Pages, project "time-up-or-down".
# On main this updates production (https://time-up-or-down.pages.dev); on any other branch it makes a preview deployment.
# Uploads only the site files (not README, .nojekyll or this script). Needs a wrangler login: npx wrangler login
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes first: this deploys HEAD, not the working tree." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
commit="$(git rev-parse HEAD)"
message="$(git log -1 --pretty=%s)"

site="$(mktemp -d)" # the files to upload
work="$(mktemp -d)" # wrangler runs here, so its config/cache never lands in the repo or the upload
trap 'rm -rf "$site" "$work"' EXIT
git archive HEAD | tar -x -C "$site"
rm -rf "$site/README.md" "$site/.nojekyll" "$site/scripts"

cd "$work"
npx --yes wrangler@4 pages deploy "$site" \
  --project-name time-up-or-down \
  --branch "$branch" \
  --commit-hash "$commit" \
  --commit-message "$message"

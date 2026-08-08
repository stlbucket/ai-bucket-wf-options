#!/usr/bin/env bash
set -euo pipefail

# do-pre-deploy — stamp the next release so `git push` sets off the tag auto-deploy pipeline
# (`pnpm do-pre-deploy [patch|minor|major]`, default patch). Spec:
# docs/specs/deployment/tag-auto-deploy.md (TD7) — the release front door:
#
#   fetch + guards (on main, clean tree, not behind origin) → next version from the latest
#   v* tag → y/N confirm → pnpm install --frozen-lockfile → pnpm build (SKIP_BUILD=1 skips)
#   → true up every workspace package.json version → commit vX.Y.Z → LIGHTWEIGHT tag vX.Y.Z
#   → atomic push (branch + tag) that sets off the deploy pipeline
#
# USER-RUN ONLY — runs git (and a full build); the assistant never executes this.
# Ahead-of-origin is fine (unpushed commits ride the same atomic push); behind-origin aborts.
# The tag is deliberately lightweight: github.sha on annotated-tag pushes is ambiguous
# (tag object vs commit), and build-images.yml / the deploy guard key off github.sha.
#
# Inputs:
#   $1            bump kind: patch (default) | minor | major
#   SKIP_BUILD=1  skip the `pnpm build` gate (docs-only releases)
#
# The final step pushes for you (one atomic push — branch + tag together):
#   git push --atomic origin main vX.Y.Z
# → build-images.yml (v* tag) → main-ancestry guard → deploy.yml (mode=deploy-only,
#   exit-code-gated db-migrate) → health-verify. See deploy.README.md.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUMP="${1:-patch}"
case "$BUMP" in patch|minor|major) ;; *)
  echo "usage: pnpm do-pre-deploy [patch|minor|major]  (got: $BUMP)" >&2; exit 1 ;;
esac

for bin in git node pnpm; do
  command -v "$bin" >/dev/null || { echo "missing required tool: $bin" >&2; exit 1; }
done

# ── guards (no mutations until all pass + confirm) ───────────────────────────
echo "==> git fetch origin --tags"
git -C "$ROOT" fetch origin --tags

branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || { echo "not on main (on: $branch) — aborting" >&2; exit 1; }

[ -z "$(git -C "$ROOT" status --porcelain)" ] \
  || { echo "working tree not clean — commit or stash first" >&2; exit 1; }

behind="$(git -C "$ROOT" rev-list --count HEAD..origin/main)"
[ "$behind" = "0" ] || { echo "main is $behind commit(s) BEHIND origin/main — pull first" >&2; exit 1; }
ahead="$(git -C "$ROOT" rev-list --count origin/main..HEAD)"
[ "$ahead" = "0" ] || echo "    note: $ahead unpushed commit(s) on main — they ride the same push"

# ── next version from the latest v* tag ──────────────────────────────────────
current="$(git -C "$ROOT" tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || true)"
current="${current:-v0.0.0}"
IFS=. read -r maj min pat <<<"${current#v}"
case "$BUMP" in
  patch) next="$maj.$min.$((pat + 1))" ;;
  minor) next="$maj.$((min + 1)).0" ;;
  major) next="$((maj + 1)).0.0" ;;
esac
NEW_TAG="v$next"
git -C "$ROOT" rev-parse -q --verify "refs/tags/$NEW_TAG" >/dev/null \
  && { echo "tag $NEW_TAG already exists — aborting" >&2; exit 1; }

# Every workspace manifest (pnpm-workspace.yaml: apps/* + packages/*) + the root.
FILES=("$ROOT/package.json" "$ROOT"/apps/*/package.json "$ROOT"/packages/*/package.json)

# ── confirm (before the slow gates — a wrong bump costs nothing) ─────────────
echo ""
echo "    release: $current → $NEW_TAG ($BUMP)"
echo "    true-up: ${#FILES[@]} package.json files, then commit + lightweight tag $NEW_TAG"
[ "${SKIP_BUILD:-0}" = "1" ] && echo "    SKIP_BUILD=1 — the pnpm build gate will be skipped"
read -r -p "Proceed? [y/N] " confirm
case "$confirm" in y|Y) ;; *) echo "aborted (no changes made)"; exit 1 ;; esac

# ── pre-flight gates (still no mutations) ────────────────────────────────────
# Frozen lockfile: the CI image build runs `pnpm install --frozen-lockfile` — catch a stale
# pnpm-lock.yaml here in seconds, not 12 minutes into the image build.
echo "==> pnpm install --frozen-lockfile"
(cd "$ROOT" && pnpm install --frozen-lockfile)
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> pnpm build (the repo gate — SKIP_BUILD=1 to skip)"
  (cd "$ROOT" && pnpm build)
else
  echo "==> SKIP_BUILD=1 — skipping the build gate"
fi

# ── true up versions (adds the field after "name" where missing) ─────────────
echo "==> setting \"version\": \"$next\" in ${#FILES[@]} package.json files"
node -e '
  const fs = require("fs")
  const v = process.argv[1]
  for (const f of process.argv.slice(2)) {
    const j = JSON.parse(fs.readFileSync(f, "utf8"))
    let out = j
    if (!("version" in j)) {
      out = {}
      for (const k of Object.keys(j)) {
        out[k] = j[k]
        if (k === "name") out.version = v
      }
      if (!("name" in j)) out.version = v
    } else j.version = v
    fs.writeFileSync(f, JSON.stringify(out, null, 2) + "\n")
  }
' "$next" "${FILES[@]}"

# ── commit + lightweight tag ─────────────────────────────────────────────────
git -C "$ROOT" add -- "${FILES[@]}"
git -C "$ROOT" commit -m "$NEW_TAG"
git -C "$ROOT" tag "$NEW_TAG"

echo ""
echo "==> $NEW_TAG stamped ($(git -C "$ROOT" rev-parse --short=12 HEAD))."
echo ""

# ── release (one atomic push — branch + tag together) ────────────────────────
echo "==> git push --atomic origin main $NEW_TAG"
git -C "$ROOT" push --atomic origin main "$NEW_TAG"

echo ""
echo "==> pushed. build-images.yml builds 8 images (~12 min) → guard confirms the commit is"
echo "    on main → deploy.yml (mode=deploy-only) migrates the DB (exit-code gated) and cuts"
echo "    over do-prod → health-verify green."

# ── watch the pipeline ───────────────────────────────────────────────────────
if command -v gh >/dev/null; then
  echo ""
  echo "==> waiting for the workflow run to register, then: gh run watch"
  run_id=""
  for _ in 1 2 3 4 5 6; do
    sleep 5
    run_id="$(cd "$ROOT" && gh run list --workflow build-images.yml \
      --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
    [ -n "$run_id" ] && break
  done
  if [ -n "$run_id" ]; then
    (cd "$ROOT" && gh run watch "$run_id" --exit-status)
  else
    echo "    run not found yet — watch manually with: gh run watch"
  fi
else
  echo "    (gh not installed — watch manually with: gh run watch)"
fi

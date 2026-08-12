#!/usr/bin/env bash
# Copyright (C) 2026 StoneDogCode L.L.C.
# SPDX-License-Identifier: Apache-2.0
#
# Publish @stonedogcode/style to npm, end to end.
#
#   npm run publish:@stonedogcode/style
#
# Run it from a terminal, interactively. npm prompts for the 2FA one-time
# password itself (account `stonedogcode`) and the browser login flow needs a
# human — neither works unattended, which is why this is a script you run
# rather than a step in CI.
#
# Modelled on optima-filings' `scripts/publish-package.sh`. The verification
# half is deliberately the same: that script exists because a publish that
# printed no error had already turned out not to have published anything, and
# during the propagation window every obvious check disagrees with every other
# one. Two things follow, and both are below:
#
#   * **`npm view pkg@version` is the reliable probe** — it exits 1 when the
#     version is absent and 0 when present. The bare `npm view pkg` form 404s
#     mid-propagation and would report a successful publish as a failure.
#   * **Nothing short of an install proves it.** This ends by installing from
#     the registry into a temp directory, because that is the question a user
#     actually asks and it is the last one to start answering "yes".
#
# ## The trap that is specific to THIS package
#
# @stonedogcode/style ships **TypeScript source**, not a bundle — Panda extracts
# styles by statically parsing source at the consumer's build, so a pre-built
# `dist/` would emit class names the consumer's `cssgen` never saw. That means
# optima's "the build did not run, so the tarball is empty" failure cannot
# happen here.
#
# The mirror image can, and did. On 2026-08-04 a publish ran from a checkout
# one commit behind `origin/main`, and `TitleLogo.tsx` was **absent from the
# tarball entirely** — a package published, successfully, without the component
# it was published for. It was caught only because the version happened to
# collide on the retry.
#
# So the load-bearing check here is not "did a build run" but **"is this
# checkout actually current"**. The file listing is printed before publishing
# for the same reason: it is the only place the real payload is shown, and
# reading it is what that near-miss needed.
#
# ## Note if you are running this from inside a consumer
#
# HopperGuard and the optima repos vendor this package as a git submodule, and
# a submodule checkout sits **detached at whatever gitlink the consumer pins** —
# which is exactly the stale state above. The first guard refuses that and tells
# you how to fix it. Publishing is this repo's own concern, so the script lives
# here rather than in any consumer: every consumer can then run it, and none of
# them has to know how it works.
set -euo pipefail

PACKAGE_NAME="@stonedogcode/style"
# Sanity floor for the tarball. Well under the real count (116) so ordinary
# growth does not trip it, far above what a `files`-misconfigured package would
# produce (3: package.json, README, LICENSE).
MIN_FILES=60
# Every path `exports` names. A tarball missing one of these installs fine and
# fails at the consumer's first import.
REQUIRED_PATHS=("src/index.ts" "src/preset/index.ts")

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mREFUSING: %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Publish from a clean, current `main`.
#
# This is the check that would have caught the missing TitleLogo.tsx.
# ---------------------------------------------------------------------------
say "Checking the working tree"
BRANCH="$(git branch --show-current)"
if [ -z "$BRANCH" ]; then
  fail "this checkout is in detached HEAD — the state a submodule sits in by default, pinned to whatever gitlink the consumer records. That is how a stale publish happens. Run: git checkout main && git pull"
fi
[ "$BRANCH" = "main" ] || fail "on branch '$BRANCH'. Publish from main, never a feature branch."
[ -z "$(git status --porcelain | grep -v '^??')" ] || fail "the working tree has uncommitted changes."

git fetch --quiet origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  BEHIND="$(git rev-list --count HEAD..origin/main)"
  fail "HEAD is not origin/main ($BEHIND commit(s) behind). A checkout one commit behind publishes a tarball missing the very thing you are publishing for, and it looks like a success. Run: git pull"
fi
echo "  clean, on main, at $(git rev-parse --short HEAD)"

# ---------------------------------------------------------------------------
# 2. Authenticate.
#
# `npm whoami` is the honest check. A 404 from `npm publish` means AUTH far
# more often than a missing package — npm answers 404 rather than 403 so it
# cannot leak whether a name exists — so establishing identity here turns that
# confusing failure into a clear one. An `_authToken` in ~/.npmrc can also be
# present but expired, which only whoami reveals.
# ---------------------------------------------------------------------------
say "Checking npm authentication"
if ! NPM_USER="$(npm whoami 2>/dev/null)"; then
  echo "  not logged in — starting the browser login flow"
  npm login
  NPM_USER="$(npm whoami)"
fi
echo "  authenticated as $NPM_USER"

# Unscoped package, so rights are per-package rather than per-org. Only
# checkable once the name exists; on a first-ever publish there is no owner list.
if npm view "$PACKAGE_NAME" version >/dev/null 2>&1; then
  npm owner ls "$PACKAGE_NAME" 2>/dev/null | grep -q "^$NPM_USER " \
    || fail "'$NPM_USER' is not an owner of $PACKAGE_NAME, so publishing will fail with a misleading 404. Owners: $(npm owner ls "$PACKAGE_NAME" 2>/dev/null | tr '\n' ' ')"
  echo "  $NPM_USER is an owner of $PACKAGE_NAME"
fi

# ---------------------------------------------------------------------------
# 3. A version may be published at most once, ever.
# ---------------------------------------------------------------------------
VERSION="$(node -p "require('./package.json').version")"
say "Preparing $PACKAGE_NAME@$VERSION"

if npm view "$PACKAGE_NAME@$VERSION" version >/dev/null 2>&1; then
  fail "$PACKAGE_NAME@$VERSION is already published. A version can never be reused — bump it (npm run version:bump:minor), land that, then re-run."
fi

# ---------------------------------------------------------------------------
# 3b. Install exactly what the lockfile says, before anything reads node_modules.
#
# Every check above is about GIT. None of them looks at node_modules, and the
# two diverge exactly when a manifest change has just been pulled — which is
# precisely when someone is about to publish.
#
# stonedog-howto 0.1.2 hit this, on 2026-08-07. The checkout was clean, on main and
# current, so the script reported readiness in as many words — but `npm install`
# had never run after the pull that renamed the style dependency. The old
# unscoped package was still on disk and the scoped one absent, and Panda's
# codegen, which resolves that import for real, died with
# "Could not resolve @stonedogcode/style/preset". That reads as a config defect
# rather than an un-run install, and it costs an interactive 2FA attempt to
# find out otherwise.
#
# `npm ci` rather than `npm install`, for two reasons: it installs exactly the
# lockfile, and it FAILS when the lockfile and manifest disagree. That
# disagreement is itself a reason not to publish — `npm install` would quietly
# reconcile it and ship a tarball built against a lockfile nobody committed.
# ---------------------------------------------------------------------------
say "Installing dependencies from the lockfile"
[ -f package-lock.json ] || fail "there is no package-lock.json, so there is nothing to install reproducibly from."
npm ci
echo "  node_modules now matches package-lock.json"

# ---------------------------------------------------------------------------
# 4. The gate: codegen, typecheck, lint, unit tier.
#
# Publishing is irreversible on a version number, so the gate runs here rather
# than being assumed from a green PR — this checkout may carry commits that
# merged after the last CI run.
# ---------------------------------------------------------------------------
say "Running the gate"
npm run gate

# ---------------------------------------------------------------------------
# 5. Read the tarball before trusting it.
#
# `npm pack --dry-run` is the only place the real payload is shown. A manifest
# that looks right and a tarball missing a component are indistinguishable
# until here — see the header.
# ---------------------------------------------------------------------------
say "Verifying the tarball"
PACK_OUTPUT="$(npm pack --dry-run 2>&1)"
FILE_COUNT="$(printf '%s' "$PACK_OUTPUT" | sed -n 's/.*total files:[[:space:]]*\([0-9]*\).*/\1/p' | tail -1)"

[ -n "$FILE_COUNT" ] || fail "could not read a file count from npm pack."
[ "$FILE_COUNT" -ge "$MIN_FILES" ] \
  || fail "the tarball has only $FILE_COUNT files (expected >= $MIN_FILES). Publishing this would ship a near-empty package on a version number that can never be reused."

for path in "${REQUIRED_PATHS[@]}"; do
  printf '%s' "$PACK_OUTPUT" | grep -q "$path" \
    || fail "'$path' is not in the tarball, but package.json's \"exports\" names it. Every consumer import would fail."
done

printf '%s' "$PACK_OUTPUT" | grep -q 'README.md' \
  || fail "no README.md in the tarball — npmjs.com would show 'This package does not have a README'."
printf '%s' "$PACK_OUTPUT" | grep -q 'LICENSE' \
  || fail "no LICENSE in the tarball. This package is Apache-2.0 and the licence text ships with it."

echo "  $FILE_COUNT files; entry points, README and LICENSE all present"

# The listing is printed, not just counted. It is the only place a missing
# component shows up.
say "Tarball contents — read this before confirming"
printf '%s\n' "$PACK_OUTPUT" | sed -n 's/^npm notice[[:space:]]*[0-9.]*[kMG]*B*[[:space:]]*\(src\/.*\)/  \1/p' | sort | head -40
echo "  ($FILE_COUNT files total)"

# ---------------------------------------------------------------------------
# 6. Publish. npm prompts for the OTP here.
#
# `--access public` is explicit, and now belt-and-braces: the name is SCOPED,
# and a scoped package defaults to access: restricted. Publishing
# one privately succeeds, prints nothing unusual, and then 404s for every
# consumer — indistinguishable from a package that was never published. So the
# flag is here AND `publishConfig.access` is in package.json; being wrong about
# it is not recoverable on that version number.
# ---------------------------------------------------------------------------
say "Publishing $PACKAGE_NAME@$VERSION — npm will ask for your 2FA code"
npm publish --access public

# ---------------------------------------------------------------------------
# 7. PROVE IT. The step whose absence is the reason this script exists.
#
# The registry is eventually consistent for a few seconds, so this polls rather
# than asserting once, and ends with a real install into a throwaway directory.
# "the registry lists it" and "a user can install it" are different claims, and
# the second is the last to start answering yes.
# ---------------------------------------------------------------------------
say "Verifying it is actually installable"
PROBE_DIR="$(mktemp -d)"
trap 'rm -rf "$PROBE_DIR"' EXIT

for attempt in $(seq 1 20); do
  if npm view "$PACKAGE_NAME@$VERSION" version >/dev/null 2>&1; then break; fi
  [ "$attempt" -lt 20 ] || fail "$PACKAGE_NAME@$VERSION is still not on the registry after publishing. The publish did NOT succeed, whatever it printed."
  sleep 3
done

printf '{"name":"probe","version":"1.0.0"}' > "$PROBE_DIR/package.json"
(cd "$PROBE_DIR" && npm install --silent "$PACKAGE_NAME@$VERSION" >/dev/null 2>&1) \
  || fail "$PACKAGE_NAME@$VERSION resolves but cannot be installed."

INSTALLED="$(node -p "require('$PROBE_DIR/node_modules/$PACKAGE_NAME/package.json').version")"
[ "$INSTALLED" = "$VERSION" ] || fail "installed $INSTALLED but published $VERSION."

# The entry points again, this time in what a consumer actually receives.
for path in "${REQUIRED_PATHS[@]}"; do
  [ -f "$PROBE_DIR/node_modules/$PACKAGE_NAME/$path" ] \
    || fail "$path is missing from the INSTALLED package, though it was in the tarball."
done

printf '\n\033[32m✓ %s@%s is published and installable.\033[0m\n' "$PACKAGE_NAME" "$VERSION"
echo "  https://www.npmjs.com/package/$PACKAGE_NAME"
printf '\n\033[1mNext:\033[0m each consumer picks this up by bumping its dependency. Consumers that\n'
printf '  vendor this as a submodule also have a gitlink, which this script does NOT move.\n'

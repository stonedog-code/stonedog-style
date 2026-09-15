#!/usr/bin/env bash
# The component-test lane of `npm run gate`.
#
# Until this lane existed, `npm run gate` ran typecheck, lint and jest and
# stopped, while CI required a second check — "Component tests (4 viewports)" —
# that the local gate never ran. A green `npm run gate` therefore said nothing
# about whether a component renders, wraps or overflows, which is the only
# question this package's component tier exists to answer. The reason given for
# leaving it out was that Playwright needs a browser download; that is a reason
# to fail loudly when the browser is missing, not a reason to report green
# without looking.
#
# This script is `npm run test:ct` with three guards a gate needs and a bare
# test run does not have:
#
#   1. It prints the size of the set it examined — files, tests, viewports —
#      and refuses an empty set. `0 failed over 0 tests` is not a pass.
#   2. It launches the browser the tests will launch BEFORE running them. A
#      missing browser fails here, naming `npx playwright install chromium`,
#      rather than as a wall of per-test errors or, worse, as a silent skip.
#   3. It clears the CT bundle cache first. The harness reuses
#      `playwright/.cache` and does not always rebuild, so a run after a source
#      edit can measure the PREVIOUS bundle and report it as a fresh verdict.
#      A gate measures the tree it was asked about, not the last one.
#
# Same projects and viewports as CI: the four in playwright-ct.config.ts, on
# Chromium. Any `--project` narrowing would make a local green answer a
# different question from the CI one.
set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG=playwright-ct.config.ts
INSTALL_CMD="npx playwright install chromium"

say() { printf '[gate:ct] %s\n' "$*"; }
die() { printf '[gate:ct] FAIL: %s\n' "$*" >&2; exit 1; }

# 1. The input set. Counted from disk, not from git, so an untracked new
#    *.ct.tsx is examined rather than invisible.
CT_FILES=$(find src -type f -name '*.ct.tsx' | wc -l | tr -d ' ')
[ "$CT_FILES" -gt 0 ] || die "no *.ct.tsx files under src/ — an empty set cannot pass"

# `--list` prints one line per (project × test) and ends with
# "Total: N tests in M files". That N is what the run must account for.
LIST_OUT=$(npx playwright test --config "$CONFIG" --list 2>&1) \
  || { printf '%s\n' "$LIST_OUT" >&2; die "could not list the component tests"; }
LISTED=$(printf '%s\n' "$LIST_OUT" | sed -n 's/^Total: \([0-9][0-9]*\) tests in \([0-9][0-9]*\) files\?$/\1 \2/p' | tail -1)
[ -n "$LISTED" ] || { printf '%s\n' "$LIST_OUT" >&2; die "could not read the test count from 'playwright test --list'"; }
LISTED_TESTS=${LISTED% *}
LISTED_FILES=${LISTED#* }
PROJECTS=$(printf '%s\n' "$LIST_OUT" | sed -n 's/^  \[\([^]]*\)\] .*/\1/p' | sort -u | tr '\n' ' ')
PROJECT_COUNT=$(printf '%s' "$PROJECTS" | wc -w | tr -d ' ')
[ "$LISTED_FILES" -eq "$CT_FILES" ] \
  || die "found $CT_FILES *.ct.tsx files on disk but playwright listed $LISTED_FILES — testMatch or testDir has drifted"
[ "$LISTED_TESTS" -gt 0 ] || die "playwright listed 0 tests — an empty set cannot pass"

say "examining $LISTED_TESTS tests in $CT_FILES files across $PROJECT_COUNT viewport projects: $PROJECTS"

# 2. The browser. Launch exactly what the tests launch (headless Chromium via
#    the installed playwright), so an absent or broken install fails here with
#    the fix in the message. `chromium.executablePath()` is not enough: headless
#    runs use a separate headless-shell binary, and a stat of one path proves
#    nothing about the other.
if ! node -e '
  const { chromium } = require("playwright");
  chromium.launch({ headless: true })
    .then((b) => b.close())
    .catch((err) => { console.error(String(err && err.message || err)); process.exit(1); });
' 2>&1; then
  die "Playwright cannot launch Chromium. Install it with: $INSTALL_CMD  (CI runs the same with --with-deps). This lane was NOT run."
fi
say "chromium launches"

# 3. Never measure a stale bundle.
rm -rf playwright/.cache
say "cleared playwright/.cache so the bundle is rebuilt from this tree"

# 4. The run. Exit status is read from the test process itself, not from the
#    tee, and the summary line is cross-checked against the listed count so a
#    run that quietly executed fewer tests than it listed cannot read as green.
LOG=$(mktemp -t gate-ct.XXXXXX)
set +e
npx playwright test --config "$CONFIG" 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}
set -e

PASSED=$(sed -n 's/^ *\([0-9][0-9]*\) passed.*/\1/p' "$LOG" | tail -1)
FAILED=$(sed -n 's/^ *\([0-9][0-9]*\) failed.*/\1/p' "$LOG" | tail -1)
FLAKY=$(sed -n 's/^ *\([0-9][0-9]*\) flaky.*/\1/p' "$LOG" | tail -1)
SKIPPED=$(sed -n 's/^ *\([0-9][0-9]*\) skipped.*/\1/p' "$LOG" | tail -1)
DID_NOT_RUN=$(sed -n 's/^ *\([0-9][0-9]*\) did not run.*/\1/p' "$LOG" | tail -1)
rm -f "$LOG"

say "result: passed=${PASSED:-0} failed=${FAILED:-0} flaky=${FLAKY:-0} skipped=${SKIPPED:-0} did-not-run=${DID_NOT_RUN:-0} of $LISTED_TESTS listed (exit $STATUS)"

[ "$STATUS" -eq 0 ] || die "component tests failed (playwright exit $STATUS)"
[ -n "$PASSED" ] || die "no summary line from playwright — cannot tell what ran"
[ "${SKIPPED:-0}" -eq 0 ] || die "$SKIPPED component tests were skipped — a skipped test is not a passing one"
[ "$PASSED" -eq "$LISTED_TESTS" ] \
  || die "$PASSED passed but $LISTED_TESTS were listed — the run did not cover the set it was asked about"

say "PASS: $PASSED/$LISTED_TESTS component tests in $CT_FILES files at $PROJECT_COUNT viewports"

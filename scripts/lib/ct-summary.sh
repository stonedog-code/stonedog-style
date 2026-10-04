#!/usr/bin/env bash
# Parse Playwright's end-of-run summary into counts (0.37.0).
#
# Sourced by scripts/gate-ct.sh and by src/__tests__/gate-ct-summary.test.ts,
# so the gate and its test exercise the same lines.
#
# Why ANSI escapes are stripped first: with FORCE_COLOR set (agent shells here
# set FORCE_COLOR=3) Playwright writes the summary as
#   ESC[32m  12 passed ESC[39m ESC[2m (1.9s) ESC[22m
# and a `^ *[0-9]+ passed` pattern cannot match a line that begins with an
# escape. The gate then died with "no summary line" on a run in which every
# test passed. Stripping here, rather than forcing NO_COLOR on the child, keeps
# the coloured output a person watching the run expects, and makes the parser
# correct for whatever produced the log.

# Remove CSI sequences (colours, cursor moves) and stray carriage returns.
strip_ansi() {
  sed -e $'s/\x1b\\[[0-9;?]*[A-Za-z]//g' -e $'s/\r//g'
}

# ct_summary_count <logfile> <word>   e.g. ct_summary_count run.log passed
# Prints the count from the LAST summary line for <word>, or nothing if none.
ct_summary_count() {
  strip_ansi < "$1" | sed -n "s/^ *\([0-9][0-9]*\) $2.*/\1/p" | tail -1
}

# ct_list_total <logfile>  ->  "<tests> <files>" from `playwright test --list`.
ct_list_total() {
  strip_ansi < "$1" \
    | sed -n 's/^Total: \([0-9][0-9]*\) tests\? in \([0-9][0-9]*\) files\?$/\1 \2/p' \
    | tail -1
}

# ct_verdict <logfile> <playwright-exit> <listed-tests>
# Prints the result line, then returns 0 only for a run that passed EVERY
# listed test with a readable summary. Sets CT_PASSED for the caller.
# A missing summary is a FAILURE, never an empty-set green.
ct_verdict() {
  local log=$1 status=$2 listed=$3
  local passed failed flaky skipped did_not_run
  passed=$(ct_summary_count "$log" passed)
  failed=$(ct_summary_count "$log" failed)
  flaky=$(ct_summary_count "$log" flaky)
  skipped=$(ct_summary_count "$log" skipped)
  did_not_run=$(ct_summary_count "$log" "did not run")
  CT_PASSED=$passed
  printf '[gate:ct] result: passed=%s failed=%s flaky=%s skipped=%s did-not-run=%s of %s listed (exit %s)\n' \
    "${passed:-0}" "${failed:-0}" "${flaky:-0}" "${skipped:-0}" "${did_not_run:-0}" "$listed" "$status"
  _ct_fail() { printf '[gate:ct] FAIL: %s\n' "$*" >&2; return 1; }
  [ "$status" -eq 0 ] || { _ct_fail "component tests failed (playwright exit $status)"; return 1; }
  [ -n "$passed" ] || { _ct_fail "no summary line from playwright — cannot tell what ran"; return 1; }
  [ "${skipped:-0}" -eq 0 ] || { _ct_fail "$skipped component tests were skipped — a skipped test is not a passing one"; return 1; }
  [ "$passed" -eq "$listed" ] \
    || { _ct_fail "$passed passed but $listed were listed — the run did not cover the set it was asked about"; return 1; }
  return 0
}

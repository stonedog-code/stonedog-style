/**
 * @jest-environment node
 */
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * NEH-1884 — `scripts/gate-ct.sh` must read Playwright's summary whether or not
 * it is coloured, and must still FAIL when there is no summary at all.
 *
 * With `FORCE_COLOR` set (agent shells here set `FORCE_COLOR=3`) Playwright
 * writes `ESC[32m  12 passed ESC[39m…`. The gate's old `sed '^ *N passed'`
 * could not match a line starting with an escape, so it died with "no summary
 * line" on a run in which every test passed — and `npm run release` runs this
 * gate, so a coloured terminal could block a publish over a parsing bug.
 *
 * These drive the real shell functions (`scripts/lib/ct-summary.sh`, which the
 * gate sources) rather than a TypeScript re-implementation, so a green here is
 * a statement about the code the gate runs.
 */

const LIB = join(__dirname, "..", "..", "scripts", "lib", "ct-summary.sh");
const ESC = "\x1b";

/** Byte-for-byte the shapes Playwright 1.62 printed under FORCE_COLOR=3. */
const COLOURED = [
  `  ${ESC}[32m✓${ESC}[39m  ${ESC}[2m 9 ${ESC}[22m[iphone-se] › src/x.ct.tsx:66:1 › a test${ESC}[2m (413ms)${ESC}[22m`,
  "",
  `${ESC}[31m  2 failed${ESC}[39m`,
  `${ESC}[33m  1 flaky${ESC}[39m`,
  `${ESC}[33m  3 skipped${ESC}[39m`,
  `${ESC}[32m  12 passed${ESC}[39m${ESC}[2m (1.9s)${ESC}[22m`,
].join("\n");

const PLAIN = [
  "  ✓   9 [iphone-se] › src/x.ct.tsx:66:1 › a test (413ms)",
  "",
  "  2 failed",
  "  1 flaky",
  "  3 skipped",
  "  12 passed (1.9s)",
].join("\n");

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "gate-ct-summary-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeLog(name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, body);
  return path;
}

function shell(script: string): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("bash", ["-c", `. "${LIB}"; ${script}`], { encoding: "utf8" });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), status: result.status };
}

const WORDS = ["passed", "failed", "flaky", "skipped"] as const;

function counts(log: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const word of WORDS) {
    out[word] = shell(`ct_summary_count "${log}" ${word}`).stdout;
  }
  return out;
}

describe("gate-ct summary parser (NEH-1884)", () => {
  test("a coloured summary yields the same counts as a plain one", () => {
    const plain = counts(writeLog("plain.log", PLAIN));
    const coloured = counts(writeLog("coloured.log", COLOURED));
    // Pinned first, so "both empty" cannot pass as "both equal".
    expect(plain).toEqual({ passed: "12", failed: "2", flaky: "1", skipped: "3" });
    expect(coloured).toEqual(plain);
  });

  test("the escapes really are in the coloured fixture", () => {
    // The plant must land where the parser looks: without an ESC before the
    // count, the test above would be comparing two plain logs.
    expect(COLOURED).toContain(`${ESC}[32m  12 passed`);
  });

  test("the --list total parses coloured or plain", () => {
    const plain = writeLog("list-plain.log", "  [laptop] › a.ct.tsx:1:1 › t\nTotal: 1744 tests in 45 files\n");
    const coloured = writeLog(
      "list-coloured.log",
      `  [laptop] › a.ct.tsx:1:1 › t\n${ESC}[1mTotal: 1744 tests in 45 files${ESC}[22m\n`,
    );
    expect(shell(`ct_list_total "${plain}"`).stdout).toBe("1744 45");
    expect(shell(`ct_list_total "${coloured}"`).stdout).toBe("1744 45");
  });

  test("a passing coloured run is a PASS verdict", () => {
    const log = writeLog("pass.log", `${ESC}[32m  12 passed${ESC}[39m${ESC}[2m (1.9s)${ESC}[22m\n`);
    const r = shell(`ct_verdict "${log}" 0 12`);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("passed=12");
  });

  test("a genuinely missing summary still FAILS — no empty-set green", () => {
    const log = writeLog("none.log", "  ✓  1 [laptop] › a test\nsome other output\n");
    const r = shell(`ct_verdict "${log}" 0 12`);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no summary line");
  });

  test("an empty log FAILS", () => {
    const r = shell(`ct_verdict "${writeLog("empty.log", "")}" 0 12`);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no summary line");
  });

  test("fewer passed than listed FAILS, coloured or not", () => {
    const log = writeLog("short.log", `${ESC}[32m  11 passed${ESC}[39m\n`);
    const r = shell(`ct_verdict "${log}" 0 12`);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("11 passed but 12 were listed");
  });

  test("a non-zero playwright exit FAILS even with a full summary", () => {
    const log = writeLog("exit.log", "  12 passed (1s)\n");
    expect(shell(`ct_verdict "${log}" 1 12`).status).toBe(1);
  });
});

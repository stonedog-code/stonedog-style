import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * `toHaveStyle` with a `var()` value asserts nothing, so no test may write one
 * (NEH-406).
 *
 * ## Why it is vacuous
 *
 * jsdom's CSS parser validates a declaration against the property's grammar. A
 * `var()` reference is not a `<length>`, so `font-size: var(--font-sizes-xl,
 * 1.25rem)` is **rejected and dropped** — the element ends up with no `style`
 * attribute at all. `toHaveStyle` then compares "" against the "" it gets from
 * parsing the expectation the same way, and passes.
 *
 * The measured consequence: an assertion in `StyledSpinner.test.tsx` named
 * `2rem` when the scale said `1.25rem`, and stayed green from the commit that
 * moved the scale until this guard was written. Swapping any of the sibling
 * assertions for a deliberately absurd value left them green too — that is how
 * this was confirmed rather than assumed.
 *
 * ## Why a text scan rather than a runtime check
 *
 * There is nothing to observe at runtime: a passing assertion and a vacuous one
 * are the same event. The only place the difference exists is in the source.
 *
 * ## What to do instead
 *
 * Split the claim. *Which* value the component chose is usually a pure function
 * and belongs in this tier — `resolveFontSizeKey` exists because of this issue.
 * What that value *renders as* is a browser question and belongs in a `.ct.tsx`,
 * where a real engine resolves the custom property.
 *
 * This is the same lesson as CLAUDE.md's "a recipe can only style what the
 * element lets it", one layer up: a green test that cannot fail is worse than
 * no test, because it is counted as coverage.
 */

const SRC = join(__dirname, "..");

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...testFiles(full));
    } else if (/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Every `toHaveStyle(...)` call's argument text, paired with its file and the
 * 1-based line it starts on.
 *
 * Brace-matched rather than regexed to a closing paren: an argument object
 * spans several lines in most of the real call sites, and a line-at-a-time scan
 * would see only `toHaveStyle({` and report nothing — a guard that inspects
 * nothing while looking healthy, which is the failure this file is about.
 */
function styleAssertions(source: string): { line: number; argument: string }[] {
  const found: { line: number; argument: string }[] = [];
  const marker = /\.(?:not\.)?toHaveStyle\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(source)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      i += 1;
    }
    found.push({
      line: source.slice(0, m.index).split("\n").length,
      argument: source.slice(m.index + m[0].length, i - 1),
    });
  }
  return found;
}

/**
 * This file is excluded from its own scan, and only this file.
 *
 * It has to contain a literal offender — the self-test below feeds one to the
 * matcher — and on the first run the guard duly reported it, which is the
 * cheapest possible proof that the scan works on real source rather than only
 * on the synthetic string. The exclusion is by exact path, not a pattern
 * anything else could opt into.
 */
const files = testFiles(SRC).filter((f) => f !== __filename);

describe("no test asserts a style value jsdom cannot see", () => {
  it("finds no toHaveStyle expectation containing var()", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const { line, argument } of styleAssertions(source)) {
        if (argument.includes("var(")) {
          offenders.push(`${file.replace(SRC, "src")}:${line} — ${argument.trim()}`);
        }
        // A bare `fontSizeMap.x` / `fontSizeMap["x"]` is the same trap wearing a
        // constant: every entry in that map IS a var() reference, which is what
        // made these read as careful rather than vacuous.
        if (/fontSizeMap\s*[.[]/.test(argument)) {
          offenders.push(
            `${file.replace(SRC, "src")}:${line} — fontSizeMap entry (a var() reference)`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("actually parsed the suite, rather than passing on an empty scan", () => {
    // Without these, deleting the recursion or mistyping the extension leaves a
    // permanently green guard that reads zero files — the exact shape of the
    // defect it exists to catch.
    expect(files.length).toBeGreaterThan(20);
    const total = files
      .map((f) => styleAssertions(readFileSync(f, "utf8")).length)
      .reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(10);
  });

  it("recognises an offender when it sees one", () => {
    // The scan itself, checked both ways on synthetic input. A matcher that
    // silently stopped matching would leave the first assertion green forever.
    const bad = `expect(el).toHaveStyle({\n  fontSize: "var(--font-sizes-xl, 2rem)",\n});`;
    const good = `expect(el).toHaveStyle({ whiteSpace: "nowrap" });`;
    expect(styleAssertions(bad)[0]!.argument).toContain("var(");
    expect(styleAssertions(good)[0]!.argument).not.toContain("var(");
    // Multi-line arguments must survive the brace matching, since that is what
    // every real offender looked like.
    expect(styleAssertions(bad)).toHaveLength(1);
  });
});

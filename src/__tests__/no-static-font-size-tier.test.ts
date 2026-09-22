import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * No source file may name a `--font-sizes-*` tier in a STRING LITERAL, except
 * the scale that defines them (NEH-1645).
 *
 * ## The defect this catches, which reads as correct on inspection
 *
 * `style={{ fontSize: "var(--font-sizes-sm, 0.9375rem)" }}` looks exactly like
 * the house mechanism and does the opposite of it. The thirteen
 * `--font-sizes-*` custom properties are declared once, at `:root`, with
 * STATIC values: the reader's profile works by choosing a different KEY, never
 * by re-valuing a key. So naming a tier directly pins that text at that tier
 * at every profile, forever.
 *
 * Following the reader takes both halves — `useResolvedFontSize` to pick the
 * key, and the `var()` it returns so Panda's literal-only extraction still
 * sees something. A literal has only the second, which is why it survives
 * review.
 *
 * ## Why this had to be a guard in THIS package, not in a consumer
 *
 * HopperGuard has run `check:font-tokens` over its own source since NEH-1597.
 * On 2026-09-22 it reported 1589 files, 61269 string literals, 0 violations —
 * a true and clean green — while four sites in this package were frozen,
 * including the data table under every chart.
 *
 * Its scan walks the app's source. These files are a dependency it never
 * opens. That is the empty-set failure in its most deceptive form: not a guard
 * that ran wrong, but one that ran correctly over a set the defect had left.
 * A package cannot borrow its consumers' guards, because the set they examine
 * is precisely the set that excludes it.
 *
 * ## String literals only, deliberately
 *
 * The walk reads `ts.isStringLiteral` / `isNoSubstitutionTemplateLiteral`
 * nodes, so a COMMENT naming the banned pattern is exempt by construction
 * rather than by an allowlist. That matters more than it sounds: the files
 * this guard protects explain the trap by quoting it — this docblock does it
 * twice — and a guard that made its own rationale unwriteable is one somebody
 * deletes to get a green test.
 *
 * An interpolated `` `var(--font-sizes-${key})` `` passes for the same
 * structural reason: it is a template WITH substitutions, so it names no tier.
 * That form is the correct one and should never need an exemption.
 */

/**
 * Scoped to the chart stack, which is the surface that was MEASURED (NEH-1645).
 *
 * A package-wide walk reports 21 sites, and the other 17 are not this defect:
 *
 *   - `preset/recipes/*` are Panda recipes resolved at BUILD time, and
 *     `button.ts` says in as many words that its one declaration is a base and
 *     "a relative size is the component's job" — which is exactly what 0.27.0
 *     made those five components do. Guarding them would flag the documented
 *     design.
 *   - `TitleLogo.tsx`'s `TITLE_LOGO_METRICS` is inline on purpose: a shared
 *     component's size metrics live in an inline `style` so they survive a
 *     consumer whose Panda `include` glob is wrong, and a token key is
 *     meaningless there.
 *
 * Both deserve a decision and neither has had one; widening this guard is the
 * follow-up, not a tidy-up. Guarding only what has been measured is the point
 * — a guard asserted over files nobody analysed is a claim, not a check.
 */
const SRC = path.join(__dirname, "..", "components", "chart");

/**
 * Empty, and that is its strictest state.
 *
 * `config/font-size.ts` — where `fontSizeMap` legitimately spells every tier
 * out, because it IS the scale — sits outside this walk rather than inside it
 * as an exemption. Nothing in the chart stack has a reason to name a tier.
 */
const EXEMPT = new Set<string>();

const TIER = /var\(\s*--font-sizes-/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

interface Census {
  files: number;
  literals: number;
  violations: string[];
  exemptSeen: string[];
}

function census(): Census {
  const files = sourceFiles(SRC);
  const violations: string[] = [];
  const exemptSeen = new Set<string>();
  let literals = 0;

  for (const file of files) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        literals += 1;
        if (TIER.test(node.text)) {
          if (EXEMPT.has(rel)) {
            exemptSeen.add(rel);
          } else {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            violations.push(`${rel}:${line + 1} — ${node.text}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { files: files.length, literals, violations, exemptSeen: [...exemptSeen] };
}

describe("no component pins itself to a font-size tier", () => {
  const result = census();

  /*
   * The input set is asserted rather than printed, matching
   * `no-vacuous-style-assertions.test.ts`. `0 violations` over four files and
   * over four hundred are the same sentence about two very different trees, so
   * a green here has to be a green over a set that is demonstrably the real
   * one. The numbers surface in the failure message when it fires.
   */
  it("examined a real set, so a green cannot be the empty set", () => {
    expect(result.files).toBeGreaterThan(8);
    expect(result.literals).toBeGreaterThan(100);
  });

  it("names no --font-sizes tier outside the scale that defines them", () => {
    expect(result.violations).toEqual([]);
  });

  it("carries no exemptions, which is the strictest state", () => {
    /*
     * An exemption covering nothing has outlived its reason, and the next
     * reader takes it as permission rather than as a fact — the argument that
     * got `KNOWN_DEAD` deleted from the token-contract test. There are none
     * here, so the set must stay empty in both directions.
     */
    expect([...EXEMPT]).toEqual([]);
    expect(result.exemptSeen).toEqual([]);
  });
});

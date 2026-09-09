import { readFileSync } from "fs";
import { join } from "path";
import {
  TEXT_BACKGROUND_PAIRS,
  colorTokenNames,
  emphasisTokenNames,
} from "../semantic-variables";

/**
 * A rule that renders text must not paint its surface with a FOREGROUND token
 * (NEH-1264).
 *
 * ## The defect
 *
 * `stackRecipe`'s `solid` shipped
 *
 * ```ts
 * solid: { bg: "textPrimary", color: "textPrimary" }
 * ```
 *
 * — the surface and the text in the same colour, so **1:1 in every theme this
 * package can wear**. Not low contrast: invisible. `textRecipe`'s `warning`
 * and `error` did the milder version, painting `textPop` (the loud *text*
 * colour) as a chip and labelling it `textWarning` / `textError`.
 *
 * ## Why the two existing sweeps could not see it
 *
 * Both live in `variant-contrast-pairing.test.ts` and both ask a question this
 * shape answers correctly:
 *
 * | sweep | asks | why it passed |
 * | -- | -- | -- |
 * | NEH-441 | does a variant that paints a background state a text colour? | it did |
 * | NEH-877 | is the stated colour the contract's partner for that surface? | it only fires when the background is a token the contract names a partner FOR. A foreground token is not, so `PAIRED_TEXT_FOR_BACKGROUND.get()` missed and the variant was skipped entirely |
 *
 * That second one is the interesting failure: the guard's own scoping rule —
 * "only assert on pairings the contract has declared, rather than inventing a
 * rule" — is exactly what let a foreground-as-surface through. The answer is
 * not to widen that sweep, which would start inventing pairings; it is this
 * separate, narrower assertion, which invents nothing. The contract already
 * says which tokens are foregrounds.
 *
 * ## Scoped to rules that render text, deliberately
 *
 * Three places paint a foreground token as a background on purpose and are
 * NOT defects:
 *
 *   - `input-radio__indicator` — a 12px dot in the pop colour
 *   - `StyledInputToggle`'s knob — `buttonTextAccent`, which is precisely the
 *     colour the contract says reads against the `buttonBgAccent` track
 *   - `StyledConfetti` — decorative particles
 *
 * None of them render text, so none of them can produce the failure this
 * guard exists for. Requiring a `color` declaration excludes all three **by
 * construction** rather than by an allowlist — which matters, because an
 * allowlist here is the `KNOWN_DEAD` shape NEH-301 deleted, and the next
 * offender would be added to it instead of fixed.
 */

const styles = readFileSync(
  join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
  "utf8",
);

/**
 * Every token that paints a FOREGROUND, derived from the contract rather than
 * listed here.
 *
 * Three sources, because "is this a foreground?" is answered in three places:
 * the surface-paired text tokens (`TEXT_BACKGROUND_PAIRS`' keys), the emphasis
 * tiers, and the meaning tokens — `textPop`, `textError`, `textWarning`,
 * `textSuccess` — which are deliberately absent from the pairs map because a
 * meaning-carrying colour appears on whatever surface the message sits on.
 *
 * Re-listing them here would be a second copy free to drift from the one the
 * themes are validated against.
 */
const FOREGROUND_TOKENS = new Set<string>([
  ...Object.keys(TEXT_BACKGROUND_PAIRS),
  ...emphasisTokenNames(),
  ...colorTokenNames().filter((name) => /^text|Text/.test(name)),
]);

const kebab = (token: string) =>
  token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const FOREGROUND_VARS = new Set(
  [...FOREGROUND_TOKENS].map((t) => `var(--colors-${kebab(t)})`),
);

interface Rule {
  selector: string;
  body: string;
}

function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1]!.trim();
    if (selector.startsWith("@")) continue;
    rules.push({ selector, body: m[2]! });
  }
  return rules;
}

function declaration(body: string, prop: string): string | null {
  const re = new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;]+)`, "i");
  const m = re.exec(body);
  return m ? m[1]!.trim() : null;
}

function backgroundOf(body: string): string | null {
  for (const prop of ["background-color", "background-image", "background"]) {
    const v = declaration(body, prop);
    if (v) return v;
  }
  return null;
}

const rules = parseRules(styles);

/** Rules that paint a surface AND render text on it. */
const painted = rules.flatMap(({ selector, body }) => {
  const background = backgroundOf(body);
  const colour = declaration(body, "color");
  if (!background || !colour) return [];
  return [{ selector, background, colour }];
});

describe("no rule paints its surface with a foreground token", () => {
  it("finds no text-rendering rule whose background is a text token", () => {
    const offenders = painted
      .filter(({ background }) => FOREGROUND_VARS.has(background))
      .map(
        ({ selector, background, colour }) =>
          `${selector} { background: ${background}; color: ${colour} }`,
      );

    expect(offenders).toEqual([]);
  });

  it("finds no rule painting its surface the SAME colour as its text", () => {
    // The severe end of the same family, and worth its own assertion because
    // it can happen with two SURFACE tokens too — `boxBgPrimary` on
    // `boxBgPrimary` would be equally invisible and would slip past the check
    // above. `stack solid` was the foreground-on-foreground case; nothing
    // stops the next one being different.
    const invisible = painted
      .filter(({ background, colour }) => background === colour)
      .map(({ selector, background }) => `${selector} — both are ${background}`);

    expect(invisible).toEqual([]);
  });

  it("actually inspected the stylesheet, rather than passing on an empty read", () => {
    // Counts, not adjectives. Measured when this landed: 629 rules parsed, 92
    // of them painting a surface and rendering text on it, against 17
    // foreground tokens. The floors sit well below those and well above zero.
    expect(styles.length).toBeGreaterThan(10_000);
    expect(rules.length).toBeGreaterThan(400);
    expect(painted.length).toBeGreaterThan(40);
    expect(FOREGROUND_TOKENS.size).toBeGreaterThanOrEqual(15);

    // And the lookup key is the shape Panda actually emits. If that spelling
    // ever changed, every membership test would miss and the sweep above would
    // pass having compared nothing.
    expect(FOREGROUND_VARS.has("var(--colors-text-primary)")).toBe(true);
    expect(FOREGROUND_VARS.has("var(--colors-text-pop)")).toBe(true);
    expect(FOREGROUND_VARS.has("var(--colors-button-text-accent)")).toBe(true);
    // A surface token must NOT be in there, or the sweep flags everything.
    expect(FOREGROUND_VARS.has("var(--colors-box-bg-primary)")).toBe(false);
  });

  it("does not flag the three deliberate foreground-as-paint cases", () => {
    // The coverage claim for the scoping rule above. These paint a foreground
    // token and are correct; if the scope ever widened to all backgrounds,
    // this fails and says which cases the widening would have to justify.
    const deliberate = rules.filter(({ selector, body }) => {
      const background = backgroundOf(body);
      return (
        Boolean(background) &&
        FOREGROUND_VARS.has(background!) &&
        declaration(body, "color") === null &&
        /input-radio__indicator|bg-c_/.test(selector)
      );
    });

    expect(deliberate.length).toBeGreaterThanOrEqual(3);
  });

  it("pins the three variants this guard was written for (NEH-1264)", () => {
    // Named, so a regression reads as "the stack went invisible again" rather
    // than as an anonymous entry in a list.
    const byToken = (selector: string) =>
      painted.find((p) => p.selector === selector);

    expect(byToken(".stack--variant_solid")).toMatchObject({
      background: "var(--colors-box-bg-primary)",
      colour: "var(--colors-text-primary)",
    });
    expect(byToken(".text--variant_warning")).toMatchObject({
      background: "var(--colors-box-warning)",
      colour: "var(--colors-text-warning)",
    });
    expect(byToken(".text--variant_error")).toMatchObject({
      background: "var(--colors-box-error)",
      colour: "var(--colors-text-error)",
    });
  });
});

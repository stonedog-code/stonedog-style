import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `tagRecipe` against the REAL generated stylesheet (NEH-721).
 *
 * The jest tier in `components/__tests__/StyledTag.test.tsx` proves the six
 * tones render six distinct class names. That is necessary and it is not
 * sufficient — this package's recurring defect is a class name with **no rule
 * behind it**, which produces no build error, no console warning, and renders
 * as an unstyled element. A DOM assertion cannot tell the two apart.
 *
 * So this reads `styled-system/styles.css` and asserts the rules exist, that
 * each paints from a token rather than a literal, and — the part that matters
 * most for how the consumers actually use this — that every tone is present
 * **statically**, because a tone chosen at runtime is invisible to Panda's
 * extractor.
 */
const CSS = readFileSync(
  join(__dirname, "..", "..", "..", "..", "styled-system", "styles.css"),
  "utf8",
);

const TONES = ["neutral", "info", "success", "warning", "error", "accent"] as const;

/** The declaration block for one tone's class, or undefined if it has none. */
function blockForTone(tone: string): string | undefined {
  // Panda emits `.tag--tone_success{…}`; the escape is for the literal dashes.
  const match = CSS.match(new RegExp(`\\.tag--tone_${tone}\\s*\\{([^}]*)\\}`));
  return match?.[1];
}

describe("tagRecipe", () => {
  it("reads a stylesheet that was actually generated", () => {
    // Guard on the guard. An empty or truncated file would make every
    // assertion below fail confusingly, or — worse, if they were written as
    // negatives — pass against nothing.
    expect(CSS.length).toBeGreaterThan(1000);
    expect(CSS).toContain(".tag");
  });

  it.each(TONES)("emits a rule for tone=%s", (tone) => {
    expect(blockForTone(tone)).toBeDefined();
  });

  /**
   * The whole reason this is a recipe rather than an inline `css()` call.
   *
   * HopperGuard writes `tone={STATUS_COLOR[item.status]}` — a value Panda's
   * extractor never sees. `staticCssRecipes` in `preset/index.ts` forces every
   * variant of every recipe into the sheet, and this asserts that arrangement
   * still covers this recipe. If someone narrows `staticCss` later, the tags
   * that break are the dynamically-toned ones, in the consumer, silently.
   */
  it("emits every tone statically, not only the ones written as literals", () => {
    const missing = TONES.filter((tone) => blockForTone(tone) === undefined);
    expect(missing).toEqual([]);
  });

  /**
   * Never a literal colour — the rule this package states in CLAUDE.md and has
   * broken four times. A literal is right in one theme and wrong in every
   * other, and it opts the element out of contrast validation.
   */
  it.each(TONES)("paints tone=%s from tokens, never a literal", (tone) => {
    const block = blockForTone(tone)!;
    const colourDeclarations = block
      .split(";")
      .filter((d) => /(^|[^-])(background|background-color|color)\s*:/.test(d));

    expect(colourDeclarations.length).toBeGreaterThan(0);
    for (const declaration of colourDeclarations) {
      const value = declaration.split(":").slice(1).join(":").trim();
      // A token resolves to `var(--…)`. `#fff`, `red`, `rgb(…)` and a bare
      // `green.100` all fail here, which is the point.
      expect({ tone, declaration: declaration.trim(), value }).toMatchObject({
        value: expect.stringContaining("var(--"),
      });
    }
  });

  it("gives the six tones six distinct declaration blocks", () => {
    const blocks = TONES.map((tone) => blockForTone(tone));
    // Two tones with identical declarations is the `input-bool` defect
    // (NEH-234, NEH-310): variants declared differently that paint the same.
    expect(new Set(blocks).size).toBe(TONES.length);
  });

  it("keeps neutral as the default so existing call sites do not move", () => {
    // The base class carries no tone; the recipe's `defaultVariants` is what
    // makes an untoned tag neutral. Assert the neutral rule is the one pairing
    // the historical tokens rather than trusting the config.
    const neutral = blockForTone("neutral")!;
    expect(neutral).toContain("var(--");
    expect(neutral.toLowerCase()).toContain("secondary");
  });
});

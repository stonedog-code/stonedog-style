import { readFileSync } from "fs";
import { join } from "path";
import { TEXT_BACKGROUND_PAIRS } from "../semantic-variables";

/**
 * A variant that paints a background must state the text colour that goes with
 * it (NEH-441).
 *
 * Otherwise the text inherits whatever the page has, and under a theme whose
 * surface sits at the same end of the scale as the inherited text the result is
 * illegible — black on navy, white on white. That is the NEH-278 family.
 *
 * **Nothing caught this before, and the reason is structural.** Every other
 * assertion in this tier asks about a property a recipe *sets*:
 *
 *   - names a token nothing defines  -> token-contract.test.ts
 *   - valid but matches nothing      -> the browser tier
 *   - never written at all           -> nothing
 *
 * An unset property has no observable value until a real engine resolves
 * inheritance. jsdom has no cascade, and the browser tier only ever asserted on
 * declarations that exist. So this guard works on the generated stylesheet,
 * where "there is a background rule and no colour rule" is a fact you can read
 * directly.
 *
 * This is deliberately NOT an allowlist of known offenders. A `KNOWN_DEAD` list
 * is how this defect class became normal enough to survive an extraction, and
 * that list was deleted on purpose under NEH-301. What follows are exclusions
 * for cases where inheriting is *correct*, each with the reason it is correct.
 */

const styles = readFileSync(
  join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
  "utf8",
);

/**
 * Backgrounds that paint nothing, so there is no surface to contrast against.
 *
 * Both spellings matter. Panda routes `transparent` through the token layer as
 * `var(--colors-transparent)`, so matching only the bare keyword reports
 * `box none` and `box unstyled` as offenders when they paint nothing at all —
 * two false positives, which is how a guard earns a reputation for crying wolf
 * and gets deleted.
 */
const PAINTS_NOTHING = /^(transparent|none|inherit|initial|unset|revert)$/i;
const PAINTS_NOTHING_TOKEN = /^var\(--[a-z-]*-(transparent|none)\)$/i;

/**
 * A translucent background shows what is behind it, so inheriting the
 * surrounding text colour is the intended behaviour rather than an omission.
 * Matches `rgba(...)` / `hsla(...)` with an alpha below 1, and the `/ <alpha>`
 * form.
 */
function isTranslucent(value: string): boolean {
  const rgba = /(?:rgba|hsla)\([^)]*,\s*(0?\.\d+|0)\s*\)/i.exec(value);
  if (rgba) return true;
  const slash = /\/\s*(0?\.\d+|0)\s*\)/.exec(value);
  return Boolean(slash);
}

/**
 * Recipes whose variants carry no text, so there is no contrast to get wrong.
 *
 * Keep this to components that structurally cannot contain text. A component
 * that merely *usually* has no text does not belong here — it will one day.
 */
const TEXTLESS_RECIPES = new Set([
  "separator-h", // a horizontal rule
  "separator-v", // a vertical rule
]);

/**
 * Variants where inheriting the surrounding text colour is the design intent.
 *
 * `glass` is translucent by definition: the surface is meant to show the page
 * through it, and pinning a text colour would defeat that on half the
 * backgrounds it is placed over. Recorded as a decision, not an oversight
 * (NEH-441 asked for one either way).
 */
const INHERITS_BY_DESIGN = new Set(["glass"]);

/**
 * This file used to carry one deferral: `input-radio__item--variant_none`
 * painted a hardcoded `white`, and pairing a THEME token against a FIXED
 * surface would have swapped one legibility bug for another. The variant now
 * paints `boxBgMain` with `textMain`, so the deferral is gone and the guard
 * inspects that selector like any other.
 *
 * **Nothing replaces it.** A deferral list with no members is an invitation;
 * the next literal background gets an entry instead of a fix, and that is the
 * `KNOWN_DEAD` list NEH-301 deleted growing back. An exclusion below has to be
 * a statement that inheriting is *correct*, not that a fix is pending.
 */

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
    // Skip at-rule preambles (@media, @layer) — they carry no declarations of
    // their own and their inner rules are matched separately by this regex.
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

/**
 * Panda GROUPS shared declarations across selectors:
 *
 *   .box--variant_aurora,.box--variant_glass { color: var(--colors-text-primary) }
 *
 * so a variant's colour frequently lives in a rule it shares with a sibling,
 * under a comma-separated selector list. A scan that only matched
 * single-selector rules therefore reported `box aurora` as stating no colour
 * when it states one three lines further down — and that false positive is in
 * the original NEH-441 sweep too. Splitting on commas and accumulating per
 * selector is what makes this guard trustworthy rather than noisy.
 */
const backgroundBySelector = new Map<string, string>();
const colourBySelector = new Set<string>();
/**
 * The colour's VALUE, not merely that one was stated (NEH-796).
 *
 * The set above answers "did this variant say anything at all", which is the
 * NEH-441 question. It cannot answer "did it say the right thing" — and
 * `button solid` shipped for months stating `textPrimary` on an accent
 * background, which is a stated colour and a failing contrast ratio.
 */
const colourValueBySelector = new Map<string, string>();
for (const rule of rules) {
  const bg = backgroundOf(rule.body);
  const colour = declaration(rule.body, "color");
  const hasColour = Boolean(colour);
  for (const raw of rule.selector.split(",")) {
    const selector = raw.trim();
    if (!selector) continue;
    if (bg && !backgroundBySelector.has(selector)) {
      backgroundBySelector.set(selector, bg);
    }
    if (hasColour) {
      colourBySelector.add(selector);
      if (!colourValueBySelector.has(selector)) {
        colourValueBySelector.set(selector, colour!);
      }
    }
  }
}

/**
 * `--colors-button-bg-accent` -> `--colors-button-text-accent`, derived from
 * `TEXT_BACKGROUND_PAIRS` rather than written out here.
 *
 * That map is the token contract's own statement of which text token sits on
 * which surface, and it exists precisely because the relationship is NOT
 * inferable from the names — `buttonTextPlain` sits on `buttonBgPlain`, not on
 * any `box*`. Re-deriving it here would be a second copy free to drift from the
 * one the themes are validated against.
 *
 * Panda emits a semantic token as `var(--colors-<kebab-cased token name>)`.
 */
const kebab = (token: string) => token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cssVar = (token: string) => `var(--colors-${kebab(token)})`;
const PAIRED_TEXT_FOR_BACKGROUND = new Map(
  Object.entries(TEXT_BACKGROUND_PAIRS).map(([text, background]) => [
    cssVar(background),
    cssVar(text),
  ]),
);

/**
 * Selector shapes.
 *
 * The character classes accept UPPERCASE deliberately. Panda emits a variant
 * key verbatim into the class name, so a camelCase variant becomes
 * `.box--variant_probeVariant` — and a lowercase-only pattern silently skips
 * it, letting exactly the defect this guard exists for through unseen. That is
 * not hypothetical: the first version of this file was lowercase-only, and the
 * verification step (inject an offender, watch it fail) passed green because
 * the injected variant happened to be camelCase. The guard looked finished and
 * inspected nothing.
 */
const RECIPE = "[A-Za-z0-9-]+(?:__[A-Za-z0-9-]+)?";
const BASE_SELECTOR = new RegExp(`^\\.(${RECIPE})$`);
const VARIANT_SELECTOR = new RegExp(`^\\.(${RECIPE})--variant_([A-Za-z0-9-]+)$`);

/** Every recipe whose BASE rule states a colour — its variants may omit one. */
const baseStatesColour = new Set<string>();
for (const selector of colourBySelector) {
  const m = BASE_SELECTOR.exec(selector);
  if (m) baseStatesColour.add(m[1]!);
}

describe("a variant that paints a background states its text colour", () => {
  const offenders: string[] = [];

  for (const [selector, bg] of backgroundBySelector) {
    const m = VARIANT_SELECTOR.exec(selector);
    if (!m) continue; // not a plain variant rule (pseudo-states excluded)
    // Both groups are non-optional in the pattern, so a match guarantees them;
    // the compiler cannot see that through `exec`'s signature.
    const recipe = m[1]!;
    const variant = m[2]!;

    if (TEXTLESS_RECIPES.has(recipe)) continue;
    if (INHERITS_BY_DESIGN.has(variant)) continue;

    if (PAINTS_NOTHING.test(bg)) continue;
    if (PAINTS_NOTHING_TOKEN.test(bg)) continue;
    if (isTranslucent(bg)) continue;

    if (colourBySelector.has(selector)) continue;
    if (baseStatesColour.has(recipe)) continue;

    offenders.push(`${selector} { background: ${bg} }  — states no color`);
  }

  it("finds no variant painting a surface it has not paired a text colour with", () => {
    expect(offenders).toEqual([]);
  });

  it("actually inspected the stylesheet, rather than passing on an empty read", () => {
    // A guard whose input silently became empty passes forever while checking
    // nothing — the same failure mode as a lint run that examined zero files.
    // These pin the scan to real content: the stylesheet must exist, and it
    // must contain variant rules of the shape the scan above matches.
    expect(styles.length).toBeGreaterThan(10_000);
    const variantSelectors = [...colourBySelector, ...backgroundBySelector.keys()]
      .filter((s) => VARIANT_SELECTOR.test(s));
    expect(new Set(variantSelectors).size).toBeGreaterThan(20);
    // And several of them paint a background, or the interesting branch of the
    // scan is never reached and this passes while inspecting nothing.
    const painted = [...backgroundBySelector.keys()].filter((s) =>
      VARIANT_SELECTOR.test(s),
    );
    expect(painted.length).toBeGreaterThan(5);
  });

  it("pairs the two variants this guard was written for", () => {
    // Named explicitly so a regression reads as "the button lost its text
    // colour again" rather than as an anonymous entry in the list above.
    expect(backgroundBySelector.has(".button--variant_outline")).toBe(true);
    expect(colourBySelector.has(".button--variant_outline")).toBe(true);
    expect(styles).toContain("--colors-button-text-accent");

    expect(backgroundBySelector.has(".box--variant_link")).toBe(true);
    expect(colourBySelector.has(".box--variant_link")).toBe(true);
  });

  it("pairs `solid` the way `outline` is paired (NEH-796)", () => {
    // `solid` is the app-wide default variant, and it stated `textPrimary` —
    // the colour that goes on `boxBgPrimary` — over an accent background.
    // Against optima-cloud-saas's light theme that measures 2.43:1, below AA;
    // its dark theme happens to clear AA, which is what let a default variant
    // ship unreadable for one of the two themes and neither host notice.
    //
    // The sweep above cannot see this: `solid` DID state a colour, so "has a
    // background and no colour" was false. What was wrong is WHICH colour, and
    // that is what the block below asks in general.
    expect(backgroundBySelector.get(".button--variant_solid")).toBe(
      "var(--colors-button-bg-accent)",
    );
    expect(colourValueBySelector.get(".button--variant_solid")).toBe(
      "var(--colors-button-text-accent)",
    );
  });

  /**
   * The general form of the assertion above, and the gap this file had.
   *
   * Every other check here asks about a property a recipe SETS or OMITS. None
   * asked whether the value it set was the one that goes WITH the surface
   * underneath — and that pairing is made by the PRESET, so a host's own
   * contrast tests structurally cannot see it either. That is this project's
   * recurring "a check that verifies one half and reads as the whole".
   *
   * ## The scope is gone (NEH-877)
   *
   * NEH-796 landed this sweep restricted to `buttonRecipe`, with the rest
   * recorded as a finding: fixing them repaints text in eight recipes across
   * four consuming applications, which wanted its own PR and a real look at the
   * result. That PR is NEH-877 and this is it — the sweep now runs over the
   * whole preset with no recipe restriction, and there is still no allowlist.
   *
   * **The count on that finding was 28; measured, it is 27.** The number is
   * corrected rather than quietly dropped, because the next person to widen a
   * guard will compare against it. `NEH_877_CORRECTED` below is the measured
   * list, and it is asserted as coverage rather than as an exception.
   */

  it("states the PAIRED text token wherever the preset paints a contract surface", () => {
    // Only backgrounds the token contract has declared a partner for. A variant
    // painting `gray.800` or a gradient is making a pairing the contract says
    // nothing about, and asserting on it would be inventing a rule rather than
    // enforcing one.
    //
    // `INHERITS_BY_DESIGN` is deliberately NOT consulted here, and that is a
    // change from NEH-796 rather than an oversight. It excuses `glass` from the
    // sweep above because a translucent surface should show the page through it
    // — but this sweep only fires when the background is a CONTRACT SURFACE
    // TOKEN, and the contract naming a text partner for a surface is the
    // contract saying that surface is opaque and has a known foreground. Five
    // `glass` variants painted one of those and stated the wrong partner, the
    // worst of them white-on-near-white at 1.05:1 (`tooltip`, against optima's
    // light theme). One of the five was `button glass` — inside the recipe
    // NEH-796 believed it had guarded without exception. A name-based exemption
    // in a guard whose whole premise is that it has none is exactly the
    // `KNOWN_DEAD` shape NEH-301 deleted, one indirection along.
    const mispaired: string[] = [];

    for (const [selector, bg] of backgroundBySelector) {
      const m = VARIANT_SELECTOR.exec(selector);
      if (!m) continue;

      const expected = PAIRED_TEXT_FOR_BACKGROUND.get(bg.trim());
      if (!expected) continue;

      const actual = colourValueBySelector.get(selector);
      // Stating no colour at all is the sweep above's finding, reported there.
      if (actual === undefined) continue;
      if (actual.trim() === expected) continue;

      mispaired.push(`${selector} { background: ${bg}; color: ${actual} } — expected ${expected}`);
    }

    expect(mispaired).toEqual([]);
  });

  /**
   * Every variant NEH-877 repainted, named.
   *
   * The sweep above is the guard; this is its COVERAGE. They fail differently
   * and both failures matter: the sweep goes red if a variant states the wrong
   * partner, and this goes red if a variant stops being *inspected* at all —
   * which is what happens when a recipe swaps a contract surface for a literal
   * or a gradient. A surface the contract knows nothing about is a surface
   * neither this file nor a host's theme tests can check, so silently drifting
   * out of the sweep is a regression that would otherwise read as a pass.
   *
   * Measured against optima-cloud-saas's real themes rather than eyeballed:
   * **14 of these 27 were below WCAG AA in the light theme** before this
   * change (5 of them under 1.2:1 — text the same colour as its own surface),
   * every one of the 27 clears AA after it, and none of them regressed in
   * either theme. The dark theme survived all but none of them, which is the
   * NEH-796 pattern exactly: a defect that only one of two themes reveals is
   * one that ships.
   */
  const NEH_877_CORRECTED = [
    // `boxBgAccent` -> `textAccent`. Was `textPrimary`, the partner of
    // `boxBgPrimary`: 1.17:1 in optima's light theme.
    ".form--variant_solid",
    ".input-dropdown--variant_solid",
    ".input-dropdown--variant_glass",
    ".input-text--variant_solid",
    ".input-text--variant_glass",
    ".input-radio__item--variant_solid",
    // `buttonBgAccent` -> `buttonTextAccent`. The NEH-796 pairing exactly,
    // in the recipes it was not applied to: 2.43:1 light.
    ".button--variant_glass",
    ".iconButton--variant_solid",
    ".iconButton--variant_outline",
    ".iconButton--variant_glass",
    ".input-bool__control--variant_solid",
    ".input-bool__control--variant_outline",
    // `buttonBgSecondary` -> `buttonTextSecondary`.
    ".input-dropdown--variant_matte",
    ".input-dropdown--variant_ghost",
    ".input-text--variant_matte",
    ".input-text--variant_ghost",
    ".input-bool__control--variant_ghost",
    ".input-radio__item--variant_matte",
    ".input-radio__item--variant_ghost",
    ".list__item--variant_ghost",
    // `boxBgPrimary` -> `textPrimary`. Every tooltip variant paints the same
    // surface and seven of them named a different surface's text token.
    ".tooltip--variant_solid",
    ".tooltip--variant_aurora",
    ".tooltip--variant_glass",
    ".tooltip--variant_matte",
    ".tooltip--variant_ghost",
    ".tooltip--variant_none",
    ".tooltip--variant_unstyled",
  ] as const;

  it("still inspects every variant NEH-877 corrected", () => {
    const notInspected = NEH_877_CORRECTED.filter((selector) => {
      const bg = backgroundBySelector.get(selector);
      return !bg || !PAIRED_TEXT_FOR_BACKGROUND.has(bg.trim());
    });

    expect(notInspected).toEqual([]);
    // Eight recipes, which is the breadth the issue was filed about. A sweep
    // that quietly narrowed to one recipe again would still satisfy the line
    // above if the list were trimmed to match, so the count is pinned here.
    expect(NEH_877_CORRECTED.length).toBe(27);
  });

  it("actually reached the pairing branch, rather than matching nothing", () => {
    // The guard on the guard, again. `PAIRED_TEXT_FOR_BACKGROUND` is keyed by
    // the exact string Panda emits, so a change to that spelling would make
    // every lookup miss and the sweep above pass having compared nothing.
    const matched = [...backgroundBySelector].filter(([selector, bg]) => {
      const m = VARIANT_SELECTOR.exec(selector);
      return Boolean(m) && PAIRED_TEXT_FOR_BACKGROUND.has(bg.trim());
    });

    expect(matched.length).toBeGreaterThanOrEqual(NEH_877_CORRECTED.length);
    // And across several recipes, not 27 variants of one — the shape the scope
    // removal is FOR.
    const recipes = new Set(
      matched.map(([selector]) => VARIANT_SELECTOR.exec(selector)![1]!),
    );
    expect(recipes.size).toBeGreaterThanOrEqual(8);
    expect(PAIRED_TEXT_FOR_BACKGROUND.get("var(--colors-button-bg-accent)")).toBe(
      "var(--colors-button-text-accent)",
    );
  });

  it("paints input-radio's `none` variant from the theme, not from a literal", () => {
    // The deferral this file used to carry (NEH-549). Named rather than left to
    // the sweep above, because the sweep only asks whether a colour was stated
    // — it would stay green if the background went back to `white` and a colour
    // came with it, which is the white-on-white half of the same bug.
    const selector = ".input-radio__item--variant_none";
    expect(backgroundBySelector.get(selector)).toBe("var(--colors-box-bg-main)");
    expect(colourBySelector.has(selector)).toBe(true);
  });
});

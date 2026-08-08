import { readFileSync } from "fs";
import { join } from "path";

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
 * A real offender that this guard deliberately does NOT fail on yet, because
 * the honest fix is blocked on something else.
 *
 * `input-radio__item--variant_none` paints a hardcoded `white` rather than a
 * token. Pairing a THEME token against a FIXED surface would swap one
 * legibility bug for another — `textPrimary` resolves light under a dark theme,
 * giving white on white. So the background has to stop being a literal first,
 * which is the inherited-literals cleanup NEH-441 scoped out and NEH-549
 * tracks.
 *
 * This entry is a deferral with a ticket, not a `KNOWN_DEAD` list: it names one
 * selector, says what unblocks it, and points at where that happens. If it ever
 * grows a second member without a matching issue, that is the signal this has
 * become the thing NEH-301 deleted.
 */
const DEFERRED_PENDING_LITERAL_CLEANUP = new Map([
  [".input-radio__item--variant_none", "NEH-549"],
]);

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
for (const rule of rules) {
  const bg = backgroundOf(rule.body);
  const hasColour = Boolean(declaration(rule.body, "color"));
  for (const raw of rule.selector.split(",")) {
    const selector = raw.trim();
    if (!selector) continue;
    if (bg && !backgroundBySelector.has(selector)) {
      backgroundBySelector.set(selector, bg);
    }
    if (hasColour) colourBySelector.add(selector);
  }
}

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
    if (DEFERRED_PENDING_LITERAL_CLEANUP.has(selector)) continue;

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
});

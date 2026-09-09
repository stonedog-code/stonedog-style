import { readFileSync } from "fs";
import { join } from "path";

/**
 * No emitted declaration may name a paint function the browser will discard
 * (NEH-1266).
 *
 * ## The defect this exists for
 *
 * `bgGradient: "linear(to-b, gray.800, gray.900)"` is Chakra v2 syntax. Panda
 * has no `bgGradient` utility and no `linear()` shorthand, so it passed the
 * value straight through and emitted
 *
 * ```css
 * background-image: linear(to-b, gray.800, gray.900);
 * ```
 *
 * `linear()` is a CSS *easing* function, not an `<image>`, so the declaration
 * is invalid and every engine drops it at parse time. Confirmed in Chromium:
 * the element reads back `background-image: none`.
 *
 * Ten of these shipped across seven recipes. Two were removed under NEH-881
 * and the remaining eight under NEH-1266 — but nothing stopped the next one
 * from arriving, and this class of defect is invisible to every other tier:
 *
 *   - the token contract passes, because `linear(...)` names no token
 *   - `tsc` passes, because the value is a string
 *   - jsdom passes, because it has no cascade and no paint
 *   - a screenshot passes, because "no background" is what the code asked for
 *     as far as anyone reviewing it could tell
 *
 * Worse, a dead gradient actively BLINDS the pairing guard next door.
 * `variant-contrast-pairing.test.ts` reads `background-image` before
 * `background`, so an inert gradient made it treat the variant as painting a
 * surface the token contract knows nothing about — and skip it. That is
 * exactly how NEH-881's 2.15:1 button shipped for two releases.
 *
 * ## Why an allowlist rather than a ban on `linear(`
 *
 * Banning the one spelling that has bitten us catches that spelling again and
 * nothing else. `radial(`, `conic(` and `repeating(` are the same Chakra
 * shorthand family, and a future one would be a fourth. So this asserts the
 * positive: every `background-image` value the preset emits is a production
 * CSS actually accepts.
 */

const styles = readFileSync(
  join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
  "utf8",
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
    // At-rule preambles (@media, @layer) carry no declarations of their own;
    // the rules nested inside them are matched separately by this regex.
    if (selector.startsWith("@")) continue;
    rules.push({ selector, body: m[2]! });
  }
  return rules;
}

const rules = parseRules(styles);

/** Every `background-image` / `background` value the preset emits. */
interface Painted {
  selector: string;
  property: string;
  value: string;
}

const painted: Painted[] = [];
for (const rule of rules) {
  for (const property of ["background-image", "background"]) {
    const re = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;]+)`, "i");
    const m = re.exec(rule.body);
    if (m) painted.push({ selector: rule.selector, property, value: m[1]!.trim() });
  }
}

/**
 * The `<image>` and `<color>` productions a `background`/`background-image`
 * value may legitimately start with, plus the keywords.
 *
 * `var(` covers every token reference, which is the overwhelming majority.
 */
const ACCEPTED = [
  /^none$/i,
  /^(inherit|initial|unset|revert|transparent|currentColor)$/i,
  /^var\(/i,
  /^url\(/i,
  /^(repeating-)?(linear|radial|conic)-gradient\(/i,
  /^image-set\(/i,
  /^-webkit-(repeating-)?(linear|radial|conic)-gradient\(/i,
  /^color-mix\(/i,
  /^rgba?\(/i,
  /^hsla?\(/i,
  /^#[0-9a-f]{3,8}$/i,
  // `background` is a shorthand, so a token reference can be followed by
  // position/size/repeat keywords. Anchoring on the first function is enough
  // to prove the paint is real.
];

describe("no recipe emits a paint the browser will discard", () => {
  it("emits no Chakra `bgGradient` shorthand anywhere", () => {
    // The literal defect, named. A regression here should read as "the dead
    // gradient is back" rather than as an anonymous allowlist miss.
    const offenders = painted.filter(({ value }) =>
      /\b(linear|radial|conic|repeating)\s*\(/i.test(
        value.replace(/(repeating-)?(linear|radial|conic)-gradient\s*\(/gi, ""),
      ),
    );

    expect(
      offenders.map((o) => `${o.selector} { ${o.property}: ${o.value} }`),
    ).toEqual([]);
  });

  it("emits only background paints CSS accepts", () => {
    const offenders = painted.filter(
      ({ value }) => !ACCEPTED.some((re) => re.test(value)),
    );

    expect(
      offenders.map((o) => `${o.selector} { ${o.property}: ${o.value} }`),
    ).toEqual([]);
  });

  it("never emits `bg-gradient` as a property", () => {
    // Panda emits an unknown shorthand's KEY verbatim when it has no utility
    // for it, so a future `bgGradient` could arrive as a property rather than
    // as a value. Cheap to pin, and it fails in a different place from the
    // assertions above.
    expect(styles).not.toMatch(/(?:^|[;{\s])bg-?gradient\s*:/im);
  });

  it("actually inspected the stylesheet, rather than passing on an empty read", () => {
    // Counts, not adjectives. A scan whose input silently became empty passes
    // forever while checking nothing — this repo's own recurring failure. The
    // measured figures when this landed were 629 rules and 34 background
    // paints; the floors are set well below so ordinary churn does not trip
    // them, and well above zero so an empty read cannot pass.
    expect(styles.length).toBeGreaterThan(10_000);
    expect(rules.length).toBeGreaterThan(400);
    expect(painted.length).toBeGreaterThan(15);

    // And the accepted set is genuinely exercised: real gradients exist in the
    // stylesheet, so "no gradient anywhere" is not how the first assertion
    // passes.
    const gradients = painted.filter(({ value }) =>
      /(repeating-)?(linear|radial|conic)-gradient\(/i.test(value),
    );
    expect(gradients.length).toBeGreaterThan(3);
  });

  it("keeps `aurora` separators painting, rather than inert (NEH-1266)", () => {
    // These two carried the ONLY paint their variant had, so deleting the dead
    // declaration would have made a public variant permanently identical to
    // `none`. They were converted to real `linear-gradient(...)` instead, and
    // that is the half of this change a reader can see.
    for (const selector of [
      ".separator-h--variant_aurora",
      ".separator-v--variant_aurora",
    ]) {
      const rule = painted.find((p) => p.selector === selector);
      expect(rule).toBeDefined();
      expect(rule!.value).toMatch(/^linear-gradient\(/);
      expect(rule!.value).toContain("var(--colors-purple-400)");
    }
  });

  it("leaves the three fixed `matte` variants painting no surface at all", () => {
    // `box`, `input-bool` and `list` `matte` each set a dead gradient AND a
    // literal `color: white` justified by it — white on whatever was behind
    // them, which on a light page is white-on-near-white. Both are gone, so
    // these variants now inherit their host's pairing, which is legible by
    // construction.
    //
    // Pinned because the alternative fix (give them a token surface) is a
    // design change: if one ever lands, this assertion is the place that says
    // so out loud rather than the change slipping through silently.
    for (const selector of [
      ".box--variant_matte",
      ".input-bool__control--variant_matte",
      ".list__root--variant_matte",
    ]) {
      expect(painted.find((p) => p.selector === selector)).toBeUndefined();
    }
    expect(styles).not.toMatch(
      /\.(box|list__root)--variant_matte\s*\{[^}]*color:\s*var\(--colors-white\)/,
    );
  });
});

import { readFileSync } from "fs";
import { join } from "path";
import {
  TEXT_BACKGROUND_PAIRS,
  colorTokenNames,
  emphasisTokenNames,
} from "../semantic-variables";

/**
 * A rule that renders text must not paint its surface with a FIXED raw-palette
 * literal while labelling it with a THEMED token (NEH-1264).
 *
 * ## The defect
 *
 * Three `none` variants shipped a hardcoded light fill under a host-supplied
 * text colour:
 *
 * ```
 * .button--variant_none             background: var(--colors-white)     color: var(--colors-text-main)
 * .iconButton--variant_none         background: var(--colors-gray-300)  color: var(--colors-text-main)
 * .input-bool__control--variant_none  background: var(--colors-gray-300)  color: var(--colors-button-text-primary)
 * ```
 *
 * A raw palette entry is the same colour in every theme; the token beside it is
 * whatever the host defines. So the pair cannot be measured once and trusted —
 * it is a different contrast ratio per theme, and nothing here can bound it.
 * Against this package's own README starter theme, which is dark, they measure
 * **1.05:1**, **1.41:1** and **1.47:1**. The first is not low contrast; it is
 * invisible.
 *
 * ## Why none of the three existing sweeps could see it
 *
 * | sweep | fires when | why it missed |
 * | -- | -- | -- |
 * | NEH-441 | a painted variant states no text colour | all three stated one |
 * | NEH-877 | the surface is a token the contract names a partner FOR | `white` and `gray.300` are raw palette, not contract surfaces |
 * | NEH-1264 (`surface-is-not-a-text-token`) | the surface is a FOREGROUND token | a raw literal is not a foreground token either |
 *
 * Each is correctly scoped for the question it asks. The gap is between them:
 * a surface that is neither a contract token nor a foreground token, which is
 * exactly what a raw palette literal is.
 *
 * ## Scoped by construction, never by allowlist
 *
 * The assertion needs BOTH halves — a fixed surface AND a themed foreground.
 * That excludes the legitimate cases without naming any of them:
 *
 *   - `.input-bool__control--variant_button` paints `gray.200` under
 *     `gray.800`. Both halves are fixed, so the pair is theme-independent and
 *     measurable once. It is a deliberate chip, not a defect.
 *   - Scrollbar tracks, dark-mode-scoped blocks and decorative pseudo-elements
 *     render no text, so they never declare `color` and never enter the set.
 *
 * An allowlist here would be the `KNOWN_DEAD` shape NEH-301 deleted, where the
 * next offender earns an entry instead of a fix.
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

/**
 * A raw palette entry is one Panda emits from its own colour scales, as
 * opposed to a semantic token this preset defines. Derived by exclusion: any
 * `--colors-*` this package does NOT name in its own token vocabulary came
 * from the palette. Listing the palette instead would be a second copy of
 * Panda's scales, free to drift the day one is added.
 */
const SEMANTIC_TOKENS = new Set<string>([
  ...Object.keys(TEXT_BACKGROUND_PAIRS),
  ...Object.values(TEXT_BACKGROUND_PAIRS),
  ...emphasisTokenNames(),
  ...colorTokenNames(),
]);
const kebab = (token: string) =>
  token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const SEMANTIC_VARS = new Set([...SEMANTIC_TOKENS].map((t) => `--colors-${kebab(t)}`));

/** `transparent`, `inherit` and `currentColor` paint nothing fixed. */
const PAINTS_NOTHING = new Set([
  "--colors-transparent",
  "--colors-current",
  "--colors-inherit",
]);

const THEMED_FOREGROUNDS = new Set(
  [
    ...Object.keys(TEXT_BACKGROUND_PAIRS),
    ...emphasisTokenNames(),
    ...colorTokenNames().filter((n) => /^text|Text/.test(n)),
  ].map((t) => `--colors-${kebab(t)}`),
);

function colourVarsIn(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--colors-[a-z0-9-]+)/gi)].map((m) => m[1]!);
}

const rules = parseRules(styles);

/**
 * Resolve the cascade PER SELECTOR, not per rule — Panda splits one variant
 * across several blocks and this guard is worthless without it.
 *
 * The planted control proved it. `tooltip`'s `none` given a `gray.500` fill
 * emits as
 *
 * ```css
 * .tooltip--variant_link,.tooltip--variant_none { color: var(--colors-text-primary) }
 * .tooltip--variant_none                        { background: var(--colors-gray-500) }
 * ```
 *
 * — the offending pair split across a grouped selector and a singleton. A
 * per-rule check sees one block with a colour and no surface and another with
 * a surface and no colour, and reports nothing. It passed the plant while the
 * three real offenders, which happen to emit both properties in one block,
 * kept it looking like it worked.
 *
 * So: split every grouped selector into its parts, key on the part with any
 * trailing state suffix removed (`:hover`, `[data-hover]`), and take the last
 * declaration of each property in document order. That is what an element
 * wearing the class actually resolves to — a hover background genuinely does
 * pair with a colour inherited from the base rule.
 */
const STATE_SUFFIX = /(:{1,2}[a-z-]+(\([^)]*\))?|\[[^\]]+\])+$/i;

/**
 * Split on TOP-LEVEL commas only. `:is(:hover, [data-hover])` — which Panda
 * emits for every `_hover` — carries a comma inside its parentheses, and a
 * naive `split(",")` cuts the selector in half, yielding the fragment
 * `.input-bool__control--variant_button:is(`. That fragment then keys its own
 * accumulator entry and the guard reports a pairing on a selector that does
 * not exist. Caught by the restore run of the planted control, not by review.
 */
function splitSelector(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

interface Declared {
  background: string | null;
  colour: string | null;
}

/**
 * Resolve the cascade PER SELECTOR, not per rule — Panda splits one variant
 * across several blocks and this guard is worthless without it.
 *
 * The planted control proved it. `tooltip`'s `none` given a `gray.500` fill
 * emits as
 *
 * ```css
 * .tooltip--variant_link,.tooltip--variant_none { color: var(--colors-text-primary) }
 * .tooltip--variant_none                        { background: var(--colors-gray-500) }
 * ```
 *
 * — the offending pair split across a grouped selector and a singleton. A
 * per-rule check sees one block with a colour and no surface and another with
 * a surface and no colour, and reports nothing. It passed the plant while the
 * three real offenders, which happen to emit both properties in one block,
 * kept it looking like it worked.
 *
 * A state rule falls back to its OWN base and to nothing else. Folding every
 * state into one bucket instead pairs an unchecked `_hover` background with a
 * `_checked` foreground — two declarations that never co-occur on an element —
 * and the guard then reports a defect nobody can render. That over-report is
 * the failure mode NEH-1264's description warns the first audit script had.
 */
const own = new Map<string, Declared>();
for (const { selector, body } of rules) {
  const background = backgroundOf(body);
  const colour = declaration(body, "color");
  if (!background && !colour) continue;
  for (const part of splitSelector(selector)) {
    const entry = own.get(part) ?? { background: null, colour: null };
    if (background) entry.background = background;
    if (colour) entry.colour = colour;
    own.set(part, entry);
  }
}

/** Selectors that paint a surface AND render text on it. */
const painted = [...own.entries()].flatMap(([part, declared]) => {
  const base = own.get(part.replace(STATE_SUFFIX, ""));
  const background = declared.background ?? base?.background ?? null;
  const colour = declared.colour ?? base?.colour ?? null;
  if (!background || !colour) return [];
  return [{ selector: part, background, colour }];
});

/** Of those, the ones whose surface is a fixed raw-palette literal. */
const fixedSurface = painted.filter(({ background }) => {
  const vars = colourVarsIn(background);
  if (vars.length === 0) return false;
  return vars.every(
    (v) => !SEMANTIC_VARS.has(v) && !PAINTS_NOTHING.has(v),
  );
});

/** Of those, the ones whose text colour comes from the host's theme. */
const offenders = fixedSurface.filter(({ colour }) =>
  colourVarsIn(colour).some((v) => THEMED_FOREGROUNDS.has(v)),
);

describe("no rule paints a fixed surface under a themed text colour", () => {
  it("examines a non-empty set at every narrowing step", () => {
    // The counts are the deliverable as much as the verdict: `0 offenders`
    // over 0 rules and over 626 are the same output and different facts.
    console.log(
      `[NEH-1264] ${rules.length} emitted rules; ` +
        `${painted.length} paint a surface and render text; ` +
        `${fixedSurface.length} of those paint a FIXED raw-palette surface; ` +
        `${offenders.length} of those label it with a THEMED token.`,
    );
    expect(rules.length).toBeGreaterThan(200);
    expect(painted.length).toBeGreaterThan(20);
    // The narrowing must not be empty either, or the final assertion is a pass
    // over nothing: the legitimate fixed-surface rules keep this above zero.
    expect(fixedSurface.length).toBeGreaterThan(0);
  });

  it("classifies the vocabulary in both directions, so neither set is empty by mistake", () => {
    expect(SEMANTIC_VARS.has("--colors-box-bg-main")).toBe(true);
    expect(SEMANTIC_VARS.has("--colors-gray-300")).toBe(false);
    expect(THEMED_FOREGROUNDS.has("--colors-text-main")).toBe(true);
    expect(THEMED_FOREGROUNDS.has("--colors-box-bg-main")).toBe(false);
  });

  it("finds no text-rendering rule on a fixed surface with a themed foreground", () => {
    // Named, not counted. The selector IS the fix.
    expect(
      offenders.map(
        ({ selector, background, colour }) =>
          `${selector} { background: ${background}; color: ${colour} }`,
      ),
    ).toEqual([]);
  });
});

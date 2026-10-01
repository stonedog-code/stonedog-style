import { readFileSync } from "fs";
import { join } from "path";
import { TEXT_BACKGROUND_PAIRS } from "../semantic-variables";

/**
 * A state that changes how a control looks must keep its text and its surface
 * a PAIR (NEH-1788).
 *
 * `variant-contrast-pairing.test.ts` asks whether a variant's resting rule
 * states the text that goes with its background, and it says in as many words
 * that it stops there: "not a plain variant rule (pseudo-states excluded)".
 * This is the other half. Hover, active and focus are separate rules in the
 * stylesheet, they repaint things, and nothing was reading them.
 *
 * Two shapes, both shipped:
 *
 * 1. **A state sets a text colour and paints nothing.** `button link` said
 *    `_hover: { color: buttonTextAccent }` on a variant whose background is
 *    transparent — an on-accent text colour put on whatever the page is. In a
 *    consumer's light theme: white on white, 1.00:1, on every link-styled
 *    control. The colour was a real token, correctly spelled, and paired with a
 *    surface that was never painted.
 * 2. **A state repaints the surface and says nothing about the text.**
 *    `form outline` and `menu item` both hovered to `boxBgAccent` and left the
 *    text riding its resting colour onto it — 1.17:1 in that same theme.
 *
 * Both are the rule below read in one direction or the other: **in any state,
 * the text is the contract's partner for the surface in that state.** The
 * partner comes from `TEXT_BACKGROUND_PAIRS`, never from a list written here,
 * because that map is what every host's theme is validated against — a pairing
 * outside it is a ratio nobody has checked.
 *
 * ## What it does not judge, and says so
 *
 * A surface with no partner in the contract — a raw palette literal, a
 * translucent value, a gradient — has no token to compare against. Those are
 * COUNTED and reported, not passed: `fixed-surface-under-themed-text.test.ts`
 * owns the literal case. A state whose rule sits under an ancestor selector
 * (`.dark .menu__item:hover`) is likewise outside this file.
 *
 * It works on the generated stylesheet for the reason its sibling does: "there
 * is a hover rule and it states no colour" is a fact that exists only there.
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
 * Split a selector LIST on its top-level commas only.
 *
 * Panda writes a state as `:is(:hover, [data-hover])`, with a comma inside the
 * parentheses. A plain `split(",")` cuts that in half, neither half matches
 * anything, and this whole file examines NOTHING while reporting no offenders —
 * which is exactly what its first version did. The count assertion below is
 * what said so.
 */
function splitSelectorList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const PAINTS_NOTHING = /^(transparent|none|inherit|initial|unset|revert)$/i;
const PAINTS_NOTHING_TOKEN = /^var\(--[a-z-]*-(transparent|none)\)$/i;
const paintsNothing = (value: string | null): boolean =>
  value === null || PAINTS_NOTHING.test(value) || PAINTS_NOTHING_TOKEN.test(value);

const kebab = (token: string) => token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cssVar = (token: string) => `var(--colors-${kebab(token)})`;
const PAIRED_TEXT_FOR_BACKGROUND = new Map(
  Object.entries(TEXT_BACKGROUND_PAIRS).map(([text, background]) => [
    cssVar(background),
    cssVar(text),
  ]),
);

/**
 * Slots that hold no text, so a surface there has nothing to pair with.
 *
 * Keep this to parts that structurally cannot contain text. A part that merely
 * usually has none does not belong here — it will one day.
 */
const TEXTLESS = new Set([
  "input-bool__control", // the box of a checkbox or switch; its label is a sibling
]);

/**
 * `.recipe`, `.recipe__slot`, `.recipe--variant_x`, each followed by one or
 * more `:is(…)` state groups. Uppercase is accepted for the reason the sibling
 * guard records: Panda emits a camelCase variant key verbatim.
 */
const RECIPE = "[A-Za-z0-9-]+(?:__[A-Za-z0-9-]+)?";
const STATE_RULE = new RegExp(
  `^\\.(${RECIPE})(--variant_[A-Za-z0-9-]+)?((?::is\\([^)]*\\))+)$`,
);
const INTERACTION = /:(hover|active|focus|focus-visible|focus-within)\b/;

const rules = parseRules(styles);

/** Resting background and colour per selector, across Panda's grouped rules. */
const restingBackground = new Map<string, string>();
const restingColour = new Map<string, string>();
for (const rule of rules) {
  const bg = backgroundOf(rule.body);
  const colour = declaration(rule.body, "color");
  for (const selector of splitSelectorList(rule.selector)) {
    if (!selector || selector.includes(":")) continue;
    if (bg && !restingBackground.has(selector)) restingBackground.set(selector, bg);
    if (colour && !restingColour.has(selector)) restingColour.set(selector, colour);
  }
}

interface StateRule {
  selector: string;
  recipe: string;
  variantSelector: string;
  baseSelector: string;
  background: string | null;
  colour: string | null;
}

const stateRules: StateRule[] = [];
for (const rule of rules) {
  for (const selector of splitSelectorList(rule.selector)) {
    const m = STATE_RULE.exec(selector);
    if (!m || !INTERACTION.test(m[3]!)) continue;
    const background = backgroundOf(rule.body);
    const colour = declaration(rule.body, "color");
    // A state that touches neither is not this file's business.
    if (!background && !colour) continue;
    stateRules.push({
      selector,
      recipe: m[1]!,
      variantSelector: `.${m[1]!}${m[2] ?? ""}`,
      baseSelector: `.${m[1]!}`,
      background,
      colour,
    });
  }
}

type Verdict =
  | { kind: "ok" }
  | { kind: "not-judged"; why: string }
  | { kind: "offender"; why: string };

function judge(rule: StateRule): Verdict {
  if (TEXTLESS.has(rule.recipe)) return { kind: "not-judged", why: "holds no text" };

  const restingBg =
    restingBackground.get(rule.variantSelector) ?? restingBackground.get(rule.baseSelector) ?? null;
  const restingText =
    restingColour.get(rule.variantSelector) ?? restingColour.get(rule.baseSelector) ?? null;

  // The surface IN this state: what the state paints, else what was there.
  const surface = rule.background ?? restingBg;

  if (paintsNothing(surface)) {
    // Nothing is painted, so there is no surface for a new colour to belong
    // to. The only colour this state may state is the one already there.
    if (rule.colour && rule.colour !== restingText) {
      return {
        kind: "offender",
        why: `sets ${rule.colour} while painting no surface (resting colour is ${restingText ?? "inherited"})`,
      };
    }
    return { kind: "ok" };
  }

  const partner = PAIRED_TEXT_FOR_BACKGROUND.get(surface!);
  if (!partner) {
    return { kind: "not-judged", why: `surface ${surface} has no partner in the token contract` };
  }

  if (rule.background) {
    // The state repaints the surface, so it must say the text — in this rule.
    if (!rule.colour) {
      return { kind: "offender", why: `repaints the surface to ${surface} and states no text colour` };
    }
    if (rule.colour !== partner) {
      return { kind: "offender", why: `pairs ${surface} with ${rule.colour}; the contract's partner is ${partner}` };
    }
    return { kind: "ok" };
  }

  // The state changes only the text, on a surface the resting rule painted.
  if (rule.colour !== partner) {
    return { kind: "offender", why: `sets ${rule.colour} on ${surface}; the contract's partner is ${partner}` };
  }
  return { kind: "ok" };
}

const verdicts = stateRules.map((rule) => ({ rule, verdict: judge(rule) }));

describe("in every state, the text is the partner of the surface in that state", () => {
  it("finds state rules to examine — a scan over nothing would pass everything", () => {
    const judged = verdicts.filter((v) => v.verdict.kind !== "not-judged");
    // The stylesheet carries well over a dozen hover and active rules that
    // touch a background or a colour. If this number collapses, the selector
    // pattern has stopped matching what Panda emits.
    expect(stateRules.length).toBeGreaterThanOrEqual(12);
    expect(judged.length).toBeGreaterThanOrEqual(8);
    // Said out loud, because "0 offenders" over 0 rules and over 15 are the
    // same sentence about very different stylesheets.
    console.info(
      `[state-colour-pairing] ${stateRules.length} state rule(s) touch a surface or a text colour; ${judged.length} judged, ${stateRules.length - judged.length} not judged`,
    );
  });

  it("names every rule it did not judge, and why", () => {
    const skipped = verdicts
      .filter((v) => v.verdict.kind === "not-judged")
      .map((v) => `${v.rule.selector} — ${(v.verdict as { why: string }).why}`);
    // Not an allowlist: a description of what is outside this file's reach.
    // Reading it is how somebody notices a surface that should have a partner.
    for (const line of skipped) expect(line).toMatch(/holds no text|has no partner/);
  });

  it("has no state that breaks the pairing", () => {
    const offenders = verdicts
      .filter((v) => v.verdict.kind === "offender")
      .map((v) => `${v.rule.selector} ${(v.verdict as { why: string }).why}`);
    expect(offenders).toEqual([]);
  });
});

describe("splitting a selector list", () => {
  it("keeps a state group whole, and still splits the list around it", () => {
    expect(splitSelectorList(".a:is(:hover, [data-hover])")).toEqual([
      ".a:is(:hover, [data-hover])",
    ]);
    expect(splitSelectorList(".a,.b:is(:hover, [data-hover]), .c")).toEqual([
      ".a",
      ".b:is(:hover, [data-hover])",
      ".c",
    ]);
  });
});

describe("the judge, against the shapes it exists to catch", () => {
  // The guard on the guard. Each of these is a rule that really shipped; if
  // `judge` ever stops calling one an offender, the suite above is passing
  // because it cannot see, not because the stylesheet is clean.
  const rule = (over: Partial<StateRule>): StateRule => ({
    selector: ".probe--variant_x:is(:hover, [data-hover])",
    recipe: "probe",
    variantSelector: ".probe--variant_x",
    baseSelector: ".probe",
    background: null,
    colour: null,
    ...over,
  });

  beforeAll(() => {
    restingBackground.set(".probe--variant_link", "var(--colors-transparent)");
    restingColour.set(".probe--variant_link", "var(--colors-text-main)");
    restingBackground.set(".probe--variant_solid", "var(--colors-button-bg-accent)");
    restingColour.set(".probe--variant_solid", "var(--colors-button-text-accent)");
  });

  it("a colour introduced over an unpainted surface — the `link` hover", () => {
    const verdict = judge(
      rule({ variantSelector: ".probe--variant_link", colour: "var(--colors-button-text-accent)" }),
    );
    expect(verdict.kind).toBe("offender");
  });

  it("a surface repainted with no text stated — the `form outline` hover", () => {
    const verdict = judge(
      rule({ variantSelector: ".probe--variant_link", background: "var(--colors-box-bg-accent)" }),
    );
    expect(verdict.kind).toBe("offender");
  });

  it("a surface repainted with the WRONG text — the `solid` hover before it was fixed", () => {
    const verdict = judge(
      rule({
        variantSelector: ".probe--variant_solid",
        background: "var(--colors-button-bg-secondary)",
        colour: "var(--colors-text-primary)",
      }),
    );
    expect(verdict.kind).toBe("offender");
  });

  it("passes the correct shapes, so it is not simply refusing everything", () => {
    expect(
      judge(
        rule({
          variantSelector: ".probe--variant_solid",
          background: "var(--colors-button-bg-secondary)",
          colour: "var(--colors-button-text-secondary)",
        }),
      ).kind,
    ).toBe("ok");
    // A state that restates the resting colour over an unpainted surface.
    expect(
      judge(rule({ variantSelector: ".probe--variant_link", colour: "var(--colors-text-main)" }))
        .kind,
    ).toBe("ok");
  });
});

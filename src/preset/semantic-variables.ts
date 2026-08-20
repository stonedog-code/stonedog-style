/**
 * The token contract.
 *
 * Every colour in this design system is a Panda token whose *value* is a bare
 * CSS custom property — `boxBgPrimary` resolves to `var(--hopper-box-primary-bg)`.
 * Nothing here defines a colour. The host application is what sets those custom
 * properties at runtime (from a theme picker, a database, a `<style>` block, a
 * stylesheet — the system does not care), and that indirection is the whole
 * reason a single component library can wear two products' branding.
 *
 * Two consequences worth internalising before changing anything below:
 *
 * 1. **A token with no matching custom property renders as nothing.** There is
 *    no fallback colour by design — a silent black-on-black box is a louder bug
 *    than a silent wrong-shade box, and it surfaces during development instead
 *    of in production. Consumers MUST define every property this file names.
 *    `requiredCssCustomProperties()` exists so a consumer can assert that.
 *
 * 2. **The names are public API.** A host app's theme data keys off them. Adding
 *    a token is backwards-compatible; renaming or removing one silently breaks
 *    whatever was painting it, because CSS has no import errors.
 */

/** A Panda token name mapped to the CSS custom-property suffix it reads. */
type TokenMap = Record<string, string>;

/**
 * `<panda token name>` → `<custom property suffix>`.
 *
 * The suffix is everything after the prefix, so `"box-primary-bg"` becomes
 * `var(--hopper-box-primary-bg)` at the default prefix. The two naming schemes
 * differ on purpose and are not derivable from each other: token names are
 * camelCase and read component-first (`boxBgPrimary`), custom properties are
 * kebab-case and read scope-first (`box-primary-bg`). Keeping the mapping
 * explicit is what lets either side be renamed without touching the other.
 */
const COLOR_TOKENS: TokenMap = {
  // Text that carries meaning on its own — errors, warnings, emphasis.
  textPop: "text-pop-text",
  textError: "text-error-text",
  textWarning: "text-warning-text",
  // Added NEH-519. The contract could express failure and caution but not
  // success, so every consumer that needed one improvised — and the obvious
  // substitute, `textAccent`, is wrong: accent is whatever the host theme sets
  // it to, with nothing constraining it to read as positive, so a confirmation
  // could land in an alarming colour. HopperGuard had a live site doing exactly
  // this dance (an SSO panel reporting "ok" vs error) and had to settle for
  // neutral text.
  //
  // Deliberately NOT in TEXT_BACKGROUND_PAIRS, matching textError and
  // textWarning: a meaning-carrying colour appears on whatever surface the
  // message happens to sit on, so there is no single pairing to contrast-check
  // it against.
  textSuccess: "text-success-text",

  // Text on each surface. Pair these with the matching `boxBg*` — see
  // TEXT_BACKGROUND_PAIRS for which goes with which.
  //
  // These are a SURFACE axis, not an emphasis one. `textSecondary` means "text
  // on the secondary surface"; it does not mean "less important text". Reading
  // it as the latter is the mistake NEH-519 records — it collapses two
  // different emphasis levels onto one colour and loses a distinction the UI
  // meant to draw. De-emphasis is EMPHASIS_TOKENS below.
  textMain: "box-main-text",
  textPrimary: "box-primary-text",
  textSecondary: "box-secondary-text",
  textAccent: "box-accent-text",

  // Arrows / carets.
  arrowBgPrimary: "arrow-primary-bg",
  arrowBgSecondary: "arrow-secondary-bg",
  arrowBgAccent: "arrow-accent-bg",
  arrowBorderPrimary: "arrow-primary-border",
  arrowBorderSecondary: "arrow-secondary-border",
  arrowBorderAccent: "arrow-accent-border",

  // Surfaces.
  boxBgMain: "box-main-bg",
  boxBgPrimary: "box-primary-bg",
  boxBgSecondary: "box-secondary-bg",
  boxBgAccent: "box-accent-bg",
  boxInfo: "box-info-bg",

  // Borders.
  borderBgPrimary: "box-primary-border",
  borderBgSecondary: "box-secondary-border",
  borderBgAccent: "box-accent-border",

  // Shadows.
  boxshadowBgPrimary: "shadow-primary-bg",
  boxshadowBgSecondary: "shadow-secondary-bg",
  boxshadowBgAccent: "shadow-accent-bg",

  // Buttons.
  buttonBgPrimary: "button-primary-bg",
  buttonBgSecondary: "button-secondary-bg",
  buttonBgAccent: "button-accent-bg",
  buttonBgPrimaryHover: "button-primary-hover-bg",
  buttonBgSecondaryHover: "button-secondary-hover-bg",
  buttonBgAccentHover: "button-accent-hover-bg",
  buttonTextPrimary: "button-primary-text",
  buttonTextSecondary: "button-secondary-text",
  buttonTextAccent: "button-accent-text",
  buttonTextPrimaryHover: "button-primary-hover-text",
  buttonTextSecondaryHover: "button-secondary-hover-text",
  buttonTextAccentHover: "button-accent-hover-text",
  buttonBgPlain: "button-plain-bg",
  buttonTextPlain: "button-plain-text",

  // Icons.
  iconBgPrimary: "icon-primary-bg",
  iconBgSecondary: "icon-secondary-bg",
  iconBgAccent: "icon-accent-bg",
  iconBgPrimaryHover: "icon-primary-hover-bg",
  iconBgSecondaryHover: "icon-secondary-hover-bg",
  iconBgAccentHover: "icon-accent-hover-bg",
};

/**
 * The emphasis axis: how important this text is, on whatever surface it sits.
 *
 * The contract had no such axis (NEH-519). It has a *surface* axis — `textMain`
 * on `boxBgMain`, `textSecondary` on `boxBgSecondary` — and consumers reached
 * for `textSecondary` when they meant "muted", which is a different question
 * with a different answer. HopperGuard had a stepper wanting three levels at
 * once:
 *
 * ```tsx
 * color={active ? "fg" : done ? "fg.muted" : "fg.subtle"}
 * ```
 *
 * and the mapping collapsed "done" and "upcoming" onto one colour, losing a
 * distinction that UI was drawing on purpose.
 *
 * ## The default is relative, which is what makes these adoptable
 *
 * Every other colour token is fallback-free by design: an undefined colour
 * paints an invisible element, a louder and earlier bug than a wrong shade.
 * That rule is right where "what colour is this?" has no answer without a
 * theme.
 *
 * Emphasis is not that question. "Like the surrounding text, but quieter" has a
 * correct answer on *every* theme, and `color-mix` states it directly:
 * `currentColor` inside a `color` declaration resolves to the INHERITED colour
 * (the property being computed is `color` itself), so the default de-emphasises
 * whatever the text around it already is — light theme, dark theme, or a host
 * palette nobody has seen.
 *
 * So these follow the font tokens' shape rather than the colours': they carry a
 * fallback and stay OUT of `requiredCssCustomProperties()`. Putting them there
 * would fail every existing host for no safety gain, and would move the
 * `required === fallback-free colours` identity the contract test pins on both
 * sides. This is the owner direction recorded on NEH-421 — a new token ships
 * with a sensible default so every project can adopt it immediately — applied
 * to the case where a default is genuinely knowable.
 *
 * ## `textMuted` is measured. `textSubtle` is still only chosen (NEH-974)
 *
 * Alpha de-emphasis trades contrast for hierarchy, and past some point it
 * trades away legibility, so these percentages want measuring rather than
 * picking.
 *
 * This comment claimed both tiers were measured by a file called
 * `emphasis-contrast.ct.tsx`, **and no such file has ever existed** — the whole
 * repo contains exactly one reference to that name, this one. A documented
 * guard nobody implemented is worse than an absent one: it is a guard everybody
 * believes in, and it is what made "the values below are what passed" read as a
 * measurement rather than as a guess.
 *
 * What is true today: `components/StyledFieldHelp.contrast.ct.tsx` measures
 * **`textMuted`** in a real browser, composited over the surface it actually
 * paints on rather than over the page, and asserts WCAG 1.4.3 AA (4.5:1). On
 * the harness theme it clears comfortably — 11.7:1 on the page, 9.1:1 on an
 * opaque card, 8.2:1 on a translucent chip over that card.
 *
 * **`textSubtle` at 64% is not measured anywhere.** It is the tier closer to
 * the legibility floor, so it is the one that needed the check more. Tracked;
 * do not restore the claim that it passed something.
 *
 * A host that wants a stronger or weaker step defines the property.
 */
const EMPHASIS_TOKENS: Record<string, [suffix: string, fallback: string]> = {
  /** Secondary information: still read, just not first. */
  textMuted: ["text-muted-text", "color-mix(in srgb, currentColor 78%, transparent)"],
  /** Furthest back — hints, placeholders, a step not yet reached. */
  textSubtle: ["text-subtle-text", "color-mix(in srgb, currentColor 64%, transparent)"],
};

/**
 * Status SURFACES — the chip an alert or banner is painted on (NEH-421).
 *
 * The contract could already say what colour an error *message* is
 * (`textError`), and had `boxInfo`, but nothing for a warning, error or success
 * surface. So `StyledAlert` painted all four statuses from the raw palette —
 * `red.50` / `red.200` / `red.700` and friends — which ignores the theme and
 * dark mode entirely and sits outside contrast validation. On a dark theme
 * those render dark text on a light chip regardless of surroundings.
 *
 * ## These carry defaults, and status is the reason
 *
 * The fallback-free rule is right where "what colour is this?" has no answer
 * without a theme. **Danger-red, caution-amber and success-green are
 * near-universal**, so the cost that rule imposes here — an invisible alert in
 * any host that has not yet defined the property — is real, while the thing it
 * protects against is not. A product wanting its own says so.
 *
 * It also dissolves the two-repo deadlock: without a default the package cannot
 * add the token (the bump goes red until the hosts adopt) and the hosts cannot
 * adopt until the bump lands. This is the owner direction recorded on NEH-421.
 *
 * ## The defaults are translucent on purpose
 *
 * A fixed `#fee2e2` chip is a light-theme chip; on a dark theme it is a glaring
 * white slab. `color-mix` with `transparent` tints whatever surface the alert
 * is placed on, so one default reads correctly in both — the same reasoning as
 * EMPHASIS_TOKENS, applied to a background instead of a foreground.
 *
 * The hue is fixed and the *lightness* is not, which is the split that matters:
 * red has to stay red to mean danger, but how light that red sits has to follow
 * the page. `alert.ct.tsx` measures the paired text against each chip in both a
 * light and a dark surrounding and asserts AA.
 */
const STATUS_SURFACE_TOKENS: Record<string, [suffix: string, fallback: string]> = {
  boxSuccess: [
    "box-success-bg",
    "color-mix(in srgb, #16a34a 14%, transparent)",
  ],
  boxWarning: [
    "box-warning-bg",
    "color-mix(in srgb, #d97706 16%, transparent)",
  ],
  boxError: ["box-error-bg", "color-mix(in srgb, #dc2626 14%, transparent)"],
  /**
   * The border that goes with each chip — the **solid** hue, not a tint of it.
   *
   * The fill is deliberately faint, so the border is what makes the alert read
   * as a container rather than as a colour accident. That means it has to clear
   * WCAG 1.4.11 (3:1 for a non-text boundary) against the page, and a
   * translucent border cannot: at 45% these measured **1.72–2.05:1** on a dark
   * surface, which is the first thing `StyledAlert.ct.tsx` caught.
   *
   * A saturated mid-tone hue clears 3:1 at BOTH ends, which is what lets one
   * value serve a light theme and a dark one without adapting:
   *
   * | | vs `#0f172a` | vs `#ffffff` |
   * |---|---|---|
   * | `#16a34a` | 4.37 | 3.79 |
   * | `#d97706` | 4.63 | 3.58 |
   * | `#dc2626` | 3.20 | 5.18 |
   *
   * So these are the one place in this file a bare literal colour is correct.
   * It is a *hue carrying meaning* — red means danger to everyone — not a
   * surface colour standing in for a theme, and the numbers above are why it
   * does not need to follow the page the way the fill does.
   */
  borderSuccess: ["box-success-border", "#16a34a"],
  borderWarning: ["box-warning-border", "#d97706"],
  borderError: ["box-error-border", "#dc2626"],
};

/**
 * Host-provided *layout* properties, as `token name → [suffix, fallback]`.
 *
 * These differ from the colours in one way that matters: they carry a fallback,
 * so a host that never sets them still renders something sensible rather than
 * nothing. They are routed through the token layer anyway, for the same reason
 * the colours are — a recipe writing `var(--hopper-…)` directly would ignore a
 * consumer's chosen prefix, silently, and no amount of correct configuration on
 * their side would fix it.
 */
const SIZE_TOKENS: Record<string, [suffix: string, fallback: string]> = {
  /** Height budget for a dashboard widget; also caps dropdown menus. */
  widgetBaseHeight: ["widget-base-height", "240px"],
};

/**
 * The host's typeface, as `token name → [suffix, fallback]` (NEH-289).
 *
 * `stonedog-theme` resolves a theme's fonts into `--<prefix>-font-family-*` and
 * `--<prefix>-font-weight-*`. Until these tokens existed nothing in this package
 * read them, so a themed typeface was emitted and inert — it stopped at the
 * theme package's edge.
 *
 * They follow the SIZE_TOKENS pattern (a fallback) rather than the COLOR_TOKENS
 * one (no fallback), and the asymmetry is deliberate. An undefined colour paints
 * an invisible element, which is a louder bug than a wrong shade and is exactly
 * what you want to trip over in development. Type is the opposite: an undefined
 * font falls back to the browser's own face and the page stays readable. So
 * these are NOT in `requiredCssCustomProperties()` — putting them there would
 * break every existing host (none of them define these) for no safety gain, and
 * would move the `required === colours` identity that the contract test pins on
 * both sides.
 *
 * Consequence worth stating plainly: a host that says nothing about type keeps
 * its own, and this stays purely additive.
 *
 * This package still owns SHAPE. The size scale, line height and density are
 * unchanged and stay here; family and weight are BRAND, and this is only the
 * wire that lets the theme deliver them.
 */
const FONT_FAMILY_TOKENS: Record<string, [suffix: string, fallback: string]> = {
  /** Body copy, and every form control that would otherwise use the UA font. */
  body: ["font-family-body", "inherit"],
  /** Headings, so a theme can pair a display face with its body face. */
  heading: ["font-family-heading", "inherit"],
  /**
   * Monospace. `inherit` would be wrong here — the whole point of asking for
   * mono is not wanting the inherited proportional face — so it falls back to
   * the system mono stack instead.
   */
  mono: ["font-family-mono", "ui-monospace, SFMono-Regular, Menlo, monospace"],
};

/**
 * Weight steps, matching what the recipes already name.
 *
 * The union is closed on purpose (`stonedog-theme` owns it): a recipe needing a
 * step outside these four is a change there first. The names deliberately match
 * Panda's built-in `fontWeights` tokens, so every existing `fontWeight: "bold"`
 * in a recipe starts reading the theme without a single call site moving —
 * `fontWeight` resolves through this token category already.
 */
const FONT_WEIGHT_TOKENS: Record<string, [suffix: string, fallback: string]> = {
  normal: ["font-weight-normal", "400"],
  medium: ["font-weight-medium", "500"],
  semibold: ["font-weight-semibold", "600"],
  bold: ["font-weight-bold", "700"],
};

/** Shared shape for the token maps that carry a fallback. */
function createFallbackTokens(
  map: Record<string, [suffix: string, fallback: string]>,
  prefix: string,
): Record<string, { value: string }> {
  return Object.fromEntries(
    Object.entries(map).map(([token, [suffix, fallback]]) => [
      token,
      { value: `var(--${prefix}-${suffix}, ${fallback})` },
    ]),
  );
}

/** Panda `fonts` token definitions, bound to a custom-property prefix. */
export function createSemanticFonts(
  prefix: string = DEFAULT_CSS_VAR_PREFIX,
): Record<string, { value: string }> {
  return createFallbackTokens(FONT_FAMILY_TOKENS, prefix);
}

/** Panda `fontWeights` token definitions, bound to a custom-property prefix. */
export function createSemanticFontWeights(
  prefix: string = DEFAULT_CSS_VAR_PREFIX,
): Record<string, { value: string }> {
  return createFallbackTokens(FONT_WEIGHT_TOKENS, prefix);
}

/** Every Panda font-family token this preset defines. */
export function fontTokenNames(): string[] {
  return Object.keys(FONT_FAMILY_TOKENS);
}

/** Every Panda font-weight token this preset defines. */
export function fontWeightTokenNames(): string[] {
  return Object.keys(FONT_WEIGHT_TOKENS);
}

/** Panda size-token definitions, bound to a custom-property prefix. */
export function createSemanticSizes(
  prefix: string = DEFAULT_CSS_VAR_PREFIX,
): Record<string, { value: string }> {
  return Object.fromEntries(
    Object.entries(SIZE_TOKENS).map(([token, [suffix, fallback]]) => [
      token,
      { value: `var(--${prefix}-${suffix}, ${fallback})` },
    ]),
  );
}

/**
 * The default custom-property prefix.
 *
 * `hopper` rather than something neutral because HopperGuard's theme engine
 * already emits `--hopper-*` and a rename there would be a coordinated change
 * across a running product's stored theme data. A second consumer that wants
 * its own namespace passes `cssVarPrefix` — see `stonedogStylePreset`.
 */
export const DEFAULT_CSS_VAR_PREFIX = "hopper";

/**
 * Text/background pairings, for contrast checking.
 *
 * A theme is only usable if each text token has enough contrast against the
 * surface it actually lands on, and that relationship is not inferable from the
 * names — `textMain` sits on `boxBgMain`, but `buttonTextPlain` sits on
 * `buttonBgPlain`, not on any `box*`. A contrast checker that guesses will pass
 * themes that are unreadable in practice.
 */
export const TEXT_BACKGROUND_PAIRS: Readonly<Record<string, string>> = {
  textMain: "boxBgMain",
  textPrimary: "boxBgPrimary",
  textSecondary: "boxBgSecondary",
  textAccent: "boxBgAccent",
  buttonTextPrimary: "buttonBgPrimary",
  buttonTextSecondary: "buttonBgSecondary",
  buttonTextAccent: "buttonBgAccent",
  buttonTextPrimaryHover: "buttonBgPrimaryHover",
  buttonTextSecondaryHover: "buttonBgSecondaryHover",
  buttonTextAccentHover: "buttonBgAccentHover",
  buttonTextPlain: "buttonBgPlain",
};

/** The surface token a given text token is meant to be read against. */
export function getBackgroundForText(textToken: string): string | undefined {
  return TEXT_BACKGROUND_PAIRS[textToken];
}

/**
 * Every colour token that carries a default, and is therefore NOT required of a
 * host.
 *
 * Two groups with two different justifications, kept separate because their
 * defaults obey different rules and a test has to be able to say which:
 * emphasis is relative to the inherited colour, status fixes a hue and leaves
 * the lightness relative.
 */
const DEFAULTED_COLOR_TOKENS = { ...EMPHASIS_TOKENS, ...STATUS_SURFACE_TOKENS };

/** Every Panda colour token this preset defines, defaulted ones included. */
export function colorTokenNames(): string[] {
  return [...Object.keys(COLOR_TOKENS), ...Object.keys(DEFAULTED_COLOR_TOKENS)];
}

/** The de-emphasis tiers, which carry a fallback and are not required of a host. */
export function emphasisTokenNames(): string[] {
  return Object.keys(EMPHASIS_TOKENS);
}

/** The status chips and their borders, which also carry a fallback. */
export function statusSurfaceTokenNames(): string[] {
  return Object.keys(STATUS_SURFACE_TOKENS);
}

/** Every colour token a host may leave undefined. */
export function defaultedColorTokenNames(): string[] {
  return Object.keys(DEFAULTED_COLOR_TOKENS);
}

/**
 * Every CSS custom property a consumer must define for the system to render.
 *
 * Intended for a startup assertion or a theme-validation test: a theme missing
 * one of these paints nothing, with no error anywhere.
 */
export function requiredCssCustomProperties(
  prefix: string = DEFAULT_CSS_VAR_PREFIX,
): string[] {
  return Object.values(COLOR_TOKENS).map((suffix) => `--${prefix}-${suffix}`);
}

/**
 * Panda colour-token definitions, bound to a custom-property prefix.
 *
 * Two shapes in one map, deliberately: the surface and meaning colours emit a
 * bare `var(…)` with no fallback, while the emphasis tiers and the status chips
 * emit `var(…, <default>)`. See `COLOR_TOKENS`, `EMPHASIS_TOKENS` and
 * `STATUS_SURFACE_TOKENS` for why each asymmetry is correct rather than an
 * oversight.
 */
export function createSemanticColors(
  prefix: string = DEFAULT_CSS_VAR_PREFIX,
): Record<string, { value: string }> {
  return {
    ...Object.fromEntries(
      Object.entries(COLOR_TOKENS).map(([token, suffix]) => [
        token,
        { value: `var(--${prefix}-${suffix})` },
      ]),
    ),
    ...createFallbackTokens(DEFAULTED_COLOR_TOKENS, prefix),
  };
}

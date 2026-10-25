/**
 * The vocabulary shared by the recipes and the components.
 *
 * Ported from HopperGuard's `hopper-types` so this package depends on nothing
 * private. The tuples are the source of truth — the unions derive from them, so
 * a value can be validated at runtime and narrowed at compile time from one
 * declaration.
 */

/**
 * The five appearances a user can choose app-wide. Every recipe defines all
 * five, which is why `staticCss` force-generates them (see the preset).
 */
export const THEME_VARIANTS = [
  "solid",
  "outline",
  "aurora",
  "glass",
  "matte",
] as const;

/**
 * Appearances a *call site* can ask for but a user cannot select globally —
 * a `ghost` toolbar button stays ghost whatever the app-wide variant is.
 */
export const STYLE_VARIANTS = [
  "ghost",
  "none",
  "link",
  "unstyled",
  "selected",
] as const;

/** Semantic text treatments. Not appearances — meanings. */
export const TEXT_VARIANTS = ["unstyled", "error", "pop", "warning"] as const;

export const ALL_VARIANTS = [...THEME_VARIANTS, ...STYLE_VARIANTS] as const;

export type ThemeVariant = (typeof THEME_VARIANTS)[number];
export type StyleVariant = (typeof STYLE_VARIANTS)[number];
export type AllowedTextVariant = (typeof TEXT_VARIANTS)[number];
export type AllowedVariant = (typeof ALL_VARIANTS)[number];

/**
 * The user's app-wide text-size setting.
 *
 * Five tiers, not the thirteen `fontSizeMap` defines: the extra sizes exist so a
 * heading can step one above body text, but only these five are offerable as a
 * global preference.
 */
export const FONT_SIZE_PROFILES = ["xs", "sm", "md", "lg", "xl"] as const;
export type FontSizeProfile = (typeof FONT_SIZE_PROFILES)[number];

/** Every size key `fontSizeMap` understands, including the heading-only tiers. */
export const FONT_SIZE_KEYS = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
] as const;
export type FontSizeKey = (typeof FONT_SIZE_KEYS)[number];

/**
 * The icon size vocabulary.
 *
 * Deliberately the Font Awesome scale, because ~150 call sites in the
 * originating app are written against it and silently changing what `"2x"`
 * means would have been an invisible, app-wide visual change. It is just a set
 * of names here — no icon library is implied by using them.
 *
 * It covers **all** of Font Awesome's `SizeProp`, `2xs` and `2xl` included.
 * That completeness is the point: an adapter that maps its library's size type
 * onto this one has to be able to, and an incomplete union turns into a type
 * error at every call site that happens to use a missing value. `md` is the one
 * addition, an alias for `1x`.
 *
 * It lives here rather than beside `StyledIcon` because `StyleConfig` names it —
 * the app-wide default icon size is a host setting — and having the config
 * import the component that imports the config would be a cycle.
 */
export const ICON_SIZES = [
  "2xs",
  "xs",
  "sm",
  "1x",
  "md",
  "lg",
  "2x",
  "xl",
  "2xl",
  "3x",
  "4x",
  "5x",
  "6x",
  "7x",
  "8x",
  "9x",
  "10x",
] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export function isThemeVariant(value: unknown): value is ThemeVariant {
  return THEME_VARIANTS.includes(value as ThemeVariant);
}

export function isFontSizeProfile(value: unknown): value is FontSizeProfile {
  return FONT_SIZE_PROFILES.includes(value as FontSizeProfile);
}

/**
 * How tightly the UI packs. A user preference, not a viewport thing — someone
 * with limited dexterity picks `comfortable` on a phone, and someone managing a
 * dense list picks `compact` on a desktop.
 *
 * It changes more than padding: at `compact` the intent buttons drop their
 * text label and show only their icon, which is why the shared components need
 * to know about it rather than the host handling it alone.
 */
export const DENSITY_PROFILES = ["compact", "normal", "comfortable"] as const;
export type DensityProfile = (typeof DENSITY_PROFILES)[number];

export function isDensityProfile(value: unknown): value is DensityProfile {
  return DENSITY_PROFILES.includes(value as DensityProfile);
}

export function isIconSize(value: unknown): value is IconSize {
  return ICON_SIZES.includes(value as IconSize);
}

/**
 * What a hover-triggered tooltip does on a device whose primary input cannot
 * hover (NEH-2015). `click` renders the "?" help control beside the child;
 * `focus-only` keeps hover mode, so the tooltip is reachable by keyboard focus
 * and by nothing else. See `StyleConfig.noHoverTooltip`.
 */
export const NO_HOVER_TOOLTIP_MODES = ["click", "focus-only"] as const;
export type NoHoverTooltipMode = (typeof NO_HOVER_TOOLTIP_MODES)[number];

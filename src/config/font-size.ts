import type { FontSizeKey } from "./types";

/**
 * Size key → CSS font-size.
 *
 * Every value is a `var(--font-sizes-*)` reference with a **rem** fallback, and
 * both halves matter. The custom property lets a host retune the scale without
 * touching this package; rem (never px) is what makes the whole UI respond to
 * the browser's own font-size setting, which is the accessibility affordance
 * that users with low vision actually reach for.
 *
 * ## The fallbacks are a conventional web scale, and that is a recent change
 *
 * `md` is `1rem` (16px), and the rest is the familiar Tailwind/Panda ramp.
 * Until NEH-251 the fallbacks encoded HopperGuard's elder-sized scale instead —
 * `md` was `1.375rem` (~22px) — because this package was extracted from that
 * product and nothing else consumed it yet.
 *
 * That was the wrong default for a shared library. It is not a scale anyone
 * *chose*; it was what a host got for saying nothing, and every new consumer
 * inherited an eldercare product's typography by accident.
 *
 * **A host that needs a different scale defines the custom properties.**
 * HopperGuard does exactly that now (its `globals.css` pins all thirteen tiers
 * at the elder values), which is what made this change invisible there — and
 * that pinning landed and was verified BEFORE this, deliberately, because
 * flipping the fallback first would have shrunk every piece of text in that app
 * with nothing failing anywhere.
 *
 * So: change these only with the same care. A fallback change is silent in
 * every host that has not named its own scale.
 */
export const fontSizeMap: Record<string, string> = {
  xs: "var(--font-sizes-xs, 0.75rem)",
  sm: "var(--font-sizes-sm, 0.875rem)",
  md: "var(--font-sizes-md, 1rem)",
  lg: "var(--font-sizes-lg, 1.125rem)",
  xl: "var(--font-sizes-xl, 1.25rem)",
  // Heading-only tiers. Not offerable as a global preference — see
  // FONT_SIZE_PROFILES — so they ramp faster than the body range above.
  "2xl": "var(--font-sizes-2xl, 1.5rem)",
  "3xl": "var(--font-sizes-3xl, 1.875rem)",
  "4xl": "var(--font-sizes-4xl, 2.25rem)",
  "5xl": "var(--font-sizes-5xl, 3rem)",
  "6xl": "var(--font-sizes-6xl, 3.75rem)",
  "7xl": "var(--font-sizes-7xl, 4.5rem)",
  "8xl": "var(--font-sizes-8xl, 6rem)",
  "9xl": "var(--font-sizes-9xl, 8rem)",
};

/** Human-readable names for the five selectable profiles. */
const fontSizeLabelMap: Record<string, string> = {
  xs: "Extra Small",
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Extra Large",
};

/** Friendly name for a font-size profile (falls back to the raw key). */
export function getFontSizeLabel(size: string): string {
  return fontSizeLabelMap[size] ?? size;
}

/**
 * Which scale step a piece of text ends up at: caller → `fixedSize` → profile.
 *
 * The same precedence shape as `useResolvedVariant`, and here for the same
 * reason — but it is a *pure function* rather than a branch inside `StyledText`
 * specifically so the unit tier can assert it (NEH-406).
 *
 * That mattered more than it looks. The rule was only ever checked through a
 * rendered `font-size`, and **jsdom cannot see one of these values at all**:
 * every `fontSizeMap` entry is a `var(--font-sizes-*, …)` reference, jsdom's
 * CSS parser rejects it against the `font-size` grammar, and the declaration is
 * dropped — the element ends up with no `style` attribute whatsoever. So
 * `toHaveStyle({ fontSize: <anything> })` compared "" with "" and passed for
 * every possible expectation, including one asserting a size that had not been
 * true since the scale moved.
 *
 * Splitting the rule out gives each tier a question it can actually answer:
 * *which step wins* here, and *what does it measure* in the browser tier.
 *
 * `fixedSize` pins to `md` — used where a label must not grow with the profile,
 * e.g. inside a fixed-height control it would otherwise clip.
 */
export function resolveFontSizeKey({
  size,
  fixedSize,
  profile,
}: {
  size?: string | undefined;
  fixedSize?: boolean | undefined;
  profile?: string | undefined;
}): string {
  if (size) return size;
  if (fixedSize) return "md";
  return profile ?? "md";
}

/**
 * The literal fallback inside a `fontSizeMap` entry, e.g. `"1rem"`.
 *
 * Used where a real length is needed rather than a CSS reference — measuring,
 * or a context that cannot resolve custom properties. Returns `"unknown"` for
 * an unrecognised key rather than throwing, because this feeds display code.
 */
export function getFontSizeValue(size: string): string {
  const sizeString = fontSizeMap[size];
  if (!sizeString) {
    return "unknown";
  }
  const parts = sizeString.split(",");
  // `parts.length > 1` does not narrow `parts[1]` under noUncheckedIndexedAccess,
  // and destructuring says what we actually mean: take the fallback if there is one.
  const [, fallback] = parts;
  if (fallback !== undefined) {
    return fallback.replace(")", "").trim();
  }
  return sizeString;
}

/** Order used to step a heading one tier above its base size. */
export const FONT_SIZE_ORDER: readonly FontSizeKey[] = [
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

/** The next size up, clamped at the top of the scale. */
export function stepUpFontSize(size: FontSizeKey, steps = 1): FontSizeKey {
  const index = FONT_SIZE_ORDER.indexOf(size);
  if (index === -1) return size;
  const next = FONT_SIZE_ORDER[Math.min(index + steps, FONT_SIZE_ORDER.length - 1)];
  // The index is clamped into range, so this cannot miss — but returning `size`
  // rather than asserting keeps the function total, and a future change to the
  // clamp fails safe instead of returning undefined to a caller typed otherwise.
  return next ?? size;
}

/**
 * The next size DOWN, clamped at the bottom of the scale.
 *
 * The counterpart to `stepUpFontSize`, added for `StyledFieldHelp` (NEH-972),
 * and the clamp is the load-bearing half. Inline help is deliberately one tier
 * below the text it accompanies — but "one tier below" must never mean "below
 * the smallest tier the host offers", because the reader who has turned their
 * text size all the way down is the reader with the least room to spare. At
 * `xs` this returns `xs`, so help matches the body text rather than shrinking
 * past it.
 *
 * Steps through `FONT_SIZE_ORDER`, so it moves through whatever scale the host
 * has pinned its `--font-sizes-*` properties to rather than through a fixed set
 * of pixel values.
 */
export function stepDownFontSize(size: FontSizeKey, steps = 1): FontSizeKey {
  const index = FONT_SIZE_ORDER.indexOf(size);
  if (index === -1) return size;
  const next = FONT_SIZE_ORDER[Math.max(index - steps, 0)];
  // Clamped into range above, so this cannot miss — but staying total means a
  // future change to the clamp fails safe rather than handing a caller
  // `undefined` from a function typed otherwise. Same shape as stepUpFontSize.
  return next ?? size;
}

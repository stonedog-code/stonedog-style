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
 * Which scale step a piece of text ends up at: an OFFSET applied to a base.
 *
 * ## An explicit `size` is RELATIVE to the user's profile, not an absolute key
 *
 * `size="sm"` means *one step below body text*, not *"sm" on the host's ramp*.
 * The offset is read from `md` — the neutral middle of `FONT_SIZE_ORDER` — and
 * then applied to whatever step the reader has actually chosen.
 *
 * **At `profile="md"` that is arithmetically the identity**: the offset is
 * `index(size) − index("md")`, the base index is `index("md")`, and the two
 * cancel, so the result is `size` itself. A host running a standard scale at
 * the default profile renders exactly what it rendered before this change.
 * Only a non-default profile moves, which is the entire point.
 *
 * ## Why it had to change (NEH-1561)
 *
 * It used to read:
 *
 * ```js
 * if (size) return size;        // an explicit size WINS
 * if (fixedSize) return "md";
 * return profile ?? "md";       // only UNSIZED text follows the setting
 * ```
 *
 * A host defines `--font-sizes-*` **once, at `:root`, with static values**, so
 * the user's setting works only by selecting a different KEY. An explicit
 * `size` selected the key itself and the setting never reached the element.
 * That was tolerable while almost nothing passed one — and then a codemod made
 * 1,138 previously-inert `fontSize` props live in one commit, pinning 1,394 of
 * 1,661 call sites in an eldercare product at 17px and 12px regardless of the
 * setting.
 *
 * Reading `size` as an offset fixes every one of them at once, with no
 * app-side change, and each site keeps the intent it was written with: "a step
 * smaller than the sentence" stays a step smaller at every profile.
 *
 * ## The base, and why `fixedSize` still pins
 *
 * The offset is applied to `md` when `fixedSize` is set and to the profile
 * otherwise. `fixedSize` exists for a label inside a fixed-height control that
 * would clip if it grew, so it must stay absolute — and making it the *base*
 * rather than an early return means `fixedSize` + `size="sm"` still resolves to
 * `"sm"`, exactly as it did before.
 *
 * Both ends are clamped by `offsetFontSize`. An offset can never fall off the
 * scale: at `profile="xs"` a smaller-than-body size resolves to `xs` rather
 * than to nothing, and at the top it stops at `9xl`.
 *
 * ## Why this is a pure function
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
 * *which step wins* here, and *what does it measure* in the browser tier. The
 * browser half is `font-size-profile.ct.tsx`, and it is the half that was
 * missing: the guard that shipped beside the codemod asserted only that the
 * sizes differ from **each other**, never that the profile reaches a sized
 * element, so it passed over the regression it was written next to.
 */
export function resolveFontSizeKey({
  size,
  fixedSize,
  profile,
  extraSteps,
}: {
  size?: string | undefined;
  fixedSize?: boolean | undefined;
  profile?: string | undefined;
  /**
   * Further steps added to the offset BEFORE the single clamp — how
   * `StyledHeading` asks for "one tier above whatever this is".
   *
   * It has to arrive here rather than being pre-applied by the caller, and the
   * reason is the clamp. `StyledHeading` used to hand down
   * `stepUpFontSize(size)`, which saturates at `9xl` — so `size="9xl"` encoded
   * an offset of +10 instead of +11 and the heading came out the same size as
   * the body text beside it, its whole reason for existing gone. Caught by
   * review rather than by a test, because nothing renders a `9xl` heading
   * today; it is fixed here so nothing has to remember not to.
   *
   * One offset, summed first, clamped once.
   */
  extraSteps?: number | undefined;
}): string {
  const base = fixedSize ? SIZE_OFFSET_ORIGIN : profile ?? SIZE_OFFSET_ORIGIN;
  const baseIndex = FONT_SIZE_ORDER.indexOf(base as FontSizeKey);
  // An unrecognised key on either side: hand back something the caller named
  // rather than guessing. Same "stay total, fail safe" shape as
  // stepUpFontSize — a host may legitimately extend the ramp, and turning an
  // unknown key into `undefined` would be worse than passing it through.
  if (baseIndex === -1) return size ?? base;

  let offset = extraSteps ?? 0;
  if (size) {
    const sizeIndex = FONT_SIZE_ORDER.indexOf(size as FontSizeKey);
    if (sizeIndex === -1) return size;
    offset += sizeIndex - ORIGIN_INDEX;
  }

  if (offset === 0) return base;
  return offsetFontSize(base as FontSizeKey, offset);
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

/**
 * What each size key is WORTH in the host document — the host's numbers
 * (NEH-1677).
 *
 * ## This package owns the KEYS. The host owns the NUMBERS
 *
 * The same split `z-layers.ts` makes for stacking order, for the same reason.
 * Every `fontSizeMap` entry is `var(--font-sizes-KEY, <fallback>)`, so on the
 * CSS side a host retunes the scale by defining the custom properties and this
 * package never needs to know. But a handful of places need a **number**
 * rather than a CSS reference — an SVG presentation attribute discards a
 * `var()` — and JS cannot see a custom property. Until this existed those
 * places converted against the package's own *fallbacks* and a hardcoded 16px
 * root, which is the ramp a host gets for saying nothing and not the ramp a
 * host that overrides the properties actually renders.
 *
 * Measured on HopperGuard, which pins `--font-sizes-md: 1.375rem` and twelve
 * more: chart axis ticks reached **18px beside 32px body text** at the largest
 * profile, because the conversion read `1.25rem` where the host's `xl` step
 * was `2rem`. The direction was right and the magnitude was the package's.
 *
 * So a host supplies the same thirteen values here that it declares in CSS,
 * and every px conversion in this package reads them. It is a static object,
 * not a measurement: no element is probed, nothing runs in an effect, and the
 * server renders the same number the client does.
 *
 * ## A host that sets nothing renders exactly as before
 *
 * `DEFAULT_FONT_SIZE_SCALE` names no ramp, so `fontSizePx` falls through to
 * the fallback half of `fontSizeMap`, at 16px per rem — byte-for-byte the
 * arithmetic that was here before. Both Optima products run the package's
 * ramp and are unaffected either way. The cost, stated plainly: a host that
 * overrides `--font-sizes-*` and does not set this field gets today's
 * under-reading, silently. HopperGuard's own test asserts its CSS and its
 * `fontSizeScale` agree, which is the guard that makes the next drift visible.
 */
export interface FontSizeScale {
  /**
   * Pixels per `rem` in the host document — the root element's font-size.
   * `16` unless the host sets `html { font-size }`, which this package tells
   * hosts not to do: the profile works by naming a different KEY, never by
   * re-valuing the root.
   */
  rootPx: number;
  /**
   * Key → length, exactly as the host declares `--font-sizes-KEY`. A string is
   * a CSS length in `rem` or `px` (`"1.375rem"`, `"22px"`); a number is px.
   * `Partial` so a host may name only the tiers it overrides, but a host that
   * pins its scale in CSS should name all thirteen — a key missing here reads
   * the package's fallback, which is the mismatch this field exists to remove.
   */
  ramp: Partial<Record<FontSizeKey, string | number>>;
}

/**
 * The document's root font size this package assumes when a host names none.
 * Converting rem → px for an SVG attribute needs a number, and this is the one
 * the browser uses for a document that leaves `html { font-size }` alone.
 */
export const ROOT_FONT_SIZE_PX = 16;

/**
 * What a host that supplies nothing gets: the package's own fallbacks at 16px
 * per rem. An empty `ramp` rather than a copy of the thirteen fallbacks, so
 * there is exactly one place those values live.
 */
export const DEFAULT_FONT_SIZE_SCALE: FontSizeScale = {
  rootPx: ROOT_FONT_SIZE_PX,
  ramp: {},
};

/**
 * A size key as a px NUMBER, for the contexts that cannot resolve a `var()`.
 *
 * Resolves the key against the host's `ramp` first and the package's static
 * fallback second, then converts: a number is already px, a `px` string is
 * read as is, a `rem` string is multiplied by `rootPx`. Anything else — an
 * unknown key, a unit this does not understand, an unparseable value —
 * returns `undefined` rather than throwing or guessing, because this feeds
 * rendering code and the caller has a floor to fall back on.
 *
 * Pure, and SSR-safe: it reads two objects and does arithmetic.
 */
export function fontSizePx(
  key: string,
  scale: FontSizeScale = DEFAULT_FONT_SIZE_SCALE,
): number | undefined {
  const entry = scale.ramp[key as FontSizeKey] ?? getFontSizeValue(key);
  if (typeof entry === "number") {
    return Number.isFinite(entry) ? entry : undefined;
  }
  const value = Number.parseFloat(entry);
  if (!Number.isFinite(value)) return undefined;
  const unit = entry.trim().replace(/^[\d.+-]+/, "").toLowerCase();
  if (unit === "rem") return value * scale.rootPx;
  if (unit === "px") return value;
  return undefined;
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

/**
 * The neutral middle of the ramp. An explicit `size` is read as an offset FROM
 * here, so that `size === SIZE_OFFSET_ORIGIN` is a no-op and the arithmetic
 * collapses to the identity at `profile="md"`.
 */
const SIZE_OFFSET_ORIGIN: FontSizeKey = "md";
const ORIGIN_INDEX = FONT_SIZE_ORDER.indexOf(SIZE_OFFSET_ORIGIN);

/**
 * Move `steps` along `FONT_SIZE_ORDER`, clamped at BOTH ends.
 *
 * The generalisation of `stepUpFontSize` and `stepDownFontSize`, which are now
 * one-line wrappers over it — there is one clamp, in one place, so a relative
 * size can never fall off either end of the scale.
 *
 * The clamp is the load-bearing half, and it is load-bearing in both
 * directions. At the bottom: the reader who has turned their text size all the
 * way down is the reader with the least room to spare, so a "one step smaller"
 * size at `profile="xs"` must resolve to `xs` and match the body text rather
 * than shrink past the smallest tier the host offers. At the top: a heading
 * that already sits at `9xl` stays there rather than resolving to nothing.
 *
 * Steps through `FONT_SIZE_ORDER`, so it moves through whatever scale the host
 * has pinned its `--font-sizes-*` properties to rather than through a fixed set
 * of pixel values.
 *
 * Total by construction: an unrecognised key is returned unchanged rather than
 * throwing, because these feed rendering code.
 */
export function offsetFontSize(size: FontSizeKey, steps: number): FontSizeKey {
  const index = FONT_SIZE_ORDER.indexOf(size);
  if (index === -1) return size;
  const clamped = Math.min(Math.max(index + steps, 0), FONT_SIZE_ORDER.length - 1);
  // The index is clamped into range, so this cannot miss — but returning
  // `size` rather than asserting keeps the function total, and a future change
  // to the clamp fails safe instead of returning undefined to a caller typed
  // otherwise.
  return FONT_SIZE_ORDER[clamped] ?? size;
}

/** The next size up, clamped at the top of the scale. */
export function stepUpFontSize(size: FontSizeKey, steps = 1): FontSizeKey {
  return offsetFontSize(size, steps);
}

/**
 * The next size DOWN, clamped at the bottom of the scale.
 *
 * The counterpart to `stepUpFontSize`, added for `StyledFieldHelp` (NEH-972).
 * Inline help is deliberately one tier below the text it accompanies — see the
 * clamp note on `offsetFontSize` for why "one tier below" must never mean
 * "below the smallest tier the host offers".
 */
export function stepDownFontSize(size: FontSizeKey, steps = 1): FontSizeKey {
  return offsetFontSize(size, -steps);
}

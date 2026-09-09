import { defineRecipe } from "@pandacss/dev";

export const boxRecipe = defineRecipe({
  className: "box",
  description: "The styles for the Box component",
  base: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  variants: {
    variant: {
      none: {
        border: "none",
        backgroundColor: "transparent",
      },
      unstyled: {
        border: "none",
        backgroundColor: "transparent",
      },
      solid: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        bg: "boxBgPrimary",
        color: "textPrimary",
      },
      outline: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        border: "1px solid",
        borderColor: "borderBgSecondary",
        color: "textPrimary",
        bg: "boxBgPrimary",
      },
      link: {
        bg: "boxBgPrimary",
        // Its two siblings above, `solid` and `outline`, paint the same
        // background and both state `textPrimary`; this one did not, so its
        // text inherited from the page and could land unreadable on the same
        // surface they render correctly on (NEH-441). Character for character
        // the defect already fixed in `listRecipe` under NEH-167 cycle 9.
        color: "textPrimary",
        _hover: {
          textDecoration: "underline",
        },
      },
      aurora: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        border: "1px solid",
        borderRadius: "md",
        backgroundImage: "linear-gradient(to right, #ff7e5f, #feb47b)",
        color: "textPrimary",
        borderColor: "borderBgSecondary",
      },
      glass: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        position: "relative",
        overflow: "hidden",
        borderRadius: "2xl", // more rounded for curved glass effect
        borderWidth: "2px",
        borderStyle: "solid",
        bg: "boxBgSecondary/60",
        color: "textPrimary",
        boxShadow: "xl",
        fontWeight: "bold",
        borderColor: "borderBgPrimary/10",
        /**
         * The frosted sheen that used to live here is GONE, not moved
         * (NEH-1266).
         *
         * It was a `::before` whose only paint was
         * `bgGradient: "linear(to-br, …)"` — Chakra v2 syntax. Panda has no
         * `bgGradient` utility and no `linear()` shorthand, so it passed the
         * value through verbatim as `background-image: linear(to-br, …)`.
         * `linear()` is a CSS *easing* function, not an `<image>`, so every
         * engine discards the declaration at parse time and the pseudo-element
         * painted nothing. Confirmed in Chromium: `background-image: none`.
         *
         * What remained was an absolutely-positioned, full-bleed, `z-index: -1`
         * pseudo-element with no paint at all, so deleting it is a no-op on
         * screen. Restoring the sheen for real — a `linear-gradient(...)`, the
         * spelling `aurora` already uses — would make `glass` visibly
         * different in every consuming product, which is a design decision and
         * not this fix.
         */
      },
      matte: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        /**
         * **`matte` paints no background, and the `color: "white"` that used to
         * sit here has gone with the gradient that justified it (NEH-1266).**
         *
         * The comment this replaces said the literal was deliberate because
         * "the surface here is `gray.800`→`gray.900`: a FIXED dark gradient".
         * There was no gradient. `bgGradient` is Chakra v2 syntax; Panda emits
         * `background-image: linear(to-b, gray.800, gray.900)` verbatim,
         * `linear()` is an easing function rather than an `<image>`, and every
         * engine discards it at parse time. So `matte` set NO background at
         * all, and pinned its text to white over whatever was behind it —
         * white-on-near-white on any light page. The comment asserted the
         * opposite of what shipped, which is why review never removed it.
         *
         * Inheriting is now correct BY CONSTRUCTION: with no surface of its
         * own, `matte` sits directly on its host's, and the colour it inherits
         * is the one that host already pairs with that surface. This is the
         * same argument `glass` is excused under in
         * `variant-contrast-pairing.test.ts`.
         *
         * Giving `matte` a real token surface instead — `boxBgAccent` with
         * `textAccent` is the one contract pair no other `box` variant uses —
         * is a defensible alternative and a visible design change, so it is the
         * owner's call rather than a bug fix.
         */
        borderColor: "gray.700",
        borderWidth: "1px",
        boxShadow: "md",
        borderRadius: "lg",
        fontWeight: "bold",
      },
      ghost: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        color: "textSecondary",
        bg: "boxBgSecondary",
      },
    },
    layout: {
      vertical: {}, // Base is already vertical
      horizontal: {
        flexDirection: { base: "column", lg: "row" },
        gap: 4,
        alignItems: "center",
      },
    },
    clickable: {
      true: {
        cursor: "pointer",
      },
    },
  },
});

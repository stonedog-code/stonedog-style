import { defineRecipe } from "@pandacss/dev";

export const buttonIconRecipe = defineRecipe({
  className: "iconButton",
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // A `<button>` does not inherit the page font — see input-surface (NEH-289).
    fontFamily: "body",
    borderRadius: "full",
    padding: "calc(.1rem + var(--panda-density-padding, 8px))",
    /**
     * The tap-target floor (NEH-220, NEH-251). See `button.ts` for why this is
     * a stated constant rather than something padding happens to produce.
     *
     * It applies to the BASE, so the `size` variants below shrink the padding
     * and the glyph but not the hit area. That is deliberate and is the whole
     * point: `size="1x"` exists to make an icon look small in a dense toolbar,
     * not to make it hard to hit. A 20px control is a WCAG 2.5.5 failure
     * whatever it is called, and this audience has elevated rates of motor
     * impairment.
     */
    minHeight: "48px",
    minWidth: "48px",
    _hover: {
      cursor: "pointer",
    },
  },
  variants: {
    size: {
      "1x": {
        padding: "2px",
        fontSize: "0.75rem",
      },
      sm: {
        padding: "4px",
        fontSize: "0.875rem",
      },
      /**
       * `md` states its font size rather than inheriting (NEH-251).
       *
       * It used to be `{}`. That does not mean "the base size" — the base sets
       * no `font-size`, so a `<button>` fell through to the USER-AGENT
       * stylesheet, which in Chrome is `13.3333px`. Three consequences, none
       * of them visible without measuring:
       *
       *   - `md` rendered SMALLER than `sm` (13.33px vs 14px), so the size
       *     scale ran 12, 14, 13.33, 20 — non-monotonic in the middle
       *   - the default icon button was the one control in the system not
       *     using the type scale at all
       *   - it was a px value, so it ignored the browser's own font setting
       *
       * Found by the component tier the moment it started asserting glyph size
       * instead of box size; the old assertion only required two distinct box
       * heights, which a broken middle satisfies.
       */
      md: {
        fontSize: "1rem",
      },
      lg: {
        padding: "12px",
        fontSize: "1.25rem",
      },
    },
    variant: {
      /**
       * The NEH-796 pairing, applied to the recipe it was never applied to
       * (NEH-877).
       *
       * `buttonRecipe` and this one are the same control in two shapes, and
       * `iconButton` carried the identical defect in three variants: an accent
       * fill labelled with `textPrimary`, the contract's partner for
       * `boxBgPrimary`. Against optima's light theme that measures 2.43:1,
       * below WCAG AA; `buttonTextAccent` measures 7.34:1. The dark theme
       * clears AA either way, which is what let it ship.
       *
       * Each `_hover` that repaints a different surface states its own colour
       * for the same reason — the base colour riding onto a secondary fill is
       * the failure one state along.
       */
      solid: {
        bg: "buttonBgAccent",
        color: "buttonTextAccent",
        _hover: {
          bg: "buttonBgSecondary",
          color: "buttonTextSecondary",
        },
      },
      outline: {
        bg: "buttonBgAccent",
        color: "buttonTextAccent",
        border: "1px solid",
        borderColor: "borderBgSecondary",
        borderRadius: 0,
        _hover: {
          border: "2px solid",
          bg: "buttonBgAccentHover",
          // The hover surface has its own partner in the contract, and it is
          // not the base one. Both are white in optima's palette today; the
          // point is that a host is free to make them differ.
          color: "buttonTextAccentHover",
        },
      },
      aurora: {
        backgroundImage: "linear-gradient(to right, #ff7e5f, #feb47b)",
        color: "buttonTextPrimary",
        borderColor: "transparent",
        _hover: {
          opacity: 0.9,
        },
      },
      glass: {
        position: "relative",
        overflow: "hidden",
        border: "2px solid",
        borderColor: "black",
        borderRadius: "xl",
        bg: "buttonBgAccent",
        // Not translucent, whatever the name suggests: the fill is an opaque
        // `buttonBgAccent` and the blur applies to what is behind it. So it
        // takes the accent partner like its neighbours above (NEH-877).
        color: "buttonTextAccent",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        fontWeight: "bold",
        lineHeight: "shorter",
        transition: "all 0.3s ease",
        _hover: {
          bg: "buttonBgSecondary",
          // Stated because the hover repaints a different surface — otherwise
          // the glyph keeps `buttonTextAccent` over a secondary fill, 1.06:1 in
          // optima's light theme (NEH-877).
          color: "buttonTextSecondary",
          borderColor: "rgba(255,255,255,0.4)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,255,255,0.1)",
          transform: "translateY(-1px)",
          textDecoration: "none",
        },
        _active: {
          transform: "translateY(0)",
          bg: "rgba(255,255,255,0.15)",
        },
        _before: {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: "50%",
          borderRadius: "inherit",
          bg: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)",
          zIndex: 0,
          pointerEvents: "none",
        },
      },
      /**
       * The accent pairing again, and the gradient that was hiding it
       * (NEH-881).
       *
       * This variant was filed as a different defect class: a FIXED dark
       * `gray.800`→`gray.900` gradient painting over the accent fill in every
       * theme, with a themed `textPrimary` glyph left dark-on-dark on top of
       * it. The proposed fix was a deliberate literal `color: "white"`, as
       * `box` and `input-bool` had already taken for their own `matte`.
       *
       * **There is no gradient.** `bgGradient` is Chakra v2 syntax; Panda has
       * no such utility and no `linear()` shorthand, so it emitted
       * `background-image: linear(to-b, gray.800, gray.900)` — not valid CSS,
       * discarded at parse time by every engine. Chromium reads the element
       * back as `background-image: none`, and the `background` shorthand
       * emitted just above it had already reset `background-image` in any case.
       *
       * So the surface here has always been plain `buttonBgAccent`, and this is
       * the ordinary NEH-796 / NEH-877 mispairing after all — `textPrimary` is
       * the contract's partner for `boxBgPrimary`, not for an accent fill.
       * Measured over nine host themes in both modes, 18 pairs: `textPrimary`
       * is below WCAG AA on 8 of them, every one in dark mode, the worst at
       * 2.15:1 (white on `#F59E0B`). `buttonTextAccent` is below AA on 0 of the
       * 18, and reaches 9.78:1 on that same worst pair.
       *
       * Had `color: "white"` been taken as filed, it would have pinned the
       * failing half of that measurement in place under a comment calling it
       * deliberate — the shape where a test makes a bug unfixable by review.
       *
       * The dead declaration goes too, and that is not tidying. The pairing
       * sweep in `variant-contrast-pairing.test.ts` reads `background-image`
       * before `background`, so while the invalid gradient was emitted the
       * guard took it as this variant's surface, found the token contract said
       * nothing about it, and skipped the variant entirely. Removing it is what
       * puts `matte` back under the guard that already covers its five
       * siblings — verified by planting the old colour back and watching that
       * guard name both selectors.
       */
      matte: {
        borderColor: "gray.700",
        borderWidth: "1px",
        boxShadow: "md",
        bg: "buttonBgAccent",
        color: "buttonTextAccent",
        borderRadius: "lg",
        fontWeight: "bold",
      },
      ghost: {
        // The base stays `textPrimary`: a 50% accent fill is a BLEND with
        // whatever is behind it, so the contract has no partner for it and
        // `textPrimary` measures 5.9:1 over the light-theme blend. The hover
        // takes the fill to full opacity, which IS a contract surface — and
        // there `textPrimary` is the 2.43:1 pairing again (NEH-877).
        bg: "buttonBgAccent/50",
        color: "textPrimary",
        _hover: {
          bg: "buttonBgAccent",
          color: "buttonTextAccent",
          border: "1px solid",
          borderColor: "gray.700",
        },
      },
      none: {
        color: "textMain",
        bg: "gray.300",
        _hover: {
          bg: "gray.100",
        },
      },
    },
  },
});

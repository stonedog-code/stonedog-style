import { defineRecipe } from "@pandacss/dev";

export const textRecipe = defineRecipe({
  className: "text",
  description: "The styles for the Text component",
  base: {
    color: "textPrimary",
    // The theme's body face (NEH-289). StyledHeading renders through this
    // recipe too and asks for the heading face at its call site instead.
    fontFamily: "body",
  },
  variants: {
    variant: {
      unstyled: {
        color: "inherit",
      },
      pop: {
        color: "textPop",
      },
      warning: {
        /**
         * `boxWarning`, not `textPop` (NEH-1264).
         *
         * This painted its surface with a **foreground** token: `textPop` is
         * the loud text colour, chosen to be read ON the page rather than to
         * be a page. Nothing caught it — the NEH-441 sweep asks whether a
         * colour was stated (it was), and the NEH-877 pairing sweep only fires
         * when the background is a token the contract names a text partner
         * for, which `textPop` is not.
         *
         * `boxWarning` is the token that exists for exactly this, and its
         * partner is the `textWarning` this variant already states.
         * `alertRecipe` and `tagRecipe` both pair them that way already, and
         * `alert.ct.tsx` measures that pair against a light and a dark
         * surrounding and asserts AA — so this variant now inherits a
         * measurement instead of an unchecked pairing.
         */
        bg: "boxWarning",
        py: "6",
        px: {
          base: "3",
          md: "6",
        },
        color: "textWarning",
        fontWeight: "bold",
      },
      error: {
        // `boxError` for the same reason as `warning` directly above
        // (NEH-1264): `textPop` is a foreground token, and `boxError` is the
        // contract's partner for the `textError` this variant states.
        bg: "boxError",
        py: "2",
        px: {
          base: "1",
          md: "3",
        },
        color: "textError",
      },
    },
  },
});

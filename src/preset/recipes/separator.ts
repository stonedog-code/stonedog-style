import { defineRecipe } from "@pandacss/dev";

export const separatorVerticalRecipe = defineRecipe({
  className: "separator-v",
  description: "The vertical styles for the StyledSeparator component",
  base: {
    width: "1px",
    height: "full",
  },
  variants: {
    variant: {
      solid: {
        backgroundColor: "gray.800",
        _dark: { backgroundColor: "gray.200" },
      },
      glass: {
        // `whiteAlpha.500` / `blackAlpha.500` were Chakra vocabulary this
        // package never defined, so the glass separator was invisible in both
        // colour modes (NEH-301). Panda's `/50` modifier keeps the
        // translucency the alpha scale was there for — it emits a
        // `color-mix(…, transparent)` over the token, and falls back to the
        // solid token where `color-mix` is unsupported, so the separator is
        // never invisible again.
        backgroundColor: "borderBgPrimary/50",
        _dark: { backgroundColor: "borderBgSecondary/50" },
      },
      outline: {
        backgroundColor: "transparent",
        borderLeft: "1px dashed",
        borderColor: "gray.400",
      },
      aurora: {
        /**
         * A REAL gradient. `bgGradient: "linear(to-b, …)"` was Chakra v2
         * syntax (NEH-1266): Panda has no such utility and no `linear()`
         * shorthand, so it emitted `background-image: linear(to-b, …)`
         * verbatim, `linear()` is a CSS *easing* function rather than an
         * `<image>`, and every engine discarded the declaration at parse time.
         *
         * That declaration was this variant's ONLY paint, so `aurora` rendered
         * nothing — indistinguishable from `none` — for the whole life of the
         * package. Deleting it would have made a public variant permanently
         * inert; restoring it is the same call already made one variant up,
         * where `glass` was fixed to paint rather than dropped (NEH-301).
         *
         * `backgroundImage` with `linear-gradient(...)` is the spelling
         * `box.ts` and `list.ts` `aurora` already use.
         */
        backgroundImage:
          "linear-gradient(to bottom, {colors.purple.400}, {colors.cyan.400})",
      },
      matte: {
        backgroundColor: "gray.700",
        _dark: { backgroundColor: "gray.300" },
      },
      ghost: {
        backgroundColor: "gray.800/20",
        _dark: { backgroundColor: "gray.200/20" },
      },
      none: {
        backgroundColor: "transparent",
      },
    },
  },
});

export const separatorHorizontalRecipe = defineRecipe({
  className: "separator-h",
  description: "The horizontal styles for the StyledSeparator component",
  base: {
    height: "1px",
    width: "full",
  },
  variants: {
    variant: {
      solid: {
        backgroundColor: "gray.800",
        _dark: { backgroundColor: "gray.200" },
      },
      glass: {
        // See the vertical recipe above — same defect, same fix (NEH-301).
        backgroundColor: "borderBgPrimary/50",
        _dark: { backgroundColor: "borderBgSecondary/50" },
      },
      outline: {
        backgroundColor: "transparent",
        borderTop: "1px dashed",
        borderColor: "gray.400",
      },
      aurora: {
        // See the vertical recipe above — same dead `bgGradient`, same fix
        // (NEH-1266). Left-to-right rather than top-to-bottom, matching the
        // direction the dead declaration asked for.
        backgroundImage:
          "linear-gradient(to right, {colors.purple.400}, {colors.cyan.400})",
      },
      matte: {
        backgroundColor: "gray.700",
        _dark: { backgroundColor: "gray.300" },
      },
      ghost: {
        backgroundColor: "gray.800/20",
        _dark: { backgroundColor: "gray.200/20" },
      },
      none: {
        backgroundColor: "transparent",
      },
    },
  },
});

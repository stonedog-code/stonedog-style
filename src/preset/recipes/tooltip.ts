import { defineRecipe } from "@pandacss/dev";

/**
 * Every variant here paints the SAME surface, so every variant owes the same
 * text colour (NEH-877).
 *
 * `boxBgPrimary` is the background of all nine, base included — the variants
 * differ by border and nothing else. Yet seven of them named a text token
 * belonging to some other surface: `buttonTextSecondary`, `textSecondary`,
 * `textMain`, `buttonTextPrimary`. The contract's partner for `boxBgPrimary` is
 * `textPrimary`, and there is no reading of these variants under which a
 * different one is intended — they are copy-paste drift, not design.
 *
 * Measured against optima-cloud-saas's light theme, the worst was `glass` at
 * **1.05:1** — `buttonTextPrimary` is white and `boxBgPrimary` is #f8f9fa, so
 * that tooltip rendered white text on a near-white panel and said nothing at
 * all. The dark theme reads it at 17.84:1, which is why nobody saw it.
 * `textPrimary` measures 16.92:1 light and 15.02:1 dark.
 *
 * A tooltip is the one surface where this class of defect is invisible in
 * review: it appears on hover, over the thing it describes, and an empty-looking
 * one reads as a tooltip that has not opened yet.
 */
export const tooltipRecipe = defineRecipe({
  className: "tooltip",
  base: {
    position: "absolute",
    zIndex: 9999,
    pointerEvents: "none",
    // The partner of the `boxBgPrimary` this base paints (NEH-877).
    color: "textPrimary",
    padding: "2px",
    borderRadius: "md",
    fontSize: "var(--font-sizes-lg, 1rem)",
    boxShadow: "lg",
    whiteSpace: "pre-line",
    maxWidth: {
      base: "340px",
      md: "550px",
    },
    left: "50%",
    top: "100%",
    transformOrigin: "top center",
    bg: "boxBgPrimary"
  },
  variants: {
    variant: {
      solid: {
        bg: "boxBgPrimary",
        color: "textPrimary",
        borderColor: "borderBgPrimary",
      },
      outline: {
        bg: "boxBgPrimary",
        color: "textPrimary",
        borderColor: "borderBgPrimary",
        border: "1px solid",
      },
      aurora: {
        bg: "boxBgPrimary",
        color: "textPrimary",
        borderColor: "borderBgSecondary",
        border: "1px solid",
      },
      glass: {
        bg: "boxBgPrimary",
        color: "textPrimary",
        border: "1px solid",
        borderColor: "borderBgPrimary",
      },
      matte: {
        bg: "boxBgPrimary",
        color: "textPrimary",
        borderColor: "borderBgSecondary",
        border: "1px solid",
      },
      ghost: {
        bg: "boxBgPrimary",
        color: "textPrimary",
      },
      link: {
        bg: "boxBgPrimary",
        color: "textPrimary",
        border: "1px solid",
        borderColor: "borderBgPrimary",
      },
      none: {
        bg: "boxBgPrimary",
        color: "textPrimary",
        border: "1px solid",
        borderColor: "borderBgPrimary",
      },
      unstyled: {
        bg: "boxBgPrimary",
        color: "textPrimary",
      },
    },
  },
});

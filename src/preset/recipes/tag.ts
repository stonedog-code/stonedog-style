import { defineRecipe } from "@pandacss/dev";

/**
 * A small label, in one of six tones.
 *
 * ## Why this is a recipe and not `css()` in the component
 *
 * `StyledTag` painted itself with an inline `css()` call, which was right while
 * it had exactly one appearance. A tone chosen at runtime is a different
 * problem: Panda's extractor reads source text, so `tone={STATUS_COLOR[status]}`
 * resolves to nothing and emits no rule — while the class name still lands in
 * the DOM. The result is an unstyled tag, with no build error and no console
 * warning.
 *
 * Recipes are the escape from that, because `staticCssRecipes` in
 * `preset/index.ts` forces **every variant of every recipe** into the
 * stylesheet. So a tone computed from a status map is covered for free, which is
 * how the consuming apps actually use this (NEH-721: HopperGuard drives 109 of
 * its 155 tags from `STATUS_COLOR[item.status]` and friends).
 *
 * ## The tones reuse StyledAlert's vocabulary exactly
 *
 * `info` / `success` / `warning` / `error` are `AlertStatus`, and each pairs the
 * **same tokens** the alert recipe pairs. Two status vocabularies in one package
 * — one for banners and a different one for tags — is how a product ends up with
 * a green that means "success" in one place and "active" in another.
 *
 * Two tones are additional rather than borrowed:
 *
 * - **`neutral`** is the historical default and stays the default, so every
 *   existing call site renders exactly as it did before this variant existed.
 * - **`accent`** has no alert equivalent, because an alert is always *about*
 *   something being fine or not. A tag is often just a category — a label, a
 *   type, a group — and forcing those into `info` would make "informational"
 *   mean nothing.
 *
 * ## No border, unlike the alert
 *
 * The alert recipe pairs each background with a `border*` token. A tag is small
 * and usually appears in groups; a 1px edge on each turns a row of five into
 * visual noise, and the tinted background already separates it from the page.
 * The border tokens stay available if a consumer disagrees.
 */
export const tagRecipe = defineRecipe({
  className: "tag",
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    paddingInline: "2",
    /*
     * Vertical padding is deliberately absent: the height comes from the line
     * box and the horizontal padding, so a tag tracks the font scale instead of
     * needing a re-tune whenever it moves.
     */
    borderRadius: "md",
    /*
     * Not a tap target. A plain tag is not interactive, so the 48px floor does
     * not apply to it — the remove BUTTON inside `StyledTag` is, and states its
     * own.
     */
    fontSize: "sm",
    whiteSpace: "nowrap",
  },
  variants: {
    tone: {
      neutral: {
        backgroundColor: "boxBgSecondary",
        color: "textSecondary",
      },
      info: {
        backgroundColor: "boxInfo",
        color: "textMain",
      },
      success: {
        backgroundColor: "boxSuccess",
        color: "textSuccess",
      },
      warning: {
        backgroundColor: "boxWarning",
        color: "textWarning",
      },
      error: {
        backgroundColor: "boxError",
        color: "textError",
      },
      accent: {
        backgroundColor: "boxBgAccent",
        color: "textMain",
      },
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

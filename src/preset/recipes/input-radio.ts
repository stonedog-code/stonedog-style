import { defineSlotRecipe } from "@pandacss/dev";

export const inputRadioRootRecipe = defineSlotRecipe({
  className: "input-radio",
  slots: ["root", "item", "input", "control", "indicator"],
  base: {
    root: {
      display: "flex",
    },
    item: {
      display: "inline-flex",
      alignItems: "center",
      cursor: "pointer",
      padding: "var(--panda-density-padding, 8px)",
      margin: "var(--panda-density-margin, 8px)",
      minHeight: "48px",
      borderRadius: "md",
      borderWidth: "1px",
      borderColor: "transparent",
      "&[data-checked]": {
        borderColor: "boxBgSecondary",
        bg: "rgba(0, 123, 255, 0.2)",
      },
    },
    // Visually hidden, NOT `display: none` — which is what this was.
    //
    // `display: none` takes the input out of the accessibility tree and out of
    // the tab order, so the group could not be reached or operated by keyboard
    // at all, and a screen reader never saw the radios. Clicking the label with
    // a pointer was the only way to choose anything: a WCAG 2.1.1 (Keyboard)
    // failure at Level A, on a control whose whole job is making a choice.
    //
    // Transparent and laid over the control instead, so it keeps its semantics,
    // its focus, and its hit area. The focus ring is drawn on `control` below,
    // since an invisible element cannot show one.
    input: {
      position: "absolute",
      width: "1.25rem",
      height: "1.25rem",
      margin: "0",
      opacity: 0,
      cursor: "pointer",
    },
    control: {
      width: "1.25rem",
      height: "1.25rem",
      borderRadius: "50%",
      border: "2px solid",
      borderColor: "gray.400",
      // The focus ring for the transparent input above. Keyboard reachability
      // is worth nothing if the user cannot see where they are.
      ".input-radio__input:focus-visible + &": {
        outline: "2px solid",
        outlineColor: "borderBgAccent",
        outlineOffset: "2px",
      },
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginRight: "0.5rem",
      transition: "border-color 0.2s",
      [`.input-radio__item[data-checked] > &,
      &[data-checked]`]: {
        borderColor: "boxBgSecondary",
      },
    },
    indicator: {
      width: "0.75rem",
      height: "0.75rem",
      borderRadius: "50%",
      backgroundColor: "textPop",
      transform: "scale(0)",
      transition: "transform 0.2s",
      [`.input-radio__item[data-checked] &,
      &[data-checked]`]: {
        transform: "scale(1)",
      },
    },
  },
  variants: {
    variant: {
      solid: {
        item: {
          bg: "boxBgAccent",
          // `textAccent` is the contract's partner for this surface;
          // `textPrimary` belongs to `boxBgPrimary` and measures 1.17:1 on it
          // against optima's light theme, whose accent surface is a near-black
          // graphite (NEH-877). This is the DEFAULT variant of this recipe.
          color: "textAccent",
          borderColor: "borderBgPrimary",
        },
      },
      outline: {
        item: {
          borderColor: "borderBgSecondary",
          color: "textPrimary",
          borderRadius: "0",
        },
      },
      aurora: {
        item: {
          // Bare token names do not substitute inside an arbitrary value, so
          // this gradient was invalid and never painted (NEH-301). `{colors.X}`
          // is the syntax that does.
          backgroundImage:
            "linear-gradient(to right, {colors.boxBgAccent}, {colors.boxBgSecondary})",
          color: "textPrimary",
          borderColor: "transparent",
        },
      },
      glass: {
        item: {
          backdropFilter: "blur(10px)",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          border: "1px solid",
          borderColor: "borderBgPrimary",
          color: "textPrimary",
        },
      },
      matte: {
        item: {
          bg: "buttonBgSecondary",
          // Was `textAccent` — the partner of `boxBgAccent`, a surface this
          // variant does not paint. 1.14:1 in optima's light theme, where the
          // accent text is white and this fill is near-white (NEH-877).
          color: "buttonTextSecondary",
        },
      },
      ghost: {
        item: {
          // `textSecondary` is `boxBgSecondary`'s partner, not this fill's.
          color: "buttonTextSecondary",
          bg: "buttonBgSecondary",
          border: "none",
        },
      },
      // "none" means no chrome, not no surface: it drops the border and sits
      // the item on the page's own background. That was written as a literal
      // `white`, which is the page background of exactly one theme — under a
      // dark one it painted a white slab, and no theme-aware text colour could
      // be paired with it (a light `textPrimary` on it is white-on-white, the
      // same NEH-278 illegibility in the other direction). `boxBgMain` is the
      // token that means "the page surface", so the variant now follows the
      // theme instead of contradicting it, and `textMain` is its documented
      // partner in TEXT_BACKGROUND_PAIRS.
      none: {
        item: {
          border: "none",
          backgroundColor: "boxBgMain",
          color: "textMain",
        },
      },
    },
    size: {
      sm: {
        control: { width: "4", height: "4" },
        indicator: { width: "2", height: "2" },
        item: { fontSize: "sm", marginLeft: "2" },
      },
      md: {
        control: { width: "5", height: "5" },
        indicator: { width: "2.5", height: "2.5" },
        item: { fontSize: "md", marginLeft: "2.5" },
      },
      lg: {
        control: { width: "6", height: "6" },
        indicator: { width: "3", height: "3" },
        item: { fontSize: "lg", marginLeft: "3" },
      },
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "md",
  },
});

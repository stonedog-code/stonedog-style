import { defineRecipe } from "@pandacss/dev";

export const formRecipe = defineRecipe({
  className: "form",
  base: {
    border: "1px solid",
    borderRadius: "md",
    p: "4",
    "& > li:not(:last-child)": {
      borderBottom: "1px solid",
      borderColor: "borderBgPrimary",
    },
  },
  variants: {
    variant: {
      solid: {
        bg: "boxBgAccent",
        // `textAccent`, not `textPrimary` (NEH-877). `textPrimary` is the
        // contract's partner for `boxBgPrimary`, a different surface: against
        // optima's light theme, whose accent surface is a near-black graphite,
        // that pairing measures 1.17:1 — a form whose every label is the exact
        // colour of the panel behind it. `textAccent` measures 15.27:1.
        color: "textAccent",
        borderColor: "borderBgPrimary",
        "& > li:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      outline: {
        borderColor: "borderBgPrimary",
        color: "textPrimary",
        _hover: {
          bg: "boxBgAccent",
        },
        "& > li:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      lines: {
        border: "none",
        borderRadius: "md",
        p: "4",
        color: "black",
        "& > li:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      aurora: {
        // Quoted token names are CSS strings, so this gradient was invalid and
        // never painted (NEH-301). `{colors.X}` is the substituting syntax.
        backgroundImage: `linear-gradient(to right, {colors.boxBgAccent}, {colors.boxBgSecondary})`,
        color: "textPrimary",
        borderColor: "transparent",
        "& > li:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      glass: {
        backdropFilter: "blur(10px)",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: "textPrimary",
        "& > li:not(:last-child)": {
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
        },
      },
      matte: {
        // `secondary` was undefined vocabulary — never painted (NEH-301).
        bg: "boxBgSecondary",
        color: "textSecondary",
        borderColor: "borderBgPrimary",
        "& > li:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      none: {
        border: "none",
        backgroundColor: "inherit",
        "& > li:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      unstyled: {
        border: "none",
        p: "0",
        m: "0",
        backgroundColor: "inherit",
        "& > li:not(:last-child)": {
          borderBottom: "none",
        },
      },
    },
  },
});

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
          // The hover repaints the surface, so it states the text that goes on
          // the new one (NEH-1788). Left to ride along, `textPrimary` on
          // `boxBgAccent` is the 1.17:1 pairing the `solid` variant above was
          // fixed for — reintroduced under the pointer, where no resting-state
          // check looks.
          color: "textAccent",
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
        /**
         * **No surface of its own, no backdrop blur, and no pinned text colour
         * (NEH-2075).**
         *
         * This variant painted `rgba(255, 255, 255, 0.1)` behind a
         * `blur(10px)` backdrop and stated `color: textPrimary`. Measured in
         * Chromium across the largest consumer's 18 SYSTEM theme/modes
         * (`glass-recipes.contrast.ct.tsx`), that was two defects:
         *
         * - on a glass tile (opaque `boxBgPrimary`, NEH-1952) the tint
         *   lightened the surface under `textPrimary` to 3.78–3.95:1 in 4 of
         *   18 — the NEH-2068 defect at twice the alpha;
         * - on the page (`boxBgMain`) the pinned `textPrimary` is the partner
         *   of a surface the page is not: 1.04:1 on two light themes and
         *   1.18:1 on two dark ones.
         *
         * Painting nothing and pinning nothing fixes both at once: the text
         * sits on whatever surface the container paired it with, in that
         * container's own ink — which is what `list glass` and `box matte`
         * already do. The blur went with the tint for NEH-2068's reasons:
         * over an opaque tile it blurs a flat colour into itself, and it
         * still makes the element a containing block for fixed descendants.
         */
        border: "1px solid rgba(255, 255, 255, 0.2)",
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

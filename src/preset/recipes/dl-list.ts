import { defineRecipe } from "@pandacss/dev";

export const dlRecipe = defineRecipe({
  className: "dl-list",
  base: {
    border: "1px solid",
    borderRadius: "md",
    // Was a literal `purple` (NEH-301): it rendered, but it was the same
    // purple in every theme and in every colour mode. The row separators
    // below already use this token — the outer border had simply never been
    // moved onto it.
    borderColor: "borderBgPrimary",
    // Add vertical padding and margin between dt/dd pairs
    "& > dt, & > dd": {
      paddingTop: "0.5rem",
      paddingBottom: "0.5rem",
    },
    "& > dt:not(:first-child), & > dd:not(:first-child)": {
      marginTop: "0.5rem",
    },
    // The separator was `& > li`, which a `<dl>` never contains — the rule was
    // valid, and matched nothing, so the row separators had never once
    // rendered (NEH-167, cycle 9). `dd` puts the line after each completed
    // pair; `dt` would have drawn it between a term and its own definition.
    //
    // Merged into the existing `dd` rule rather than added beside it: a second
    // key with the same selector is a duplicate object key, and the later one
    // replaces the earlier wholesale — which would have dropped this margin.
    "& > dd:not(:last-child)": {
      marginBottom: "0.5rem",
      borderBottom: "1px solid",
      borderColor: "borderBgPrimary",
    },
  },
  variants: {
    variant: {
      solid: {
        // `bgAccent` was Chakra vocabulary this package never defined, so the
        // surface never painted (NEH-301). `textAccent` rather than
        // `textPrimary` because TEXT_BACKGROUND_PAIRS is what a host's
        // contrast check reads: text on `boxBgAccent` must be `textAccent`, or
        // the pair that gets validated is not the pair that renders.
        bg: "boxBgAccent",
        color: "textAccent",
        borderColor: "borderBgPrimary",
      },
      outline: {
        borderColor: "borderBgSecondary",
        color: "textPrimary",
        "& > dd:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgSecondary",
        },
      },
      aurora: {
        // The token names were QUOTED, so they were CSS strings, so the whole
        // gradient was invalid and this variant had no background at all
        // (NEH-301). `{colors.X}` is the syntax that actually substitutes a
        // token inside an arbitrary value — see drawerRecipe, the one aurora
        // that has been rendering. Surface tokens, not `textPrimary`: this is
        // a background.
        backgroundImage: `linear-gradient(to right, {colors.boxBgAccent}, {colors.boxBgSecondary})`,
        color: "textPrimary",
        borderColor: "transparent",
        "& > dd:not(:last-child)": {
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
        "& > dd:not(:last-child)": {
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
        },
      },
      matte: {
        // `secondary` was undefined vocabulary — the surface never painted
        // (NEH-301). Paired text, per TEXT_BACKGROUND_PAIRS.
        bg: "boxBgSecondary",
        color: "textSecondary",
        borderColor: "borderBgPrimary",
        "& > dd:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      none: {
        border: "none",
        backgroundColor: "inherit",
        "& > dd:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "borderBgPrimary",
        },
      },
      unstyled: {
        border: "none",
        p: "0",
        m: "0",
        backgroundColor: "inherit",
        "& > dd:not(:last-child)": {
          borderBottom: "none",
        },
      },
    },
  },
});

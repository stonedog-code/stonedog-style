import { defineSlotRecipe } from "@pandacss/dev";

export const inputBoolRecipe = defineSlotRecipe({
  className: "input-bool",
  slots: ["root", "control", "label"],
  base: {
    root: {
      display: "flex",
      alignItems: "center",
      gap: "2",
    },
    control: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--panda-density-padding, 8px)",
      margin: "var(--panda-density-margin, 8px)",
      minHeight: "48px",
      width: "48px",
      /**
       * This slot is a native `<input type="checkbox">` at `appearance: auto`,
       * which changes what styling it is even possible to express (NEH-234).
       *
       * Verified in the component-test harness rather than assumed: a raw
       * checkbox given a red 2px border and a slate background paints as the
       * default white box. The UA draws the widget and discards
       * `background-color` and `border-*` — while `getComputedStyle`
       * cheerfully reports both, which is what made this recipe look styled
       * for so long.
       *
       * `border-radius` is worse still and worth separating out (NEH-310): it
       * does not even COMPUTE. A control set to `9999px` reports `0px`, so it
       * cannot be asserted on, cannot be differed by, and is not merely
       * invisible. The `borderRadius: "md"` below is therefore inert too; it is
       * kept only because it belongs to the same `appearance: none` fallback
       * set as `border` and `background-color`.
       *
       * The three it DOES honour, and therefore the only levers here:
       * `accent-color` (the checked fill and tick), `box-shadow` (painted
       * outside the widget) and `outline` (the focus ring).
       *
       * The `border`/`background` declarations are kept and pointed at real
       * tokens anyway: they cost nothing, they say what the control means, and
       * they are what would render if a consumer ever sets `appearance: none`.
       */
      border: "1px solid",
      borderColor: "borderBgPrimary",
      borderRadius: "md",
      backgroundColor: "boxBgMain",
      // Carries the host's theme into the tick. Without it a checked box is
      // Chromium's own blue in every theme this package can wear.
      accentColor: "buttonBgPrimary",
      cursor: "pointer",
      "&:focus": {
        // Was `2px solid var(--colors-blue-500, #3182ce)` — Panda's blue, fixed
        // in every theme including dark and high-contrast, which is exactly
        // where a keyboard user cannot afford to lose the focus ring.
        outline: "2px solid",
        outlineColor: "textPop",
        outlineOffset: "2px",
      },
      boxShadow: "none",
      _hover: {
        cursor: "pointer",
      },
      // `primary` was undefined vocabulary, so a ticked checkbox got no fill
      // of its own and fell back to the UA's (NEH-301).
      _checked: {
        bg: "buttonBgPrimary",
        borderColor: "borderBgPrimary",
      },
    },
    label: {},
  },
  variants: {
    variant: {
      /**
       * solid vs outline (NEH-234).
       *
       * These were declared identically — same `buttonBgAccent`, same
       * `textPrimary` — so two of the five appearances a user can pick app-wide
       * rendered the same checkbox. Worse, neither declaration painted at all
       * (see the note in `base`), so the variant was doubly a lie.
       *
       * `buttonRecipe` expresses outline as a 2px edge with squared corners.
       * A native checkbox discards `border`, so the same reading is carried by
       * a `box-shadow` ring, which it does paint — themed. `solid` states
       * `none` explicitly rather than by omission, so switching between them
       * cannot leave a ring behind.
       *
       * **The squared corners were dropped in NEH-310, because they never
       * existed.** This comment used to say the ring was "squared to match",
       * and the variant carried `borderRadius: "0"` to do it. Probed in the
       * harness: Chromium computes `border-radius: 0px` on a checkbox at
       * `appearance: auto` **whatever the stylesheet says** — a control set to
       * `9999px` reports `0px`, while a plain `<span>` beside it reports its
       * `12px` correctly. So the property is not merely discarded at paint
       * time like `background-color`; it does not even compute, and no variant
       * here can differ by corner. The declaration is removed rather than left
       * as decoration, since a recipe full of inert declarations is the exact
       * condition that made this defect take three issues to find.
       */
      solid: {
        control: {
          bg: "buttonBgAccent",
          color: "textPrimary",
          accentColor: "buttonBgPrimary",
          boxShadow: "none",
        },
      },
      outline: {
        control: {
          bg: "buttonBgAccent",
          color: "textPrimary",
          /**
           * The SAME checked fill as `solid`, deliberately.
           *
           * Giving outline a recessive `accentColor` did make the two more
           * different — and made a ticked outline checkbox a dark box on a dark
           * surface, which is the checked state, the one thing the control
           * exists to communicate. Distinguishing an appearance must not cost
           * state legibility, so the difference is carried entirely by the
           * ring.
           */
          accentColor: "buttonBgPrimary",
          boxShadow: "0 0 0 2px {colors.borderBgPrimary}",
        },
      },
      /**
       * The remaining variants, given a painted difference (NEH-310).
       *
       * NEH-234 fixed `solid` vs `outline` and stopped there, so these still
       * differed only in `background`, `background-image`, `color` and a
       * pseudo-element — every one of which this control discards. A user
       * picking `aurora` app-wide watched every other control change and every
       * checkbox stay put: the same complaint NEH-234 was filed for, one layer
       * down.
       *
       * ## The rule they all follow
       *
       * **Appearance is carried by the ring; the checked colour never varies.**
       *
       * Not a stylistic choice — it is the lesson recorded on `outline` above.
       * Giving a variant a recessive `accentColor` did make it more distinct,
       * and made a ticked box dark-on-dark: illegible in the one state the
       * control exists to communicate. So every variant keeps
       * `accentColor: buttonBgPrimary` and differs by `box-shadow` alone.
       *
       * `outline` (the CSS property) is not available as a lever either: it is
       * the focus ring, and a variant using it would look permanently focused.
       * `border-radius` is not available because it does not even COMPUTE here
       * — see the note on the `outline` variant.
       *
       * ## What this deliberately does NOT attempt
       *
       * `aurora` is a gradient and `glass` is a blur; a box-shadow ring is
       * neither. These are **approximations** — a two-tone ring, a soft halo —
       * not renderings of the intent. The real thing needs `appearance: none`
       * plus a hand-drawn tick, which means owning forced-colors mode and every
       * engine's default widget, and this repo's CT tier is Chromium-only so it
       * cannot answer that. NEH-310 names it as option 2 and says it needs
       * someone to look at the result in more than one engine.
       *
       * The unpainted `bg` / `color` / gradient declarations are left exactly
       * as they were, per the note in `base`.
       */
      aurora: {
        control: {
          backgroundImage: "linear-gradient(to right, #ff7e5f, #feb47b)",
          color: "buttonTextPrimary",
          accentColor: "buttonBgPrimary",
          // Two stops, two rings — the nearest a box-shadow gets to the
          // gradient this variant means. Layers paint inner-first.
          boxShadow:
            "0 0 0 2px {colors.borderBgAccent}, 0 0 0 4px {colors.borderBgPrimary}",
        },
      },
      glass: {
        control: {
          position: "relative",
          overflow: "hidden",
          bg: "buttonBgPrimary/20",
          color: "textPrimary/10",
          backdropFilter: "blur(8px)",
          fontWeight: "bold",
          lineHeight: "shorter",
          _before: {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgGradient:
              "linear(to-br, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
            zIndex: -1,
          },
          accentColor: "buttonBgPrimary",
          // A soft halo rather than a hard edge — the nearest painted reading
          // of "frosted".
          //
          // This REPLACES the `boxShadow: "xl"` this variant used to carry
          // (removed above, not shadowed — a second `boxShadow` key here was a
          // TS1117 duplicate-property error that the CSS build silently
          // resolved in favour of the last one). `xl` was the only thing glass
          // ever painted, and it is Panda's own neutral shadow: the same grey
          // in every theme this package can wear, which is the one thing a
          // themeable package must not ship.
          boxShadow:
            "0 0 0 1px {colors.borderBgSecondary}, 0 0 12px 2px {colors.boxshadowBgAccent}",
        },
      },
      matte: {
        control: {
          bgGradient: "linear(to-b, gray.800, gray.900)",
          // `whiteAlpha.900` never painted (NEH-301). `white` rather than a
          // token for the same reason as boxRecipe's matte: the surface above
          // is a FIXED dark gradient, so themed text on it risks dark-on-dark.
          color: "white",
          fontWeight: "bold",
          accentColor: "buttonBgPrimary",
          // Wide, blurred and low-contrast: a matte surface absorbs light
          // rather than edging it. The only soft-edged ring in the set, so it
          // cannot be mistaken for `outline` at a glance.
          boxShadow: "0 2px 8px 0 {colors.boxshadowBgSecondary}",
        },
      },
      ghost: {
        control: {
          color: "textSecondary",
          bg: "buttonBgSecondary",
          accentColor: "buttonBgPrimary",
          // The thinnest ring in the set, in the secondary border colour.
          // `ghost` means "present but not asserting itself", which every other
          // recipe expresses by having no fill — exactly the property this
          // control discards.
          boxShadow: "0 0 0 1px {colors.borderBgSecondary}",
        },
      },
      /**
       * `none` is the one variant that CANNOT be distinguished, and saying so
       * is more useful than inventing a difference (NEH-310).
       *
       * Every lever this control has is additive — a ring, a halo, a checked
       * colour. `none` means "do not style this", so the only honest rendering
       * of it is the bare widget, which is what `solid` already is. Giving it a
       * ring to make a test pass would mean the variant named `none` was the
       * only one wearing decoration.
       *
       * So `none` and `solid` render identically, deliberately, and the
       * component test asserts that pair is equal rather than skipping it —
       * so if a future `appearance: none` redesign (option 2 on NEH-310) makes
       * them separable, the test says so instead of quietly passing.
       */
      none: {
        control: {
          color: "buttonTextPrimary",
          bg: "gray.300",
          accentColor: "buttonBgPrimary",
          boxShadow: "none",
        },
      },
      button: {
        control: {
          bg: "gray.200",
          color: "gray.800",
          // `primary` / `primary.600` were undefined vocabulary, so the
          // checked and checked-hover fills never painted (NEH-301). The
          // hover step is the matching `*Hover` token rather than an invented
          // darker shade — this package holds no colour scales to step along.
          _checked: {
            bg: "buttonBgPrimary",
            color: "buttonTextPrimary",
            _hover: {
              bg: "buttonBgPrimaryHover",
            },
          },
          _hover: {
            bg: "gray.300",
          },
        },
      },
    },
  },
});

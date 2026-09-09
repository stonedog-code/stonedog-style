import { defineRecipe } from '@pandacss/dev'

export const stackRecipe = defineRecipe({
  className: 'stack',
  base: {
    display: 'flex',
    alignItems: 'center',
  },
  variants: {
    direction: {
      row: {
        flexDirection: 'row',
      },
      column: {
        flexDirection: 'column',
      },
    },
    justify: {
      start: {
        justifyContent: 'flex-start',
      },
      center: {
        justifyContent: 'center',
      },
      end: {
        justifyContent: 'flex-end',
      },
      between: {
        justifyContent: 'space-between',
      },
    },
    gap: {
      '0': { gap: '0' },
      '1': { gap: '1' },
      '2': { gap: '2' },
      '3': { gap: '3' },
      '4': { gap: '4' },
      '5': { gap: '5' },
      '6': { gap: '6' },
    },
    variant: {
        solid: {
            /**
             * `boxBgPrimary`, not `textPrimary` (NEH-1264).
             *
             * This variant painted its surface AND its text with the SAME
             * token — `textPrimary` on `textPrimary`, which is 1:1 in every
             * theme this package can wear. Invisible text, not merely
             * low-contrast text.
             *
             * It survived two sweeps written to catch exactly this family.
             * NEH-441 asks whether a variant that paints a background states a
             * colour: it does. NEH-877 asks whether the stated colour is the
             * contract's partner for the surface — but it only fires when the
             * surface is a token the contract names a partner FOR, and
             * `textPrimary` is a foreground, so the lookup missed and the
             * variant was skipped. Neither could see a foreground token used
             * as a surface, which is why this change ships with a guard for
             * that shape rather than only a fix.
             *
             * `boxBgPrimary` is the contract's own partner for the
             * `textPrimary` already stated here, and it is what `matte` and
             * `ghost` below do with `boxBgSecondary`/`textSecondary`.
             */
            bg: "boxBgPrimary",
            color: "textPrimary",
            borderColor: "borderBgPrimary",
        },
        outline: {
            borderColor: "borderBgSecondary",
            color: "textPrimary",
            _hover: {
            // Same defect, same fix (NEH-1264). `outline` states
            // `color: textPrimary`, so hovering used to paint the surface the
            // identical colour as the text — the label vanished under the
            // pointer, which is the one moment a reader is looking at it.
            bg: "boxBgPrimary",
            },
        },
        aurora: {
            // Quoted token names are CSS strings, so this gradient was invalid
            // and never painted (NEH-301). `{colors.X}` substitutes.
            backgroundImage: `linear-gradient(to right, {colors.boxBgAccent}, {colors.boxBgSecondary})`,
            color: "textPrimary",
            borderColor: "transparent",
        },
        glass: {
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "textPrimary",
        },
        matte: {
            // `secondary` was undefined vocabulary — never painted (NEH-301).
            bg: "boxBgSecondary",
            color: "textSecondary",
            borderColor: "borderBgPrimary",
        },
        ghost: {
            bg: "boxBgSecondary",
            // Found by the new stylesheet guard, not by the NEH-441 sweep that
            // preceded it — the sweep missed this one, which is the argument
            // for having a guard rather than a one-off scan. `matte` directly
            // above paints the identical `boxBgSecondary` and pairs it with
            // `textSecondary`; this painted the same surface and left its text
            // to inherit.
            color: "textSecondary",
            border: "none",
        },
        none: {
            border: "none",
            backgroundColor: "inherit",
        },
        unstyled: {
            border: "none",
            p: "0",
            m: "0",
            backgroundColor: "inherit",
        },
    }
  },
})

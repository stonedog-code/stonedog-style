import { defineSlotRecipe } from "@pandacss/dev";

/**
 * A status banner: an icon, a title and a message, on a tinted chip.
 *
 * Extracted from HopperGuard, where all four statuses painted from the raw
 * Panda palette (`red.50` / `red.200` / `red.700` and friends). Those ignore the
 * theme and dark mode entirely and sit outside contrast validation, so on a dark
 * theme the component rendered dark text on a light chip regardless of its
 * surroundings — the NEH-278 family (NEH-421).
 *
 * Every colour here is now a token. Three of the four statuses needed tokens
 * that did not exist; see `STATUS_SURFACE_TOKENS` for why those carry a default
 * where the rest of the contract does not.
 */
export const alertRecipe = defineSlotRecipe({
  className: "alert",
  description: "A status banner — info, success, warning or error",
  slots: ["root", "indicator", "content", "title", "description"],
  base: {
    root: {
      position: "relative",
      display: "flex",
      alignItems: "flex-start",
      gap: "3",
      padding: "4",
      borderRadius: "md",
      borderWidth: "1px",
      borderStyle: "solid",
      // Stated, not inherited: a themed typeface otherwise reaches the page and
      // stops at the edge of the component (NEH-289).
      fontFamily: "body",
    },
    indicator: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Sized to sit on the first line of the title rather than centred against
      // the whole block, which drifts as the message grows.
      width: "1.25em",
      height: "1.5em",
      lineHeight: "1",
      /**
       * `em`, not the `lg` token (NEH-1561).
       *
       * `fontSize: "lg"` is absolute: it resolved to `var(--font-sizes-lg)` and
       * did not move with the reader's profile — and, worse, it did not move
       * with the banner it sits in either. On HopperGuard's ramp that put a
       * 27px glyph beside a 16px message; the ratio was only ever right on a
       * ramp where `lg/md` happens to be 1.125.
       *
       * The recipe's own comment for the glyph characters already argues for
       * this ("a glyph inherits `currentColor` and the font scale for free, so
       * the signal survives a font-size change"), and the box around it is
       * already `em`. One step up from the message, expressed the same way the
       * box is, so the three can never disagree.
       */
      fontSize: "1.125em",
      // The glyph inherits the chip's text colour, so it never needs a colour of
      // its own and can never disagree with the message beside it.
      color: "inherit",
    },
    content: {
      flex: "1",
      minWidth: "0",
    },
    title: {
      fontWeight: "bold",
    },
    description: {
      display: "block",
    },
  },
  variants: {
    status: {
      info: {
        root: {
          backgroundColor: "boxInfo",
          borderColor: "borderBgAccent",
          color: "textMain",
        },
      },
      success: {
        root: {
          backgroundColor: "boxSuccess",
          borderColor: "borderSuccess",
          color: "textSuccess",
        },
      },
      warning: {
        root: {
          backgroundColor: "boxWarning",
          borderColor: "borderWarning",
          color: "textWarning",
        },
      },
      error: {
        root: {
          backgroundColor: "boxError",
          borderColor: "borderError",
          color: "textError",
        },
      },
    },
  },
  defaultVariants: {
    status: "info",
  },
});

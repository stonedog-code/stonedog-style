import { defineSlotRecipe } from "@pandacss/dev";

export const listRecipe = defineSlotRecipe({
  className: "list",
  slots: ["root", "item"],
  description: "A recipe for lists with various styles",
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
    },
    item: {
      width: "full",
      padding: "4", // Default padding for list items
    },
  },
  variants: {
    variant: {
      solid: {
        root: {
          bg: "boxBgPrimary",
          // Paired with the surface, per TEXT_BACKGROUND_PAIRS. Without it the
          // rows inherit whatever colour the page has — and on a dark
          // `boxBgPrimary` that is dark-on-dark, unreadable. This recipe was
          // the only one setting a background without its partner; `dlRecipe`
          // beside it has always paired them. Found by screenshotting the
          // component rather than by any test (NEH-167, cycle 9), which is the
          // same way NEH-278 was found.
          color: "textPrimary",
          borderWidth: "1px",
          // Same omission as the item slot below: no `border-style`, so the
          // outer border of a solid or outline list computed to 0px and never
          // painted either.
          borderStyle: "solid",
          borderColor: "borderBgPrimary",
          borderRadius: "lg",
        },
        item: {
          borderBottomWidth: "1px",
          // `border-style` defaults to `none`, and a border with no style
          // computes to a width of ZERO however many pixels you ask for — so
          // these row separators had never rendered (NEH-167, cycle 9). The
          // aurora/glass/matte variants below use the `borderBottom`
          // shorthand, which carries the style, which is why only these three
          // were dead.
          borderBottomStyle: "solid",
          borderColor: "borderBgSecondary",
          _last: {
            borderBottom: "none",
          },
        },
      },
      outline: {
        root: {
          borderWidth: "1px",
          // Same omission as the item slot below: no `border-style`, so the
          // outer border of a solid or outline list computed to 0px and never
          // painted either.
          borderStyle: "solid",
          borderColor: "borderBgPrimary",
          borderRadius: "lg",
        },
        item: {
          borderBottomWidth: "1px",
          // `border-style` defaults to `none`, and a border with no style
          // computes to a width of ZERO however many pixels you ask for — so
          // these row separators had never rendered (NEH-167, cycle 9). The
          // aurora/glass/matte variants below use the `borderBottom`
          // shorthand, which carries the style, which is why only these three
          // were dead.
          borderBottomStyle: "solid",
          borderColor: "borderBgSecondary",
          _last: {
            borderBottom: "none",
          },
        },
      },
      lines: {
        item: {
          borderBottomWidth: "1px",
          // `border-style` defaults to `none`, and a border with no style
          // computes to a width of ZERO however many pixels you ask for — so
          // these row separators had never rendered (NEH-167, cycle 9). The
          // aurora/glass/matte variants below use the `borderBottom`
          // shorthand, which carries the style, which is why only these three
          // were dead.
          borderBottomStyle: "solid",
          borderColor: "borderBgSecondary",
          _last: {
            borderBottom: "none",
          },
        },
      },
      aurora: {
        root: {
          position: "relative",
          overflow: "hidden",
          px: { base: 6, md: 8 },
          py: { base: 2, md: 4 },
          border: "1px solid",
          backgroundImage: "linear-gradient(to right, #ff7e5f, #feb47b)",
          color: "textPrimary",
          borderColor: "borderBgSecondary",
          _before: {
            content: '""',
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "250%",
            height: "250%",
            zIndex: -1,
            background:
              "conic-gradient(from 180deg at 50% 50%, #ff006e, #8338ec, #3a86ff, #ff006e)",
            filter: "blur(80px)",
            animation: "rotateGradient 8s linear infinite",
          },
        },
        item: {
          borderBottom: "1px solid",
          // `whiteAlpha.300` was Chakra vocabulary this package never defined,
          // so these row separators never painted (NEH-301). Half-strength so
          // the divider still reads as subordinate to the outer border, which
          // is what the alpha was buying.
          borderColor: "borderBgPrimary/30",
          _last: {
            borderBottom: "none",
          },
        },
      },
      glass: {
        root: {
          backdropFilter: "blur(10px)",
          bg: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "lg",
        },
        item: {
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
          _last: {
            borderBottom: "none",
          },
        },
      },
      matte: {
        root: {
          bgGradient: "linear(to-b, gray.800, gray.900)",
          // A deliberate literal, matching `box.ts` and `input-bool.ts`: this
          // variant's surface is a FIXED dark gradient rather than a token, so
          // themed text renders dark-on-dark in a light theme. The literal is
          // correct until the surface and the text move onto tokens together.
          color: "white",
          borderColor: "gray.700",
          borderWidth: "1px",
          borderRadius: "lg",
        },
        item: {
          borderBottom: "1px solid",
          borderColor: "gray.700",
          _last: {
            borderBottom: "none",
          },
        },
      },
      ghost: {
        item: {
          // The partner of `buttonBgSecondary` (NEH-877). `textSecondary`
          // belongs to `boxBgSecondary`, a surface this variant does not paint.
          color: "buttonTextSecondary",
          bg: "buttonBgSecondary",
          borderRadius: "md",
          cursor: "pointer",
          _hover: {
            bg: "boxBgAccent",
            // The hover repaints an accent surface, so the row must take that
            // surface's partner rather than ride the base colour onto it —
            // 1.14:1 in optima's light theme if it did.
            color: "textAccent",
          },
        },
      },
      none: {
        // Keeps base padding but removes borders and backgrounds
        item: {
          border: "none",
        },
      },
      unstyled: {
        root: {
          p: "0",
          m: "0",
          listStyle: "none",
        },
        item: {
          p: "0",
          m: "0",
          border: "none",
        },
      },
    },
  },
});

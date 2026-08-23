import { defineSlotRecipe } from "@pandacss/dev";

/**
 * A transient message: the region it lives in, and the card itself.
 *
 * Extracted from HopperGuard, where the card was a `cva` in the component file
 * and the region was a nine-cell CSS grid of which one cell was ever used. Both
 * are here now, for the reason every recipe is: a `cva` inside a component is
 * invisible to a consumer's Panda run unless that consumer globs this package's
 * source, whereas a recipe is emitted from config with no parsing at all.
 *
 * ## The accent is a border, not a background
 *
 * Status is carried by a 4px bar down the leading edge rather than by tinting
 * the whole card. Two reasons, and the second is the load-bearing one:
 *
 * - A toast sits over arbitrary page content, so it needs an opaque surface of
 *   its own to stay readable. A tint would fight that.
 * - **Colour is never the only cue.** The accent says the same thing as the
 *   glyph the component renders beside the message, so a reader who cannot
 *   distinguish the hues loses nothing — WCAG 1.4.1, Level A. Deleting the
 *   glyph "because the colour already says it" is the regression this note
 *   exists to stop.
 *
 * `borderInlineStart` rather than `borderLeft`: in a right-to-left document the
 * accent belongs on the right, and the logical property is what moves it there.
 */
export const toastRecipe = defineSlotRecipe({
  className: "toast",
  description: "A transient message and the region that stacks them",
  slots: [
    "region",
    "root",
    "indicator",
    "content",
    "title",
    "description",
    "action",
    "close",
  ],
  base: {
    region: {
      position: "fixed",
      // Anchored to one corner rather than laid out in a grid of nine cells:
      // the extracted version declared all nine and rendered into exactly one,
      // so eight of them were markup nothing could ever reach.
      insetBlockEnd: "4",
      insetInlineEnd: "4",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "3",
      // The region spans far enough to stack wide toasts but must not swallow
      // clicks meant for the page beneath it — `none` here, `auto` on each
      // card. Without this pairing a dismissed-but-still-animating toast
      // leaves an invisible plate over the corner of the app.
      pointerEvents: "none",
      maxWidth: "calc(100vw - {spacing.8})",
      zIndex: "toast",
    },
    root: {
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
      gap: "4",
      borderRadius: "md",
      boxShadow: "lg",
      paddingInline: "4",
      paddingBlock: "3",
      minWidth: { base: "320px", lg: "600px" },
      maxWidth: { base: "400px", lg: "700px" },
      fontSize: "md",
      // Stated, not inherited: a themed typeface otherwise reaches the page and
      // stops at the edge of the component (NEH-289).
      fontFamily: "body",
      borderWidth: "1px",
      borderStyle: "solid",
      // `borderBgPrimary`, not the `borderSubtle` this was first written with:
      // that token belongs to HopperGuard's vocabulary, not this package's, and
      // Panda passes an unknown token through as a literal — the card would
      // have rendered with `border-color: borderSubtle`, which the browser
      // discards, so the toast would have had no border at all and nothing
      // would have said so. The package's own token-contract test caught it.
      borderColor: "borderBgPrimary",
      backgroundColor: "boxBgPrimary",
      color: "textPrimary",
      transition: "opacity 200ms ease, transform 200ms ease",
      // `data-state` rather than a class: the renderer flips one attribute and
      // the same rule drives both directions, so there is no window in which a
      // toast has neither state.
      "&[data-state='closed']": {
        opacity: "0",
        transform: "translateY(0.5rem)",
      },
      "&[data-state='open']": {
        opacity: "1",
        transform: "translateY(0)",
      },
    },
    indicator: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: "1",
      fontSize: "lg",
    },
    content: {
      flex: "1",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      gap: "1",
    },
    title: {
      fontWeight: "bold",
    },
    description: {
      display: "block",
    },
    action: {
      flexShrink: 0,
    },
    close: {
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      // 48px, matching every other interactive floor in this package. A close
      // control is the one thing on a toast a person is *aiming* at, often
      // while it is animating, so it is the last place to shave a target down
      // to the size of its glyph.
      minWidth: "48px",
      minHeight: "48px",
      borderRadius: "md",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "transparent",
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
    },
  },
  variants: {
    /**
     * The status accent. `default` deliberately has none — a toast that means
     * nothing in particular should not borrow a colour that means something.
     */
    type: {
      success: { root: { borderInlineStartWidth: "4px", borderInlineStartColor: "borderSuccess" } },
      error: { root: { borderInlineStartWidth: "4px", borderInlineStartColor: "borderError" } },
      warning: { root: { borderInlineStartWidth: "4px", borderInlineStartColor: "borderWarning" } },
      info: { root: { borderInlineStartWidth: "4px", borderInlineStartColor: "borderBgAccent" } },
      loading: { root: { borderInlineStartWidth: "4px", borderInlineStartColor: "borderBgAccent" } },
      default: {},
    },
  },
  defaultVariants: {
    type: "default",
  },
});

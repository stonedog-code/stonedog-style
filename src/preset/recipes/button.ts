import { defineRecipe } from "@pandacss/dev";

export const buttonRecipe = defineRecipe({
  className: "button",
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // A `<button>` does not inherit the page font — see input-surface (NEH-289).
    fontFamily: "body",
    fontWeight: "semibold",
    padding: "calc(.2rem + var(--panda-density-padding, 8px))",
    /**
     * The tap-target floor, enforced structurally (NEH-220, NEH-251).
     *
     * Until now this recipe set no minimum and the button's size *emerged*
     * from padding plus the inherited font size. That looked fine and was not:
     * a short label produced a 42.375px-tall control against a 44px
     * requirement, and the two component tests asserting the floor were marked
     * `test.fail()` — the requirement was documented, visible, and unmet.
     *
     * Emergent sizing is also fragile in a way a constant is not. The font
     * scale is host-tunable and just moved (md 1.375rem -> 1rem), which drops
     * every button that depends on font size for its height. A floor that
     * survives a typography change has to be stated, not derived.
     */
    minHeight: "48px",
    minWidth: "48px",
    _hover: {
      cursor: "pointer",
    },
    border: "1px solid",
    borderColor: "borderBgPrimary",
    borderRadius: "var(--radii-md, 0.375rem)",
  },
  variants: {
    variant: {
      solid: {
        bg: "buttonBgAccent",
        color: "textPrimary",
        _hover: {
          bg: "buttonBgSecondary",
          color: "textPrimary",
        },
      },
      outline: {
        bg: "buttonBgAccent",
        // Paints an accent background, so it must state the text colour that
        // goes with it. Without this the label inherits whatever the page has,
        // and under a theme whose surface sits at the same end of the scale as
        // the inherited text it is unreadable — the NEH-278 family (NEH-441).
        //
        // `buttonTextAccent` exists in the token contract specifically to pair
        // with `buttonBgAccent`, and every host already defines it, so this
        // costs no host action. The hover state repaints the background, so it
        // takes the matching hover pairing rather than letting the base colour
        // ride along against a different surface.
        color: "buttonTextAccent",
        border: "2px solid",
        borderRadius: 0,
        _hover: {
          border: "2px solid",
          bg: "buttonBgAccentHover",
          color: "buttonTextAccentHover",
        },
      },
      aurora: {
        backgroundImage: "linear-gradient(to right, #ff7e5f, #feb47b)",
        color: "buttonTextPrimary",
        _hover: {
          opacity: 0.9,
        },
      },
      glass: {
        position: "relative",
        overflow: "hidden",
        border: "2px solid",
        borderRadius: "xl",
        bg: "buttonBgAccent",
        color: "textPrimary",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        fontWeight: "bold",
        lineHeight: "shorter",
        transition: "all 0.3s ease",
        _hover: {
          bg: "buttonBgSecondary",
          borderColor: "rgba(255,255,255,0.4)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,255,255,0.1)",
          transform: "translateY(-1px)",
          textDecoration: "none",
        },
        _active: {
          transform: "translateY(0)",
          bg: "rgba(255,255,255,0.15)",
        },
        _before: {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: "50%",
          borderRadius: "inherit",
          bg: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)",
          zIndex: 0,
          pointerEvents: "none",
        },
      },
      matte: {
        bgGradient: "linear(to-b, gray.800, gray.900)",
        borderColor: "gray.700",
        borderWidth: "1px",
        boxShadow: "md",
        bg: "buttonBgAccent",
        color: "textPrimary",
        borderRadius: "lg",
        fontWeight: "bold",
      },
      ghost: {
        bg: "boxBgSecondary/90",
        color: "textPrimary",
        _hover: {
          bg: "boxBgSecondary",
        },
      },
      selected: {
        color: "textPrimary",
        border: "3px dashed black",
        borderRadius: "xl",
        bg: "boxBgAccent",
      },
      none: {
        color: "textMain",
        bg: "white"
      },
      unstyled: {
        color: "inherit",
        border: "none",
        backgroundColor: "transparent",
      },
      link: {
        color: "textMain",
        /**
         * Stated, not omitted (NEH-307).
         *
         * A `<button>` that declares no background does not render
         * transparent — the user agent paints its own `ButtonFace`, a system
         * grey that ignores the theme and moves with the browser's colour
         * scheme (measured: `rgb(239,239,239)` light, `rgb(107,107,107)`
         * dark). This preset sets `preflight: false` and imposes no reset on
         * its consumers, so there is nothing between this recipe and the UA's
         * paint except this line. `unstyled` has always said it; `link` was
         * the only one of the ten variants that did not.
         *
         * Transparent is the right answer for a link-styled button — the
         * themed surface behind it should show through — but silence gets the
         * browser's grey, not transparency.
         */
        backgroundColor: "transparent",
        border: "1px solid transparent",
        textDecoration: "underline",
        _hover: {
          color: "buttonTextAccent",
        },
        _active: {
          color: "buttonTextSecondary",
        },
      },
    },
  },
});

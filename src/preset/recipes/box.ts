import { defineRecipe } from "@pandacss/dev";

export const boxRecipe = defineRecipe({
  className: "box",
  description: "The styles for the Box component",
  base: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  variants: {
    variant: {
      none: {
        border: "none",
        backgroundColor: "transparent",
      },
      unstyled: {
        border: "none",
        backgroundColor: "transparent",
      },
      solid: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        bg: "boxBgPrimary",
        color: "textPrimary",
      },
      outline: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        border: "1px solid",
        borderColor: "borderBgSecondary",
        color: "textPrimary",
        bg: "boxBgPrimary",
      },
      link: {
        bg: "boxBgPrimary",
        // Its two siblings above, `solid` and `outline`, paint the same
        // background and both state `textPrimary`; this one did not, so its
        // text inherited from the page and could land unreadable on the same
        // surface they render correctly on (NEH-441). Character for character
        // the defect already fixed in `listRecipe` under NEH-167 cycle 9.
        color: "textPrimary",
        _hover: {
          textDecoration: "underline",
        },
      },
      aurora: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        border: "1px solid",
        borderRadius: "md",
        backgroundImage: "linear-gradient(to right, #ff7e5f, #feb47b)",
        color: "textPrimary",
        borderColor: "borderBgSecondary",
      },
      glass: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        position: "relative",
        overflow: "hidden",
        borderRadius: "2xl", // more rounded for curved glass effect
        borderWidth: "2px",
        borderStyle: "solid",
        bg: "boxBgSecondary/60",
        color: "textPrimary",
        boxShadow: "xl",
        fontWeight: "bold",
        borderColor: "borderBgPrimary/10",
        _before: {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "inherit",
          bgGradient:
            "linear(to-br, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
          zIndex: -1,
        },
      },
      matte: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        bgGradient: "linear(to-b, gray.800, gray.900)",
        borderColor: "gray.700",
        borderWidth: "1px",
        boxShadow: "md",
        /**
         * `whiteAlpha.900` was undefined vocabulary, so this never painted and
         * matte text inherited whatever it landed on — dark-on-dark against
         * the fixed gradient above (NEH-301).
         *
         * `white`, not a token, and that is deliberate. The surface here is
         * `gray.800`→`gray.900`: a FIXED dark gradient that does not follow the
         * host's theme. Pointing the text at a host token while the surface
         * stays fixed is how you get dark-on-dark in a light theme — a
         * contrast regression traded for a style-rule win. The literal is the
         * honest description of what matte currently is, and it joins the
         * tracked literal-colour cleanup (`gray.*`, `black`/`white` in
         * input-text.ts) that has to move the surface and the text together.
         */
        color: "white",
        borderRadius: "lg",
        fontWeight: "bold",
      },
      ghost: {
        px: { base: 6, md: 8 },
        py: { base: 2, md: 4 },
        color: "textSecondary",
        bg: "boxBgSecondary",
      },
    },
    layout: {
      vertical: {}, // Base is already vertical
      horizontal: {
        flexDirection: { base: "column", lg: "row" },
        gap: 4,
        alignItems: "center",
      },
    },
    clickable: {
      true: {
        cursor: "pointer",
      },
    },
  },
});

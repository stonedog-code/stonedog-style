import { defineRecipe } from "@pandacss/dev";

export const iconRecipe = defineRecipe({
  className: "icon",
  base: {
    // A centring flex box, not `inline-block` (NEH-562). `StyledIcon` sizes
    // this wrapper in pixels while the icon set sizes the glyph from
    // `font-size` — two independent numbers — so on an inline-block wrapper the
    // glyph sat on a text baseline rather than in the middle of the box, and
    // Font Awesome's `vertical-align: -0.125em` pushed it a further ~2px down.
    // That was a visible sag under the label on every icon-bearing button in
    // the product. A flex item ignores `vertical-align`, so centring here fixes
    // the whole class rather than one call site.
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // Still meaningful: it aligns this wrapper within a parent's line box, for
    // the call sites that drop an icon into running text.
    verticalAlign: "middle",
    lineHeight: 1,
    fontSize: "var(--font-sizes-2xl, 1.5rem)",
    "& .fa-secondary": {
      color: "iconBgPrimary",
    },
    "& .fa-primary": {
      color: "iconBgSecondary",
    },
    _hover: {
      fontSize: "var(--font-sizes-2xl, 1.5rem)",
      "& .fa-secondary": {
        color: "iconBgSecondary",
      },
      "& .fa-primary": {
        color: "iconBgPrimary",
      },
    },
  },
  variants: {
    size: {
      sm: { fontSize: "1em" },
      md: { fontSize: "1.5em" },
      lg: { fontSize: "2em" },
      xl: { fontSize: "3em" },
    },
  },
});

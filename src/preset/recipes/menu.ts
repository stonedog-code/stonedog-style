import { defineSlotRecipe } from "@pandacss/dev";

export const menuRecipe = defineSlotRecipe({
  className: "menu",
  description: "Styles for the Menu component",
  slots: ["item"],
  base: {
    item: {
      w: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 3,
      px: 4,
      py: 2,
      // Stated, not derived — the same reason `button`, `icon-button`,
      // `input-bool`, `input-radio` and `input-surface` all state it. Height
      // that emerges from padding plus the current font size moves whenever
      // either does, and this recipe measured 34px at the default profile.
      //
      // A menu is a column of adjacent targets, so missing one does not fail:
      // it performs the neighbour's action instead. An unexpected navigation
      // is worse than a dead tap for the audience this system is built for.
      minHeight: "48px",
      borderRadius: "md",
      cursor: "pointer",
      _hover: {
        backgroundColor: "boxBgAccent",
      },
      _dark: {
        _hover: {
          backgroundColor: "gray.800",
        },
      },
    },
  },
});

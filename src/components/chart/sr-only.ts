/**
 * Visually-hidden text, as an inline style object.
 *
 * Inline rather than a Panda pattern deliberately. Panda extracts LITERAL
 * style values by statically parsing source, and a consumer whose `include`
 * glob does not reach this package's source gets the class name with no rule
 * behind it — which for THIS rule means the text becomes visible, mid-layout,
 * on a chart. A silent styling failure that adds junk to the page is worse
 * than one that removes decoration, so this one does not depend on the
 * consumer's build being configured correctly.
 */
export const SR_ONLY: import("react").CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

/**
 * Visually-hidden text, as an inline style object.
 *
 * ## Two decisions here, and the second was made by measurement
 *
 * **1. Inline, not a Panda pattern.** Panda extracts LITERAL style values by
 * statically parsing source, so a consumer whose `include` glob does not reach
 * this package's source gets the class name with no rule behind it — which for
 * THIS rule means the hidden text becomes visible, mid-layout, on a chart. A
 * silent styling failure that ADDS junk to the page is worse than one that
 * removes decoration, so this one does not depend on the consumer's build
 * being configured correctly.
 *
 * **2. NOT `position: absolute`, which is what almost every sr-only recipe
 * uses.**
 *
 * An absolutely positioned element is clipped by an `overflow: hidden`
 * ancestor only if that ancestor is in its CONTAINING BLOCK chain — that is,
 * only if the ancestor is itself positioned. None of a chart's wrappers are,
 * so an absolutely positioned span's containing block is the initial one: the
 * page. Every gap cell in the table then extended the document to the right of
 * the viewport, through an `overflow: hidden` widget, through a scrolling
 * table box, through everything.
 *
 * That is not theory. With the absolute version, a six-column table inside a
 * 320px widget on a 390px screen let the PAGE scroll 156px sideways — while
 * `document.body.scrollWidth` read exactly 390 and every visible box was
 * correctly clipped. The offending elements were 1x1 and invisible. Only
 * asking the browser to scroll and reading `window.scrollX` back found it, and
 * `StyledChart.ct.tsx` now asks it that way for exactly this reason.
 *
 * A 1x1 static box with a -1px margin nets to zero space in flow, is clipped
 * by its own `overflow`, and cannot escape an ancestor's clip because it never
 * leaves the flow to begin with.
 */
export const SR_ONLY: import("react").CSSProperties = {
  display: "inline-block",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

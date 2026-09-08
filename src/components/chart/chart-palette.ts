/**
 * The chart palette, as roles rather than colours (NEH-748, NEH-1521).
 *
 * Nothing in this file is a colour value, and that is not an accident of the
 * current contents — it is the rule this package is built on. The eight series
 * slots, the grid, the axis text, the cursor and the chart surface are all CSS
 * custom properties the HOST defines; this module only names them and pairs
 * each slot with the NON-COLOUR cue that goes with it.
 *
 * That pairing is the point. Colour is never the sole carrier of meaning, and
 * a multi-series chart is the hardest case in a health product for it: two
 * lines that differ only in stroke colour collapse into one under
 * deuteranopia. So a slot carries a dash pattern for line/area marks and a
 * hatch texture for bar marks, and a chart with more than one series always
 * renders a legend as well.
 *
 * ## Why every variable is emitted as a two-name fallback chain
 *
 * This stack was promoted out of HopperGuard, where the properties are named
 * `--hopper-chart-*` and are defined today in that app's `chart-palette.css`.
 * Renaming them in one move would have been a silent break: a CSS variable
 * that is never defined paints NOTHING — the series disappears with no build
 * error and nothing in the console, which is the single worst failure mode
 * available here.
 *
 * So the package emits `var(--stonedog-chart-X, var(--hopper-chart-X))`. A new
 * consumer defines the `--stonedog-` names and never thinks about it; the
 * originating app keeps working byte-for-byte until it renames on its own
 * schedule. There is deliberately NO literal colour at the end of the chain:
 * a fallback hex would make this file own a colour, and would also turn "the
 * host forgot to define the palette" from a visible fault into a silent one.
 */

/** How many categorical slots the palette defines. */
export const CHART_SERIES_SLOTS = 8;

/**
 * The custom-property namespaces, most specific first.
 *
 * Exported because a guard should be able to assert the chain rather than
 * re-deriving the string it expects — see `__tests__/chart-palette.test.ts`.
 */
export const CHART_VAR_NAMESPACES = ["stonedog", "hopper"] as const;

/** `var(--stonedog-chart-<suffix>, var(--hopper-chart-<suffix>))`. */
export function chartVar(suffix: string): string {
  return CHART_VAR_NAMESPACES.reduceRight<string>(
    (fallback, ns) =>
      `var(--${ns}-chart-${suffix}${fallback === "" ? "" : `, ${fallback}`})`,
    "",
  );
}

function wrapSlot(slot: number): number {
  return (
    (((Math.trunc(slot) - 1) % CHART_SERIES_SLOTS) + CHART_SERIES_SLOTS) %
    CHART_SERIES_SLOTS
  );
}

/**
 * The CSS variable for a series slot.
 *
 * Slots are 1-based to match the token names a reader sees in the stylesheet.
 * Out-of-range slots wrap rather than throwing — a chart with nine categories
 * should still draw, and the caller that has nine is told so by the legend,
 * not by a crash.
 */
export function chartSeriesVar(slot: number): string {
  return chartVar(`series-${wrapSlot(slot) + 1}`);
}

/** Grid stroke — themed, and the only chart element allowed to be low-contrast. */
export const CHART_GRID_VAR = chartVar("grid");

/** Axis tick labels. Real text, so full theme contrast — never a muted grey. */
export const CHART_AXIS_TEXT_VAR = chartVar("axis-text");

/** The tooltip cursor line. */
export const CHART_CURSOR_VAR = chartVar("cursor");

/** The surface a chart sits on — used for the ring around an active dot. */
export const CHART_SURFACE_VAR = chartVar("surface");

/**
 * Axis tick size.
 *
 * The reference styling this came from uses 12px. That is below the floor for
 * an audience of seniors and adults with cognitive disabilities on anything
 * the reader has to decode — 13-14px. 14 it is.
 */
export const CHART_AXIS_FONT_SIZE = 14;

/**
 * Per-slot dash patterns for line and area marks.
 *
 * Slot 1 is solid because the overwhelming majority of charts have one series
 * and a dashed single line reads as "provisional". Every later slot is visibly
 * different in shape, not merely in colour, so a reader who cannot separate
 * the hues can still follow a line from the legend.
 */
export const CHART_SERIES_DASH: readonly (string | undefined)[] = [
  undefined,
  "8 4",
  "2 4",
  "12 4 3 4",
  "6 3 2 3",
  "1 5",
  "14 5",
  "4 3 10 3",
];

/** The dash pattern for a slot, matching `chartSeriesVar`'s wrapping. */
export function chartSeriesDash(slot: number): string | undefined {
  return CHART_SERIES_DASH[wrapSlot(slot)];
}

/**
 * Bars cannot be dashed, so they get a texture instead.
 *
 * `null` means "fill flat with the slot colour" — the single-series case, and
 * the first series of a multi-series bar chart. The other values name an SVG
 * `<pattern>` the host's mark renderer draws into the chart's `<defs>`. Four
 * are enough for every bar chart we have seen, and past four the honest answer
 * is a different chart, not a fifth texture nobody can tell from the fourth.
 */
export type ChartHatch = "diagonal" | "reverse" | "cross" | null;

export const CHART_SERIES_HATCH: readonly ChartHatch[] = [
  null,
  "diagonal",
  "reverse",
  "cross",
];

/** The hatch for the nth series of a multi-series bar chart (0-based). */
export function chartSeriesHatch(seriesIndex: number): ChartHatch {
  return CHART_SERIES_HATCH[seriesIndex % CHART_SERIES_HATCH.length] ?? null;
}

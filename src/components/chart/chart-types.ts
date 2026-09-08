/**
 * The shape every chart is described in (NEH-749, NEH-1521).
 *
 * Kept in its own module with no React and no charting-library import so the
 * call sites — and the tests that assert on series derivation — can name these
 * types without dragging a chart runtime in behind them.
 */

/** A tick or tooltip-label formatter, injected by the caller. */
export type ChartValueFormatter = (value: string) => string;

/** A y-axis domain, in the subset of a charting library's domain we use. */
export type ChartDomain = [number | string, number | string];

/**
 * One plotted series.
 *
 * `slot` is the palette slot, and it is the caller's decision on purpose:
 * colour follows the ENTITY, never its rank. Heart rate is slot 3 whether or
 * not weight is on screen beside it, so hiding a metric never repaints the
 * ones that remain. Omit it and the series takes its position in the array,
 * which is right for a list whose membership is fixed.
 */
export interface ChartSeries {
  /** The key to read out of each data row. */
  dataKey: string;
  /** What a person calls this series — legend, tooltip, table header, SRs. */
  label: string;
  /**
   * The unit the values are in — "lbs", "bpm", "%".
   *
   * Rendered beside the number in the SAME text node, so it lands in the
   * accessible name: `264.2` alone is ambiguous between pounds and kilograms
   * and a screen reader should not have to guess (WCAG 1.3.1).
   *
   * Optional because not every metric has one — happiness is a 1-10 scale and
   * "7 points" would be an invention. Supplied by the CALLER rather than
   * looked up from a fixed list here.
   */
  unit?: string;
  /** 1-based palette slot. Defaults to the series' position in the array. */
  slot?: number;
}

/** Props shared by every chart form. */
export interface BaseChartProps {
  /** The rows to plot. */
  data: Record<string, unknown>[];
  /** One or more series. */
  series: ChartSeries[];
  /**
   * The chart's accessible name.
   *
   * Required, with `""` meaning "deliberately decorative" — an empty string is
   * a decision and a missing prop is an oversight.
   */
  label: string;
  /** The key holding the x value. Defaults to `"date"`. */
  xKey?: string;
  /** Pixel height of the plot area. */
  height?: number;
  /** y-axis domain, when the metric has a meaningful fixed range. */
  yDomain?: ChartDomain;
  /** Formats x-axis ticks — and, by default, the table's row headers. */
  tickFormatter?: ChartValueFormatter;
  /** Formats the tooltip's heading. Defaults to `tickFormatter`. */
  labelFormatter?: ChartValueFormatter;
  /**
   * Exactly which x-axis categories get a tick.
   *
   * Omit and the charting library decides, hiding whichever labels overlap.
   * That is fine for a dense daily axis and wrong for a categorical one, where
   * WHICH labels survive then depends on how many buckets the data happened to
   * produce.
   */
  xTicks?: string[];
  /** Force the legend on or off. Defaults to on for two or more series. */
  showLegend?: boolean;
  /** What to say when there is not enough data to draw. */
  emptyMessage?: string;
  /**
   * How many plottable points this chart needs before it will draw.
   *
   * The default differs by mark, because "enough to draw" does: a line needs
   * two points to be a line; a bar is a magnitude and reads perfectly well
   * alone.
   */
  minPoints?: number;
  /** Test hook for the surrounding panel. */
  "data-testid"?: string;
}

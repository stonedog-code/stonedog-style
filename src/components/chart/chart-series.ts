/**
 * Turning a caller's series list into everything a mark needs to draw.
 *
 * Pure, no React and no charting library — so the interesting half of the
 * chart (which slot, which dash, which texture, is there enough data) is
 * unit-testable without a DOM. jsdom has no layout engine and cannot answer
 * anything about how a chart LOOKS; it can answer all of this.
 */

import {
  chartSeriesDash,
  chartSeriesHatch,
  chartSeriesVar,
  type ChartHatch,
} from "./chart-palette";
import type { ChartSeries } from "./chart-types";

export interface ResolvedChartSeries {
  dataKey: string;
  label: string;
  /** The unit, carried through from `ChartSeries`. */
  unit?: string | undefined;
  /** 1-based palette slot. */
  slot: number;
  /** A CSS custom-property reference — never a literal colour. */
  color: string;
  /** Dash pattern for line/area marks; `undefined` means solid. */
  dash: string | undefined;
  /** Texture for bar marks; `null` means a flat fill. */
  hatch: ChartHatch;
  /** The id of this series' gradient def, unique to the chart instance. */
  gradientId: string;
}

/**
 * Resolve each series to its slot and its two non-colour cues.
 *
 * `instanceId` scopes the gradient ids. Two charts on one page that both call
 * their gradient `colorValue` make the second one reference the first's def —
 * a real footgun, and the reason this takes an id rather than generating one
 * per render.
 */
export function resolveSeries(
  series: ChartSeries[],
  instanceId: string,
): ResolvedChartSeries[] {
  return series.map((s, index) => {
    const slot = s.slot ?? index + 1;
    return {
      dataKey: s.dataKey,
      label: s.label,
      unit: s.unit,
      slot,
      color: chartSeriesVar(slot),
      dash: chartSeriesDash(slot),
      // Hatch follows POSITION, not slot: it separates the series on THIS
      // chart from each other, whereas the slot identifies the metric across
      // charts. A single-series bar chart is always flat.
      hatch: series.length > 1 ? chartSeriesHatch(index) : null,
      gradientId: `chart-grad-${instanceId}-${index}`,
    };
  });
}

/**
 * The rows in which at least one plotted series has a value.
 *
 * `!= null` rather than truthiness, deliberately: a happiness of 0, or 0
 * steps, is a real recorded value, and treating it as absent hides the reading
 * a user is most likely to want explained.
 *
 * Returns the rows rather than counting them, because a chart that cannot draw
 * still has something to say — with exactly one row it shows the reading
 * itself. Counting first and then going back for the row would ask the same
 * question twice.
 */
export function plottableRows(
  data: Record<string, unknown>[],
  series: { dataKey: string }[],
): Record<string, unknown>[] {
  return data.filter((row) => series.some((s) => row[s.dataKey] != null));
}

export function plottablePointCount(
  data: Record<string, unknown>[],
  series: { dataKey: string }[],
): number {
  return plottableRows(data, series).length;
}

/**
 * A row present on the axis for which every plotted series is absent — a GAP.
 *
 * This is the distinction NEH-1518 turns on. A day with no doses due is not a
 * day with zero adherence: nobody was asked, so nothing was missed. Once the
 * aggregation window emits that day as a labelled bucket carrying `null`
 * rather than dropping it from the axis, the only remaining way to get it
 * wrong is to render the `null` as `0` — which states, on the resident's own
 * record, that they missed a dose they were never due.
 *
 * So a gap is identified here, once, and both surfaces read it from here.
 */
export function isGapRow(
  row: Record<string, unknown>,
  series: { dataKey: string }[],
): boolean {
  return series.every((s) => row[s.dataKey] == null);
}

/**
 * The default minimum for a line or area — two points, because that is what a
 * line is. Bars and pies pass 1.
 */
export const MIN_CHART_POINTS = 2;

export function hasEnoughToDraw(
  data: Record<string, unknown>[],
  series: { dataKey: string }[],
  minPoints: number = MIN_CHART_POINTS,
): boolean {
  return plottablePointCount(data, series) >= minPoints;
}

/**
 * A legend is on by default for two or more series and off for one.
 *
 * With one series the chart's own title already names it, and a legend
 * repeating that title steals plot height for nothing. With two it is the
 * thing that keeps the series separable without colour, so it is not optional
 * — a caller may pass `showLegend` to force it either way, but the default is
 * the one that satisfies the accessibility rule.
 */
export function shouldShowLegend(
  seriesCount: number,
  explicit: boolean | undefined,
): boolean {
  return explicit ?? seriesCount > 1;
}

/**
 * Look up a series' palette slot by its data key.
 *
 * The tooltip needs this: a charting library hands the content component a
 * payload keyed by `dataKey`, in whatever order it likes, and a swatch that
 * does not match the line it describes is worse than no swatch.
 */
export function slotLookup(
  resolved: ResolvedChartSeries[],
): (dataKey: string) => number {
  const map = new Map(resolved.map((s) => [s.dataKey, s.slot]));
  return (dataKey: string) => map.get(dataKey) ?? 1;
}

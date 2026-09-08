/**
 * `StyledChart` and the pieces it is made of.
 *
 * The composed component is what a host should reach for. The parts are
 * exported because a host with an existing chart stack migrates in pieces —
 * and because the pure modules (`chart-series`, `chart-table`, `chart-range`)
 * are where the behaviour worth testing lives, and a test should be able to
 * import them without a DOM.
 */

export { default as StyledChart, StyledChart as Chart } from "./StyledChart";
export type {
  StyledChartProps,
  ChartPlotArgs,
  ChartPlotRenderer,
} from "./StyledChart";

export { ChartFrame, ChartEmpty, ChartSingleReading } from "./ChartFrame";
export type { ChartFrameProps } from "./ChartFrame";

export { ChartLegend } from "./ChartLegend";
export type { ChartLegendProps } from "./ChartLegend";

export { ChartTooltip } from "./ChartTooltip";
export type { ChartTooltipProps, ChartTooltipPayloadEntry } from "./ChartTooltip";

export { ChartRangeControl } from "./ChartRangeControl";
export type { ChartRangeControlProps } from "./ChartRangeControl";

export { ChartDataTable } from "./ChartDataTable";
export type { ChartDataTableProps } from "./ChartDataTable";

export {
  CHART_RANGES,
  CHART_RANGE_LABELS,
  isChartRangeKey,
  useSeededRange,
} from "./chart-range";
export type { ChartRangeKey } from "./chart-range";

export {
  CHART_AXIS_FONT_SIZE,
  CHART_AXIS_TEXT_VAR,
  CHART_CURSOR_VAR,
  CHART_GRID_VAR,
  CHART_SERIES_DASH,
  CHART_SERIES_HATCH,
  CHART_SERIES_SLOTS,
  CHART_SURFACE_VAR,
  CHART_VAR_NAMESPACES,
  chartSeriesDash,
  chartSeriesHatch,
  chartSeriesVar,
  chartVar,
} from "./chart-palette";
export type { ChartHatch } from "./chart-palette";

export {
  MIN_CHART_POINTS,
  hasEnoughToDraw,
  isGapRow,
  plottablePointCount,
  plottableRows,
  resolveSeries,
  shouldShowLegend,
  slotLookup,
} from "./chart-series";
export type { ResolvedChartSeries } from "./chart-series";

export {
  CHART_GAP_LABEL,
  CHART_GAP_TEXT,
  CHART_TABLE_SCROLL_AFTER_ROWS,
  buildChartTable,
  chartTableCell,
  chartTableScrolls,
} from "./chart-table";
export type {
  ChartTableCell,
  ChartTableColumn,
  ChartTableModel,
  ChartTableRow,
} from "./chart-table";

export type {
  BaseChartProps,
  ChartDomain,
  ChartSeries,
  ChartValueFormatter,
} from "./chart-types";

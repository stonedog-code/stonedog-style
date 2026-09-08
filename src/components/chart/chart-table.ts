/**
 * The table model: the SAME numbers the plot draws, as rows and columns.
 *
 * Pure and DOM-free on purpose. The whole promise of NEH-1521 is that the
 * chart and the table can never disagree, and the way that promise is kept is
 * that both read one array through one derivation. A test can therefore assert
 * the promise directly — same rows in, same values out — without a browser.
 *
 * ## The gap day is the reason this module exists at all
 *
 * A cell whose series value is `null` is a GAP, and it renders as an em dash
 * with a spoken explanation beside it. It must never render as `0`.
 *
 * The difference is not cosmetic. On an adherence chart, `0` says the resident
 * missed every dose that day; `—` says nothing was due. Printing the first
 * when the second is true is a false statement about a person's own medical
 * record, in a document the feature exists to help them hand to a doctor.
 * NEH-1518 is that bug; it is fixed here, once, rather than in each chart.
 */

import { isGapRow, type ResolvedChartSeries } from "./chart-series";
import type { ChartValueFormatter } from "./chart-types";

/** What a gap prints. An em dash, not a hyphen, and not "0". */
export const CHART_GAP_TEXT = "—";

/**
 * What a screen reader says for a gap.
 *
 * An em dash on its own is announced as "dash" or as nothing at all depending
 * on the reader and its punctuation setting, so the cell carries words too.
 */
export const CHART_GAP_LABEL = "No data recorded";

export interface ChartTableColumn {
  key: string;
  label: string;
  unit?: string | undefined;
}

export interface ChartTableCell {
  /** The visible text. `CHART_GAP_TEXT` when this is a gap. */
  text: string;
  /** True when the underlying value was absent. */
  isGap: boolean;
  /** Spoken instead of `text` when `isGap`. */
  srLabel?: string;
}

export interface ChartTableRow {
  /** The row's `<th scope="row">` text — the x value, formatted. */
  header: string;
  /** A stable React key: the raw x value. */
  key: string;
  /** True when EVERY series is absent for this row. */
  isGapRow: boolean;
  cells: ChartTableCell[];
}

export interface ChartTableModel {
  columns: ChartTableColumn[];
  rows: ChartTableRow[];
}

/**
 * Format one value for a table cell.
 *
 * `!= null` rather than truthiness, for the reason `plottableRows` already
 * gives: 0 is a real reading and must print as 0. Only genuine absence prints
 * a dash — which is precisely the pair of cases that must not be conflated.
 */
export function chartTableCell(
  value: unknown,
  valueFormatter?: (value: unknown) => string,
): ChartTableCell {
  if (value == null) {
    return { text: CHART_GAP_TEXT, isGap: true, srLabel: CHART_GAP_LABEL };
  }
  return {
    text: valueFormatter ? valueFormatter(value) : String(value),
    isGap: false,
  };
}

export interface BuildChartTableOptions {
  data: Record<string, unknown>[];
  series: ResolvedChartSeries[];
  /** The key holding the x value. */
  xKey: string;
  /**
   * Formats the row header — the x value.
   *
   * Defaults to the chart's own axis tick formatter, so the table's row
   * headers read exactly like the axis labels a reader has just looked at. Two
   * different renderings of the same date is a way for the two surfaces to
   * disagree without either being wrong.
   */
  headerFormatter?: ChartValueFormatter;
  /** Formats a value cell. Rarely needed; units live on the column header. */
  valueFormatter?: (value: unknown) => string;
}

export function buildChartTable({
  data,
  series,
  xKey,
  headerFormatter,
  valueFormatter,
}: BuildChartTableOptions): ChartTableModel {
  const columns: ChartTableColumn[] = series.map((s) => ({
    key: s.dataKey,
    label: s.label,
    unit: s.unit,
  }));

  const rows: ChartTableRow[] = data.map((row, index) => {
    const raw = row[xKey];
    const key = raw == null ? `row-${index}` : String(raw);
    const header =
      raw == null ? "" : headerFormatter ? headerFormatter(String(raw)) : String(raw);
    return {
      key,
      header,
      isGapRow: isGapRow(row, series),
      cells: series.map((s) => chartTableCell(row[s.dataKey], valueFormatter)),
    };
  });

  return { columns, rows };
}

/**
 * How many rows before the table gets its own scroll box.
 *
 * Above this the table scrolls inside itself with a sticky header; below it,
 * it simply sits under the chart. The threshold exists because the table is
 * ALWAYS present (NEH-1521): a year of daily readings is 365 rows, and letting
 * that push the rest of the dashboard off the page is how an accessibility win
 * turns into a usability loss.
 *
 * Eight, because that is roughly a week plus a heading — enough that a Week
 * range never scrolls, which is the range most readers sit in.
 */
export const CHART_TABLE_SCROLL_AFTER_ROWS = 8;

export function chartTableScrolls(
  rowCount: number,
  threshold: number = CHART_TABLE_SCROLL_AFTER_ROWS,
): boolean {
  return rowCount > threshold;
}

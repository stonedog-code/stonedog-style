/**
 * The table model — and the gap day, which is the reason it exists.
 *
 * NEH-1518: a day on which no dose was due used to be dropped from the axis
 * entirely, so the line joined non-adjacent days. Once the aggregation window
 * emits that day as a labelled bucket carrying `null`, the remaining way to
 * get it wrong is to print the `null` as `0` — which says, on a resident's own
 * record and in a document they are about to hand a doctor, that they missed a
 * dose nobody asked them to take.
 *
 * Both surfaces read this one model, so the promise that the chart and the
 * table can never disagree is a property of the code rather than a convention.
 */

import {
  CHART_GAP_LABEL,
  CHART_GAP_TEXT,
  CHART_TABLE_SCROLL_AFTER_ROWS,
  buildChartTable,
  chartTableCell,
  chartTableScrolls,
} from "../chart-table";
import { isGapRow, resolveSeries } from "../chart-series";

const series = resolveSeries(
  [{ dataKey: "taken", label: "Doses taken", unit: "%" }],
  "t",
);

describe("a gap is a gap, never a zero", () => {
  it("renders an absent value as an em dash", () => {
    expect(chartTableCell(null)).toEqual({
      text: CHART_GAP_TEXT,
      isGap: true,
      srLabel: CHART_GAP_LABEL,
    });
    expect(chartTableCell(undefined).isGap).toBe(true);
  });

  it("never renders an absent value as 0", () => {
    // The assertion the whole issue turns on, stated in the direction the bug
    // would take.
    expect(chartTableCell(null).text).not.toBe("0");
    expect(chartTableCell(undefined).text).not.toBe("0");
  });

  it("renders a real zero as 0, and does not call it a gap", () => {
    // The other half. A guard that only banned "0" could be satisfied by
    // suppressing every zero, which would hide the reading a reader is most
    // likely to want explained.
    expect(chartTableCell(0)).toEqual({ text: "0", isGap: false });
  });

  it("gives the gap words as well as punctuation", () => {
    // An em dash alone is announced as "dash", or as nothing at all, depending
    // on the reader and its punctuation setting.
    expect(chartTableCell(null).srLabel).toBe("No data recorded");
  });

  it("marks a row a gap only when EVERY series is absent", () => {
    expect(isGapRow({ date: "Mon", taken: null }, series)).toBe(true);
    expect(isGapRow({ date: "Mon", taken: 0 }, series)).toBe(false);
  });
});

describe("buildChartTable", () => {
  const data = [
    { date: "2026-09-01", taken: 100 },
    { date: "2026-09-02", taken: null },
    { date: "2026-09-03", taken: 0 },
  ];

  it("keeps the gap day on the axis as a labelled row", () => {
    const model = buildChartTable({ data, series, xKey: "date" });
    expect(model.rows.map((r) => r.header)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
    expect(model.rows[1]!.isGapRow).toBe(true);
    expect(model.rows[1]!.cells[0]!.text).toBe(CHART_GAP_TEXT);
    expect(model.rows[2]!.cells[0]!.text).toBe("0");
  });

  it("carries the unit onto the column, not into every cell", () => {
    const model = buildChartTable({ data, series, xKey: "date" });
    expect(model.columns).toEqual([
      { key: "taken", label: "Doses taken", unit: "%" },
    ]);
  });

  it("formats row headers with the chart's own axis formatter", () => {
    // Two different renderings of the same date is a way for the two surfaces
    // to disagree without either being wrong.
    const model = buildChartTable({
      data,
      series,
      xKey: "date",
      headerFormatter: (v) => v.slice(5),
    });
    expect(model.rows.map((r) => r.header)).toEqual(["09-01", "09-02", "09-03"]);
  });

  it("reads the SAME array the plot is handed, row for row", () => {
    const model = buildChartTable({ data, series, xKey: "date" });
    expect(model.rows).toHaveLength(data.length);
    model.rows.forEach((row, i) => {
      const raw = data[i]!.taken;
      expect(row.cells[0]!.isGap).toBe(raw == null);
      if (raw != null) expect(row.cells[0]!.text).toBe(String(raw));
    });
  });
});

describe("the scroll threshold", () => {
  it("does not scroll a week", () => {
    expect(chartTableScrolls(7)).toBe(false);
    expect(chartTableScrolls(CHART_TABLE_SCROLL_AFTER_ROWS)).toBe(false);
  });

  it("scrolls a year", () => {
    // The cost of an always-present table, paid inside its own box rather
    // than by pushing the rest of the page below the fold.
    expect(chartTableScrolls(365)).toBe(true);
  });
});

"use client";

import React from "react";
import { SR_ONLY } from "./sr-only";
import { CHART_AXIS_TEXT_VAR, CHART_GRID_VAR, CHART_SURFACE_VAR } from "./chart-palette";
import {
  buildChartTable,
  chartTableScrolls,
  type ChartTableModel,
} from "./chart-table";
import type { ResolvedChartSeries } from "./chart-series";
import type { ChartValueFormatter } from "./chart-types";

/**
 * The chart's numbers, as a real table.
 *
 * A real `<table>` with `<caption>`, `<th scope="col">` and `<th scope="row">`
 * — not a grid of divs. The table role is what carries row and column position
 * to a screen reader; a div grid is pixel-identical and announces nothing.
 * `StyledTable` exists in this package and would have been the obvious reuse,
 * but it wraps its own scroll container and does not offer a sticky header, and
 * the sticky header is the thing that makes an always-present 365-row table
 * usable. So this renders the elements directly and states why.
 *
 * ## Always present, and what that costs
 *
 * Decided on NEH-1521: the table sits under every chart, on the dashboard as
 * well as in fullscreen and in exports. There is no toggle — a toggle is a
 * hidden state that costs working memory, and it also creates the class of bug
 * where the chart and the table disagree about which one you are looking at.
 *
 * The cost is vertical space, and it is paid here rather than absorbed: past
 * `CHART_TABLE_SCROLL_AFTER_ROWS` rows the body scrolls inside its own box
 * with the header stuck to the top of it, so a year of daily readings does not
 * push the rest of the page below the fold. The box scrolls in BOTH axes, so
 * a wide table never makes the document scroll sideways.
 *
 * ## A gap prints as a gap
 *
 * A cell with no value renders an em dash plus visually-hidden words, never a
 * zero. See `chart-table.ts` — on an adherence table the difference is between
 * "nothing was due" and "every dose was missed".
 */

export interface ChartDataTableProps {
  data: Record<string, unknown>[];
  series: ResolvedChartSeries[];
  xKey: string;
  /**
   * The table's caption.
   *
   * Rendered, not visually hidden. The caption is what tells a sighted reader
   * that these are the same numbers as the picture above, which is the whole
   * reason the table is not behind a toggle.
   */
  caption: string;
  /** What the x column is called — "Date", "Month", "Reading". */
  xLabel?: string;
  /** Formats the row header. Defaults to the chart's axis tick formatter. */
  headerFormatter?: ChartValueFormatter;
  /** Rows before the body gets its own scroll box. */
  scrollAfterRows?: number;
  /** Cap on the scroll box, in CSS length. */
  maxHeight?: string;
  "data-testid"?: string;
}

export const ChartDataTable: React.FC<ChartDataTableProps> = ({
  data,
  series,
  xKey,
  caption,
  xLabel = "Date",
  headerFormatter,
  scrollAfterRows,
  maxHeight = "18rem",
  "data-testid": testId = "chart-data-table",
}) => {
  const model: ChartTableModel = buildChartTable({
    data,
    series,
    xKey,
    ...(headerFormatter ? { headerFormatter } : {}),
  });

  const scrolls = chartTableScrolls(model.rows.length, scrollAfterRows);

  return (
    <div
      data-testid={`${testId}-scroll`}
      data-scrolls={scrolls ? "true" : "false"}
      style={{
        // BOTH axes inside this box. The page must never scroll sideways
        // because a table got wide — `StyledChart.ct.tsx` asks the browser to
        // scroll and reads `window.scrollX` back, at four viewports.
        overflow: "auto",
        /*
         * Belt and braces for a scroll container that is a flex descendant: a
         * flex item's `min-width` defaults to `auto`, which resolves to
         * min-content — for a table, the width of its narrowest layout — so
         * such an item refuses to be narrower than its own table and
         * `overflow: auto` never engages.
         *
         * Stated honestly: removing these three declarations fails NO test
         * today. The sideways scroll that was measured here came from
         * somewhere else entirely (the visually-hidden gap labels; see
         * `sr-only.ts`), and a first, confident reading of the symptom
         * attributed it to this. They are kept because they are correct for
         * the layout this component will be dropped into, not because
         * anything proves they are load-bearing.
         */
        minWidth: 0,
        maxWidth: "100%",
        width: "100%",
        maxHeight: scrolls ? maxHeight : undefined,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: CHART_GRID_VAR,
        borderRadius: 6,
      }}
    >
      <table
        data-testid={testId}
        style={{
          /*
           * `separate`, not `collapse`, and `border-spacing: 0` so the
           * appearance is identical (each cell draws its own bottom rule, so
           * nothing doubles).
           *
           * `position: sticky` on a `<th>` inside a `border-collapse:
           * collapse` table was broken for years, and still is in older
           * engines. It is NOT broken in the Chromium the component tier
           * runs: planting `collapse` back leaves all 12 specs green. So this
           * is defensive rather than guarded, and the tier that would catch a
           * regression — an older Chromium, or WebKit — is a tier this
           * package does not run. Said plainly rather than left as an
           * implication that the test covers it.
           *
           * The first version of this comment claimed the sticky test caught
           * `collapse` failing. It did not: that test was comparing the
           * header against its UNSCROLLED position, and the 32px it reported
           * was the caption leaving, not the header moving.
           */
          borderCollapse: "separate",
          borderSpacing: 0,
          width: "100%",
          // Digits share a column width, so numeric cells line up down the
          // table. The single most useful thing a table of readings can do.
          fontVariantNumeric: "lining-nums tabular-nums",
          fontSize: "var(--font-sizes-sm, 0.9375rem)",
          color: CHART_AXIS_TEXT_VAR,
        }}
      >
        <caption
          style={{
            captionSide: "top",
            textAlign: "start",
            padding: "0.5rem 0.75rem",
            fontSize: "var(--font-sizes-sm, 0.9375rem)",
          }}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: CHART_SURFACE_VAR,
                textAlign: "start",
                padding: "0.5rem 0.75rem",
                borderBottomWidth: 1,
                borderBottomStyle: "solid",
                borderBottomColor: CHART_GRID_VAR,
              }}
            >
              {xLabel}
            </th>
            {model.columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: CHART_SURFACE_VAR,
                  textAlign: "end",
                  padding: "0.5rem 0.75rem",
                  borderBottomWidth: 1,
                  borderBottomStyle: "solid",
                  borderBottomColor: CHART_GRID_VAR,
                }}
              >
                {/*
                  * Label and unit in ONE header cell, so the unit reaches the
                  * accessible name of every cell in the column through
                  * `scope="col"`. `264.2` alone is ambiguous between pounds
                  * and kilograms.
                  *
                  * NOT a hover tooltip and NOT a truncation the reader has to
                  * hover to recover: help behind a pointer is unavailable to
                  * touch and to keyboard alike.
                  */}
                {col.unit ? `${col.label} (${col.unit})` : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.key} data-gap-row={row.isGapRow ? "true" : "false"}>
              <th
                scope="row"
                style={{
                  textAlign: "start",
                  fontWeight: 400,
                  padding: "0.5rem 0.75rem",
                  whiteSpace: "nowrap",
                  borderBottomWidth: 1,
                  borderBottomStyle: "solid",
                  borderBottomColor: CHART_GRID_VAR,
                }}
              >
                {row.header}
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={model.columns[i]?.key ?? i}
                  data-gap={cell.isGap ? "true" : "false"}
                  style={{
                    textAlign: "end",
                    padding: "0.5rem 0.75rem",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    borderBottomColor: CHART_GRID_VAR,
                  }}
                >
                  <span aria-hidden={cell.isGap ? "true" : undefined}>
                    {cell.text}
                  </span>
                  {cell.isGap && <span style={SR_ONLY}>{cell.srLabel}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ChartDataTable;

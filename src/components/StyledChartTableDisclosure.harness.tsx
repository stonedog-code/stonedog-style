import React from "react";
import StyledChart from "./chart/StyledChart";
import type { ChartPlotArgs } from "./chart/StyledChart";

/**
 * Mount targets for `StyledChartTableDisclosure.ct.tsx` (NEH-1647).
 *
 * A separate module because Playwright resolves a mounted component by import,
 * and because a spec may only mount once — so anything that needs two charts on
 * screen at the same time has to be one fixture.
 *
 * The palette is supplied here for the reason `StyledChart.harness.tsx` gives:
 * this package owns shape and never a colour, so a page defining none of the
 * `--hopper-chart-*` properties renders the chart chrome invisible. These are
 * the values HopperGuard ships.
 */
const PALETTE: React.CSSProperties = {
  ["--hopper-chart-series-1" as string]: "rgb(37, 99, 235)",
  ["--hopper-chart-grid" as string]: "rgb(203, 213, 225)",
  ["--hopper-chart-axis-text" as string]: "rgb(15, 23, 42)",
  ["--hopper-chart-cursor" as string]: "rgb(100, 116, 139)",
  ["--hopper-chart-surface" as string]: "rgb(255, 255, 255)",
  background: "rgb(255, 255, 255)",
  color: "rgb(15, 23, 42)",
  padding: "0.5rem",
};

function plot({ height }: ChartPlotArgs) {
  return <div data-testid="plot" style={{ height, background: "rgb(241, 245, 249)" }} />;
}

/**
 * Fourteen rows, deliberately.
 *
 * `CHART_TABLE_SCROLL_AFTER_ROWS` is 8, so this is enough to make
 * `ChartDataTable` take its own scroll box — which is the only tab stop inside
 * the region, since the table holds no links or inputs. Without a stop in
 * there, "the collapsed region is out of the focus order" would be a claim
 * about a document with nothing focusable in it either way.
 */
const DATA = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-03-${String(i + 1).padStart(2, "0")}`,
  weight: i % 4 === 0 ? null : 176 + (i % 3),
}));

const SERIES = [{ dataKey: "weight", label: "Weight", unit: "lbs" }];

function Chart({ open, testId }: { open: boolean; testId: string }) {
  return (
    <StyledChart
      compact
      title="Weight — Last 7 days"
      data-testid={testId}
      data={DATA}
      series={SERIES}
      label="Weight over time, in pounds"
      height={180}
      showRangeControl={false}
      showFullscreen={false}
      showTable="collapsible"
      tableSubject="Weight"
      tableDefaultOpen={open}
      renderPlot={plot}
    />
  );
}

/**
 * The trailing button is a SENTINEL for the tab-order assertion.
 *
 * "The collapsed table is not in the focus order" is only measurable against
 * something that IS — without a known stop after the chart, a Tab press that
 * went nowhere and one that skipped the table correctly look the same.
 */
export function ChartTableCollapsedByDefault() {
  return (
    <div style={{ ...PALETTE, width: 360 }}>
      <Chart open={false} testId="chart-collapsed" />
      <button type="button" data-testid="sentinel-after">
        After the chart
      </button>
    </div>
  );
}

export function ChartTableOpenByDefault() {
  return (
    <div style={{ ...PALETTE, width: 360 }}>
      <Chart open testId="chart-open" />
      <button type="button" data-testid="sentinel-after">
        After the chart
      </button>
    </div>
  );
}

/** Both at once, for the "only the starting state differs" comparison. */
export function ChartTableBothDefaults() {
  return (
    <div style={{ ...PALETTE, width: 360 }}>
      <Chart open testId="chart-open" />
      <Chart open={false} testId="chart-collapsed" />
    </div>
  );
}

/**
 * The CONTROL for the whole file: the same chart at the default `showTable`.
 *
 * Every assertion below is about a disclosure existing and behaving; none of
 * them would notice if `showTable="collapsible"` had quietly become the
 * package default and every chart in every consumer had grown a toggle. This
 * fixture is what says the default did not move — table present, no trigger,
 * nothing hidden.
 */
export function ChartTableAlwaysVisible() {
  return (
    <div style={{ ...PALETTE, width: 360 }}>
      <StyledChart
        compact
        title="Weight — Last 7 days"
        data-testid="chart-plain"
        data={DATA}
        series={SERIES}
        label="Weight over time, in pounds"
        height={180}
        showRangeControl={false}
        showFullscreen={false}
        renderPlot={plot}
      />
    </div>
  );
}

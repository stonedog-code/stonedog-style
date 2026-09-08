import React from "react";
import StyledChart from "./chart/StyledChart";
import type { ChartPlotArgs } from "./chart/StyledChart";

/**
 * Mount targets for `StyledChart.ct.tsx`.
 *
 * A separate module because Playwright resolves a mounted component by import,
 * and because a spec may only mount once — so anything that needs two things
 * on screen at the same time has to be one fixture.
 *
 * ## The palette is supplied here, and that is the honest boundary
 *
 * This package owns SHAPE and never a colour: every chart variable resolves
 * through the host's `--stonedog-chart-*` / `--hopper-chart-*` properties, and
 * a page defining none renders the chart chrome invisible. So the fixture
 * defines them — which means a contrast number measured here is a statement
 * about THIS palette, not about any product's. The claim the package can make
 * on its own is structural: the active range's border is `currentColor`, so it
 * cannot drift below its own label's contrast. The product-level contrast
 * assertion belongs in the consumer, against the consumer's tokens.
 *
 * The values below are the ones HopperGuard ships, so a regression here is at
 * least a regression against a real palette rather than an invented one.
 */
const PALETTE: React.CSSProperties = {
  ["--hopper-chart-series-1" as string]: "rgb(37, 99, 235)",
  ["--hopper-chart-series-2" as string]: "rgb(220, 38, 38)",
  ["--hopper-chart-grid" as string]: "rgb(203, 213, 225)",
  ["--hopper-chart-axis-text" as string]: "rgb(15, 23, 42)",
  ["--hopper-chart-cursor" as string]: "rgb(100, 116, 139)",
  ["--hopper-chart-surface" as string]: "rgb(255, 255, 255)",
  background: "rgb(255, 255, 255)",
  color: "rgb(15, 23, 42)",
  padding: "0.5rem",
};

function plot({ height }: ChartPlotArgs) {
  // A stand-in for the host's real mark. The point of these tests is the
  // geometry of everything AROUND the plot — the package ships no charting
  // library, so a real one here would be testing the host's dependency.
  return (
    <div
      data-testid="plot"
      style={{ height, background: "rgb(241, 245, 249)" }}
    />
  );
}

function days(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
    // Every seventh day is a GAP — a labelled bucket with no reading, which
    // must print as a dash and never as a zero.
    systolic: i % 7 === 0 ? null : 110 + (i % 20),
    diastolic: i % 7 === 0 ? null : 70 + (i % 12),
  }));
}

const SERIES = [
  { dataKey: "systolic", label: "Systolic", unit: "mmHg" },
  { dataKey: "diastolic", label: "Diastolic", unit: "mmHg" },
];

/** A week of readings — under the scroll threshold, so nothing scrolls. */
export function ChartWithShortTable() {
  return (
    <div style={PALETTE}>
      <StyledChart
        label="Blood pressure"
        title="Blood pressure"
        data={days(6)}
        series={SERIES}
        renderPlot={plot}
      />
    </div>
  );
}

/**
 * A year of daily readings.
 *
 * This is the case the always-present table has to survive: 365 rows under
 * every widget is what "each widget roughly doubles in height" turns into if
 * the table does not take its own scroll box.
 */
export function ChartWithYearOfRows() {
  return (
    <div style={PALETTE}>
      <StyledChart
        label="Blood pressure"
        title="Blood pressure"
        data={days(365)}
        series={SERIES}
        renderPlot={plot}
      />
    </div>
  );
}

/**
 * The narrow-widget case: many wide columns inside a 320px shell.
 *
 * Wide content scrolls inside its own box; the page body must never scroll
 * sideways. A dashboard widget is the place that gets broken, so the fixture
 * is a widget rather than a full-width page.
 */
export function ChartInNarrowWidget() {
  const series = Array.from({ length: 6 }, (_, i) => ({
    dataKey: `m${i}`,
    label: `A very long metric name ${i}`,
    unit: "mmHg",
  }));
  const data = Array.from({ length: 12 }, (_, r) => {
    const row: Record<string, unknown> = { date: `2026-09-${String(r + 1).padStart(2, "0")}` };
    for (let i = 0; i < 6; i += 1) row[`m${i}`] = r === 3 ? null : 100 + r + i;
    return row;
  });
  return (
    <div style={{ ...PALETTE, width: 320, overflow: "hidden" }}>
      <StyledChart
        compact
        label="Six metrics"
        title="Six metrics"
        data={data}
        series={series}
        renderPlot={plot}
      />
    </div>
  );
}

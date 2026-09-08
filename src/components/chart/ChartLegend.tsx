"use client";

import React from "react";
import StyledText from "../StyledText";
import { CHART_AXIS_TEXT_VAR, CHART_SURFACE_VAR } from "./chart-palette";
import type { ResolvedChartSeries } from "./chart-series";

/**
 * The legend, drawn so it survives the colours being removed.
 *
 * A charting library's default legend paints a small coloured square and the
 * series name. That is colour plus a text label, which passes the letter of
 * the rule — but it leaves the reader to match a solid square against a DASHED
 * line in the plot, and on a chart with two similar hues that match is exactly
 * what fails under deuteranopia.
 *
 * So each entry draws the series' actual mark: the same colour, the same dash
 * pattern for a line, the same hatch for a bar. The reader matches shape to
 * shape.
 *
 * The label itself is theme text, never the series colour — a coloured mark
 * beside a name carries identity; coloured text just gets harder to read.
 */
export interface ChartLegendProps {
  series: ResolvedChartSeries[];
  /** Bars get a filled swatch; lines and areas get a stroked rule. */
  variant?: "line" | "bar";
}

function HatchSwatch({ s }: { s: ResolvedChartSeries }) {
  // A miniature of the bar's fill: the hue, overlaid with the same texture.
  const stripes: Record<string, string> = {
    diagonal: "repeating-linear-gradient(45deg, transparent 0 3px, VAR 3px 5px)",
    reverse: "repeating-linear-gradient(135deg, transparent 0 3px, VAR 3px 5px)",
    cross: "repeating-linear-gradient(90deg, transparent 0 3px, VAR 3px 5px)",
  };
  const overlay = s.hatch
    ? stripes[s.hatch]?.replace(/VAR/g, CHART_SURFACE_VAR)
    : undefined;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 18,
        height: 12,
        borderRadius: 3,
        flexShrink: 0,
        backgroundColor: s.color,
        backgroundImage: overlay,
      }}
    />
  );
}

function LineSwatch({ s }: { s: ResolvedChartSeries }) {
  return (
    <svg width={26} height={12} aria-hidden="true" style={{ flexShrink: 0 }}>
      <line
        x1={1}
        y1={6}
        x2={25}
        y2={6}
        stroke={s.color}
        strokeWidth={2.5}
        strokeDasharray={s.dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

export const ChartLegend: React.FC<ChartLegendProps> = ({
  series,
  variant = "line",
}) => (
  <div
    data-testid="chart-legend"
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "0.25rem 1rem",
      paddingTop: "0.5rem",
    }}
  >
    {series.map((s) => (
      <span
        key={s.dataKey}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
      >
        {variant === "bar" ? <HatchSwatch s={s} /> : <LineSwatch s={s} />}
        <StyledText size="sm" color={CHART_AXIS_TEXT_VAR}>
          {s.label}
        </StyledText>
      </span>
    ))}
  </div>
);

export default ChartLegend;

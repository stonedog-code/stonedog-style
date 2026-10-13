import React from "react";
import ChartTooltip from "./chart/ChartTooltip";

/**
 * Mount targets for `ChartTooltip.ct.tsx` (NEH-2042).
 *
 * The card is mounted directly with an `active` payload — exactly what the
 * host's charting library hands it on hover. The package ships no charting
 * library, so hovering a real mark here would be testing the host's dependency.
 *
 * The card sits over a high-contrast STRIPE, standing in for the plot's lines
 * and grid. A see-through card lets the stripe through; an opaque one does not.
 */

const PAYLOAD = [
  { dataKey: "taken", name: "Taken", value: 3 },
  { dataKey: "missed", name: "Missed", value: 1 },
];

const STRIPES =
  "repeating-linear-gradient(90deg, rgb(255, 255, 255) 0 4px, rgb(0, 0, 0) 4px 8px)";

function Stage({
  palette,
  children,
}: {
  palette: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...palette, padding: "1rem" }}>
      <div data-testid="plot" style={{ backgroundImage: STRIPES, padding: "1rem" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A dark host whose chart surface carries ALPHA — the case a user-editable
 * theme can produce, and the reason the card paints an opaque base.
 */
const DARK_TRANSLUCENT: React.CSSProperties = {
  ["--hopper-chart-surface" as string]: "rgba(30, 41, 59, 0.6)",
  ["--hopper-chart-axis-text" as string]: "rgb(241, 245, 249)",
  ["--hopper-chart-grid" as string]: "rgb(51, 65, 85)",
  ["--hopper-chart-tooltip-base" as string]: "rgb(15, 23, 42)",
  ["--hopper-chart-series-1" as string]: "rgb(57, 135, 229)",
  ["--hopper-chart-series-2" as string]: "rgb(217, 89, 38)",
  background: "rgb(15, 23, 42)",
  color: "rgb(241, 245, 249)",
};

/** A host that defines only the chrome tokens it always had — no tooltip names. */
const LIGHT_MINIMAL: React.CSSProperties = {
  ["--hopper-chart-surface" as string]: "rgb(255, 255, 255)",
  ["--hopper-chart-axis-text" as string]: "rgb(15, 23, 42)",
  ["--hopper-chart-grid" as string]: "rgb(203, 213, 225)",
  ["--hopper-chart-series-1" as string]: "rgb(37, 99, 235)",
  ["--hopper-chart-series-2" as string]: "rgb(220, 38, 38)",
  background: "rgb(255, 255, 255)",
  color: "rgb(15, 23, 42)",
};

export function DarkTranslucentTooltip() {
  return (
    <Stage palette={DARK_TRANSLUCENT}>
      <ChartTooltip active label="Oct 12" payload={PAYLOAD} />
    </Stage>
  );
}

export function LightMinimalTooltip() {
  return (
    <Stage palette={LIGHT_MINIMAL}>
      <ChartTooltip active label="Oct 12" payload={PAYLOAD} />
    </Stage>
  );
}

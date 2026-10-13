"use client";

import React from "react";
import StyledBox from "../StyledBox";
import StyledText from "../StyledText";
import {
  CHART_TOOLTIP_BASE_VAR,
  CHART_TOOLTIP_BG_VAR,
  CHART_TOOLTIP_BORDER_VAR,
  CHART_TOOLTIP_TEXT_VAR,
  chartSeriesVar,
} from "./chart-palette";

/**
 * One tooltip card for every chart.
 *
 * A charting library's default is a white rectangle with a hard border and
 * 12px type. It ignores the theme entirely, so on a dark theme it is a white
 * slab, and its type is below this system's floor. This replaces it with a
 * card built from the Styled primitives — themed surface, rounded corners,
 * soft shadow, a muted label above prominent values.
 *
 * Two details that are accessibility rather than polish:
 *
 * - Each row carries a **swatch AND the series name**, so the row is readable
 *   with the colours removed.
 * - The value is rendered at the normal text size, not shrunk to fit. A
 *   tooltip nobody can read is not a tooltip.
 *
 * And one that is a rule rather than a detail: the tooltip is a CONVENIENCE.
 * `StyledChart` always renders the table, so nothing here is the only route to
 * a number — hover is never the sole way to read a value.
 */

/**
 * The subset of a charting library's tooltip contract this card needs.
 *
 * Declared locally rather than imported so this file — which every chart pulls
 * in — does not put a charting library into the module graph. The mark half is
 * loaded lazily by the host precisely to keep that library out of the main
 * bundle, and a type-only import would be erased but an accidental value
 * import would not.
 */
export interface ChartTooltipPayloadEntry {
  name?: string | number;
  value?: string | number | (string | number)[] | null;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
  color?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayloadEntry[];
  /** Formats the heading — the caller's x-axis formatter, usually. */
  labelFormatter?: (value: string) => string;
  /** Maps a series `dataKey` to its palette slot, so the swatch matches. */
  slotForKey?: (dataKey: string) => number;
}

function formatValue(value: ChartTooltipPayloadEntry["value"]): string {
  // An absent value is a GAP, and prints as one. Never as zero — see
  // `chart-table.ts` for why that distinction is the point of NEH-1518.
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(" – ");
  return String(value);
}

/**
 * The card's paint, as an inline style rather than Panda props (NEH-2042).
 *
 * These values are computed in `chart-palette.ts`, and Panda extracts only
 * values it can read as literals in the file that uses them. As style props
 * they put class names in the DOM with NO rule behind them, so the card shipped
 * with no background, no border colour and inherited text — see-through over
 * the plot on a dark theme. An inline style is always applied, and does not
 * depend on a consumer's `include` glob either.
 *
 * Two layers, so the card is opaque whatever the theme says: the opaque base
 * as `background-color`, the themed surface as a one-colour gradient over it.
 * A translucent theme surface then composites to a solid colour instead of
 * letting the lines run through the text.
 */
const TOOLTIP_PAINT: React.CSSProperties = {
  backgroundColor: CHART_TOOLTIP_BASE_VAR,
  backgroundImage: `linear-gradient(${CHART_TOOLTIP_BG_VAR}, ${CHART_TOOLTIP_BG_VAR})`,
  color: CHART_TOOLTIP_TEXT_VAR,
  border: `1px solid ${CHART_TOOLTIP_BORDER_VAR}`,
};

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  label,
  payload,
  labelFormatter,
  slotForKey,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const heading =
    label === undefined || label === null
      ? ""
      : labelFormatter
        ? labelFormatter(String(label))
        : String(label);

  return (
    <StyledBox
      data-testid="chart-tooltip"
      borderRadius="lg"
      px={3}
      py={2}
      boxShadow="0 6px 20px rgba(0, 0, 0, 0.18)"
      style={TOOLTIP_PAINT}
    >
      {heading !== "" && (
        <StyledText size="sm" color="inherit" mb={1}>
          {heading}
        </StyledText>
      )}
      {payload.map((entry, index) => {
        const key = String(entry.dataKey ?? index);
        const slot = slotForKey ? slotForKey(key) : index + 1;
        return (
          <div
            key={key}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 3,
                flexShrink: 0,
                backgroundColor: chartSeriesVar(slot),
              }}
            />
            <StyledText size="sm" color="inherit">
              {entry.name ?? key}: {formatValue(entry.value)}
            </StyledText>
          </div>
        );
      })}
    </StyledBox>
  );
};

export default ChartTooltip;

"use client";

import React from "react";
import StyledBox from "../StyledBox";
import { SR_ONLY } from "./sr-only";
import {
  CHART_RANGES,
  CHART_RANGE_LABELS,
  type ChartRangeKey,
} from "./chart-range";

/**
 * The range control: 1 Day / 1 Week / 1 Month / 1 Year / Custom.
 *
 * ## Three decisions here are requirements, not styling
 *
 * **1. The labels are spelled out.** Never "D / W / M / Y". See
 * `chart-range.ts` — this was decided against an audience of seniors and
 * adults with cognitive disabilities, for whom a single letter is a decoding
 * step before a choice.
 *
 * **2. The active state does not rest on colour.** Three redundant cues, and
 * each is checkable:
 *
 * - `aria-pressed` — the programmatic one. These are toggle buttons rather
 *   than tabs on purpose: nothing swaps, so there is no panel to own and
 *   `role="tab"` would promise a relationship that does not exist.
 * - **Weight.** Bold on the active option.
 * - **A 3px bottom border in `currentColor`.** `currentColor` rather than a
 *   palette entry, deliberately: it is by construction the same colour as the
 *   label text, which the theme already holds to at least 4.5:1 against the
 *   surface. A separately-chosen border colour is a second contrast claim
 *   nobody re-checks when the theme moves; this one cannot drift below the
 *   3:1 the non-text contrast rule asks for without the label failing first
 *   and much more visibly.
 *
 * The inactive button keeps the same 3px border in `transparent`, so choosing
 * one does not move the row.
 *
 * **3. Every metric is inline `style`, not a Panda prop.** Panda extracts
 * literal style values by statically parsing source; `minHeight={size}` emits
 * no rule while still landing a class name in the DOM. A tap target that
 * silently becomes 20px tall is exactly the failure this component exists to
 * prevent, so its sizes do not go through the extractor at all. Sizes that
 * SHOULD follow the host's scale reach it through a custom property with a
 * literal fallback.
 */

/**
 * The tap-target floor.
 *
 * 48 is the house minimum (WCAG 2.2 AA asks 24; this product asks more,
 * because its users' pointing accuracy is the reason the product exists).
 * Overridable upward through `--stonedog-chart-control-size`, never below.
 */
const CONTROL_MIN = "max(48px, var(--stonedog-chart-control-size, 48px))";

export interface ChartRangeControlProps {
  value: ChartRangeKey;
  onChange: (range: ChartRangeKey) => void;
  /** Which options to offer. Defaults to all five. */
  ranges?: readonly ChartRangeKey[];
  /**
   * The group's accessible name.
   *
   * Named after the chart it controls — "Range for Weight" — because a page
   * with four charts has four of these and "Range" four times tells a screen
   * reader user nothing about which one they are in.
   */
  label: string;
  "data-testid"?: string;
}

export const ChartRangeControl: React.FC<ChartRangeControlProps> = ({
  value,
  onChange,
  ranges = CHART_RANGES,
  label,
  "data-testid": testId = "chart-range-control",
}) => (
  <StyledBox
    role="group"
    aria-label={label}
    data-testid={testId}
    display="flex"
    flexWrap="wrap"
    gap={1}
    mb={2}
  >
    {ranges.map((range) => {
      const active = range === value;
      return (
        <button
          key={range}
          type="button"
          aria-pressed={active}
          data-testid={`chart-range-${range}`}
          data-active={active ? "true" : "false"}
          onClick={() => onChange(range)}
          style={{
            minHeight: CONTROL_MIN,
            minWidth: CONTROL_MIN,
            paddingInline: "0.75rem",
            // The host's own text scale, with a literal that keeps the button
            // legible if the property is undefined.
            fontSize: "var(--font-sizes-md, 1rem)",
            fontWeight: active ? 700 : 400,
            borderStyle: "solid",
            borderWidth: 0,
            borderBottomWidth: 3,
            borderBottomColor: active ? "currentColor" : "transparent",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          {CHART_RANGE_LABELS[range]}
          {active && <span style={SR_ONLY}> (selected)</span>}
        </button>
      );
    })}
  </StyledBox>
);

export default ChartRangeControl;

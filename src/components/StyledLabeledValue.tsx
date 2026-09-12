"use client";

import React from "react";
import StyledText, { type StyledTextProps } from "./StyledText";

/**
 * One label and its value — "Average" over "182.7 points" — as a real
 * `<dl>`/`<dt>`/`<dd>`, so the pair cannot render as one run.
 *
 * ```tsx
 * <StyledLabeledValue label="Average" value="182.7 points" />
 * <StyledLabeledValue label="Weight" value="64.2 kg" layout="inline" />
 * ```
 *
 * ## Why props and not children (NEH-1558)
 *
 * The shape this replaces is two adjacent `StyledText` siblings:
 *
 * ```tsx
 * <StyledBox>
 *   <StyledText size="sm" color="textSecondary">{label}</StyledText>
 *   <StyledText fontWeight="bold">{value}</StyledText>
 * </StyledBox>
 * ```
 *
 * `StyledText` is an inline `<span>`, JSX strips the newline between the two,
 * and `StyledBox` parents them in a plain block `<div>` — so they render as
 * "Average182.7 points". That has shipped at least four times. `StyledText`'s
 * block promotion only fires when the caller passes `block` or a vertical
 * spacing prop, and **a heuristic keyed on props cannot fire when there are no
 * props**; the next occurrence also passes none.
 *
 * Taking `label` and `value` as props moves the separation into the library.
 * The caller supplies two strings and never writes the boundary, so there is
 * nothing to forget.
 *
 * ## It also fixes the half you cannot see
 *
 * `block` on both spans separates the BOXES, but they are still two unrelated
 * spans, and a screen reader announces them as one string with no tie between
 * them. `<dt>`/`<dd>` is the element HTML has for exactly this pairing, so the
 * label is announced as the term and the value as its definition.
 *
 * ## Why not `StyledDefinitionList.Root`
 *
 * Same elements, different job. `StyledDefinitionList` is a details PANEL: it
 * applies `dlRecipe`, which paints a surface, a border and padding, and lays
 * pairs out in a two-column grid. A labeled value sits inside a tile or a card
 * that already has a surface, so reusing the panel would put a bordered card
 * inside the card. This component paints nothing and knows no colour beyond the
 * text tokens `StyledText` already uses.
 *
 * ## Layout is inline style, deliberately
 *
 * Panda extracts only literal style values, and a value chosen by a prop is not
 * literal. `display` and `gap` therefore go in `style`, reaching the host's
 * spacing through its custom property with a fallback, so they apply whatever
 * the consumer's `include` glob does. `display: block` is written explicitly
 * on `<dt>` and `<dd>` too, even though it is their UA default: a host reset
 * that restyles description lists must not be able to make them inline again.
 */

export const LABELED_VALUE_LAYOUTS = ["stacked", "inline"] as const;
export type LabeledValueLayout = (typeof LABELED_VALUE_LAYOUTS)[number];

type FontSizeKey = NonNullable<StyledTextProps["size"]>;

export interface StyledLabeledValueProps
  extends Omit<React.HTMLAttributes<HTMLDListElement>, "children"> {
  /** What the value is. Rendered in a `<dt>`. Required: a value with no label is just text. */
  label: React.ReactNode;
  /** The value itself. Rendered in a `<dd>`. */
  value: React.ReactNode;
  /**
   * `stacked` (the default) puts the label above the value — the tile and
   * readout shape. `inline` puts them on one line with a gap, and wraps when
   * the line is too narrow for both.
   */
  layout?: LabeledValueLayout | undefined;
  /** Font-size step for the label, relative to the reader's profile. Defaults to `sm`. */
  labelSize?: FontSizeKey | undefined;
  /** Font-size step for the value, relative to the reader's profile. Defaults to `md`. */
  valueSize?: FontSizeKey | undefined;
}

/** The host's spacing step 2 — `0.5rem` in the base preset. */
const PAIR_GAP = "var(--spacing-2, 0.5rem)";

const PAIR_PART_STYLE: React.CSSProperties = { display: "block", margin: 0 };

function listStyle(layout: LabeledValueLayout): React.CSSProperties {
  // Flex in both layouts. Its items are blockified whatever a host's CSS says
  // about `dt`/`dd`, which is the belt to the explicit `display: block`'s
  // braces.
  return layout === "inline"
    ? {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        columnGap: PAIR_GAP,
        margin: 0,
      }
    : { display: "flex", flexDirection: "column", margin: 0 };
}

const StyledLabeledValue = React.forwardRef<HTMLDListElement, StyledLabeledValueProps>(
  ({ label, value, layout = "stacked", labelSize = "sm", valueSize, style, ...rest }, ref) => {
    const resolvedLayout: LabeledValueLayout = LABELED_VALUE_LAYOUTS.includes(layout)
      ? layout
      : "stacked";

    return (
      <dl
        ref={ref}
        data-layout={resolvedLayout}
        style={{ ...listStyle(resolvedLayout), ...style }}
        {...rest}
      >
        <dt style={PAIR_PART_STYLE}>
          <StyledText size={labelSize} color="textSecondary">
            {label}
          </StyledText>
        </dt>
        <dd style={PAIR_PART_STYLE}>
          <StyledText size={valueSize} fontWeight="bold">
            {value}
          </StyledText>
        </dd>
      </dl>
    );
  },
);

StyledLabeledValue.displayName = "StyledLabeledValue";

export default StyledLabeledValue;

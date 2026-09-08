"use client";

import React from "react";
import StyledBox from "../StyledBox";
import StyledHeading from "../StyledHeading";
import StyledText from "../StyledText";
import { SR_ONLY } from "./sr-only";

/**
 * The titled, bordered panel a chart sits in.
 *
 * It is deliberately NOT folded into the chart itself. A chart is sometimes
 * framed and sometimes bare inside a card that already has its own heading,
 * and folding the frame in would force the second case to un-style it.
 */
export interface ChartFrameProps {
  /** The panel heading. Omit for an unframed-but-padded container. */
  title?: React.ReactNode;
  /** Optional controls rendered under the title, above the chart. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  /** Test hook. */
  "data-testid"?: string;
  /**
   * Tighter padding, for a frame inside a dashboard widget rather than on a
   * full page. A boolean rather than a number on purpose — see below.
   */
  compact?: boolean;
}

export const ChartFrame: React.FC<ChartFrameProps> = ({
  title,
  toolbar,
  children,
  compact = false,
  "data-testid": testId,
}) => (
  <StyledBox
    data-testid={testId}
    /*
     * Both paddings are written as literals in a ternary, never as `p={pad}`.
     * Panda extracts LITERAL style values by statically parsing this source: a
     * variable resolves to nothing, emits no rule, and the class still lands
     * in the DOM — so the padding silently disappears with no build error and
     * nothing to notice until someone looks at the pixels. A ternary with two
     * static branches is extracted; a number prop is not.
     */
    p={compact ? 3 : 4}
    borderWidth="1px"
    borderRadius="md"
    borderColor="borderBgPrimary"
  >
    {title !== undefined && (
      <StyledHeading size="sm" mb={compact ? 2 : 3}>
        {title}
      </StyledHeading>
    )}
    {toolbar}
    {children}
  </StyledBox>
);

/**
 * What a chart shows when it has nothing to draw.
 *
 * This exists as a component rather than a `return null` because six framed,
 * titled, EMPTY panels read as "we lost your readings", which is worse than
 * saying plainly that there is nothing yet.
 */
export const ChartEmpty: React.FC<{ message: string; height?: number }> = ({
  message,
  height,
}) => (
  <StyledBox
    data-testid="chart-empty"
    display="flex"
    alignItems="center"
    justifyContent="center"
    /*
     * Inline, not `minH={`${height}px`}` — a computed value is invisible to
     * Panda's static extraction, so the height would simply not apply. The
     * height matters: the empty state stands where the plot would have been,
     * and a collapsed one makes the page jump as data arrives.
     */
    style={height ? { minHeight: height } : undefined}
    p={4}
  >
    <StyledText color="textSecondary" textAlign="center">
      {message}
    </StyledText>
  </StyledBox>
);

/**
 * One reading, shown as the reading.
 *
 * A line needs two points. A resident with one recorded value does not have a
 * line — but they do have a number, and the thing they least need to be told
 * is that nothing was recorded.
 *
 * The two states stay distinguishable: `ChartEmpty` means "you have not
 * recorded this", this means "there is not enough here to draw a line yet".
 */
export const ChartSingleReading: React.FC<{
  readings: { label: string; value: string; unit?: string }[];
  when: string;
  height?: number;
  /** What to suggest instead. The host words it; this component does not. */
  hint?: string;
}> = ({ readings, when, height, hint }) => (
  <StyledBox
    data-testid="chart-single-reading"
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    gap={2}
    /* Inline for the same reason ChartEmpty's is — see the note there. */
    style={height ? { minHeight: height } : undefined}
    p={4}
  >
    {readings.map((r) => (
      <StyledBox
        key={r.label}
        textAlign="center"
        display="flex"
        flexDirection="column"
      >
        {/*
          * VALUE AND UNIT IN ONE TEXT NODE, not two siblings.
          *
          * `StyledText` renders a `<span>` and JSX strips the whitespace
          * between elements on separate lines, so two adjacent ones weld into
          * a single run. One node cannot weld with itself, and it also puts
          * the unit in the same accessible text node as the number, which is
          * what WCAG 1.3.1 wants: `264.2` alone is ambiguous between pounds
          * and kilograms and a screen reader should not have to guess.
          *
          * A `size`, never a `fontSize` — `fontSize` freezes the text so it
          * stops responding when a reader enlarges it.
          */}
        <StyledText size="3xl" fontWeight="bold" block>
          {r.unit ? `${r.value} ${r.unit}` : r.value}
        </StyledText>
        <StyledText color="textSecondary" block>
          {r.label}
        </StyledText>
      </StyledBox>
    ))}
    {when && (
      <StyledText color="textSecondary" block style={SR_ONLY}>
        Recorded {when}
      </StyledText>
    )}
    {hint && (
      <StyledText color="textSecondary" textAlign="center" block>
        {hint}
      </StyledText>
    )}
  </StyledBox>
);

export default ChartFrame;

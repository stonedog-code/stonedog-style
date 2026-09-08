/**
 * The range vocabulary, and the one hook that makes a range seedable.
 *
 * Pure — no React component, no DOM — so the interesting half (what the
 * options are, what they are called, how a page-level seed interacts with a
 * per-chart override) is unit-testable.
 *
 * ## The labels are spelled out, and that is a requirement rather than a taste
 *
 * "D / W / M / Y" is four characters the reader has to decode before they can
 * choose. For an audience of seniors and adults with cognitive disabilities
 * that decoding step is exactly the barrier the product exists to remove, so
 * the labels are "1 Day", "1 Week", "1 Month", "1 Year", "Custom" and there is
 * no abbreviated variant to fall back to. Decided on NEH-1520 after an
 * accessibility consult; do not add a `compact` prop that undoes it.
 */

import { useCallback, useRef, useState } from "react";

export const CHART_RANGES = ["day", "week", "month", "year", "custom"] as const;

export type ChartRangeKey = (typeof CHART_RANGES)[number];

/**
 * What each range is CALLED. Spelled out and quantified — see the note above.
 *
 * The number is part of the label ("1 Week", not "Week") because "Week" alone
 * is ambiguous between "this calendar week" and "the last seven days", and the
 * chart means the second.
 */
export const CHART_RANGE_LABELS: Readonly<Record<ChartRangeKey, string>> = {
  day: "1 Day",
  week: "1 Week",
  month: "1 Month",
  year: "1 Year",
  custom: "Custom",
};

export function isChartRangeKey(value: unknown): value is ChartRangeKey {
  return (
    typeof value === "string" &&
    (CHART_RANGES as readonly string[]).includes(value)
  );
}

/**
 * A range that the page SEEDS and the reader can then override, per chart.
 *
 * Neither of the two obvious shapes can express what is wanted here:
 *
 * - **Purely controlled** (`value` + `onChange`, no internal state) cannot
 *   express "the resident changed just this one chart" — every chart on the
 *   page is bound to the same state, so changing one changes all of them
 *   unless the page keeps a map keyed by chart id, which pushes the whole
 *   problem into every host.
 * - **Purely uncontrolled** (`defaultValue`, read once) cannot express "the
 *   page said Week" after mount. A page-level range control that moves to
 *   Month leaves every chart on Week, silently.
 *
 * So: the seed is adopted whenever it CHANGES, and a local choice wins until
 * it does. `seedRef` holds the last seed observed rather than comparing
 * against the current value, which is the distinction that makes a local
 * override survive a re-render with an unchanged seed.
 *
 * `onChange` is called only for a reader's own choice, never for adopting a
 * seed — a host that writes the callback's value back into the seed would
 * otherwise loop.
 */
export function useSeededRange(
  seed: ChartRangeKey,
  onChange?: (range: ChartRangeKey) => void,
): [ChartRangeKey, (range: ChartRangeKey) => void] {
  const [local, setLocal] = useState<ChartRangeKey>(seed);
  const seedRef = useRef<ChartRangeKey>(seed);

  // Render-phase adoption rather than an effect: an effect would paint one
  // frame of the stale range first, which on a chart is a visible flicker of
  // the wrong data.
  //
  // `effective` is computed rather than read back out of state on purpose.
  // `setLocal` during render schedules an immediate re-render, but THIS pass
  // still holds the old value, and returning it would hand the caller one
  // render of the range it just stopped being in.
  const adopting = seedRef.current !== seed;
  if (adopting) {
    seedRef.current = seed;
    setLocal(seed);
  }
  const effective = adopting ? seed : local;

  const choose = useCallback(
    (range: ChartRangeKey) => {
      setLocal(range);
      onChange?.(range);
    },
    [onChange],
  );

  return [effective, choose];
}

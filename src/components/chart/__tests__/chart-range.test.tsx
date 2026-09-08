/**
 * The range vocabulary and the seeded-range hook.
 *
 * The labels are asserted as a REQUIREMENT, not as a snapshot: single-letter
 * range labels were rejected on NEH-1520 because this product's audience has
 * to decode them, and a test is the only thing that stops a later "compact
 * mode" quietly reintroducing them.
 */

import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  CHART_RANGES,
  CHART_RANGE_LABELS,
  isChartRangeKey,
  useSeededRange,
  type ChartRangeKey,
} from "../chart-range";

describe("the range labels", () => {
  it("offers exactly the five ranges the product asked for", () => {
    expect(CHART_RANGES).toEqual(["day", "week", "month", "year", "custom"]);
  });

  it("spells every label out — never a single letter", () => {
    for (const range of CHART_RANGES) {
      const label = CHART_RANGE_LABELS[range];
      expect(label.length).toBeGreaterThan(1);
      // "D", "W", "M", "Y" and any other bare initial.
      expect(label).not.toMatch(/^[A-Z]$/);
    }
  });

  it("quantifies the four durations, so 'Week' cannot mean two things", () => {
    expect(CHART_RANGE_LABELS.day).toBe("1 Day");
    expect(CHART_RANGE_LABELS.week).toBe("1 Week");
    expect(CHART_RANGE_LABELS.month).toBe("1 Month");
    expect(CHART_RANGE_LABELS.year).toBe("1 Year");
    expect(CHART_RANGE_LABELS.custom).toBe("Custom");
  });

  it("recognises its own keys and nothing else", () => {
    expect(isChartRangeKey("week")).toBe(true);
    expect(isChartRangeKey("W")).toBe(false);
    expect(isChartRangeKey(undefined)).toBe(false);
  });
});

function Harness({
  seed,
  onChange,
}: {
  seed: ChartRangeKey;
  onChange?: (r: ChartRangeKey) => void;
}) {
  const [range, choose] = useSeededRange(seed, onChange);
  return (
    <div>
      <output data-testid="range">{range}</output>
      <button type="button" onClick={() => choose("month")}>
        pick month
      </button>
    </div>
  );
}

describe("useSeededRange — the page seeds it, the reader overrides it", () => {
  it("starts in the range the page named", () => {
    render(<Harness seed="year" />);
    expect(screen.getByTestId("range")).toHaveTextContent("year");
  });

  it("keeps a reader's own choice when the page re-renders unchanged", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness seed="week" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByTestId("range")).toHaveTextContent("month");

    // The page re-renders for some unrelated reason. A purely controlled
    // component would snap back to "week" here, which is the failure that
    // makes "change just this one chart" impossible.
    rerender(<Harness seed="week" />);
    expect(screen.getByTestId("range")).toHaveTextContent("month");
  });

  it("adopts a NEW seed, overriding the reader's choice", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness seed="week" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByTestId("range")).toHaveTextContent("month");

    // The page-level control moved. A purely uncontrolled component would sit
    // on "month" forever, which is the other half of the same problem.
    act(() => {
      rerender(<Harness seed="day" />);
    });
    expect(screen.getByTestId("range")).toHaveTextContent("day");
  });

  it("reports a reader's choice and stays silent when adopting a seed", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(<Harness seed="week" onChange={onChange} />);

    act(() => {
      rerender(<Harness seed="year" onChange={onChange} />);
    });
    // Adopting a seed must not call back: a host that writes the callback's
    // value into the seed would otherwise loop.
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("month");
  });
});

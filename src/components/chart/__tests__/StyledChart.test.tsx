/**
 * `StyledChart` in a DOM.
 *
 * jsdom has no layout engine, so nothing here says anything about size,
 * contrast or overflow — those are asserted in the component tier at real
 * viewports. What jsdom CAN answer is structural, and that is what this covers:
 * is the table really a table, is it really always there, does the active
 * range carry something other than colour, does fullscreen open and close.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import StyledChart from "../StyledChart";
import type { ChartPlotArgs } from "../StyledChart";

const series = [
  { dataKey: "systolic", label: "Systolic", unit: "mmHg" },
  { dataKey: "diastolic", label: "Diastolic", unit: "mmHg" },
];

const data = [
  { date: "2026-09-01", systolic: 118, diastolic: 76 },
  { date: "2026-09-02", systolic: null, diastolic: null },
  { date: "2026-09-03", systolic: 121, diastolic: 79 },
];

function renderChart(props: Partial<React.ComponentProps<typeof StyledChart>> = {}) {
  return render(
    <StyledChart
      label="Blood pressure"
      title="Blood pressure"
      data={data}
      series={series}
      renderPlot={(args: ChartPlotArgs) => (
        <div data-testid="plot" data-height={args.height}>
          plot of {args.series.length} series
        </div>
      )}
      {...props}
    />,
  );
}

describe("the table is always present", () => {
  it("renders a real <table>, not a grid of divs", () => {
    renderChart();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders the plot AND the table at the same time", () => {
    renderChart();
    expect(screen.getByTestId("plot")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("offers no control that could hide either one", () => {
    // The decision on NEH-1521 was "no toggle, anywhere". A later `role="tab"`
    // or a "Show table" button is the thing this asserts against.
    renderChart();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    const names = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.toLowerCase() ?? "");
    expect(names.some((n) => n.includes("table"))).toBe(false);
    expect(names.some((n) => n.includes("chart"))).toBe(false);
  });

  it("gives every column a <th scope=col> and every row a <th scope=row>", () => {
    renderChart();
    const table = screen.getByRole("table");
    const columnHeaders = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.getAttribute("scope"));
    expect(columnHeaders).toEqual(["col", "col", "col"]);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(data.length);
  });

  it("puts the unit on the column header, in the same node as the label", () => {
    renderChart();
    expect(
      screen.getByRole("columnheader", { name: "Systolic (mmHg)" }),
    ).toBeInTheDocument();
  });

  it("captions the table so a reader knows it is the same numbers", () => {
    renderChart();
    expect(screen.getByRole("table")).toHaveAccessibleName(
      /the same readings as a table/i,
    );
  });
});

describe("the gap day", () => {
  it("renders as a dash with words, never as 0", () => {
    renderChart();
    const gapRow = screen
      .getAllByRole("row")
      .find((r) => r.getAttribute("data-gap-row") === "true");
    expect(gapRow).toBeDefined();
    const cells = within(gapRow!).getAllByRole("cell");
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell.textContent).toContain("—");
      expect(cell.textContent).toContain("No data recorded");
      expect(cell.textContent).not.toContain("0");
    }
  });

  it("keeps the gap day on the axis rather than dropping the row", () => {
    renderChart();
    expect(screen.getByRole("rowheader", { name: "2026-09-02" })).toBeInTheDocument();
  });
});

describe("the range control", () => {
  it("spells every option out", () => {
    renderChart();
    for (const label of ["1 Day", "1 Week", "1 Month", "1 Year", "Custom"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("marks the active option with aria-pressed and with weight, not colour", () => {
    renderChart({ range: "month" });
    const active = screen.getByTestId("chart-range-month");
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active.style.fontWeight).toBe("700");
    // The third cue: a bottom border in the label's own colour, so its
    // contrast cannot drift below the text's.
    expect(active.style.borderBottomColor.toLowerCase()).toBe("currentcolor");
    expect(active.style.borderBottomWidth).toBe("3px");

    const inactive = screen.getByTestId("chart-range-day");
    expect(inactive).toHaveAttribute("aria-pressed", "false");
    expect(inactive.style.fontWeight).toBe("400");
    // Same border width when inactive, so choosing one does not move the row.
    expect(inactive.style.borderBottomWidth).toBe("3px");
    expect(inactive.style.borderBottomColor).toBe("transparent");
  });

  it("names the group after the chart it controls", () => {
    renderChart();
    expect(
      screen.getByRole("group", { name: "Range for Blood pressure" }),
    ).toBeInTheDocument();
  });

  it("lets a reader change this chart without telling the page", async () => {
    const user = userEvent.setup();
    const onRangeChange = jest.fn();
    renderChart({ range: "week", onRangeChange });
    await user.click(screen.getByTestId("chart-range-year"));
    expect(screen.getByTestId("chart-range-year")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(onRangeChange).toHaveBeenCalledWith("year");
  });
});

describe("fullscreen", () => {
  it("opens a labelled modal dialog carrying the same table", async () => {
    const user = userEvent.setup();
    renderChart();
    await user.click(screen.getByTestId("chart-fullscreen-open"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Blood pressure");
    expect(within(dialog).getByRole("table")).toBeInTheDocument();
    expect(within(dialog).getByTestId("plot")).toBeInTheDocument();
  });

  it("carries a visible word, not an icon alone", () => {
    renderChart();
    expect(screen.getByTestId("chart-fullscreen-open").textContent).toContain(
      "Full screen",
    );
  });

  it("moves focus into the overlay and back out again", async () => {
    const user = userEvent.setup();
    renderChart();
    const open = screen.getByTestId("chart-fullscreen-open");
    await user.click(open);
    expect(screen.getByTestId("chart-fullscreen-close")).toHaveFocus();

    await user.click(screen.getByTestId("chart-fullscreen-close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Focus back where it came from. Leaving it on a removed node sends it to
    // <body>, which for a keyboard user means starting the page again.
    expect(screen.getByTestId("chart-fullscreen-open")).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderChart();
    await user.click(screen.getByTestId("chart-fullscreen-open"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the plot seam", () => {
  it("hands the mark renderer series that already carry their non-colour cues", () => {
    let seen: ChartPlotArgs | undefined;
    renderChart({
      renderPlot: (args) => {
        seen = args;
        return <div data-testid="plot" />;
      },
    });
    expect(seen!.series.map((s) => s.slot)).toEqual([1, 2]);
    expect(seen!.series[0]!.dash).toBeUndefined();
    expect(seen!.series[1]!.dash).toBeTruthy();
    expect(seen!.series[0]!.color).toContain("--stonedog-chart-series-1");
  });

  it("still renders the numbers when no mark renderer is supplied", () => {
    // The default is a working table rather than an error: the numbers were
    // always the thing the reader came for.
    render(
      <StyledChart label="Blood pressure" data={data} series={series} />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      document.querySelector('[data-plot="absent"]'),
    ).toBeInTheDocument();
  });
});

describe("too little data", () => {
  it("says so plainly rather than framing an empty box", () => {
    renderChart({ data: [{ date: "2026-09-01", systolic: null, diastolic: null }] });
    expect(screen.getByTestId("chart-empty")).toBeInTheDocument();
  });

  it("shows a single reading as the reading, not as 'nothing recorded'", () => {
    renderChart({ data: [{ date: "2026-09-01", systolic: 118, diastolic: 76 }] });
    expect(screen.getByTestId("chart-single-reading")).toBeInTheDocument();
    expect(screen.getByText("118 mmHg")).toBeInTheDocument();
    // And the table is still there, because it always is.
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

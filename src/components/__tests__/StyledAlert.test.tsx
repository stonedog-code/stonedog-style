import { render, screen } from "@testing-library/react";
import StyledAlert from "../StyledAlert";

/**
 * `StyledAlert`, at the tier that can answer roles and wiring (NEH-421).
 *
 * What it deliberately does NOT assert: any colour. Every status paints through
 * a token that resolves to a custom property, and jsdom resolves neither — an
 * assertion on the rendered chip here would be the vacuous kind NEH-406 was
 * about. Contrast is measured in `StyledAlert.ct.tsx`.
 */
describe("StyledAlert", () => {
  it("renders its title and message", () => {
    render(
      <StyledAlert status="error" title="Something went wrong">
        We could not save your changes.
      </StyledAlert>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("We could not save your changes.")).toBeInTheDocument();
  });

  /**
   * The role split is the whole reason this component is not one `role="alert"`.
   *
   * `alert` is an assertive live region — a screen reader abandons what it was
   * saying. Right for a failure, hostile for a confirmation, and applying it to
   * all four trains people to ignore the ones that matter.
   */
  it.each([
    ["error", "alert"],
    ["warning", "alert"],
    ["info", "status"],
    ["success", "status"],
  ] as const)("announces %s as role=%s", (status, role) => {
    render(<StyledAlert status={status}>message</StyledAlert>);
    expect(screen.getByRole(role)).toBeInTheDocument();
  });

  it("is announced at all, which the original was not", () => {
    // The component this replaces had NO role on any status, so none of the four
    // was ever announced. Named separately from the mapping above so a
    // regression reads as "alerts went silent" rather than as one row changing.
    for (const status of ["info", "success", "warning", "error"] as const) {
      const { unmount } = render(<StyledAlert status={status}>m</StyledAlert>);
      expect(screen.getByText("m").closest("[role]")).not.toBeNull();
      unmount();
    }
  });

  it("pairs aria-live with the role, so a content swap is announced too", () => {
    // A banner that changes "Saving…" to "Failed" in place is the common case.
    // Without an explicit aria-live, an already-mounted region can stay silent
    // when only its text changes.
    render(<StyledAlert status="error">boom</StyledAlert>);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    render(<StyledAlert status="success">yay</StyledAlert>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  /**
   * WCAG 1.4.1, Level A. The original conveyed status by background colour
   * alone, and left the indicator slot empty at every call site.
   */
  it("gives each status a distinct non-colour signal", () => {
    const glyphs = new Set<string>();
    for (const status of ["info", "success", "warning", "error"] as const) {
      const { container, unmount } = render(
        <StyledAlert status={status}>m</StyledAlert>,
      );
      const indicator = container.querySelector('[aria-hidden="true"]');
      expect(indicator).not.toBeNull();
      expect(indicator!.textContent).not.toBe("");
      glyphs.add(indicator!.textContent!);
      unmount();
    }
    // Four DISTINCT signals. Four identical ticks would satisfy "has a glyph"
    // and convey exactly nothing.
    expect(glyphs.size).toBe(4);
  });

  it("hides the glyph from the accessibility tree", () => {
    // The role already says what kind of message this is; reading "tick" before
    // the text is the same information twice.
    render(<StyledAlert status="success">done</StyledAlert>);
    expect(screen.getByRole("status").querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByText("✓", { ignore: "[aria-hidden='true']" })).toBeNull();
  });

  it("lets a caller substitute their own indicator", () => {
    render(
      <StyledAlert status="info" indicator={<svg data-testid="custom" />}>
        m
      </StyledAlert>,
    );
    expect(screen.getByTestId("custom")).toBeInTheDocument();
  });

  it("renders no indicator when explicitly given null", () => {
    // Possible on purpose, for a caller whose surrounding UI carries the signal.
    const { container } = render(
      <StyledAlert status="info" indicator={null}>
        m
      </StyledAlert>,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("renders without a title", () => {
    const { container } = render(<StyledAlert status="info">just a message</StyledAlert>);
    expect(screen.getByText("just a message")).toBeInTheDocument();
    // No empty title div left behind — it would take vertical space and read as
    // a blank heading to a screen reader walking the tree.
    expect(container.querySelectorAll("div").length).toBeLessThan(4);
  });

  it("defaults to info", () => {
    render(<StyledAlert>m</StyledAlert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("gives each status a different class, so the recipe really varies", () => {
    // Guards against a recipe whose variants all collapse to the same rule —
    // the defect NEH-234 found in input-bool, where five variants were
    // indistinguishable and a test asserting each "had a class" passed anyway.
    const classes = new Set<string>();
    for (const status of ["info", "success", "warning", "error"] as const) {
      const { container, unmount } = render(<StyledAlert status={status}>m</StyledAlert>);
      classes.add(container.firstElementChild!.className);
      unmount();
    }
    expect(classes.size).toBe(4);
  });

  it("keeps a caller's className alongside its own", () => {
    const { container } = render(
      <StyledAlert className="mine" status="info">
        m
      </StyledAlert>,
    );
    expect(container.firstElementChild!.className).toContain("mine");
    expect(container.firstElementChild!.className).toContain("alert");
  });

  it("forwards a ref to the root", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <StyledAlert ref={ref} status="info">
        m
      </StyledAlert>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

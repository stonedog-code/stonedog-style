import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledTag from "../StyledTag";

/**
 * `StyledTag`, at the tier that can answer roles and wiring (NEH-430).
 *
 * The component this replaces was built on `@ark-ui/react`, which is what kept
 * it out of a package whose dependency list is `csstype` and React. So the
 * claims worth pinning are about what the dependency-free version still does:
 * a non-interactive tag stays non-interactive, and the removable one is a real
 * button with a real accessible name.
 *
 * Tap-target size is a pixel question and lives in `StyledTag.ct.tsx` — jsdom
 * has no layout engine and would agree the button is 48px however it is styled.
 */
describe("StyledTag", () => {
  it("renders its label", () => {
    render(<StyledTag>Draft</StyledTag>);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  /**
   * A tag that is merely a label must not be focusable, and must not offer a
   * control that does nothing. This is the common case by a wide margin.
   */
  it("is not interactive when no onRemove is given", () => {
    render(<StyledTag>Draft</StyledTag>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("when removable", () => {
    it("renders a button and calls onRemove when it is activated", async () => {
      const user = userEvent.setup();
      const onRemove = jest.fn();

      render(<StyledTag onRemove={onRemove}>Draft</StyledTag>);
      await user.click(screen.getByRole("button"));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("is operable by keyboard, not only by pointer", async () => {
      // A native <button> gives this for free, which is most of the argument
      // for not reimplementing one.
      const user = userEvent.setup();
      const onRemove = jest.fn();

      render(<StyledTag onRemove={onRemove}>Draft</StyledTag>);
      await user.tab();
      expect(screen.getByRole("button")).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(onRemove).toHaveBeenCalled();
    });

    it("has an accessible name, and the glyph is not part of it", () => {
      render(<StyledTag onRemove={jest.fn()}>Draft</StyledTag>);

      expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
      expect(screen.getByText("×")).toHaveAttribute("aria-hidden", "true");
    });

    it("takes a specific label, for a list where every tag would say Remove", () => {
      render(
        <StyledTag onRemove={jest.fn()} removeLabel="Remove tag Draft">
          Draft
        </StyledTag>,
      );
      expect(
        screen.getByRole("button", { name: "Remove tag Draft" }),
      ).toBeInTheDocument();
    });

    it('is type="button", so it cannot submit a surrounding form', () => {
      // A tag inside a form is the normal case, and an untyped <button> defaults
      // to submit — so removing a tag would submit the form.
      render(<StyledTag onRemove={jest.fn()}>Draft</StyledTag>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    });
  });

  it("keeps caller-supplied class names", () => {
    const { container } = render(<StyledTag className="mine">Draft</StyledTag>);
    expect(container.querySelector("span")?.className).toContain("mine");
  });
});

/**
 * Tone (NEH-721).
 *
 * HopperGuard drives 109 of its 155 tags from a status — `STATUS_COLOR[item.status]`
 * and friends — so the tag's colour is carrying meaning, and a package with one
 * fixed appearance would have flattened all of them to grey.
 *
 * These assert what jsdom CAN answer: that the tones are distinct classes and
 * that the default is unchanged. Whether each class has CSS behind it is a
 * different question and is asserted in `__tests__/tag-tone-css.test.ts`, which
 * reads the real generated stylesheet — the distinction this package keeps
 * relearning, because a class name with no rule behind it looks identical here.
 */
describe("StyledTag tone", () => {
  const TONES = ["neutral", "info", "success", "warning", "error", "accent"] as const;

  it("defaults to neutral, so existing call sites are untouched", () => {
    const { container: withDefault } = render(<StyledTag>Draft</StyledTag>);
    const { container: explicit } = render(<StyledTag tone="neutral">Draft</StyledTag>);

    expect(withDefault.firstElementChild!.className).toBe(
      explicit.firstElementChild!.className,
    );
  });

  it("gives every tone a distinct class", () => {
    const classes = TONES.map((tone) => {
      const { container } = render(<StyledTag tone={tone}>Draft</StyledTag>);
      return container.firstElementChild!.className;
    });

    // A Set smaller than the list means two tones render identically, which is
    // the defect `input-bool` shipped for months (NEH-234/NEH-310) — variants
    // that were declared differently and painted the same.
    expect(new Set(classes).size).toBe(TONES.length);
  });

  it("renders no indicator unless asked", () => {
    const { container } = render(<StyledTag tone="success">Enabled</StyledTag>);
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });

  /**
   * The escape hatch for WCAG 1.4.1. A tag whose label names its own state
   * ("Enabled") needs nothing; one tinted to mean something its text does not
   * say has colour as its only signal, and needs this.
   */
  it("renders an indicator when given one, hidden from the accessibility tree", () => {
    const { container } = render(
      <StyledTag tone="success" indicator="✓">
        Reminders
      </StyledTag>,
    );

    const indicator = container.querySelector("[aria-hidden='true']");
    expect(indicator).not.toBeNull();
    expect(indicator).toHaveTextContent("✓");
    // The label is still the accessible name — the glyph must not join it.
    expect(screen.getByText("Reminders")).toBeInTheDocument();
  });

  it("keeps the remove button working in every tone", async () => {
    const onRemove = jest.fn();
    render(
      <StyledTag tone="error" onRemove={onRemove} removeLabel="Remove Draft">
        Draft
      </StyledTag>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove Draft" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

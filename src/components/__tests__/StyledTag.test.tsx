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

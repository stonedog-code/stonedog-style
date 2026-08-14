import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledPage from "../StyledPage";

/**
 * `StyledPage`, at the tier that can answer wiring and semantics (NEH-430).
 *
 * The layout contract — that the page fills its row and only the content box
 * scrolls — is a pixel claim and lives in `StyledPage.ct.tsx`. jsdom reports
 * every box as zero-sized and would agree with any arrangement at all.
 */
describe("StyledPage", () => {
  it("renders its children", () => {
    render(<StyledPage>content</StyledPage>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  describe("the title", () => {
    /**
     * The original rendered the title into a bare styled div, so a page's
     * title was not a heading — screen reader users could not navigate to it,
     * and a page with a visible title had no h1.
     */
    it("is a real heading, defaulting to h1", () => {
      render(<StyledPage title="Settings">c</StyledPage>);
      expect(
        screen.getByRole("heading", { level: 1, name: "Settings" }),
      ).toBeInTheDocument();
    });

    it("can take a different level, for a page nested in a heading structure", () => {
      // Skipped or duplicated heading levels are a real navigation problem, and
      // the component cannot see its own surroundings to pick correctly.
      render(
        <StyledPage title="Settings" titleAs="h2">
          c
        </StyledPage>,
      );
      expect(
        screen.getByRole("heading", { level: 2, name: "Settings" }),
      ).toBeInTheDocument();
    });

    it("renders no heading when there is no title", () => {
      render(<StyledPage>c</StyledPage>);
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("renders none unless asked for", () => {
      render(<StyledPage>c</StyledPage>);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows Save, disabled until there is something to save", () => {
      render(
        <StyledPage includeSave>
          c
        </StyledPage>,
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("enables Save once dirty, and calls onSave", async () => {
      const user = userEvent.setup();
      const onSave = jest.fn();

      render(
        <StyledPage includeSave isDirty onSave={onSave}>
          c
        </StyledPage>,
      );

      const save = screen.getByRole("button", { name: "Save" });
      expect(save).toBeEnabled();
      await user.click(save);
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    /**
     * Rendering a disabled Cancel on a pristine page is a control that can
     * never do anything — "discard nothing" is not an action.
     */
    it("shows Cancel only when dirty", () => {
      const { unmount } = render(<StyledPage includeSave>c</StyledPage>);
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
      unmount();

      render(
        <StyledPage includeSave isDirty>
          c
        </StyledPage>,
      );
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("honours saveDisabled even when dirty", () => {
      render(
        <StyledPage includeSave isDirty saveDisabled>
          c
        </StyledPage>,
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("takes custom labels", () => {
      render(
        <StyledPage includeSave isDirty saveLabel="Publish" cancelLabel="Discard">
          c
        </StyledPage>,
      );
      expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    });

    it('renders buttons as type="button", so they cannot submit a surrounding form', () => {
      render(
        <StyledPage includeSave isDirty>
          c
        </StyledPage>,
      );
      for (const button of screen.getAllByRole("button")) {
        expect(button).toHaveAttribute("type", "button");
      }
    });
  });

  /**
   * The point of the whole batch: this component used to import
   * `next/navigation` purely to call `router.back()` as the default Cancel.
   * `window.history.back()` is the same operation reached directly, so there is
   * no seam and `StyleConfig` gains no field.
   */
  describe("Cancel with no handler", () => {
    it("goes back in session history", async () => {
      const user = userEvent.setup();
      const back = jest.spyOn(window.history, "back").mockImplementation(() => {});

      render(
        <StyledPage includeSave isDirty>
          c
        </StyledPage>,
      );
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(back).toHaveBeenCalledTimes(1);
      back.mockRestore();
    });

    it("prefers an explicit onCancel over going back", async () => {
      const user = userEvent.setup();
      const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
      const onCancel = jest.fn();

      render(
        <StyledPage includeSave isDirty onCancel={onCancel}>
          c
        </StyledPage>,
      );
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(back).not.toHaveBeenCalled();
      back.mockRestore();
    });
  });

  it("keeps caller-supplied class names", () => {
    render(<StyledPage className="mine">c</StyledPage>);
    expect(screen.getByTestId("styled-page-root").className).toContain("mine");
  });
});

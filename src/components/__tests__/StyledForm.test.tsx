import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledForm from "../StyledForm";

/**
 * `StyledForm` (NEH-430). Its zod dependency was only ever the TYPE on its
 * `zodErrors` prop, so switching to `FieldError[]` removes it outright.
 */
describe("StyledForm", () => {
  it("renders its children", () => {
    render(
      <StyledForm>
        <input aria-label="Email" />
      </StyledForm>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  /**
   * The original rendered a `StyledBox` — a div. That is not cosmetic: Enter
   * does not submit a div, assistive technology loses the form role, and native
   * constraint validation has nothing to validate against.
   */
  it("renders a real form element", () => {
    const { container } = render(
      <StyledForm>
        <input aria-label="Email" />
      </StyledForm>,
    );
    expect(container.querySelector("form")).toBeInTheDocument();
  });

  it("submits on Enter from a field, which a div could never do", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());

    render(
      <StyledForm onSubmit={onSubmit}>
        <input aria-label="Email" />
      </StyledForm>,
    );

    await user.type(screen.getByLabelText("Email"), "a{Enter}");
    expect(onSubmit).toHaveBeenCalled();
  });

  describe("the error summary", () => {
    it("shows the messages when there are errors", () => {
      render(
        <StyledForm errors={[{ path: ["email"], message: "Enter an email" }]}>
          <input aria-label="Email" />
        </StyledForm>,
      );
      expect(screen.getByText("Enter an email")).toBeInTheDocument();
    });

    it("renders nothing when there are none", () => {
      render(
        <StyledForm errors={[]}>
          <input aria-label="Email" />
        </StyledForm>,
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("is omitted entirely when no errors prop is given", () => {
      render(
        <StyledForm>
          <input aria-label="Email" />
        </StyledForm>,
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    /**
     * A summary rendered below the inputs is one a keyboard user reaches only
     * after tabbing past everything it is telling them about.
     */
    it("comes before the fields in document order", () => {
      const { container } = render(
        <StyledForm errors={[{ path: ["email"], message: "Enter an email" }]}>
          <input aria-label="Email" />
        </StyledForm>,
      );

      const alert = screen.getByRole("alert");
      const input = screen.getByLabelText("Email");
      // DOCUMENT_POSITION_FOLLOWING === 4: the input follows the alert.
      expect(
        alert.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(container.querySelector("form")).toContainElement(alert);
    });

    it("takes a custom heading", () => {
      render(
        <StyledForm
          errors={[{ path: ["email"], message: "Enter an email" }]}
          errorsTitle="Check these"
        >
          <input aria-label="Email" />
        </StyledForm>,
      );
      expect(screen.getByText("Check these")).toBeInTheDocument();
    });
  });
});

import { render, screen } from "@testing-library/react";
import StyledFieldErrors, { type FieldError } from "../StyledFieldErrors";

/**
 * `StyledFieldErrors`, the zod-free replacement for `StyledZodErrorDisplay`
 * (NEH-430).
 *
 * The rename is the substance: the original's prop was `z.ZodIssue[]`, which
 * put zod in the dependency list of a design system — imposed on every
 * consumer, including ones that validate with something else or not at all.
 */
describe("StyledFieldErrors", () => {
  const errors: FieldError[] = [
    { path: ["email"], message: "Enter a valid email address" },
    { path: ["password"], message: "Must be at least 12 characters" },
  ];

  it("lists every message", () => {
    render(<StyledFieldErrors errors={errors} />);
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(
      screen.getByText("Must be at least 12 characters"),
    ).toBeInTheDocument();
  });

  it("shows a heading, overridable", () => {
    const { unmount } = render(<StyledFieldErrors errors={errors} />);
    expect(screen.getByText("Please fix the following:")).toBeInTheDocument();
    unmount();

    render(<StyledFieldErrors errors={errors} title="Check these fields" />);
    expect(screen.getByText("Check these fields")).toBeInTheDocument();
  });

  /**
   * `role="alert"` is an assertive live region — a screen reader abandons what
   * it was saying. Rendering an empty one would interrupt the user to tell them
   * about no problems.
   */
  it("renders nothing at all when there are no errors", () => {
    const { container } = render(<StyledFieldErrors errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces assertively, because a failed submit must interrupt", () => {
    render(<StyledFieldErrors errors={errors} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  /**
   * The original carried a `dismissed` state and an effect resetting it when
   * `errors` changed. A summary the user can dismiss while the errors are still
   * there — and the submit button still refuses — hides the explanation for a
   * form that will not submit.
   */
  it("offers no way to dismiss it while the errors stand", () => {
    render(<StyledFieldErrors errors={errors} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  /**
   * Two fields commonly fail the same rule with the same message ("Required"),
   * so a message-only key collides and React drops one of them.
   */
  it("renders both entries when two fields share a message", () => {
    render(
      <StyledFieldErrors
        errors={[
          { path: ["email"], message: "Required" },
          { path: ["password"], message: "Required" },
        ]}
      />,
    );
    expect(screen.getAllByText("Required")).toHaveLength(2);
  });

  it("renders two failures on ONE field", () => {
    // The case the path alone cannot key: same field, two rules. The index is
    // the tail-breaker.
    render(
      <StyledFieldErrors
        errors={[
          { path: ["password"], message: "Too short" },
          { path: ["password"], message: "Needs a digit" },
        ]}
      />,
    );
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.getByText("Needs a digit")).toBeInTheDocument();
  });

  /**
   * The compatibility claim the rename rests on: a zod host passes
   * `result.error.issues` unchanged, because `ZodIssue` already has `path` and
   * `message`. This is that shape, including a numeric array index in the path,
   * which is why `path` is `(string | number)[]` and not `string[]`.
   */
  it("accepts a zod-shaped issue unchanged, extra fields and all", () => {
    const zodShaped = [
      {
        code: "too_small",
        minimum: 12,
        type: "string",
        inclusive: true,
        path: ["users", 0, "password"],
        message: "Must be at least 12 characters",
      },
    ];

    render(<StyledFieldErrors errors={zodShaped} />);
    expect(
      screen.getByText("Must be at least 12 characters"),
    ).toBeInTheDocument();
  });
});

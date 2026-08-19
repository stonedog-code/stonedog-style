import { render, screen, fireEvent } from "@testing-library/react";
import StyledTooltip from "../StyledTooltip";

/**
 * Where the click-mode help control sits, and what it is called (NEH-769).
 *
 * The rule is `Label → ? → Input`: the help control goes after the label and
 * before the control it explains, never after it. The reason is specific to
 * the audiences this package serves rather than aesthetic — a screen-magnifier
 * user reads linearly at high zoom, and a `?` placed after a long input is
 * pushed off the visible viewport entirely. Before the control, the reader
 * meets the concept, can ask what it means, and only then enters data.
 *
 * Consumers wrap two different shapes and BOTH have to end up obeying that
 * rule, which is why neither a fixed "always before" nor a fixed "always
 * after" is correct:
 *
 *   Shape A  <StyledTooltip><Label/></StyledTooltip> <Input/>
 *            The input is OUTSIDE the wrapper, so the help belongs after the
 *            children — `Label ? | Input`.
 *
 *   Shape B  <StyledTooltip><Row><Label/><Toggle/></Row></StyledTooltip>
 *            The control is INSIDE the wrapper, so the help belongs before the
 *            children — `? Label Toggle` — or it lands after the control,
 *            which is the reported defect.
 *
 * So the component keys on what it already measures: whether the children
 * contain a focusable control.
 *
 * jsdom has no layout engine, so none of this asserts pixels or on-screen
 * position — only DOM order, ARIA wiring and accessible names, which are
 * structural and answerable here. The 48x48 target size and "is it beside or
 * below" remain e2e questions.
 */

/** True when `a` appears before `b` in document order. */
function precedes(a: Element, b: Element): boolean {
  return Boolean(
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("StyledTooltip — help control placement (NEH-769)", () => {
  it("Shape B: puts the help control BEFORE a control it wraps", () => {
    render(
      <StyledTooltip
        tooltip="Ask for a PIN before opening the app."
        trigger="click"
        helpLabel="Help: Require PIN"
      >
        <div>
          <label htmlFor="pin">Require PIN</label>
          <input id="pin" />
        </div>
      </StyledTooltip>,
    );

    const help = screen.getByRole("button", { name: "Help: Require PIN" });
    const input = screen.getByLabelText("Require PIN");

    expect(precedes(help, input)).toBe(true);
  });

  it("Shape A: puts the help control AFTER a label it wraps, so the outside input still follows it", () => {
    render(
      <>
        <StyledTooltip
          tooltip="Ask for a PIN before opening the app."
          trigger="click"
          helpLabel="Help: Require PIN"
        >
          <label htmlFor="pin">Require PIN</label>
        </StyledTooltip>
        <input id="pin" />
      </>,
    );

    const help = screen.getByRole("button", { name: "Help: Require PIN" });
    const label = screen.getByText("Require PIN");
    const input = document.getElementById("pin")!;

    // Label → ? → Input, in that order.
    expect(precedes(label, help)).toBe(true);
    expect(precedes(help, input)).toBe(true);
  });

  it("names the help control after what it explains, not 'More information'", () => {
    // Twenty identical "More information" buttons on one screen name nothing.
    // The subject is the child's own text, which is what a reader would call it.
    render(
      <StyledTooltip tooltip="Ask for a PIN before opening the app." trigger="click">
        <label htmlFor="pin">Require PIN</label>
      </StyledTooltip>,
    );

    expect(
      screen.getByRole("button", { name: "Help: Require PIN" }),
    ).toBeInTheDocument();
  });

  it("still honours an explicit helpLabel over the derived one", () => {
    render(
      <StyledTooltip
        tooltip="Ask for a PIN before opening the app."
        trigger="click"
        helpLabel="What does Require PIN do?"
      >
        <label htmlFor="pin">Require PIN</label>
      </StyledTooltip>,
    );

    expect(
      screen.getByRole("button", { name: "What does Require PIN do?" }),
    ).toBeInTheDocument();
  });

  it("falls back to 'More information' when the child carries no text of its own", () => {
    render(
      <StyledTooltip tooltip="Ask for a PIN." trigger="click">
        <span />
      </StyledTooltip>,
    );

    expect(
      screen.getByRole("button", { name: "More information" }),
    ).toBeInTheDocument();
  });

  it("describes the CONTROL with the help text, not the help button", () => {
    // aria-describedby is what makes the help announced rather than merely
    // reachable. It has to land on the thing that takes focus — the input —
    // and never on the help button, which already names itself.
    render(
      <StyledTooltip
        tooltip="Ask for a PIN before opening the app."
        trigger="click"
        helpLabel="Help: Require PIN"
      >
        <div>
          <label htmlFor="pin">Require PIN</label>
          <input id="pin" />
        </div>
      </StyledTooltip>,
    );

    const help = screen.getByRole("button", { name: "Help: Require PIN" });
    const input = screen.getByLabelText("Require PIN");

    expect(input).not.toHaveAttribute("aria-describedby");

    fireEvent.click(help);

    const tooltip = screen.getByRole("tooltip");
    expect(input).toHaveAttribute("aria-describedby", tooltip.id);
    expect(help).not.toHaveAttribute("aria-describedby");
  });
});

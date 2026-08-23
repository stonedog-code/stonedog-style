import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useDisclosure } from "../useDisclosure";
import StyledCollapsible from "../StyledCollapsible";

/**
 * `useDisclosure` — the mechanics, apart from any one arrangement of them.
 *
 * The assertions worth having are the ones about what a host can now build
 * without hand-rolling: a control that is ALREADY a button, in a layout the
 * component does not impose, with the ARIA relationship still intact. That
 * combination is what NEH-1100 records a product failing to get, twice.
 */

/**
 * A host header row: a title, and an icon button opposite it that is the
 * disclosure's only control. This is HopperGuard's `StyledCollapsible` in
 * miniature — the shape the packaged component cannot express, and the reason
 * the hook exists.
 */
function HeaderDisclosure({
  defaultOpen = false,
  onOpenChange,
}: {
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
}) {
  const { open, triggerProps, contentProps } = useDisclosure({
    defaultOpen,
    onOpenChange,
  });

  return (
    <section>
      <header>
        <h2>Vitals</h2>
        <button {...triggerProps} aria-label={open ? "Hide this section" : "Show this section"}>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
      </header>
      <div {...contentProps} data-testid="content">
        <input data-testid="inner" defaultValue="" />
      </div>
    </section>
  );
}

describe("useDisclosure — a host composing its own control", () => {
  it("produces exactly ONE button", () => {
    // The defect this whole seam exists to make impossible. Passing an icon
    // button into `StyledCollapsible`'s `trigger` would wrap one <button> in
    // another: invalid HTML that React warns will break hydration, and one
    // affordance split in two.
    render(<HeaderDisclosure />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("puts aria-expanded on the same element that carries the name", () => {
    // Split across two elements, a reader announces a nameless button
    // containing a button that says nothing about its state.
    render(<HeaderDisclosure />);
    const trigger = screen.getByRole("button", { name: "Show this section" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("points aria-controls at a region that resolves", () => {
    render(<HeaderDisclosure />);
    const trigger = screen.getByRole("button");
    expect(screen.getByTestId("content")).toHaveAttribute(
      "id",
      trigger.getAttribute("aria-controls"),
    );
  });

  it("keeps the region addressable while it is collapsed", () => {
    // A dangling aria-controls is worse than none. `hidden` rather than
    // unmounting is what keeps the promise resolvable in both states.
    render(<HeaderDisclosure />);
    const content = screen.getByTestId("content");
    expect(content).toBeInTheDocument();
    expect(content).toHaveAttribute("hidden");
  });

  it("keeps focus on the trigger across a toggle", () => {
    // The NEH-933 regression, in the shape a host can reintroduce. Swapping
    // one component for another in the trigger position makes React discard
    // the <button> and build a new one, so a keyboard user's focus falls to
    // <body> and the next Enter goes nowhere.
    render(<HeaderDisclosure />);
    const trigger = screen.getByRole("button");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps state out of the accessible name and in aria-expanded", () => {
    render(<HeaderDisclosure />);
    fireEvent.click(screen.getByRole("button", { name: "Show this section" }));
    expect(screen.getByRole("button", { name: "Hide this section" })).toBeInTheDocument();
  });

  it("keeps what the reader typed across a collapse", () => {
    render(<HeaderDisclosure defaultOpen />);
    const input = screen.getByTestId("inner") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "half a sentence" } });

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));

    expect((screen.getByTestId("inner") as HTMLInputElement).value).toBe(
      "half a sentence",
    );
  });

  it("types the trigger as a button so it cannot submit a surrounding form", () => {
    // An untyped <button> inside a <form> submits it. The symptom is the page
    // reloading on the first press of a "show more" control.
    render(<HeaderDisclosure />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("useDisclosure — controlled and uncontrolled", () => {
  it("reports the press and still moves when uncontrolled", () => {
    const onOpenChange = jest.fn();
    render(<HeaderDisclosure onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("lets a controlled host hold it shut", () => {
    function Controlled() {
      const { triggerProps, contentProps } = useDisclosure({ open: false });
      return (
        <>
          <button {...triggerProps} aria-label="Toggle" />
          <div {...contentProps} data-testid="content" />
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("content")).toHaveAttribute("hidden");
  });

  it("gives two disclosures on one page different ids", () => {
    // `useId` per instance. Sharing one would point both triggers at whichever
    // region rendered last.
    render(
      <>
        <HeaderDisclosure />
        <HeaderDisclosure />
      </>,
    );
    const [first, second] = screen.getAllByRole("button");
    expect(first!.getAttribute("aria-controls")).not.toBe(
      second!.getAttribute("aria-controls"),
    );
  });
});

describe("StyledCollapsible — still the same component, built on the hook", () => {
  // The control for the refactor: the packaged arrangement must be unchanged
  // by having its mechanics moved out from under it. Its own nine tests cover
  // the behaviour; this asserts the structural claim the hook makes possible.
  it("renders exactly one button, with the trigger inside it", () => {
    render(
      <StyledCollapsible trigger="Details" aria-label="Details">
        <p>body</p>
      </StyledCollapsible>,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Details");
  });
});

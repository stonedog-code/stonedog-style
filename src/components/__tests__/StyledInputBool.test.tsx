import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StyledInputBool, { INPUT_BOOL_VARIANTS } from "../StyledInputBool";
import { StonedogStyleProvider } from "../../config/style-config";

describe("StyledInputBool", () => {
  it("renders a checkbox", () => {
    render(<StyledInputBool label="Send me email" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("takes its accessible name from the label", () => {
    // This is what the surrounding <label> buys, and it is the whole reason the
    // component exists rather than a bare input plus some text.
    render(<StyledInputBool label="Send me email" />);
    expect(screen.getByRole("checkbox", { name: "Send me email" })).toBeInTheDocument();
  });

  it("renders without a label, though the control is then unnamed", () => {
    render(<StyledInputBool data-testid="bare" />);
    expect(screen.getByTestId("bare")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /./ })).toBeNull();
  });

  it("accepts a node as the label", () => {
    render(
      <StyledInputBool
        label={
          <>
            I accept the <a href="/terms">terms</a>
          </>
        }
      />,
    );
    expect(screen.getByRole("link", { name: "terms" })).toBeInTheDocument();
  });

  it("fires onChange when clicked", () => {
    const onChange = jest.fn();
    render(<StyledInputBool label="Toggle me" onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is operable by clicking the label text, not just the box", () => {
    // The point of wrapping: a 14px box is under the 44px floor, so the text
    // has to be part of the target.
    const onChange = jest.fn();
    render(<StyledInputBool label="Send me email" onChange={onChange} />);
    fireEvent.click(screen.getByText("Send me email"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reflects the controlled checked state", () => {
    const { rerender } = render(
      <StyledInputBool label="On?" checked={false} onChange={() => {}} />,
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    rerender(<StyledInputBool label="On?" checked onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("maps isReadOnly onto the input's readOnly", () => {
    render(<StyledInputBool label="Locked" isReadOnly checked onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("readonly");
  });

  it("passes disabled through", () => {
    render(<StyledInputBool label="Nope" disabled />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("forwards a ref to the input itself", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<StyledInputBool label="Focus me" ref={ref} />);
    expect(ref.current?.type).toBe("checkbox");
  });

  describe("variant resolution", () => {
    // The house precedence is caller → app-wide → solid. Asserting on the class
    // is what makes this real: these are the actual recipe outputs, because
    // this package tests against the generated styled-system rather than a mock.
    const classOf = (ui: React.ReactElement) => {
      const { container } = render(ui);
      return container.querySelector("input")?.className ?? "";
    };

    it("produces different classes for different variants", () => {
      expect(classOf(<StyledInputBool label="a" variant="solid" />)).not.toBe(
        classOf(<StyledInputBool label="b" variant="outline" />),
      );
    });

    it("inherits the app-wide variant when the call site names none", () => {
      const { container } = render(
        <StonedogStyleProvider variant="outline">
          <StyledInputBool label="inherited" />
        </StonedogStyleProvider>,
      );
      expect(container.querySelector("input")?.className).toBe(
        classOf(<StyledInputBool label="explicit" variant="outline" />),
      );
    });

    it("keeps ghost, which the recipe defines but no user can select app-wide", () => {
      // The regression this migration nearly shipped. @stonedogcode/style's default
      // gate is the five app-wide appearances, so `ghost` fell through to
      // `solid` — silently, since a coerced variant still renders.
      expect(classOf(<StyledInputBool label="g" variant="ghost" />)).not.toBe(
        classOf(<StyledInputBool label="s" variant="solid" />),
      );
    });

    it("still coerces a variant the recipe has no case for", () => {
      // `link` is a button appearance. Passing it through would render an
      // unstyled checkbox, because a recipe emits nothing for a case it does
      // not define.
      expect(
        classOf(<StyledInputBool label="l" variant={"link" as never} />),
      ).toBe(classOf(<StyledInputBool label="s" variant="solid" />));
    });

    it("lets the call site override the app-wide variant", () => {
      const { container } = render(
        <StonedogStyleProvider variant="outline">
          <StyledInputBool label="override" variant="solid" />
        </StonedogStyleProvider>,
      );
      expect(container.querySelector("input")?.className).toBe(
        classOf(<StyledInputBool label="explicit" variant="solid" />),
      );
    });
  });

  /**
   * Keeps `StyledInputBool.ct.tsx`'s copy of the variant list honest.
   *
   * That spec has to write the seven names out rather than importing this
   * constant: Playwright CT rewrites imports from a component module into
   * mount references, so pulling a plain value out of `StyledInputBool.tsx`
   * alongside the default import fails at build with
   * `Identifier 'StyledInputBool' has already been declared`.
   *
   * A hand-copied list is exactly the thing that goes stale, and the failure
   * would be silent in the worst way — the NEH-310 distinctness check would
   * simply stop covering whichever variant was added. Jest has no such import
   * restriction, so the drift is caught here instead.
   */
  it("the component-test spec's variant list is still complete (NEH-310)", () => {
    const inCtSpec = readFileSync(
      join(__dirname, "..", "StyledInputBool.ct.tsx"),
      "utf8",
    );
    const declared = inCtSpec.match(/const VARIANTS = \[([\s\S]*?)\] as const;/);
    // No message argument: jest's `expect` takes exactly one, unlike
    // Playwright's. A second one throws rather than annotating the failure.
    expect(declared).not.toBeNull();

    const listed = [...declared![1]!.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual([...INPUT_BOOL_VARIANTS].sort());
  });
});

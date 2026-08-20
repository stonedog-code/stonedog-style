import React from "react";
import { render, screen } from "@testing-library/react";
import StyledFieldHelp, { fieldHelpId } from "../StyledFieldHelp";
import { setStyleLogger } from "../../config/logger";
import type { StyleLogger } from "../../config/logger";
import { stepDownFontSize } from "../../config/font-size";

/**
 * The wiring tier. What a screen reader would be handed, and what the keyboard
 * can reach — both answerable in jsdom, neither answerable from a screenshot.
 *
 * The pixel questions this component raises — is the smaller size still legible,
 * does the muted colour clear WCAG 1.4.3 against the surface it actually paints
 * on — are in `StyledFieldHelp.ct.tsx` and `StyledFieldHelp.contrast.ct.tsx`.
 * jsdom cannot answer any of them: it has no layout engine, it cannot resolve a
 * `var()` against the type scale, and it does not composite a translucent colour
 * over anything.
 *
 * ## Both guards here were verified by planting the failure they exist to catch
 *
 * Recorded because "the test passes" and "the test can fail" are different
 * claims, and only the second one is worth anything:
 *
 * - **the association**: with the `aria-describedby` effect removed from
 *   `StyledFieldHelp`, the four wiring tests below fail;
 * - **the tab stop**: with `tabIndex={0}` added to the rendered element, the
 *   focusability tests below fail.
 */

/** A control rendered next to the help, as a real form would. */
function Field({
  help = "Milligrams per tablet, as printed on the bottle.",
  describedBy,
}: {
  help?: React.ReactNode;
  describedBy?: string;
}) {
  return (
    <div>
      <label htmlFor="dose">Dose</label>
      <StyledFieldHelp htmlFor="dose">{help}</StyledFieldHelp>
      <input
        id="dose"
        {...(describedBy !== undefined
          ? { "aria-describedby": describedBy }
          : {})}
      />
    </div>
  );
}

const control = () => document.getElementById("dose");
const describedBy = () => control()?.getAttribute("aria-describedby") ?? null;

describe("StyledFieldHelp", () => {
  afterEach(() => setStyleLogger(null));

  it("renders the help text as permanent, always-present content", () => {
    render(<Field />);
    // Not behind a disclosure, a hover, or a preference: it is simply there
    // from the first render, which is the entire point of the component.
    expect(
      screen.getByText("Milligrams per tablet, as printed on the bottle."),
    ).toBeInTheDocument();
  });

  describe("the association with its control", () => {
    it("points the control's aria-describedby at the help", () => {
      render(<Field />);
      // Without this the help is prose that happens to sit near a control, and
      // a screen reader announces "Dose, edit text" and nothing else.
      expect(describedBy()).toBe("dose-help");
      expect(document.getElementById("dose-help")).toHaveTextContent(
        "Milligrams per tablet",
      );
    });

    it("appends to a description the control already had", () => {
      render(<Field describedBy="dose-error" />);
      // An error summary or a character counter is commonly already there.
      // Replacing the attribute would silently drop it.
      expect(describedBy()).toBe("dose-error dose-help");
    });

    it("does not name itself twice when the call site wired it statically", () => {
      // A host that wants the association present in server-rendered HTML
      // writes it itself. The effect must notice and stand down, or the
      // description is announced twice.
      render(<Field describedBy={fieldHelpId("dose")} />);
      expect(describedBy()).toBe("dose-help");
    });

    it("removes only its own id when it unmounts", () => {
      const { rerender } = render(<Field describedBy="dose-error" />);
      expect(describedBy()).toBe("dose-error dose-help");

      rerender(
        <div>
          <label htmlFor="dose">Dose</label>
          <input id="dose" aria-describedby="dose-error" />
        </div>,
      );
      // The pre-existing description survives. Restoring the string captured
      // before the effect ran would be the obvious implementation and would
      // clobber anything added in between.
      expect(describedBy()).toBe("dose-error");
    });

    it("tells the host's logger when no control has that id", () => {
      const warn = jest.fn();
      setStyleLogger({
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn,
        error: jest.fn(),
      } as StyleLogger);

      render(<StyledFieldHelp htmlFor="nothing-here">Help.</StyledFieldHelp>);

      // A call-site bug, not a crash: the words are still on screen, so taking
      // the form down over an attribute would be the worse trade.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Help.")).toBeInTheDocument();
    });
  });

  describe("it adds no tab stop — the reason this component exists", () => {
    /**
     * `HelpTrigger` is a `<button>`, so the pattern this replaces put one tab
     * stop beside every explained control — roughly twenty on one production
     * screen. Anything focusable here reintroduces exactly that tax.
     */
    const FOCUSABLE = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      "[tabindex]",
      '[contenteditable="true"]',
    ].join(", ");

    it("renders nothing focusable", () => {
      render(<Field />);
      const help = document.getElementById("dose-help");
      expect(help).not.toBeNull();
      expect(help!.querySelectorAll(FOCUSABLE)).toHaveLength(0);
    });

    it("carries no tabindex of its own", () => {
      render(<Field />);
      // Not even `tabindex="-1"`. A negative stop is out of the Tab sequence,
      // but it is still a thing to reason about at 160 call sites, and this
      // component has no reason to be programmatically focused.
      expect(document.getElementById("dose-help")).not.toHaveAttribute(
        "tabindex",
      );
    });

    it("adds no element the user can interact with at all", () => {
      const { container } = render(
        <StyledFieldHelp htmlFor="dose">
          Milligrams per tablet.
        </StyledFieldHelp>,
      );
      // One element, and it is a paragraph. No trigger, no wrapper button, no
      // disclosure — there is nothing here to press.
      expect(container.querySelectorAll("*")).toHaveLength(1);
      expect(container.firstElementChild?.tagName).toBe("P");
      expect(container.querySelectorAll(FOCUSABLE)).toHaveLength(0);
    });

    it("exposes no role that implies an interaction", () => {
      render(<Field />);
      const help = document.getElementById("dose-help");
      // A `role="button"`/`role="tooltip"` here would announce an affordance
      // that does not exist. It is a paragraph, and it says so by being one.
      expect(help).not.toHaveAttribute("role");
    });
  });

  describe("fieldHelpId", () => {
    it("derives a stable id from the control's id", () => {
      // Deterministic rather than `useId`: both halves of the pair can name it
      // without threading a generated value between two siblings, and the value
      // is identical on the server and the client.
      expect(fieldHelpId("dose")).toBe("dose-help");
      expect(fieldHelpId("dose")).toBe(fieldHelpId("dose"));
    });

    it("is the id the component actually uses", () => {
      // Otherwise the export is a suggestion rather than a contract.
      render(<Field />);
      expect(document.getElementById(fieldHelpId("dose"))).not.toBeNull();
    });
  });

  it("carries the migration hook the app's e2e assertion keys off", () => {
    render(<Field />);
    expect(document.getElementById("dose-help")).toHaveAttribute(
      "data-field-help",
      "true",
    );
  });

  it("respects an explicit id over the derived one", () => {
    render(
      <div>
        <StyledFieldHelp htmlFor="dose" id="custom-help">
          Help.
        </StyledFieldHelp>
        <input id="dose" />
      </div>,
    );
    expect(describedBy()).toBe("custom-help");
  });
});

describe("stepDownFontSize", () => {
  // The size the component picks is a pure function, so it is asserted here.
  // What that size RENDERS as is a browser question and lives in the ct tier —
  // every `fontSizeMap` entry is a `var()` reference, which jsdom drops from the
  // style attribute entirely, so a `toHaveStyle` on it cannot fail.
  it("steps one tier down the scale", () => {
    expect(stepDownFontSize("md")).toBe("sm");
    expect(stepDownFontSize("xl")).toBe("lg");
  });

  it("clamps at the bottom rather than shrinking past the smallest tier", () => {
    // The reader who has turned their text size all the way down is the one
    // with the least room to spare.
    expect(stepDownFontSize("xs")).toBe("xs");
    expect(stepDownFontSize("sm", 5)).toBe("xs");
  });

  it("leaves a key it does not recognise alone", () => {
    expect(stepDownFontSize("nonsense" as never)).toBe("nonsense");
  });
});

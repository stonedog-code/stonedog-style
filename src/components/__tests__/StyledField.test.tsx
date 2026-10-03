import React from "react";
import { render, screen } from "@testing-library/react";
import StyledField, { fieldErrorId } from "../StyledField";
import StyledInputText from "../StyledInputText";
import StyledInputTextArea from "../StyledInputTextArea";
import StyledInputSelect from "../StyledInputSelect";
import StyledInputRadio from "../StyledInputRadio";
import { fieldHelpId } from "../StyledFieldHelp";

/**
 * StyledField — the wiring between a label, help, a control and its error.
 *
 * `expectDescribedBy` is the assertion everything below leans on: it resolves
 * `aria-describedby` to the TEXT a screen reader would read, rather than
 * checking that some id is present. An id pointing at nothing, or at the
 * wrong element, passes a presence check and announces nothing.
 */
function describedText(control: HTMLElement): string {
  const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return ids
    .map((id) => control.ownerDocument.getElementById(id)?.textContent ?? "")
    .join(" | ");
}

function expectDescribedBy(control: HTMLElement, text: string) {
  const described = describedText(control);
  if (!described.includes(text)) {
    throw new Error(
      `expected the control to be described by "${text}", but it is described by "${described}"`,
    );
  }
}

describe("StyledField — the assertion itself bites", () => {
  /**
   * The plant: the exact defect this component exists to remove — a label,
   * a visible error, and a control nobody wired to it. If `expectDescribedBy`
   * passed here, every green below would be meaningless.
   */
  it("fails on a hand-rolled field whose error is not in aria-describedby", () => {
    render(
      <div>
        <label htmlFor="planted">Notes</label>
        <textarea id="planted" aria-invalid="true" />
        <p id="planted-error" role="alert">
          Notes are required.
        </p>
      </div>,
    );
    const control = screen.getByLabelText("Notes");
    expect(() => expectDescribedBy(control, "Notes are required.")).toThrow(
      /described by ""/,
    );
  });

  it("fails when the slot ignores the wiring it was handed", () => {
    render(
      <StyledField label="Notes" error="Notes are required.">
        {() => <textarea id="dropped" aria-label="Notes" />}
      </StyledField>,
    );
    expect(() =>
      expectDescribedBy(screen.getByRole("textbox"), "Notes are required."),
    ).toThrow();
  });
});

describe("StyledField — a text control", () => {
  it("labels the control with a visible <label>", () => {
    render(
      <StyledField label="Email">
        <StyledInputText type="email" />
      </StyledField>,
    );
    const input = screen.getByLabelText("Email");
    expect(input.tagName).toBe("INPUT");
    expect(input.id).not.toBe("");
  });

  it("describes the control by its help and, while present, its error", () => {
    const { rerender } = render(
      <StyledField id="email" label="Email" help="We send receipts here.">
        <StyledInputText />
      </StyledField>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-describedby", fieldHelpId("email"));
    expect(input).not.toHaveAttribute("aria-invalid");

    rerender(
      <StyledField id="email" label="Email" help="We send receipts here." error="Enter an email address.">
        <StyledInputText />
      </StyledField>,
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expectDescribedBy(input, "We send receipts here.");
    expectDescribedBy(input, "Enter an email address.");
  });

  it("keeps the error container mounted, empty, before there is an error", () => {
    render(
      <StyledField id="name" label="Name">
        <StyledInputText />
      </StyledField>,
    );
    const region = document.getElementById(fieldErrorId("name"));
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("role", "alert");
    expect(region).toBeEmptyDOMElement();
    // ...and is not named while it has nothing to say.
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
  });

  it("the SAME region carries the error when one arrives", () => {
    const { rerender } = render(
      <StyledField id="name" label="Name">
        <StyledInputText />
      </StyledField>,
    );
    const before = document.getElementById(fieldErrorId("name"));
    rerender(
      <StyledField id="name" label="Name" error="Enter your name.">
        <StyledInputText />
      </StyledField>,
    );
    const after = document.getElementById(fieldErrorId("name"));
    expect(after).toBe(before);
    expect(after).toHaveTextContent("Enter your name.");
  });

  it("required: the native attribute on the control, an aria-hidden marker on the label", () => {
    render(
      <StyledField label="Email" required>
        <StyledInputText />
      </StyledField>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toBeRequired();
    const marker = screen.getByText("*");
    expect(marker).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps a describedby the child already had", () => {
    render(
      <>
        <p id="counter">0 of 200</p>
        <StyledField label="Bio" error="Too long.">
          <StyledInputTextArea aria-describedby="counter" />
        </StyledField>
      </>,
    );
    const area = screen.getByRole("textbox", { name: "Bio" });
    expectDescribedBy(area, "0 of 200");
    expectDescribedBy(area, "Too long.");
  });

  it("wires a select and a textarea exactly like an input", () => {
    render(
      <>
        <StyledField label="Country" error="Choose a country.">
          <StyledInputSelect options={[{ value: "us", label: "United States" }]} />
        </StyledField>
        <StyledField label="Minutes" error="Add the minutes.">
          <StyledInputTextArea />
        </StyledField>
      </>,
    );
    const select = screen.getByRole("combobox", { name: "Country" });
    const area = screen.getByRole("textbox", { name: "Minutes" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expectDescribedBy(select, "Choose a country.");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expectDescribedBy(area, "Add the minutes.");
  });

  it("hands the wiring to a function child", () => {
    render(
      <StyledField label="Code" error="Wrong code." required>
        {(control) => <input {...control} />}
      </StyledField>,
    );
    const input = screen.getByRole("textbox", { name: "Code" });
    expect(input).toBeRequired();
    expectDescribedBy(input, "Wrong code.");
  });
});

describe("StyledField — a checkbox", () => {
  it("labels the box with a <label> beside it and describes it", () => {
    render(
      <StyledField label="Send me reminders" kind="checkbox" help="One email a week." error="Required for this plan.">
        <input type="checkbox" />
      </StyledField>,
    );
    const box = screen.getByRole("checkbox", { name: "Send me reminders" });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expectDescribedBy(box, "One email a week.");
    expectDescribedBy(box, "Required for this plan.");
  });
});

describe("StyledField — a radio group", () => {
  const items = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ];

  it("names the group with a fieldset legend and describes the fieldset", () => {
    render(
      <StyledField label="Billing cycle" kind="group" help="You can change this later." error="Choose a cycle." required>
        <StyledInputRadio items={items} name="cycle" />
      </StyledField>,
    );
    const group = screen.getByRole("group", { name: /Billing cycle/ });
    expect(group.tagName).toBe("FIELDSET");
    expectDescribedBy(group, "You can change this later.");
    expectDescribedBy(group, "Choose a cycle.");

    const radiogroup = screen.getByRole("radiogroup");
    expect(radiogroup).toHaveAttribute("aria-invalid", "true");
    expect(radiogroup).toHaveAttribute("aria-required", "true");
  });
});

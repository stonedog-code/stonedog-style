import React from "react";
import StyledField from "./StyledField";
import StyledInputText from "./StyledInputText";
import StyledInputTextArea from "./StyledInputTextArea";
import StyledInputSelect from "./StyledInputSelect";
import StyledInputRadio from "./StyledInputRadio";

/** Mount targets for `StyledField.ct.tsx`. */

/** One of each kind, with an error the reader can clear and re-raise. */
export function FieldForm() {
  const [invalid, setInvalid] = React.useState(false);
  const [cycle, setCycle] = React.useState("");
  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "32rem" }}
      onSubmit={(event) => {
        event.preventDefault();
        setInvalid(true);
      }}
    >
      <StyledField
        id="email"
        label="Email"
        help="We send receipts here."
        error={invalid ? "Enter an email address." : undefined}
        required
      >
        <StyledInputText type="email" />
      </StyledField>
      <StyledField id="minutes" label="Minutes" error={invalid ? "Add the minutes." : undefined}>
        <StyledInputTextArea rows={3} />
      </StyledField>
      <StyledField id="country" label="Country" optional>
        <StyledInputSelect placeholder="Choose…" options={[{ value: "us", label: "United States" }]} />
      </StyledField>
      <StyledField id="reminders" label="Send me reminders" kind="checkbox" help="One email a week.">
        <input type="checkbox" />
      </StyledField>
      <StyledField
        id="cycle"
        label="Billing cycle"
        kind="group"
        error={invalid ? "Choose a cycle." : undefined}
        required
      >
        <StyledInputRadio
          name="cycle"
          value={cycle}
          onChange={(event) => setCycle(event.target.value)}
          items={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
      </StyledField>
      <button type="submit">Save</button>
      <button type="button" onClick={() => setInvalid(false)}>
        Clear errors
      </button>
    </form>
  );
}

/**
 * The plant: a hand-rolled field with a visible error and a control nobody
 * wired to it — the shape this component exists to remove. The in-browser
 * describedby check must REJECT this, or its passes on `FieldForm` mean
 * nothing.
 */
export function FieldHandRolled() {
  return (
    <div>
      <label htmlFor="planted">Notes</label>
      <textarea id="planted" aria-invalid="true" />
      <p id="planted-error" role="alert">
        Notes are required.
      </p>
    </div>
  );
}

export default FieldForm;

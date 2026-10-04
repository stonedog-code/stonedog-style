import React from "react";
import StyledButton from "./StyledButton";

/**
 * Mount targets for `StyledButton.ct.tsx` that need state (NEH-1860).
 *
 * Both go busy the way a real call site does — the press itself flips
 * `loading` — and stay busy, so a test can press again and count what got
 * through. The counts are rendered rather than returned, because a mounted
 * component's callbacks run in the browser.
 */

/** A plain `type="button"` whose click starts the work. */
export function ButtonThatGoesBusy() {
  const [busy, setBusy] = React.useState(false);
  const [clicks, setClicks] = React.useState(0);
  return (
    <div>
      <StyledButton
        type="button"
        loading={busy}
        loadText="Saving"
        onClick={() => {
          setClicks((n) => n + 1);
          setBusy(true);
        }}
      >
        Save
      </StyledButton>
      <p data-testid="clicks">{clicks}</p>
    </div>
  );
}

/** A submit button whose form's submit starts the work. */
export function FormThatGoesBusy() {
  const [busy, setBusy] = React.useState(false);
  const [submits, setSubmits] = React.useState(0);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmits((n) => n + 1);
        setBusy(true);
      }}
    >
      <label>
        Name <input name="name" />
      </label>
      <StyledButton type="submit" loading={busy} loadText="Saving">
        Save
      </StyledButton>
      <p data-testid="submits">{submits}</p>
    </form>
  );
}

export default ButtonThatGoesBusy;

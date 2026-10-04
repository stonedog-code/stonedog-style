import React from "react";
import StyledInlineConfirm from "./StyledInlineConfirm";
import StyledAlert from "./StyledAlert";

/** Mount targets for `StyledInlineConfirm.ct.tsx`. */

export function ConfirmRemove({ stepUp = false }: { stepUp?: boolean }) {
  const [log, setLog] = React.useState<string[]>([]);
  return (
    <div style={{ maxWidth: "36rem" }}>
      <StyledInlineConfirm
        triggerLabel="Remove organisation"
        prompt="Remove Acme Ltd? Its filings and reminders are deleted, and this cannot be undone."
        confirmLabel="Remove Acme Ltd"
        onConfirm={({ code }) => setLog((l) => [...l, `confirmed${code ? `:${code}` : ""}`])}
        onCancel={() => setLog((l) => [...l, "cancelled"])}
        {...(stepUp
          ? { stepUp: { label: "Verification code", help: "From your authenticator app." } }
          : {})}
      />
      <p data-testid="log">{log.join(",")}</p>
    </div>
  );
}

/**
 * Confirm beside the error alert it borrows its pairing from, so one mount can
 * compare the two paints.
 */
export function ConfirmBesideAlert() {
  return (
    <div>
      <StyledAlert status="error" title="Reference" data-testid="reference-alert" />
      <StyledInlineConfirm
        triggerLabel="Delete"
        prompt="Delete it?"
        confirmLabel="Delete it"
        onConfirm={() => {}}
        data-testid="paint"
      />
    </div>
  );
}

/**
 * NEH-1852 — a body of the caller's own controlled fields. The confirm handler
 * reads them from the caller's state, which is the whole contract.
 */
export function ConfirmWithBody({ stepUp = false }: { stepUp?: boolean }) {
  const [reason, setReason] = React.useState("");
  const [notify, setNotify] = React.useState(false);
  const [log, setLog] = React.useState<string[]>([]);
  return (
    <div style={{ maxWidth: "36rem" }}>
      <StyledInlineConfirm
        triggerLabel="Call off meeting"
        prompt="Call off the March board meeting? Attendees see it as called off."
        confirmLabel="Call off meeting"
        onConfirm={({ code }) =>
          setLog((l) => [
            ...l,
            `confirmed:${reason}:${notify ? "notify" : "quiet"}${code ? `:${code}` : ""}`,
          ])
        }
        onCancel={() => setLog((l) => [...l, "cancelled"])}
        {...(stepUp ? { stepUp: { label: "Verification code" } } : {})}
      >
        <label>
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Email the board
        </label>
      </StyledInlineConfirm>
      <p data-testid="log">{log.join(",")}</p>
    </div>
  );
}

/** A body with nothing focusable: focus falls back to Cancel, as before. */
export function ConfirmWithTextBody() {
  return (
    <StyledInlineConfirm
      triggerLabel="Archive"
      prompt="Archive this filing?"
      confirmLabel="Archive filing"
      onConfirm={() => {}}
    >
      <p>Archived filings stay searchable for seven years.</p>
    </StyledInlineConfirm>
  );
}

/** NEH-1858 — the step-up field's keyboard, by default and when asked. */
export function ConfirmStepUpModes() {
  return (
    <div>
      <StyledInlineConfirm
        triggerLabel="Default step-up"
        prompt="Default?"
        onConfirm={() => {}}
        stepUp={{ label: "Code, recovery code or password" }}
        data-testid="default"
      />
      <StyledInlineConfirm
        triggerLabel="Numeric step-up"
        prompt="Numeric?"
        onConfirm={() => {}}
        stepUp={{ label: "Six-digit code", inputMode: "numeric" }}
        data-testid="numeric"
      />
      <StyledInlineConfirm
        triggerLabel="Password step-up"
        prompt="Password?"
        onConfirm={() => {}}
        stepUp={{ label: "Password", autoComplete: "current-password" }}
        data-testid="password"
      />
    </div>
  );
}

export default ConfirmRemove;

/**
 * A host whose `onConfirm` refuses (NEH-1887). With `withError`, it does what
 * optima's step-up panels do on a wrong code: set `stepUpError` in the same
 * handler, then reject. Without it, the rejection carries no field verdict —
 * a transient failure. The rejection is deferred so Confirm really goes busy
 * (and loses then regains its enabled state) before focus is decided.
 */
export function ConfirmRefused({
  stepUp = false,
  withError = false,
}: {
  stepUp?: boolean;
  withError?: boolean;
}) {
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [attempts, setAttempts] = React.useState(0);
  return (
    <div style={{ maxWidth: "36rem" }}>
      <StyledInlineConfirm
        triggerLabel="Remove organisation"
        prompt="Remove Acme Ltd? This cannot be undone."
        confirmLabel="Remove Acme Ltd"
        onConfirm={async () => {
          setAttempts((n) => n + 1);
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (withError) setError("That code did not match. Try a new one.");
          throw new Error("refused");
        }}
        {...(stepUp ? { stepUp: { label: "Verification code" } } : {})}
        {...(error !== undefined ? { stepUpError: error } : {})}
      />
      <p data-testid="attempts">{attempts}</p>
    </div>
  );
}

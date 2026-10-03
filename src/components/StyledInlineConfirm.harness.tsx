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

export default ConfirmRemove;

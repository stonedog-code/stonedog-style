import React from "react";
import StyledAlert, { type AlertStatus } from "./StyledAlert";

/**
 * Mount target for `StyledAlert.ct.tsx`.
 *
 * `surface` sets the background the alert is placed ON, and it is the point of
 * the harness: the status chips default to a translucent tint, so their
 * rendered colour depends on what is behind them. A test that only ever placed
 * them on one surface would prove nothing about the claim that one default
 * works on both a light theme and a dark one.
 */
export function AlertHarness({
  status = "info",
  surface = "#0f172a",
  text = "#f8fafc",
  title = "Heads up",
  message = "Something happened that you should know about.",
}: {
  status?: AlertStatus;
  surface?: string;
  text?: string;
  title?: string;
  message?: string;
}) {
  return (
    <div
      data-testid="surface"
      style={{ background: surface, color: text, padding: "16px", width: "100%" }}
    >
      <StyledAlert status={status} title={title}>
        {message}
      </StyledAlert>
    </div>
  );
}

export default AlertHarness;

import React from "react";
import StyledToaster from "./StyledToaster";
import { createToaster, type ToastOptions } from "./toaster-store";

/**
 * Mount target for `StyledToaster.ct.tsx`.
 *
 * The toaster is driven by a store rather than by props, so a component test
 * cannot simply mount it with the state it wants to photograph. This creates a
 * store, mounts the renderer against it, and pushes the requested toasts in on
 * mount — which is also a faithful rehearsal of the real pre-mount path, since
 * the effect ordering means the first `create` lands before the renderer has
 * finished setting up.
 *
 * `duration: Infinity` by default: a component test that raced a two-second
 * auto-dismiss would be flaky for a reason that has nothing to do with what it
 * measures.
 */
export function ToasterHarness({
  toasts = [{ title: "Saved.", type: "success" as const }],
  surface = "#0f172a",
}: {
  toasts?: ToastOptions[];
  surface?: string;
}) {
  const [toaster] = React.useState(() => createToaster());

  // Refs rather than effect dependencies. Seeding must happen exactly once —
  // listing `toasts` would re-push the whole set every time Playwright caused a
  // re-render, stacking duplicates under each measurement.
  const seeded = React.useRef(false);
  const requested = React.useRef(toasts);
  requested.current = toasts;

  React.useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (const toast of requested.current) {
      toaster.create({ duration: Infinity, ...toast });
    }
  }, [toaster]);

  return (
    <div
      style={{
        background: surface,
        color: "#f8fafc",
        minHeight: "100vh",
        margin: 0,
      }}
    >
      <StyledToaster toaster={toaster} />
    </div>
  );
}

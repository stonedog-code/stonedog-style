/**
 * @jest-environment node
 */
import { renderToString } from "react-dom/server";
import StyledToaster from "../StyledToaster";
import { createToaster } from "../toaster-store";

/**
 * The server render.
 *
 * Three separate ways this component can break a server-rendered application,
 * none of which a jsdom test can see, and all of which fail at the top of the
 * tree rather than at the toaster — so the stack trace points somewhere else
 * and the toaster is the last place anyone looks:
 *
 *   1. `createPortal(…, document.body)` — `document is not defined`, a crash.
 *   2. `useSyncExternalStore` with no `getServerSnapshot` — throws during
 *      hydration.
 *   3. A `getServerSnapshot` that returns a fresh value each call — React
 *      re-renders forever.
 *
 * `renderToString` is the only environment that exercises the first two at all.
 */
describe("StyledToaster — server render", () => {
  it("has no document to portal into", () => {
    // The premise. If this fails the rest is measuring jsdom.
    expect(typeof document).toBe("undefined");
  });

  it("renders without throwing", () => {
    const toaster = createToaster();
    expect(() => renderToString(<StyledToaster toaster={toaster} />)).not.toThrow();
  });

  it("emits nothing at all", () => {
    // It must not emit the region either: the markup would then differ from the
    // first client render (which is also pre-mount and empty) and hydration
    // would report a mismatch.
    const toaster = createToaster();
    expect(renderToString(<StyledToaster toaster={toaster} />)).toBe("");
  });

  it("emits nothing even when a toast was created during the render pass", () => {
    // The cross-request bleed, from the component's side. The store refuses to
    // queue on the server; this asserts the renderer agrees rather than finding
    // some other way to paint it.
    const toaster = createToaster();
    toaster.create({ title: "Prescription updated.", type: "success" });
    expect(renderToString(<StyledToaster toaster={toaster} />)).toBe("");
  });
});

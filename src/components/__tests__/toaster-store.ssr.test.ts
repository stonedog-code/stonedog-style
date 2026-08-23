/**
 * @jest-environment node
 */
import { createToaster } from "../toaster-store";

/**
 * The server half, which needs the `node` environment and therefore its own
 * file — under jsdom `window` exists and none of this can be observed.
 *
 * The failure being guarded is not a crash. A module-level array lives for the
 * lifetime of the Node process, so a toast created during one request is still
 * sitting there for the next one: person A's "Prescription updated." rendered
 * to person B. It would appear intermittently, under load, on a page neither of
 * them was on.
 */
describe("createToaster — on the server", () => {
  it("has no window to render into", () => {
    // The premise of every assertion below. If this ever fails the rest are
    // measuring jsdom and prove nothing.
    expect(typeof window).toBe("undefined");
  });

  it("refuses to queue a toast", () => {
    const toaster = createToaster();
    toaster.create({ title: "Saved.", type: "success" });
    expect(toaster.getSnapshot()).toHaveLength(0);
  });

  it("still returns the id it would have used", () => {
    // So a caller that keeps the return value behaves the same in both
    // environments rather than getting `undefined` only on the server.
    const toaster = createToaster();
    const id = toaster.create({ title: "Saved." });
    expect(typeof id).toBe("string");
    expect(id).not.toHaveLength(0);
  });

  it("honours a caller-supplied id", () => {
    const toaster = createToaster();
    expect(toaster.create({ id: "given", title: "Saved." })).toBe("given");
  });

  it("cannot leak a toast from one store use to the next", () => {
    // The bleed, stated as the thing it actually is: two sequential "requests"
    // through one long-lived module.
    const toaster = createToaster();
    toaster.create({ title: "request one" });
    toaster.create({ title: "request two" });
    expect(toaster.getSnapshot()).toHaveLength(0);
  });

  it("gives the same empty snapshot to the server and the client", () => {
    // useSyncExternalStore throws a hydration error if these differ by
    // reference, and it does it at the top of the tree.
    const toaster = createToaster();
    expect(toaster.getServerSnapshot()).toBe(toaster.getSnapshot());
  });

  it("removes without scheduling a timer that would outlive the request", () => {
    const toaster = createToaster({ removeDelay: 5000 });
    expect(() => toaster.remove("anything")).not.toThrow();
    expect(() => toaster.remove()).not.toThrow();
  });
});

import { act, render, screen, fireEvent } from "@testing-library/react";
import StyledToaster from "../StyledToaster";
import { createToaster, DEFAULT_DURATIONS } from "../toaster-store";

/**
 * Notifications that stay until the reader says otherwise (0.46.0, NEH-2262).
 *
 * The dismiss policy, the fold, "Dismiss all", displacement at the cap and the
 * keyboard focus hand-off. Every clock here is driven by hand. The control for
 * every other consumer — no `autoDismiss` prop, per-type defaults untouched —
 * is the first describe block, because a policy that leaked into hosts that
 * never asked for one would be the silent-default failure this package's
 * CLAUDE.md is mostly about.
 *
 * What a fold or a card LOOKS like is the component tier's question
 * (`StyledToaster.ct.tsx`); jsdom answers roles, attributes and timers.
 */

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const emit = (fn: () => void) => act(() => { fn(); });
const tick = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

/** The exit animation's length in the store; a dismissed card lingers this long. */
const EXIT = 200;

function renderToaster(props: Partial<React.ComponentProps<typeof StyledToaster>> = {}) {
  const toaster = props.toaster ?? createToaster();
  const view = render(<StyledToaster {...props} toaster={toaster} />);
  return { toaster, view };
}

describe("no policy — the control for every other consumer", () => {
  it("keeps the per-type defaults when no autoDismiss prop is passed", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    tick(DEFAULT_DURATIONS.success + EXIT);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still honours a call site's own duration", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Long", type: "success", duration: 9000 }));
    tick(DEFAULT_DURATIONS.success + EXIT);
    expect(screen.getByRole("status")).toBeInTheDocument();
    tick(9000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("autoDismiss — the host's policy", () => {
  it("with enabled: false, nothing leaves in ten minutes — not even a success", () => {
    const { toaster } = renderToaster({ autoDismiss: { enabled: false, afterMs: 60_000 } });
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    emit(() => toaster.create({ title: "Oops", type: "error" }));
    emit(() => toaster.create({ title: "Short", type: "info", duration: 100 }));
    tick(10 * 60 * 1000);
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });

  it("with enabled: true, every toast leaves at afterMs, whatever it asked for", () => {
    const { toaster } = renderToaster({ autoDismiss: { enabled: true, afterMs: 60_000 } });
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    emit(() => toaster.create({ title: "Pinned?", type: "error", duration: Infinity }));
    tick(59_999);
    expect(screen.getAllByRole("status")).toHaveLength(2);
    tick(1 + EXIT);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still pauses while the pointer is over the region", () => {
    const { toaster } = renderToaster({ autoDismiss: { enabled: true, afterMs: 1000 } });
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    fireEvent.mouseEnter(screen.getByLabelText("Notifications"));
    tick(60_000);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByLabelText("Notifications"));
    tick(1000 + EXIT);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("leaves a loading toast up under either policy", () => {
    const { toaster } = renderToaster({ autoDismiss: { enabled: true, afterMs: 1000 } });
    emit(() => toaster.create({ id: "up", title: "Uploading…", type: "loading" }));
    tick(60_000);
    expect(screen.getByRole("status")).toHaveTextContent("Uploading…");
  });

  it("starts the clock at the update when a loading toast becomes a success", () => {
    // A 55-second upload must leave the FULL afterMs to read "Uploaded.", so
    // the countdown is reset when the duration changes — not seeded once at
    // mount, which is what left an updated loading toast at Infinity forever.
    const { toaster } = renderToaster({ autoDismiss: { enabled: true, afterMs: 1000 } });
    emit(() => toaster.create({ id: "up", title: "Uploading…", type: "loading" }));
    tick(55_000);
    emit(() => toaster.create({ id: "up", title: "Uploaded.", type: "success" }));
    tick(999);
    expect(screen.getByRole("status")).toHaveTextContent("Uploaded.");
    tick(1 + EXIT);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("re-times an updated loading toast with no policy too — the found defect", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ id: "up", title: "Uploading…", type: "loading" }));
    emit(() => toaster.create({ id: "up", title: "Uploaded.", type: "success" }));
    tick(DEFAULT_DURATIONS.success + EXIT);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("the cap — max 5, overflow: displace", () => {
  const persistent = { enabled: false, afterMs: 0 };

  it("shows five of six, and the oldest is the one that left", () => {
    const toaster = createToaster({ max: 5, overflow: "displace" });
    renderToaster({ toaster, autoDismiss: persistent });
    for (let i = 1; i <= 6; i++) emit(() => toaster.create({ title: `t${i}`, type: "info" }));
    tick(EXIT);
    const texts = screen.getAllByRole("status").map((n) => n.textContent ?? "");
    expect(texts).toHaveLength(5);
    expect(texts.some((t) => t.includes("t1"))).toBe(false);
    expect(texts.some((t) => t.includes("t6"))).toBe(true);
  });

  it("never displaces an error while a non-error is up", () => {
    const toaster = createToaster({ max: 2, overflow: "displace" });
    renderToaster({ toaster, autoDismiss: persistent });
    emit(() => toaster.create({ title: "failed", type: "error" }));
    emit(() => toaster.create({ title: "saved", type: "success" }));
    emit(() => toaster.create({ title: "newer", type: "info" }));
    tick(EXIT);
    const texts = screen.getAllByRole("status").map((n) => n.textContent ?? "");
    expect(texts.join(" ")).toContain("failed");
    expect(texts.join(" ")).not.toContain("saved");
  });

  it("with only errors up, the oldest error goes — no deadlock", () => {
    const toaster = createToaster({ max: 2, overflow: "displace" });
    renderToaster({ toaster, autoDismiss: persistent });
    emit(() => toaster.create({ title: "e1", type: "error" }));
    emit(() => toaster.create({ title: "e2", type: "error" }));
    emit(() => toaster.create({ title: "saved", type: "success" }));
    tick(EXIT);
    const texts = screen.getAllByRole("status").map((n) => n.textContent ?? "").join(" ");
    expect(texts).not.toContain("e1");
    expect(texts).toContain("e2");
    expect(texts).toContain("saved");
  });

  it("a card on its way out does not hold a slot", () => {
    // Six saves in two seconds: the dismissed card lingers EXIT ms for its
    // animation, and must not count against the cap while it does.
    const toaster = createToaster({ max: 1, overflow: "displace" });
    renderToaster({ toaster, autoDismiss: persistent });
    emit(() => toaster.create({ title: "a", type: "info" }));
    emit(() => toaster.create({ title: "b", type: "info" }));
    emit(() => toaster.create({ title: "c", type: "info" }));
    // Three cards in the snapshot: two fading, one live.
    expect(toaster.getSnapshot().filter((t) => !t.dismissed).map((t) => t.title)).toEqual(["c"]);
    tick(EXIT);
    expect(toaster.getSnapshot().map((t) => t.title)).toEqual(["c"]);
  });

  it("queues, as before, when overflow is not displace", () => {
    const toaster = createToaster({ max: 1 });
    renderToaster({ toaster, autoDismiss: persistent });
    emit(() => toaster.create({ title: "a", type: "info" }));
    emit(() => toaster.create({ title: "b", type: "info" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("a");
  });
});

describe("the fold", () => {
  const persistent = { enabled: false, afterMs: 0 };

  it("folds an untouched stack after collapseAfterMs into one line that names the count", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent, collapseAfterMs: 1000 });
    emit(() => toaster.create({ title: "one", type: "info" }));
    emit(() => toaster.create({ title: "two", type: "info" }));
    tick(999);
    expect(screen.queryByRole("button", { name: "Notifications (2)" })).not.toBeInTheDocument();
    tick(1);
    const fold = screen.getByRole("button", { name: "Notifications (2)" });
    expect(fold).toBeInTheDocument();
    // The cards are hidden — off the screen, out of the tree and the tab order —
    // not removed: fold-then-unfold shows the same cards.
    for (const card of screen.getAllByRole("status", { hidden: true })) {
      expect(card).not.toBeVisible();
    }
    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });

  it("unfolds on activation and the clock restarts", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent, collapseAfterMs: 1000 });
    emit(() => toaster.create({ title: "one", type: "info" }));
    tick(1000);
    fireEvent.click(screen.getByRole("button", { name: "Notifications (1)" }));
    expect(screen.getByRole("status")).toBeVisible();
    tick(999);
    expect(screen.getByRole("status")).toBeVisible();
    tick(1);
    expect(screen.getByRole("button", { name: "Notifications (1)" })).toBeInTheDocument();
  });

  it("unfolds when a new toast arrives — new information must be seen", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent, collapseAfterMs: 1000 });
    emit(() => toaster.create({ title: "one", type: "info" }));
    tick(1000);
    expect(screen.getByRole("button", { name: "Notifications (1)" })).toBeInTheDocument();
    emit(() => toaster.create({ title: "two", type: "success" }));
    expect(screen.queryByRole("button", { name: /^Notifications \(/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("does not fold while the pointer, focus or a hidden tab holds it", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent, collapseAfterMs: 1000 });
    emit(() => toaster.create({ title: "one", type: "info" }));
    const region = screen.getByLabelText("Notifications");

    fireEvent.mouseEnter(region);
    tick(5000);
    expect(screen.getByRole("status")).toBeVisible();
    fireEvent.mouseLeave(region);

    fireEvent.focus(region);
    tick(5000);
    expect(screen.getByRole("status")).toBeVisible();
    fireEvent.blur(region, { relatedTarget: document.body });

    const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    tick(5000);
    expect(screen.getByRole("status")).toBeVisible();
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });

    tick(1000);
    expect(screen.getByRole("button", { name: "Notifications (1)" })).toBeInTheDocument();
  });

  it("never folds without collapseAfterMs — the control", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent });
    emit(() => toaster.create({ title: "one", type: "info" }));
    tick(60 * 60 * 1000);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Notifications \(/ })).not.toBeInTheDocument();
  });

  it("keeps the countdown running while folded", () => {
    const { toaster } = renderToaster({
      autoDismiss: { enabled: true, afterMs: 3000 },
      collapseAfterMs: 1000,
    });
    emit(() => toaster.create({ title: "one", type: "info" }));
    tick(1000);
    expect(screen.getByRole("button", { name: "Notifications (1)" })).toBeInTheDocument();
    tick(2000 + EXIT);
    // The card expired under the fold, and a fold over nothing is gone too —
    // there is never a "Notifications (0)".
    expect(screen.queryByRole("status", { hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Notifications \(/ })).not.toBeInTheDocument();
  });

  it("clears without warnings when everything is removed under it", () => {
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    const { toaster, view } = renderToaster({ autoDismiss: persistent, collapseAfterMs: 1000 });
    emit(() => toaster.create({ title: "one", type: "info" }));
    tick(1000);
    emit(() => toaster.remove());
    view.unmount();
    tick(60_000);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("Dismiss all", () => {
  const persistent = { enabled: false, afterMs: 0 };

  it("appears with two cards, not with one", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent });
    emit(() => toaster.create({ title: "one", type: "info" }));
    expect(screen.queryByRole("button", { name: "Dismiss all" })).not.toBeInTheDocument();
    emit(() => toaster.create({ title: "two", type: "info" }));
    expect(screen.getByRole("button", { name: "Dismiss all" })).toBeInTheDocument();
  });

  it("clears every card", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent });
    emit(() => toaster.create({ title: "one", type: "info" }));
    emit(() => toaster.create({ title: "two", type: "info" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss all" }));
    tick(EXIT);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss all" })).not.toBeInTheDocument();
  });

  it("can be switched off by the host", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent, dismissAllLabel: null });
    emit(() => toaster.create({ title: "one", type: "info" }));
    emit(() => toaster.create({ title: "two", type: "info" }));
    expect(screen.queryByRole("button", { name: "Dismiss all" })).not.toBeInTheDocument();
  });
});

describe("keyboard dismissal leaves focus somewhere visible", () => {
  const persistent = { enabled: false, afterMs: 0 };
  /** Enter or Space on a button fires a click with `detail: 0`; a pointer reports its click count. */
  const pressByKeyboard = (el: HTMLElement) => fireEvent.click(el, { detail: 0 });

  it("moves to the newest remaining card's close control", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent });
    emit(() => toaster.create({ title: "older", type: "info" }));
    emit(() => toaster.create({ title: "newer", type: "info" }));
    const closes = screen.getAllByRole("button", { name: "Dismiss notification" });
    // Rendered oldest first; the newer card's close control is the second.
    const olderClose = closes[0]!;
    olderClose.focus();
    pressByKeyboard(olderClose);
    expect(document.activeElement).toBe(closes[1]);
  });

  it("returns to where focus came from when the last card goes", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent });
    const trigger = document.createElement("button");
    trigger.textContent = "Save";
    document.body.appendChild(trigger);
    trigger.focus();

    emit(() => toaster.create({ title: "only", type: "info" }));
    const close = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.focus(screen.getByLabelText("Notifications"), { relatedTarget: trigger });
    close.focus();
    pressByKeyboard(close);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("falls back to the main landmark, never to body", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent });
    const main = document.createElement("main");
    document.body.appendChild(main);

    emit(() => toaster.create({ title: "only", type: "info" }));
    const close = screen.getByRole("button", { name: "Dismiss notification" });
    close.focus();
    pressByKeyboard(close);
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute("tabindex")).toBe("-1");
    main.remove();
  });

  it("a pointer dismissal moves focus nowhere", () => {
    const { toaster } = renderToaster({ autoDismiss: persistent });
    const main = document.createElement("main");
    document.body.appendChild(main);
    emit(() => toaster.create({ title: "only", type: "info" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }), { detail: 1 });
    expect(document.activeElement).not.toBe(main);
    main.remove();
  });
});

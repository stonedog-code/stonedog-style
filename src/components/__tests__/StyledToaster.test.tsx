import { act, render, screen, fireEvent } from "@testing-library/react";
import StyledToaster from "../StyledToaster";
import { createToaster, DEFAULT_DURATIONS } from "../toaster-store";

/**
 * StyledToaster — the renderer.
 *
 * The assertions worth having are the ones a screenshot cannot make. A toast
 * can look perfect and never announce, expire before it is drawn, or pin itself
 * to the screen because a hover was never released — none of which is visible
 * in a picture, and all of which are what a reimplementation gets wrong.
 *
 * The server-render half lives in `StyledToaster.ssr.test.tsx`.
 */

/** Every test drives time by hand; a real 5-second wait is not a test. */
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

function renderToaster(props: Partial<React.ComponentProps<typeof StyledToaster>> = {}) {
  const toaster = props.toaster ?? createToaster();
  const view = render(<StyledToaster {...props} toaster={toaster} />);
  return { toaster, view };
}

/** `create` is called outside React, so its notification needs wrapping. */
const emit = (fn: () => void) => act(() => { fn(); });

describe("StyledToaster — announcing", () => {
  it("puts the toast text inside a live region", () => {
    // THE assertion of this file. Without it a blind user is never told their
    // save failed, and nothing else in the suite would notice.
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saved.");
  });

  it("reads the toast as one message rather than as whatever changed", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", description: "Two of two." }));
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
  });

  it("announces politely, so a confirmation does not cut across the reader", () => {
    // `alert` would interrupt. That is right for a fire alarm and wrong for
    // "Saved." — and swapping this to `alert` is a plausible-looking change
    // someone makes to "improve accessibility".
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved." }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("keeps the region mounted before any toast exists", () => {
    // A live region created at the same instant as its content is announced
    // inconsistently. One that was already there is not.
    renderToaster();
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("StyledToaster — status is never carried by colour alone", () => {
  it.each([
    ["success", "✓"],
    ["error", "✕"],
    ["warning", "!"],
    ["info", "i"],
  ] as const)("gives a %s toast a glyph", (type, glyph) => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Message", type }));
    expect(screen.getByRole("status")).toHaveTextContent(glyph);
  });

  it("hides the glyph from the reader, which already knows the kind", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    const glyph = screen.getByRole("status").querySelector("[aria-hidden='true']");
    expect(glyph).toHaveTextContent("✓");
  });

  it("lets a host substitute its own icon set", () => {
    // The seam that keeps this package free of icon artwork.
    const { toaster } = renderToaster({
      icons: { success: <svg data-testid="tick" /> },
    });
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    expect(screen.getByTestId("tick")).toBeInTheDocument();
  });

  it("renders no glyph for a toast with no status", () => {
    // `default` is the one type with nothing to say about itself, so inventing
    // a glyph for it would claim a meaning the message does not have.
    //
    // Asserted against the indicator ELEMENT rather than against the toast's
    // text: the first version of this test looked for the glyph characters in
    // `textContent` and failed on the word "Plain", because "i" is one of them.
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Plain", type: "default" }));

    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Plain");
    expect(toast.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("still renders an indicator for a status toast — the control for the above", () => {
    // Without this pair, the assertion above passes just as happily against a
    // component that lost its indicator entirely.
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Plain", type: "success" }));
    expect(
      screen.getByRole("status").querySelector("[aria-hidden='true']"),
    ).not.toBeNull();
  });
});

describe("StyledToaster — auto-dismiss", () => {
  it("clears a success toast after its own two seconds", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));

    act(() => { jest.advanceTimersByTime(DEFAULT_DURATIONS.success - 1); });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(1 + 200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("leaves a loading toast up indefinitely", () => {
    // `Infinity` fed to setTimeout overflows and fires immediately, so
    // "stays until dismissed" silently becomes "vanishes at once".
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Uploading…", type: "loading" }));

    act(() => { jest.advanceTimersByTime(10 * 60 * 1000); });
    expect(screen.getByRole("status")).toHaveTextContent("Uploading…");
  });

  it("does not start the clock until the toast is on screen", () => {
    // The pre-mount case: a toast fired during a redirect or a slow hydration.
    // If the countdown lived in the store it would already have expired here,
    // and the toast would be dropped without ever being drawn.
    const toaster = createToaster();
    act(() => { toaster.create({ title: "Saved.", type: "success" }); });
    act(() => { jest.advanceTimersByTime(60000); });

    render(<StyledToaster toaster={toaster} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");

    // …and its two seconds start now, not retroactively.
    act(() => { jest.advanceTimersByTime(DEFAULT_DURATIONS.success + 200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("StyledToaster — pausing", () => {
  it("stops the countdown while the pointer is over the region", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    const region = screen.getByLabelText("Notifications");

    fireEvent.mouseEnter(region);
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.mouseLeave(region);
    act(() => { jest.advanceTimersByTime(DEFAULT_DURATIONS.success + 200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("resumes with the time that was left, not the whole duration", () => {
    // Restarting the clock on every mouse-out means a toast a reader keeps
    // brushing past never leaves.
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));
    const region = screen.getByLabelText("Notifications");

    act(() => { jest.advanceTimersByTime(1900); });
    fireEvent.mouseEnter(region);
    act(() => { jest.advanceTimersByTime(60000); });
    fireEvent.mouseLeave(region);

    act(() => { jest.advanceTimersByTime(99); });
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1 + 200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stops the countdown while focus is inside the region", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success", closable: true }));
    const region = screen.getByLabelText("Notifications");

    fireEvent.focus(region);
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not resume when focus moves BETWEEN controls in the same toast", () => {
    // blur fires on every internal hop. Treating that as "focus left" restarts
    // the countdown under a keyboard user's hands, mid-tab.
    const { toaster } = renderToaster();
    emit(() =>
      toaster.create({
        title: "Saved.",
        type: "success",
        closable: true,
        action: { label: "Undo", onClick: () => {} },
      }),
    );
    const region = screen.getByLabelText("Notifications");
    const undo = screen.getByRole("button", { name: "Undo" });

    fireEvent.focus(region);
    fireEvent.blur(region, { relatedTarget: undo });
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("stops the countdown while the tab is hidden", () => {
    // A message that expired in a background tab was never delivered.
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));

    const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByRole("status")).toBeInTheDocument();

    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { jest.advanceTimersByTime(DEFAULT_DURATIONS.success + 200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("StyledToaster — controls", () => {
  it("gives the close button a name, since its only content is a glyph", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", closable: true }));
    expect(
      screen.getByRole("button", { name: "Dismiss notification" }),
    ).toBeInTheDocument();
  });

  it("dismisses on close", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", closable: true }));

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    act(() => { jest.advanceTimersByTime(200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders no close control unless one was asked for", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "Saved." }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("runs the action and then takes the toast away", () => {
    // A toast whose button has been pressed has done its job; leaving it up
    // invites a second press on an action that has already run.
    const onClick = jest.fn();
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "You have notifications", action: { label: "Review", onClick } }));

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    act(() => { jest.advanceTimersByTime(200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("StyledToaster — lifecycle", () => {
  it("stacks the newest toast nearest the corner", () => {
    const { toaster } = renderToaster();
    emit(() => toaster.create({ title: "first", duration: Infinity }));
    emit(() => toaster.create({ title: "second", duration: Infinity }));

    const texts = screen.getAllByRole("status").map((n) => n.textContent);
    expect(texts[0]).toContain("first");
    expect(texts[1]).toContain("second");
  });

  it("unmounts mid-countdown without updating state afterwards", () => {
    // The classic leak: a timer that outlives its component and calls setState
    // into nothing. React logs it as a warning, which is easy to never read.
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    const { toaster, view } = renderToaster();
    emit(() => toaster.create({ title: "Saved.", type: "success" }));

    view.unmount();
    act(() => { jest.advanceTimersByTime(60000); });

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("drives two independent toasters without crossing them", () => {
    // Each store is its own queue. Sharing module state between them would show
    // up here and nowhere else.
    const a = createToaster();
    const b = createToaster();
    render(<StyledToaster toaster={a} regionLabel="A" />);
    render(<StyledToaster toaster={b} regionLabel="B" />);

    emit(() => a.create({ title: "only in A", duration: Infinity }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("only in A");
  });
});

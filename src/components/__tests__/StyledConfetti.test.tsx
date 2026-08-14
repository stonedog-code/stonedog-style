import { render, screen, act } from "@testing-library/react";
import StyledConfetti from "../StyledConfetti";

/**
 * `StyledConfetti` (NEH-430) — the seam that replaced a `js-confetti` import.
 *
 * What is NOT asserted here: anything the particles look like. The burst is a
 * CSS animation, and jsdom neither animates nor lays out. `StyledConfetti.ct.tsx`
 * measures it in a real engine.
 */

/** jsdom implements no matchMedia at all, so every test must supply one. */
function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
}

describe("StyledConfetti", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders nothing until triggered", () => {
    render(<StyledConfetti />);
    expect(screen.queryByTestId("styled-confetti")).not.toBeInTheDocument();
  });

  it("throws particles on a rising trigger", () => {
    render(<StyledConfetti trigger particleCount={12} />);
    expect(screen.getByTestId("styled-confetti")).toBeInTheDocument();
    expect(screen.getAllByTestId("styled-confetti-particle")).toHaveLength(12);
  });

  it("clears itself and reports completion", () => {
    const onComplete = jest.fn();
    render(<StyledConfetti trigger particleCount={4} onComplete={onComplete} />);

    act(() => {
      jest.advanceTimersByTime(1300);
    });

    expect(screen.queryByTestId("styled-confetti")).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  /**
   * The decoration must not sit on top of the UI swallowing clicks, and it has
   * nothing to announce.
   */
  it("is hidden from assistive technology", () => {
    // Only the ARIA half is asserted here. `pointer-events: none` comes from a
    // Panda class, and jsdom loads no stylesheet — `toHaveStyle` would be
    // reading a rule that does not exist in this environment. It is measured
    // for real in StyledConfetti.ct.tsx by clicking through the overlay.
    render(<StyledConfetti trigger particleCount={2} />);
    expect(screen.getByTestId("styled-confetti")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("fires once per rising edge, not on every render", () => {
    const { rerender } = render(<StyledConfetti trigger particleCount={3} />);
    const first = screen.getAllByTestId("styled-confetti-particle").length;

    rerender(<StyledConfetti trigger particleCount={3} />);
    expect(screen.getAllByTestId("styled-confetti-particle")).toHaveLength(first);
  });

  describe("prefers-reduced-motion", () => {
    /**
     * Confetti carries no information — purely decorative motion is exactly
     * what the preference is about — so the burst is SKIPPED rather than
     * shortened.
     */
    it("plays no burst", () => {
      mockReducedMotion(true);
      render(<StyledConfetti trigger particleCount={20} />);
      expect(screen.queryByTestId("styled-confetti")).not.toBeInTheDocument();
    });

    /**
     * The half that is easy to get wrong. Hosts commonly use `onComplete` to
     * reset the trigger, so swallowing it would leave the flag stuck true and
     * the celebration permanently armed — a reduced-motion setting quietly
     * breaking the host's state machine.
     */
    it("still reports completion", () => {
      mockReducedMotion(true);
      const onComplete = jest.fn();
      render(<StyledConfetti trigger onComplete={onComplete} />);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("the celebrate seam", () => {
    it("is used instead of the default burst", () => {
      const celebrate = jest.fn();
      render(<StyledConfetti trigger particleCount={7} celebrate={celebrate} />);

      expect(celebrate).toHaveBeenCalledWith({
        particleCount: 7,
        emojis: undefined,
      });
      expect(screen.queryByTestId("styled-confetti")).not.toBeInTheDocument();
    });

    it("reports completion when a synchronous implementation returns", () => {
      const onComplete = jest.fn();
      render(
        <StyledConfetti trigger celebrate={() => {}} onComplete={onComplete} />,
      );
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("waits for a promise before reporting completion", async () => {
      const onComplete = jest.fn();
      let settle!: () => void;
      const pending = new Promise<void>((resolve) => {
        settle = resolve;
      });

      render(
        <StyledConfetti
          trigger
          celebrate={() => pending}
          onComplete={onComplete}
        />,
      );
      expect(onComplete).not.toHaveBeenCalled();

      await act(async () => {
        settle();
        await pending;
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    /**
     * A failed decoration must not wedge the host: `onComplete` is what
     * releases the trigger, so a rejection that skipped it would leave the flag
     * true and nothing could ever fire again.
     */
    it("reports completion even when the host implementation rejects", async () => {
      const onComplete = jest.fn();
      // Created INSIDE the callback, not before render. A rejected promise
      // built up front is unhandled for the microtask before the component
      // attaches to it, and Node reports that as an unhandled rejection — the
      // test would fail for its own setup rather than for the component.
      const unhandled = jest.fn();
      process.on("unhandledRejection", unhandled);

      render(
        <StyledConfetti
          trigger
          celebrate={() => Promise.reject(new Error("no canvas"))}
          onComplete={onComplete}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(onComplete).toHaveBeenCalledTimes(1);

      // The other half, and the reason `.finally()` was wrong: it returns a
      // promise that rejects onward, so the trigger would be released AND an
      // unhandled rejection logged into the host's console — for a decoration.
      //
      // Node only reports an unhandled rejection at the end of a macrotask
      // turn, so microtasks alone cannot detect it. Real timers for exactly
      // that tick; restored afterwards so `afterEach` still has fake ones.
      jest.useRealTimers();
      await new Promise((r) => {
        setTimeout(r, 0);
      });
      expect(unhandled).not.toHaveBeenCalled();
      process.off("unhandledRejection", unhandled);
      jest.useFakeTimers();
    });
  });
});

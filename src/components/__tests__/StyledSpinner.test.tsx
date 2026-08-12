import { render, screen, act } from "@testing-library/react";
import StyledSpinner from "../StyledSpinner";
import { StonedogStyleProvider } from "../../config/style-config";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Advance past N dot ticks. */
const tick = (n = 1) =>
  act(() => {
    jest.advanceTimersByTime(500 * n);
  });

describe("StyledSpinner", () => {
  it("says what it is waiting for", () => {
    render(<StyledSpinner />);
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("takes a custom label", () => {
    // "Loading" alone tells someone nothing about whether to wait or leave.
    render(<StyledSpinner loadText="Loading your medicines" />);
    expect(screen.getByText("Loading your medicines")).toBeInTheDocument();
  });

  it("accepts a node label without wrapping it in text", () => {
    render(<StyledSpinner loadText={<em data-testid="rich">Almost there</em>} />);
    expect(screen.getByTestId("rich")).toBeInTheDocument();
  });

  it("animates the dots on a 500ms cycle and wraps back round", () => {
    render(<StyledSpinner />);
    const status = screen.getByRole("status");

    expect(status).toHaveTextContent(/Loading\.$/);
    tick();
    expect(status).toHaveTextContent(/Loading\.\.$/);
    tick();
    expect(status).toHaveTextContent(/Loading\.\.\.$/);
    tick();
    // Wraps rather than growing without bound — the original grew a string by
    // appending and reset on equality, which is easy to get wrong.
    expect(status).toHaveTextContent(/Loading\.$/);
  });

  it("stops its timer when unmounted", () => {
    // A spinner is rendered exactly when a component is about to be replaced,
    // so a leaked interval here is the common case, not an edge case.
    const { unmount } = render(<StyledSpinner />);
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  describe("accessibility", () => {
    it("is a polite live region so it is announced, not silent", () => {
      // WCAG 4.1.3. The original had no role: sighted users saw an indicator
      // and everyone else got nothing.
      render(<StyledSpinner />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("hides the dots from assistive technology", () => {
      // Inside a live region, unhidden dots would re-announce the whole status
      // twice a second — a helpful message turned into unusable chatter.
      render(<StyledSpinner />);
      const dots = screen.getByText(".", { selector: '[aria-hidden="true"]' });
      expect(dots).toBeInTheDocument();
    });

    it("announces the label exactly once, not once per dot change", () => {
      render(<StyledSpinner loadText="Saving" />);
      tick(3);
      expect(screen.getAllByText("Saving")).toHaveLength(1);
    });
  });

  describe("the props that were dropped", () => {
    it("still renders when a stale caller passes a removed prop", () => {
      // thickness/speed/color/emptyColor/logoSize/spinLogo were accepted and
      // silently discarded upstream, and no call site used them. A stale JS
      // caller should degrade to a working spinner rather than crash.
      const stale = {
        thickness: "4px",
        speed: "2s",
        spinLogo: true,
      } as unknown as Record<string, unknown>;
      render(<StyledSpinner {...stale} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  it("routes its load text through StyledText, so the profile can reach it", () => {
    // This used to assert `toHaveStyle({ fontSize: "var(--font-sizes-xl, 2rem)" })`
    // — a value that stopped being true when the scale moved to a conventional
    // web baseline, and which the suite never noticed because the assertion
    // cannot fail (NEH-406): jsdom drops a `var()` font-size, leaving no style
    // attribute for the matcher to read.
    //
    // What jsdom CAN answer is whether the text goes through the component that
    // knows about the profile at all — the wiring, not the pixels. The rendered
    // size is measured in StyledSpinner.ct.tsx, in a browser that resolves the
    // custom property.
    render(
      <StonedogStyleProvider fontSizeProfile="xl">
        <StyledSpinner loadText="Big" />
      </StonedogStyleProvider>,
    );
    const text = screen.getByText("Big");
    expect(text).toBeInTheDocument();
    expect(text.className).toContain("text");
  });
});

"use client";

import React from "react";
import StyledHStack from "./StyledHStack";
import StyledText, { type StyledTextProps } from "./StyledText";
import { log } from "../config/logger";

/**
 * A "still working" indicator: a label followed by animating dots.
 *
 * Text rather than a rotating graphic, deliberately. This came out of a product
 * for an often-elderly audience, where a spinner that says *"Loading…"* is
 * understood immediately and an abstract rotating shape is not. It also degrades
 * honestly under `prefers-reduced-motion`: the dots change once every 500ms
 * rather than spinning continuously.
 *
 * ## What was deliberately left behind
 *
 * The originating component had a second mode, `spinLogo`, that rotated
 * HopperGuard's brand mark. That is **branding, not a primitive** — the same
 * reason this package ships no icons — so it stays in the app, which keeps its
 * own `StyledSpinner` wrapping this one for the dots path.
 *
 * Five props went with it: `thickness`, `speed`, `color`, `emptyColor` and
 * `logoSize` were all declared, accepted, and **silently discarded** — none was
 * read, and a search of the originating app found zero call sites passing any of
 * them. A prop that does nothing is worse than a missing one: it reads as a
 * supported knob and fails silently when someone turns it.
 *
 * `size` is gone for the same reason. It sized the logo wrapper only, so on the
 * dots path it never did anything.
 */

/** How long each dot stays before the next is added. */
const DOT_INTERVAL_MS = 500;
const DOT_STATES = [".", "..", "..."] as const;

export interface StyledSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * What the user is waiting for. A string is wrapped in `StyledText` so it
   * picks up the app-wide font-size profile; a node is rendered as given.
   *
   * Say what is loading where you can — "Loading" alone tells someone nothing
   * about whether to wait or navigate away.
   */
  loadText?: React.ReactNode;
  /**
   * The colour of the label and the dots. Defaults to `textPrimary`, which is
   * right for a spinner standing on a page.
   *
   * It exists for the spinner that stands INSIDE something that states its own
   * text colour — a busy `StyledButton` passes `"inherit"`, so "Saving…" takes
   * the colour the button's variant chose for its background rather than the
   * body colour (NEH-1788). This is not the `color` prop that was removed from
   * this component for doing nothing: this one is read, by both text nodes.
   */
  color?: StyledTextProps["color"];
}

export const StyledSpinner = ({
  loadText = "Loading",
  color = "textPrimary",
  ...rest
}: StyledSpinnerProps) => {
  log.trace("StyledSpinner rendered");

  const [dotIndex, setDotIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(
      () => setDotIndex((i) => (i + 1) % DOT_STATES.length),
      DOT_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, []);

  return (
    // `role="status"` — an implicit `aria-live="polite"` region, so a screen
    // reader announces "Loading" once when this appears instead of leaving the
    // user with silence. The original had no role at all: sighted users got an
    // indicator and everyone else got nothing, which is a WCAG 4.1.3 gap rather
    // than a missing nicety.
    <StyledHStack gap={1} role="status" {...rest}>
      {typeof loadText === "string" ? (
        <StyledText color={color}>{loadText}</StyledText>
      ) : (
        loadText
      )}
      {/*
        The dots are decorative and deliberately hidden. The label beside them
        already says what is happening, and inside a live region a screen reader
        would otherwise re-announce the whole thing twice a second as they
        change — turning a helpful status into unusable chatter.
      */}
      <StyledText aria-hidden="true" color={color}>
        {DOT_STATES[dotIndex]}
      </StyledText>
    </StyledHStack>
  );
};

StyledSpinner.displayName = "StyledSpinner";

export default StyledSpinner;

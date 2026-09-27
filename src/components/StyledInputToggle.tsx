"use client";

import React from "react";
import { styled } from "styled-system/jsx";
import StyledTooltip from "./StyledTooltip";

/**
 * An on/off switch.
 *
 * ## No animation library
 *
 * The originating component used framer-motion for two things: sliding the
 * handle, and growing a strike-through when disabled. Both are a CSS
 * transition, and a whole animation library is a heavy thing to make three
 * products carry for a 26px circle that moves 30px. This package has one
 * runtime dependency and that is worth defending.
 *
 * The spring is gone with it. A spring on a binary control is decoration —
 * there is no in-between state to communicate — and it delayed the settled
 * position by longer than the ease does.
 *
 * **It honours `prefers-reduced-motion`.** Motion is a vestibular trigger, not
 * only a preference; under that query the handle moves instantly.
 *
 * ## It is a real button
 *
 * The original was a `<div role="switch">` with hand-written `Space`/`Enter`
 * handling and a manual `tabIndex`. A `<button>` gets all of that from the
 * platform — focus, activation, the disabled semantics — and gets them right in
 * the cases hand-rolled versions miss, like activation on key-up rather than
 * key-down.
 *
 * ## Three defects fixed on the way in
 *
 * **It was under the tap-target floor.** The switch was 60×30 CSS px against a
 * 44×44 minimum (WCAG 2.5.5). The track still *looks* 60×30 — the button pads
 * out to 44 around it, so the appearance is unchanged and the target is legal.
 * Shrinking the visible track would have been the wrong fix; a switch reads as
 * a switch at that size.
 *
 * **It painted itself from the raw palette** — `gray.300`, `green.400`,
 * `white` — so it ignored the theme and dark mode entirely. Now tokens, chosen
 * from `TEXT_BACKGROUND_PAIRS` rather than by eye: the handle is the *text*
 * token belonging to whichever track surface is under it, which is the
 * package's own contract for "these two are readable together".
 *
 * **It could end up with no accessible name.** The old fallback used `tooltip`
 * only when it happened to be a string, so a node tooltip left the switch
 * announced as "switch" with no name at all. `label` is now explicit, with the
 * string tooltip still serving as a fallback.
 *
 * ## A named switch that could never be DESCRIBED
 *
 * The switch took no `aria-describedby` at all, and its `id` landed on the
 * wrapper `<div>` rather than on the `role="switch"` button. Both halves of
 * describing a control were therefore unreachable:
 *
 * - there was no prop for the attribute; and
 * - `StyledFieldHelp htmlFor={id}` resolves its target with
 *   `getElementById(htmlFor)` and writes `aria-describedby` on whatever it
 *   finds — so it described the wrapper, which nothing announces.
 *
 * A consumer worked round it with a `display: contents` wrapper and an effect
 * that set the attribute on the button by query. That is a workaround for a
 * defect here, not a shape worth keeping, so:
 *
 * - **`ariaDescribedBy` is a prop**, written to the button. Wanted as well as
 *   the fix below, because not every description is a `StyledFieldHelp`: a host
 *   naming an error summary, a character counter, or an id rendered on the
 *   server needs to say so declaratively rather than hope something else wires
 *   it imperatively after hydration.
 * - **`id` lands on the button.** It is the element with the role, the name and
 *   the state; every use of a control's id — `aria-describedby`,
 *   `aria-labelledby`, `aria-controls`, a label's `htmlFor`, a test selector —
 *   means the interactive element, and pointing any of them at a layout wrapper
 *   fails silently rather than loudly. `data-testid` already made exactly this
 *   move for exactly this reason.
 *
 * **Moving `id` is a behaviour change, and the old behaviour has a name.**
 * `containerId` puts an id back on the wrapper for a host that genuinely wants
 * one there — a CSS hook, a layout query. That is the same escape hatch
 * `minTrackWidth="auto"` provides for `StyledSimpleGrid`'s track change, and it
 * is what makes the default safe to move on a minor: a caret range on a `0.x`
 * package does not cross a minor, so no consumer receives this until it widens
 * the range deliberately, and the one that wants the old placement can say so
 * instead of pinning an old version.
 */

export interface StyledInputToggleProps {
  /**
   * Written to the `role="switch"` BUTTON, not to the wrapper — see above.
   * This is what makes `StyledFieldHelp htmlFor={id}` describe the switch.
   */
  id?: string;
  /**
   * An id for the wrapper `<div>`, for a host that wants a hook on the
   * container itself. Where `id` used to land. Rarely wanted.
   */
  containerId?: string;
  /**
   * Id(s) of the element(s) that describe the switch, written to its
   * `aria-describedby`. Space-separated, as the attribute takes.
   *
   * A `StyledFieldHelp` pointed at this switch's `id` wires itself and needs
   * nothing here; this is for the descriptions that are not one.
   */
  ariaDescribedBy?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Shown above the switch when on. */
  iconOn?: React.ReactNode;
  /** Shown above the switch when off. */
  iconOff?: React.ReactNode;
  disabled?: boolean;
  tooltip?: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  /** Accessible name. Pass it — see above. */
  label?: string;
  ["data-testid"]?: string;
}

const ToggleContainer = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2",
  },
});

const IconContainer = styled("div", {
  base: { position: "relative" },
});

const StrikeThrough = styled("div", {
  base: {
    position: "absolute",
    top: "50%",
    left: 0,
    width: "100%",
    height: "2px",
    backgroundColor: "currentColor",
    transformOrigin: "center",
    transform: "scaleX(1)",
    animation: "stonedogStrikeIn 200ms ease-out",
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
});

/**
 * The button. Its padding is what carries the 44px floor: the visible track
 * inside stays 60×30, so nothing looks different and the target is legal.
 */
const SwitchButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "48px",
    minHeight: "48px",
    padding: "0",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: "md",
    _disabled: {
      cursor: "not-allowed",
      opacity: 0.5,
    },
  },
});

const Track = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    width: "60px",
    height: "30px",
    borderRadius: "15px",
    padding: "2px",
    transition: "background-color 200ms ease",
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
    },
  },
  variants: {
    on: {
      // Token pairs from TEXT_BACKGROUND_PAIRS — the handle below reads against
      // whichever of these is under it.
      true: { backgroundColor: "buttonBgAccent" },
      false: { backgroundColor: "boxBgSecondary" },
    },
  },
});

const Handle = styled("span", {
  base: {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    // translateX, not `margin-left: auto` — a margin change is not animatable,
    // which is why the original needed a layout animation to move at all.
    transform: "translateX(0)",
    transition: "transform 200ms ease, background-color 200ms ease",
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
    },
  },
  variants: {
    on: {
      true: {
        transform: "translateX(30px)",
        backgroundColor: "buttonTextAccent",
      },
      false: { backgroundColor: "textSecondary" },
    },
  },
});

export default function StyledInputToggle({
  id,
  containerId,
  ariaDescribedBy,
  value,
  onChange,
  iconOn,
  iconOff,
  disabled,
  tooltip,
  placement,
  label,
  ...props
}: StyledInputToggleProps) {
  const hasIcons = iconOn || iconOff;
  const name = label ?? (typeof tooltip === "string" ? tooltip : undefined);

  const content = (
    <ToggleContainer id={containerId}>
      {hasIcons && (
        <IconContainer>
          {value ? iconOn : iconOff}
          {/* Decorative: the switch's own state is already announced by
              aria-checked and aria-disabled. */}
          {disabled && <StrikeThrough aria-hidden="true" data-testid="toggle-strike" />}
        </IconContainer>
      )}
      <SwitchButton
        type="button"
        role="switch"
        // The caller's id lands on the BUTTON, not the container — this is the
        // element with the role, the name and the state, and it is what every
        // id-based association has to reach.
        id={id}
        aria-checked={value}
        aria-label={name}
        // Omitted rather than set to `undefined` so the attribute is absent
        // from the DOM when there is nothing to describe: an empty
        // `aria-describedby` is not the same as no description, and some
        // screen readers announce the gap.
        {...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})}
        disabled={disabled}
        data-state={value ? "on" : "off"}
        // The caller's test id lands on the BUTTON too. A test that does
        // `click(getByTestId(...))` has to hit the interactive element —
        // clicking a wrapper does nothing, and the failure looks like a broken
        // component rather than a mis-aimed selector.
        data-testid={props["data-testid"] ?? "toggle-switch"}
        onClick={() => onChange(!value)}
      >
        <Track on={value}>
          <Handle on={value} />
        </Track>
      </SwitchButton>
    </ToggleContainer>
  );

  if (tooltip) {
    return (
      <StyledTooltip tooltip={tooltip} placement={placement}>
        {content}
      </StyledTooltip>
    );
  }

  return content;
}

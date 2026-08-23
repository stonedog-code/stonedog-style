"use client";

import React from "react";
import { styled } from "styled-system/jsx";
import { useDisclosure } from "./useDisclosure";

/**
 * A disclosure: a trigger that shows and hides a region.
 *
 * Built here rather than in an app because three products want the same thing
 * and one of them currently reaches for Chakra to get it. It knows nothing
 * about what it contains.
 *
 * ## Why the content stays mounted
 *
 * Collapsed content is hidden with `hidden`, not unmounted. Unmounting looks
 * tidier and is wrong for the audience this package serves: it discards focus,
 * scroll position and any input a reader had part-typed, so a mis-click on the
 * trigger destroys work rather than merely hiding it. `hidden` also keeps the
 * region addressable by `aria-controls` at all times, which is what lets the
 * trigger's `aria-expanded` mean anything.
 *
 * `hidden` rather than `display: none` in CSS: it is the accessibility default,
 * it removes the content from the accessibility tree *and* from tab order in
 * one attribute, and it cannot be defeated by a host stylesheet the way a
 * utility class can.
 */

export interface StyledCollapsibleProps {
  /** The disclosure's own control. Rendered inside a `<button>`. */
  trigger: React.ReactNode;
  children: React.ReactNode;
  /** Controlled. Omit to let the component own the state. */
  open?: boolean | undefined;
  /** Initial state when uncontrolled. Default `false`. */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((next: boolean) => void) | undefined;
  /**
   * Names the trigger.
   *
   * State belongs in `aria-expanded`, never in the name — a name that reads
   * "Collapse tools" is announced as "Collapse tools, expanded", which says the
   * same thing twice and in opposite tenses. Say what the control is *for*.
   */
  "aria-label"?: string | undefined;
  /** Escape hatch for a host that must reach the trigger in a test. */
  triggerTestId?: string | undefined;
  contentTestId?: string | undefined;
}

/**
 * 48px, matching every other interactive floor in this package: stated as a
 * minimum rather than left to emerge from padding, so no density step or font
 * profile can erode it below the WCAG target size.
 */
const CONTROL_MIN_TARGET = "48px";

const CollapsibleTrigger = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "2",
    minHeight: CONTROL_MIN_TARGET,
    minWidth: CONTROL_MIN_TARGET,
    px: "2",
    borderRadius: "md",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "borderBgPrimary",
    color: "textPrimary",
    background: "transparent",
    cursor: "pointer",
  },
});

const StyledCollapsible: React.FC<StyledCollapsibleProps> = ({
  trigger,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  "aria-label": ariaLabel,
  triggerTestId,
  contentTestId,
}) => {
  // The mechanics live in `useDisclosure`, not here. This component is one
  // ARRANGEMENT of a disclosure — a button with the trigger inside it, above
  // the region — and a host whose control is already a button composes the
  // same hook into its own layout instead of nesting one button in another
  // (NEH-1100). Two arrangements, one implementation.
  const { triggerProps, contentProps } = useDisclosure({
    open,
    defaultOpen,
    onOpenChange,
  });

  return (
    <>
      <CollapsibleTrigger
        {...triggerProps}
        aria-label={ariaLabel}
        data-testid={triggerTestId}
      >
        {trigger}
      </CollapsibleTrigger>
      <div {...contentProps} data-testid={contentTestId}>
        {children}
      </div>
    </>
  );
};

export default StyledCollapsible;
export { StyledCollapsible };

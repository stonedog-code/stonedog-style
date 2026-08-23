"use client";

import { useCallback, useId, useState } from "react";

/**
 * The mechanics of a disclosure, with no markup attached.
 *
 * ## Why this exists as a hook and not only as a component
 *
 * `StyledCollapsible` renders its own `<button>` with the trigger inside it.
 * That is the right default and it is the wrong shape for a host whose control
 * is *already* a button — an icon button with a tooltip, say, sitting in a
 * header row opposite a title. Handed such a control as `trigger`, the
 * component would wrap one `<button>` in another: invalid HTML that React warns
 * will break hydration, and one affordance split into two, with the accessible
 * name on the inner element and `aria-expanded` on the outer one. A screen
 * reader then announces a button that says nothing, containing a button that
 * says nothing about its state.
 *
 * The alternative — the host hand-rolling `useState`, a `useId`, the two ARIA
 * attributes and the `hidden` decision — is how one product ends up with two
 * disclosures that disagree, which is exactly what NEH-1100 records happening.
 *
 * So the mechanics live here, and both the component below and any host
 * composition are built on the same three lines. There is one implementation of
 * *a disclosure*; there are as many arrangements of it as there are layouts.
 *
 * ```tsx
 * const { open, triggerProps, contentProps } = useDisclosure();
 *
 * <header>
 *   <h2>Vitals</h2>
 *   <MyIconButton {...triggerProps} aria-label={open ? "Hide" : "Show"} />
 * </header>
 * <section {...contentProps}>…</section>
 * ```
 *
 * ## `hidden`, never unmounted
 *
 * `contentProps.hidden` is the whole opinion this hook carries, and it is not
 * negotiable by a prop. Unmounting collapsed content looks tidier and discards
 * focus, scroll position and anything part-typed — so a mis-press destroys work
 * rather than merely hiding it. `hidden` also keeps the region addressable by
 * `aria-controls` at all times, which is what lets `aria-expanded` mean
 * anything: a control that claims to expand something must point at something
 * that exists while it is collapsed.
 *
 * A host that genuinely wants unmounting can render `{open && …}` itself. It
 * should then know it is giving that up.
 */

export interface UseDisclosureOptions {
  /** Controlled. Omit to let the hook own the state. */
  open?: boolean | undefined;
  /** Initial state when uncontrolled. Default `false`. */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((next: boolean) => void) | undefined;
  /**
   * The id linking trigger to content. Generated when omitted.
   *
   * Supply one only when something outside this pair must reference the region
   * by id; two disclosures given the same id will produce two triggers pointing
   * at one region.
   */
  id?: string | undefined;
}

/** Spread onto the ONE element that is the control. It must be a `<button>`. */
export interface DisclosureTriggerProps {
  type: "button";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
}

/** Spread onto the region the control shows and hides. */
export interface DisclosureContentProps {
  id: string;
  hidden: boolean;
}

export interface Disclosure {
  open: boolean;
  toggle: () => void;
  setOpen: (next: boolean) => void;
  triggerProps: DisclosureTriggerProps;
  contentProps: DisclosureContentProps;
}

export function useDisclosure(options: UseDisclosureOptions = {}): Disclosure {
  const { open: controlled, defaultOpen = false, onOpenChange, id } = options;

  const [uncontrolled, setUncontrolled] = useState(defaultOpen);

  // Controlled the moment `open` is supplied, and uncontrolled otherwise —
  // decided per render rather than latched at mount, because a host that
  // switches between the two mid-life has a bug we should not paper over by
  // silently ignoring the prop.
  const isControlled = controlled !== undefined;
  const open = isControlled ? controlled : uncontrolled;

  const generatedId = useId();
  const contentId = id ?? generatedId;

  const setOpen = useCallback(
    (next: boolean) => {
      // The internal state moves even when controlled. If the host ignores the
      // callback the control would otherwise appear dead to the pointer, and a
      // control that does nothing when pressed is indistinguishable from a
      // broken one.
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);

  return {
    open,
    toggle,
    setOpen,
    triggerProps: {
      // `type="button"` because the commonest place a disclosure lives is
      // inside a form, where an untyped button submits it. The symptom is a
      // page reload on the first press of a "show more" control.
      type: "button",
      "aria-expanded": open,
      "aria-controls": contentId,
      onClick: toggle,
    },
    contentProps: {
      id: contentId,
      hidden: !open,
    },
  };
}

export default useDisclosure;

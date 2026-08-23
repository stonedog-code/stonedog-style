"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toastRecipe } from "styled-system/recipes";
import { cx } from "styled-system/css";

import StyledButton from "./StyledButton";
import StyledSpinner from "./StyledSpinner";
import StyledText from "./StyledText";
import type { Toast, ToasterStore, ToastType } from "./toaster-store";

/**
 * Draws whatever is in a toaster store.
 *
 * Mount **one** of these, once, near the root of the application, and hand it
 * the same store your `create()` calls go to. It renders nothing until there is
 * something to show.
 *
 * ```tsx
 * export const toaster = createToaster();
 * // …somewhere near the root:
 * <StyledToaster toaster={toaster} />
 * // …anywhere at all:
 * toaster.create({ title: "Saved.", type: "success" });
 * ```
 *
 * ## The three things that make this SSR-safe
 *
 * All three were failure modes before they were requirements, and none of them
 * shows up in a client-only test:
 *
 * 1. **`getServerSnapshot`** — `useSyncExternalStore` throws during hydration
 *    without one. The store supplies a frozen empty array, the same reference
 *    every time, so React sees no change between the server render and the
 *    first client one.
 * 2. **The portal waits for mount.** `createPortal(…, document.body)` is a
 *    `document is not defined` crash on the server. `mounted` below is false
 *    for the server render *and* for the first client render, which is what
 *    keeps the two identical — checking `typeof document` instead would make
 *    them differ and produce a hydration mismatch rather than a crash.
 * 3. **The store refuses to queue on the server**, so a toast created during a
 *    render cannot leak into the next request. That one lives in the store; see
 *    its header.
 *
 * ## Timers start here, not in the store
 *
 * A toast created before this component mounts — during a redirect, a slow
 * hydration, an early event handler — must still be seen. Because each toast's
 * countdown is an effect *in the toast's own element*, it cannot start before
 * that element exists, so an early toast waits rather than expiring unseen.
 */
export interface StyledToasterProps {
  /** The store to draw. Create it with `createToaster()`. */
  toaster: ToasterStore;
  /**
   * The glyph for each kind of toast.
   *
   * **This package ships no icon artwork**, deliberately — see CLAUDE.md. The
   * defaults are text characters, which work everywhere and are nobody's
   * favourite. Pass your own icon set here to replace them; pass `null` for a
   * type to render no glyph at all.
   *
   * Whatever you pass is `aria-hidden`: the toast's role already tells a screen
   * reader what kind of message it is, and reading "check mark" before the text
   * is the same information twice.
   */
  icons?: Partial<Record<ToastType, React.ReactNode>> | undefined;
  /** The glyph inside the close control. Text by default, for the same reason. */
  closeIcon?: React.ReactNode;
  /**
   * The close control's accessible name. It is a button whose only content is a
   * glyph, so without a name it announces as "button" and nothing else.
   */
  closeLabel?: string;
  /**
   * Names the region for a screen reader listing landmarks.
   *
   * Not the toasts themselves — those announce individually as they arrive.
   */
  regionLabel?: string;
}

/**
 * Text stand-ins for the artwork this package will not ship.
 *
 * `default` has none on purpose: it is the type for a message with no status,
 * and inventing a glyph for "no particular kind" would say something the
 * message does not.
 */
const DEFAULT_ICONS: Partial<Record<ToastType, React.ReactNode>> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
};

/**
 * One toast, and the only place a dismissal timer exists.
 *
 * The timer is an effect keyed on `paused`, which gives pause-and-resume for
 * free: pausing tears the effect down, and the cleanup subtracts the elapsed
 * time from what is left, so resuming schedules the remainder rather than
 * restarting the whole duration. Unmounting runs the same cleanup, so a toast
 * removed mid-countdown cannot fire a state update into a component that is no
 * longer there.
 */
function ToastItem({
  toast,
  paused,
  onDismiss,
  icons,
  closeIcon,
  closeLabel,
}: {
  toast: Toast;
  paused: boolean;
  onDismiss: (id: string) => void;
  icons: Partial<Record<ToastType, React.ReactNode>>;
  closeIcon: React.ReactNode;
  closeLabel: string;
}) {
  /**
   * Resolved PER TOAST, with this toast's type.
   *
   * The first version called `toastRecipe()` once for the whole region and
   * shared the result, so every card came out as `toast__root--type_default`
   * and no status accent was ever painted — the recipe was correct, its
   * stylesheet was correct, and nothing rendered it. Neither the unit tier
   * (which asserts roles and text) nor the token-contract test (which reads the
   * stylesheet) could see it; the component test comparing three computed
   * accent colours found all three identical.
   */
  const classes = toastRecipe({ type: toast.type });

  const remaining = useRef(toast.duration);

  useEffect(() => {
    // `loading` and anything given `Infinity` stay until something dismisses
    // them. Scheduling a timeout for Infinity is not merely pointless — the
    // value overflows a 32-bit delay and fires immediately, which would make
    // "stays until dismissed" mean "vanishes at once".
    if (paused || toast.dismissed || !Number.isFinite(remaining.current)) return;

    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);

    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, toast.dismissed, toast.id, onDismiss]);

  const glyph = icons[toast.type];

  return (
    <div
      // `status` rather than `alert`: polite, so it waits for a gap in whatever
      // the reader is already saying instead of cutting across it. An
      // interruption is right for a fire alarm and wrong for "Saved."
      //
      // `aria-atomic` makes the whole toast read as one message. Without it a
      // reader announces only the part of the subtree that changed, which for a
      // toast updated in place is a fragment with no context.
      role="status"
      aria-atomic="true"
      data-state={toast.dismissed ? "closed" : "open"}
      data-type={toast.type}
      className={classes.root}
    >
      {/*
        `aria-hidden` on the whole indicator, spinner included.

        The glyph is hidden because the toast's role has already told the reader
        what kind of message this is, and "check mark, Saved." is the same thing
        twice. The SPINNER is hidden for a sharper reason: `StyledSpinner`
        carries its own `role="status"`, so rendering it bare nests one live
        region inside another — the message is announced twice, and the outer
        `aria-atomic` no longer describes one coherent thing. What tells a
        reader the work is still going is the toast's own text ("Uploading…"),
        which is the part worth reading anyway.
      */}
      {(toast.type === "loading" || glyph != null) && (
        <div className={classes.indicator} aria-hidden="true">
          {toast.type === "loading" ? <StyledSpinner loadText="" /> : glyph}
        </div>
      )}

      <div className={classes.content}>
        {toast.title != null && (
          <StyledText className={classes.title}>{toast.title}</StyledText>
        )}
        {toast.description != null && (
          <StyledText className={classes.description}>
            {toast.description}
          </StyledText>
        )}
      </div>

      {toast.action && (
        <div className={classes.action}>
          <StyledButton
            onClick={() => {
              toast.action?.onClick();
              // A toast whose button has been pressed has done its job. Leaving
              // it up invites a second press on an action that has already run.
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </StyledButton>
        </div>
      )}

      {toast.closable && (
        <button
          type="button"
          aria-label={closeLabel}
          className={classes.close}
          onClick={() => onDismiss(toast.id)}
        >
          <span aria-hidden="true">{closeIcon}</span>
        </button>
      )}
    </div>
  );
}

export const StyledToaster: React.FC<StyledToasterProps> = ({
  toaster,
  icons,
  closeIcon = "✕",
  closeLabel = "Dismiss notification",
  regionLabel = "Notifications",
}) => {
  const toasts = useSyncExternalStore(
    toaster.subscribe,
    toaster.getSnapshot,
    toaster.getServerSnapshot,
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * Pointer or keyboard inside the region, and the tab being hidden, all stop
   * the clock. They are one boolean rather than three because the resume
   * condition is "none of them", and three independent flags is how a toast
   * ends up pinned forever by a hover the pointer left through a portal.
   */
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // A countdown that runs in a background tab is a message the user never had
    // the chance to read. Chakra's store called this `pauseOnPageIdle` and had
    // it on; this keeps that, without the option, because no consumer wanted
    // the other behaviour.
    const sync = () => setPageHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const paused = hovered || focused || pageHidden;

  // Stable identity so it is not a fresh dependency on every render of every
  // toast — each toast's timer effect lists it.
  const onDismiss = React.useCallback(
    (id: string) => toaster.remove(id),
    [toaster],
  );

  // Only the region slot is read here; every card resolves its own, above.
  const classes = toastRecipe();
  const resolvedIcons = icons ?? DEFAULT_ICONS;

  if (!mounted) return null;

  return createPortal(
    <div
      className={cx(classes.region)}
      // The region is present from mount and stays, whether or not it holds
      // anything. A live region created at the same moment as its content is
      // announced inconsistently across screen readers; one that was already
      // there is not.
      aria-label={regionLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        // Only when focus has actually left the region — moving between the
        // action and the close button inside one toast fires blur too, and
        // treating that as "focus left" would restart the countdown under the
        // keyboard user's hands.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      {/*
        Rendered oldest-last so the newest toast sits nearest the corner, which
        is where the eye already is. The store keeps them newest-first because
        that is the order its priority rules work in; the reversal is a
        presentation decision and belongs here.
      */}
      {[...toasts].reverse().map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          paused={paused}
          onDismiss={onDismiss}
          icons={resolvedIcons}
          closeIcon={closeIcon}
          closeLabel={closeLabel}
        />
      ))}
    </div>,
    document.body,
  );
};

export default StyledToaster;

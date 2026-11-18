"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
 *
 * ## The host decides whether anything times out (0.46.0, NEH-2262)
 *
 * Before 0.46.0 every toast expired on a per-type clock the reader could not
 * see or change. For an audience that reads slowly that is a message that may
 * vanish half-read. `autoDismiss` hands the decision to the host — which
 * usually means to the reader, through a setting — and with it off, nothing
 * leaves the screen until the reader dismisses it. A `collapseAfterMs` keeps
 * such a stack from sitting over the page forever: left alone, it folds to one
 * line that says how many are waiting.
 */
export interface AutoDismissPolicy {
  /** `false`: no toast expires on its own. `true`: every toast expires after `afterMs`. */
  enabled: boolean;
  /** Milliseconds on screen when `enabled`. Counted only while the page is visible and the pointer and focus are outside the region. */
  afterMs: number;
}

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
   * The close control's accessible name. It must CONTAIN `closeText` — WCAG
   * 2.5.3 Label in Name — which the defaults ("Dismiss notification" and
   * "Dismiss") satisfy. A host translating one translates both.
   */
  closeLabel?: string;
  /**
   * The word rendered beside the glyph on every close control (0.46.0,
   * NEH-2262). An icon alone assumes the reader already knows what it means,
   * which is the assumption an elderly or cognitively impaired reader least
   * satisfies; a word costs one short label. `null` renders the glyph alone.
   */
  closeText?: string | null;
  /**
   * The label of the control that dismisses every toast at once. Shown when
   * two or more are up: five persistent cards are five precise taps for a
   * reader with limited fine motor control, and one target is the remedy.
   * `null` removes the control.
   */
  dismissAllLabel?: string | null;
  /**
   * Where focus goes after a keyboard dismissal empties the region and the
   * element focus came from no longer exists: the first element matching this
   * selector, typically the page's main landmark. Focus must land somewhere a
   * reader can see (WCAG 2.4.3, 2.4.7); `<body>` is nowhere.
   */
  returnFocusSelector?: string;
  /**
   * Names the region for a screen reader listing landmarks.
   *
   * Not the toasts themselves — those announce individually as they arrive.
   */
  regionLabel?: string;
  /**
   * Whether toasts time out, and after how long. **Omit it and every toast
   * keeps the duration the store gave it** (the per-type defaults, or the
   * call site's own) — the behaviour every consumer had before 0.46.0.
   *
   * When supplied it overrides every per-toast duration: `enabled: false`
   * pins every toast until it is dismissed; `enabled: true` gives every toast
   * `afterMs`. A `loading` toast stays until something updates it either
   * way, and takes the policy's duration from that update.
   */
  autoDismiss?: AutoDismissPolicy | undefined;
  /**
   * After this many milliseconds with no new toast and no pointer, touch or
   * keyboard inside the region, the cards fold into one line — the
   * `foldLabel` — which unfolds them when activated. A new toast unfolds the
   * stack too, because new information must be seen (WCAG 4.1.3). Folding
   * dismisses nothing and stops no clock; it is presentation only.
   *
   * Omit it and the stack never folds — the behaviour before 0.46.0.
   */
  collapseAfterMs?: number | undefined;
  /**
   * The text of the folded line. The count is the number of toasts a reader
   * can still act on. The default is sentence case, as every consumer's copy
   * rule asks.
   */
  foldLabel?: (count: number) => string;
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

const defaultFoldLabel = (count: number): string => `Notifications (${count})`;

/**
 * The landmark a keyboard reader is returned to when nothing better is known.
 * Tried in order; the first match that can take focus wins. A `main` with no
 * `tabindex` is made focusable for the moment, the way skip links do it.
 */
const DEFAULT_RETURN_FOCUS = "main, [role='main']";

function focusFallback(selector: string): boolean {
  if (typeof document === "undefined") return false;
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return false;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
  return true;
}

/**
 * How long this toast stays, once the host's policy has had its say.
 *
 * `loading` is `Infinity` under every policy: it means "something is still
 * happening", and no clock should decide otherwise. With no policy the store's
 * number stands. With one, the policy replaces it wholesale — a call site's
 * `duration: 2000` must not sneak a confirmation past a reader who turned
 * timing off.
 */
export function effectiveDuration(toast: Toast, policy: AutoDismissPolicy | undefined): number {
  if (toast.type === "loading") return Infinity;
  if (policy === undefined) return toast.duration;
  return policy.enabled ? policy.afterMs : Infinity;
}

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
  duration,
  paused,
  hidden,
  onDismiss,
  icons,
  closeIcon,
  closeLabel,
  closeText,
}: {
  toast: Toast;
  /** Already resolved through the policy; see `effectiveDuration`. */
  duration: number;
  paused: boolean;
  /** Folded away. The card stays mounted so its clock keeps running. */
  hidden: boolean;
  onDismiss: (id: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
  icons: Partial<Record<ToastType, React.ReactNode>>;
  closeIcon: React.ReactNode;
  closeLabel: string;
  closeText: string | null;
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

  /**
   * What is left of the countdown, in ms. Reset whenever the duration itself
   * changes — a `loading` toast updated in place to `success`, or the host
   * flipping its policy — so the new clock starts from its full length. The
   * first version seeded this once at mount, so an "Uploading…" updated to
   * "Uploaded." kept its `Infinity` and never left, whatever the store said
   * its new duration was.
   */
  const remaining = useRef(duration);
  const lastDuration = useRef(duration);
  if (lastDuration.current !== duration) {
    lastDuration.current = duration;
    remaining.current = duration;
  }

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
  }, [paused, toast.dismissed, toast.id, onDismiss, duration]);

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
      data-toast-id={toast.id}
      // The HTML attribute, so a folded card leaves the accessibility tree and
      // the tab order as well as the screen. The recipe's `display: flex` would
      // otherwise beat the attribute's user-agent `display: none`; the recipe
      // states `&[hidden]` for exactly that.
      hidden={hidden}
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
          data-toast-close=""
          onClick={(event) => onDismiss(toast.id, event)}
        >
          <span aria-hidden="true">{closeIcon}</span>
          {closeText !== null && <span className={classes.closeText}>{closeText}</span>}
        </button>
      )}
    </div>
  );
}

// Layout effect on the client, so the scroll lands before the frame paints;
// plain effect on the server, where a layout effect only produces a warning.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const StyledToaster: React.FC<StyledToasterProps> = ({
  toaster,
  icons,
  closeIcon = "✕",
  closeLabel = "Dismiss notification",
  closeText = "Dismiss",
  dismissAllLabel = "Dismiss all",
  returnFocusSelector = DEFAULT_RETURN_FOCUS,
  regionLabel = "Notifications",
  autoDismiss,
  collapseAfterMs,
  foldLabel = defaultFoldLabel,
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

  const regionRef = useRef<HTMLDivElement>(null);

  /**
   * Where focus was before it came into the region. A keyboard dismissal of
   * the last card has nowhere inside the region to go, and leaving focus on
   * a removed element drops it to `<body>` — the reader is nowhere, with no
   * ring (WCAG 2.4.3). Recorded on the way in, used on the way out.
   */
  const focusBeforeRegion = useRef<HTMLElement | null>(null);

  const live = toasts.filter((toast) => !toast.dismissed);

  /**
   * Dismiss, and when it was the keyboard that asked, put focus somewhere
   * visible: the close control of the newest remaining card, else wherever
   * focus came from. A pointer dismissal moves nothing — the pointer is
   * already somewhere.
   *
   * A click fired from Enter or Space on a button reports `detail === 0`; a
   * real pointer click reports the click count. That is the whole of the
   * keyboard test, and it is why the handler takes the event.
   */
  const onDismiss = useCallback(
    (id: string, event?: React.MouseEvent<HTMLButtonElement>) => {
      const fromKeyboard = event !== undefined && event.detail === 0;
      const next = fromKeyboard
        ? toaster.getSnapshot().find((toast) => toast.id !== id && !toast.dismissed)
        : undefined;

      toaster.remove(id);

      if (!fromKeyboard) return;
      const region = regionRef.current;
      const target =
        next && region
          ? region.querySelector<HTMLElement>(
              `[data-toast-id="${next.id}"] [data-toast-close]`,
            )
          : null;
      if (target) {
        target.focus();
        return;
      }
      const prior = focusBeforeRegion.current;
      if (prior && prior.isConnected) {
        prior.focus();
        return;
      }
      if (!focusFallback(returnFocusSelector) && typeof document !== "undefined") {
        // Nowhere better. Blurring the removed control rather than leaving it
        // with a focus that no longer exists.
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    },
    [toaster, returnFocusSelector],
  );

  /**
   * Every card at once. Through the store's own "dismiss everything", which
   * animates them out together; a keyboard reader is then returned to where
   * they came from, as for the last single dismissal.
   */
  const onDismissAll = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const fromKeyboard = event.detail === 0;
      toaster.remove();
      if (!fromKeyboard) return;
      const prior = focusBeforeRegion.current;
      if (prior && prior.isConnected) prior.focus();
      else focusFallback(returnFocusSelector);
    },
    [toaster, returnFocusSelector],
  );

  /**
   * Folding. A stack nobody is touching folds after `collapseAfterMs` into one
   * line; a new toast or an activation of that line unfolds it. `interacted`
   * is a counter rather than a timestamp so that every interaction restarts
   * the effect below — which is what restarts the clock.
   */
  const [folded, setFolded] = useState(false);
  const [interacted, setInteracted] = useState(0);
  const touch = useCallback(() => setInteracted((n) => n + 1), []);

  const newestId = toasts[0]?.id;
  const liveCount = live.length;

  useEffect(() => {
    // A new toast unfolds the stack: new information has to be seen.
    setFolded(false);
  }, [newestId]);

  useEffect(() => {
    if (collapseAfterMs === undefined || !Number.isFinite(collapseAfterMs)) return;
    // Not while the tab is hidden: a laptop closed on an unfolded stack must
    // open on the same unfolded stack, not on a line that folded the instant
    // the overdue timer fired. The clock restarts in full when the page comes
    // back, which errs toward showing.
    if (folded || liveCount === 0 || hovered || focused || pageHidden) return;
    const timer = setTimeout(() => setFolded(true), collapseAfterMs);
    return () => clearTimeout(timer);
  }, [collapseAfterMs, folded, liveCount, hovered, focused, pageHidden, interacted, newestId]);

  // Nothing left to show: the next arrival starts unfolded.
  useEffect(() => {
    if (liveCount === 0) setFolded(false);
  }, [liveCount]);

  const foldRef = useRef<HTMLButtonElement>(null);
  const unfold = () => {
    setFolded(false);
    touch();
  };

  /**
   * The region is height-capped and scrolls (the recipe's `maxHeight`). A
   * scroll container opens at its TOP, which here is the OLDEST toast, so a
   * fresh one would land out of sight below the fold. When a toast arrives,
   * scroll to the end, where the newest sits.
   *
   * Keyed on the NEWEST toast's id, not on the count: a toast arriving in the
   * same update as another is dismissed leaves the count unchanged. And only
   * on an arrival, so a reader who has scrolled up to an older message is not
   * yanked back when one is dismissed. The store keeps them newest-first.
   */
  const newestShown = useRef<string | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    const region = regionRef.current;
    // Nothing is rendered until `mounted`, so there is nothing to scroll yet.
    if (!region) return;
    if (newestId !== undefined && newestId !== newestShown.current) {
      // The newest CARD's bottom edge, not the region's end: "Dismiss all"
      // sits after the newest card (0.46.0), and scrolling to the very end
      // would push that card up out of view behind the control meant to
      // clear it. The region is `position: fixed`, so it is the cards'
      // offset parent and `offsetTop` is relative to it.
      const card = region.querySelector<HTMLElement>(`[data-toast-id="${newestId}"]`);
      region.scrollTop = card
        ? Math.max(0, card.offsetTop + card.offsetHeight - region.clientHeight)
        : region.scrollHeight;
    }
    newestShown.current = newestId;
  }, [newestId, mounted]);

  // Only the region slot is read here; every card resolves its own, above.
  const classes = toastRecipe();
  const resolvedIcons = icons ?? DEFAULT_ICONS;

  if (!mounted) return null;

  const showFold = folded && liveCount > 0;

  return createPortal(
    <div
      ref={regionRef}
      className={cx(classes.region)}
      // The region is present from mount and stays, whether or not it holds
      // anything. A live region created at the same moment as its content is
      // announced inconsistently across screen readers; one that was already
      // there is not.
      aria-label={regionLabel}
      onMouseEnter={() => {
        setHovered(true);
        touch();
      }}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={touch}
      onKeyDown={touch}
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          // `<body>` is where focus sits when it is nowhere, and returning
          // there would be the 2.4.3 failure this ref exists to avoid — so
          // it is recorded as "nothing known" and the landmark fallback runs.
          const from = event.relatedTarget as HTMLElement | null;
          focusBeforeRegion.current =
            from && from !== document.body && from !== document.documentElement ? from : null;
        }
        setFocused(true);
        touch();
      }}
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
      {showFold && (
        <button
          ref={foldRef}
          type="button"
          className={classes.fold}
          data-toast-fold=""
          onClick={unfold}
        >
          {foldLabel(liveCount)}
        </button>
      )}
      {/*
        Rendered oldest-last so the newest toast sits nearest the corner, which
        is where the eye already is. The store keeps them newest-first because
        that is the order its priority rules work in; the reversal is a
        presentation decision and belongs here.

        Folded cards stay mounted, hidden: their countdowns keep running, and
        unfolding shows the same cards with the same time left.
      */}
      {[...toasts].reverse().map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          duration={effectiveDuration(toast, autoDismiss)}
          paused={paused}
          hidden={showFold}
          onDismiss={onDismiss}
          icons={resolvedIcons}
          closeIcon={closeIcon}
          closeLabel={closeLabel}
          closeText={closeText}
        />
      ))}
      {/*
        Nearest the corner, after the newest card: the corner is where the eye
        and the finger already are. Only with two or more cards — with one, the
        card's own control is the same action one target away.
      */}
      {!showFold && dismissAllLabel !== null && liveCount >= 2 && (
        <div className={classes.toolbar}>
          <StyledButton data-toast-dismiss-all="" onClick={onDismissAll}>
            {dismissAllLabel}
          </StyledButton>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default StyledToaster;

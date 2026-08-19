"use client";

import { log } from "../config/logger";
import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { styled } from "styled-system/jsx";
import StyledText from "./StyledText";
import type { AllowedVariant } from "../config/types";
import { tooltipRecipe } from "styled-system/recipes";
import { useCanHover } from "../config/can-hover";
import { useResolvedVariant } from "../config/style-config";

const TooltipTrigger = styled("div", {
  base: {
    display: "inline-block",
    position: "relative",
    cursor: "pointer",
  },
});

const TooltipContent = styled("div");

/**
 * The click-mode affordance.
 *
 * In click mode the tooltip cannot be opened by clicking the wrapper, because
 * the wrapper usually contains a button and that click belongs to the button.
 * So click mode renders this next to the child: a separate, visible, focusable
 * control whose only job is to reveal the explanation. The reader can see that
 * there is help, and where to press for it, without discovering that pressing
 * the thing itself does something else entirely.
 *
 * Deliberately not `StyledButton` — that imports this module, and a cycle
 * between two components that render each other is a module-init hazard for
 * every consumer. Layout only, no colours, per the package rule.
 */
const HelpTrigger = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // 48 rather than the WCAG 2.5.5 floor of 44: this component is used by
    // applications whose readers are frequently older, and a help control that
    // is hard to hit is a help control that does not get used.
    minWidth: "48px",
    minHeight: "48px",
    marginLeft: "4px",
    borderRadius: "9999px",
    borderWidth: "1px",
    borderStyle: "solid",
    cursor: "pointer",
    fontWeight: "bold",
    lineHeight: "1",
    verticalAlign: "middle",
  },
});

/**
 * Everything the browser already puts in the tab sequence, plus anything given
 * an explicit non-negative tabindex. Used to decide whether the trigger needs a
 * tab stop of its own, or whether the child already provides one.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

export interface StyledTooltipProps {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  delay?: number | undefined;
  placement?: "top" | "bottom" | "left" | "right" | undefined;
  boxBgAccent?: string | undefined; // theme color or fallback
  size?: string | undefined;
  "aria-label"?: string;
  variant?: AllowedVariant | undefined;
  style?: React.CSSProperties | undefined;
  /**
   * How the tooltip opens.
   *
   * `"hover"` (the default, and what an unset value means) preserves the
   * long-standing behaviour: reveal on hover or focus, hide on leave or blur.
   *
   * `"click"` renders a separate help control beside the child and opens only
   * when that control is pressed. Hover does nothing at all. This exists for
   * readers whose pointer drifts — a hover tooltip closes itself before they
   * arrive, and a hover tooltip they *are* reading vanishes when their hand
   * moves. Hosts typically wire this to a user preference rather than setting
   * it per call site.
   */
  trigger?: "hover" | "click" | undefined;
  /**
   * Accessible name for the click-mode help control. Defaults to
   * "More information". Give it something specific where the surrounding
   * context does not already make the subject obvious.
   */
  helpLabel?: string | undefined;
}

const StyledTooltip: React.FC<StyledTooltipProps> = ({
  tooltip,
  children,
  delay = 120,
  placement = "top",
  size = "md",
  "aria-label": ariaLabel,
  variant,
  trigger = "hover",
  helpLabel = "More information",
  ...rest
}) => {
  // Caller's variant, else the app-wide one, else `solid` — and anything the
  // tooltip recipe has no case for (`ghost`, `selected`, `link`, …) coerces to
  // `solid` rather than rendering an unstyled floating box. The original coerced
  // only `ghost` and `selected` by name; useResolvedVariant generalises that to
  // "any variant this recipe does not define", which is the rule that was meant.
  const finalVariant = useResolvedVariant(variant);
  log.trace("StyledTooltip rendered");
  const tooltipId = React.useId(); // <-- Move useId to top-level, before any returns or conditionals
  const [visible, setVisible] = useState(false);
  const [styles, setStyles] = useState({});

  // `ReturnType<typeof setTimeout>`, not `NodeJS.Timeout`: this is browser
  // code, and naming the NodeJS namespace makes the whole package fail to
  // typecheck for any consumer that has not installed @types/node. It also
  // happens to be wrong — in a browser this is a number, not a Timeout object.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLButtonElement>(null);
  /**
   * Schedule the open.
   *
   * **Clearing first is the whole of NEH-818.** `show()` runs from four
   * places — the trigger's mouseenter and focus, and the tooltip's own
   * mouseenter — and more than one of them fires for a single gesture: a press
   * both hovers and focuses the trigger, ~0ms apart. Assigning over
   * `timeoutRef.current` left the earlier timer running with nothing holding
   * its id, so `hide()` could cancel only the last one scheduled.
   *
   * The orphan then fired into a page the reader had already left, opening a
   * tooltip that no departure event could ever close — measured as a live,
   * opaque, click-eating overlay sitting over the dialog the press had just
   * opened, gone only on reload.
   *
   * One timer at a time; the id is nulled when it fires so `hide()` never
   * clears a stale one.
   *
   * Hoisted above the effects (and memoised) rather than declared beside the
   * JSX: the ancestor-focus effect added for NEH-950 has to bind these as
   * listeners, and a second copy of the timer discipline above is exactly how
   * NEH-818 would come back.
   */
  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setVisible(true);
    }, delay);
  }, [delay]);
  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setVisible(false);
  }, []);

  /**
   * A hover trigger on a device that cannot hover is not a worse experience —
   * it is an unreachable one. There is no hover event, and tapping the control
   * activates it rather than explaining it, so the help is rendered, correct
   * and impossible to see.
   *
   * So `hover` becomes `click` there, which renders the explicit control the
   * click path already has. This only ever changes cases that were broken:
   * `click` is unaffected, and a device that can hover is unaffected.
   */
  const canHover = useCanHover();
  const isClick = trigger === "click" || !canHover;

  // The child may be any component (StyledIconButton, a link, a bare span), so
  // whether it is focusable can only be known from the rendered DOM — React
  // cannot see inside a child component's output. Starts as "yes" so the common
  // case (an icon button) never renders a spurious tab stop, not even for the
  // one frame before this layout effect runs.
  const [focusableChild, setFocusableChild] = useState<HTMLElement | null>(null);
  const [hasFocusableChild, setHasFocusableChild] = useState(true);

  /**
   * The focusable element this trigger sits *inside*, if any (NEH-950).
   *
   * `hasFocusableChild` looks down and cannot see upwards, so it answers "no
   * focusable child" for an icon that is decorative content inside a control
   * that is already focusable and already named — and the trigger then took a
   * `tabIndex` of its own. The result was the exact failure the conditional
   * above exists to prevent, one level in: a second tab stop inside a button
   * the reader has already passed, carrying no role and no name because
   * `needsFallbackName` correctly declines to name it (the ancestor already
   * has). Every icon in `stonedog-icons` that carries its own tooltip
   * reproduced it, in every consumer.
   *
   * Deleting the `tabIndex` alone would have been a different WCAG failure
   * rather than a fix — the tooltip must stay reachable by keyboard (2.1.1).
   * So the ancestor becomes the trigger instead: it already owns the tab stop,
   * and the effect below opens the tooltip when it takes focus, exactly as a
   * focusable *child* already does by bubbling.
   *
   * Starts null, and the layout effect below can only ever find an ancestor
   * when there is no focusable child — the two are mutually exclusive by
   * construction, so nothing has to decide between them.
   */
  const [focusableAncestor, setFocusableAncestor] = useState<HTMLElement | null>(null);

  /**
   * True when something else — a descendant or an ancestor — already puts this
   * trigger's content in the tab sequence. When it does, the trigger must add
   * no stop of its own, and must not invent a role or a name for one.
   */
  const insideFocusable = hasFocusableChild || focusableAncestor !== null;

  // When the trigger KEEPS its tab stop it must have a role and a name (WCAG
  // 2.2 4.1.2) — but only if nothing else already provides one. Borrowing the
  // tooltip text unconditionally is what broke SharedWithIndicator, which names
  // an ANCESTOR: two elements then claimed the same label, with role="button"
  // nested inside role="img" (NEH-151).
  //
  // Defaults to false so the component never invents a name before it has
  // measured. Silence is the safe direction — a missing name is the status quo,
  // a duplicated one is a new bug.
  const [needsFallbackName, setNeedsFallbackName] = useState(false);

  useLayoutEffect(() => {
    const node = triggerRef.current;
    const found = node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
    // Same-value setState is a no-op in React, so this cannot loop.
    setFocusableChild((prev) => (prev === found ? prev : found));
    setHasFocusableChild(found !== null);

    // `parentElement.closest`, not `node.closest`: the trigger itself may be
    // carrying the very `tabindex` this is deciding whether to keep, and
    // matching ourselves would make the answer depend on the previous render.
    // Only asked when there is no focusable child, because a child already
    // settles the question and is the nearer trigger of the two.
    const ancestor = found
      ? null
      : node?.parentElement?.closest<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
    setFocusableAncestor((prev) => (prev === ancestor ? prev : ancestor));

    if (!node) return;
    // parentElement, not the node itself: closest() would match our own
    // aria-label once we set one, and the answer would flip every render.
    const namedByAncestor = Boolean(
      node.parentElement?.closest("[aria-label], [aria-labelledby]"),
    );
    // Text content names an element for free; so does a labelled descendant
    // (an icon carrying its own aria-label, an <img alt>).
    const namedByContent =
      (node.textContent ?? "").trim().length > 0 ||
      Boolean(
        node.querySelector('[aria-label], [aria-labelledby], img[alt]:not([alt=""])'),
      );
    setNeedsFallbackName(!namedByAncestor && !namedByContent);
  }, [children]);

  // aria-describedby has to sit on whatever actually receives focus, or a screen
  // reader announces the control with no description. Set imperatively rather
  // than by cloning the child: cloneElement would depend on every child
  // component forwarding the prop, and a child that quietly drops it would fail
  // invisibly.
  useLayoutEffect(() => {
    const node = focusableChild ?? focusableAncestor;
    if (!node || !visible) return;
    const previous = node.getAttribute("aria-describedby");
    node.setAttribute(
      "aria-describedby",
      previous ? `${previous} ${tooltipId}` : tooltipId,
    );
    return () => {
      if (previous === null) node.removeAttribute("aria-describedby");
      else node.setAttribute("aria-describedby", previous);
    };
  }, [focusableChild, focusableAncestor, visible, tooltipId]);

  /**
   * Open on the ANCESTOR's focus, when the trigger is inside one (NEH-950).
   *
   * A focusable *child* needs nothing here: `focusin`/`focusout` bubble, so the
   * wrapper's own `onFocus`/`onBlur` already fire for it. An ancestor is the
   * other direction, where nothing bubbles, so the listeners go on the ancestor
   * itself.
   *
   * Without this the fix would trade WCAG 2.2 4.1.2 (a focusable element with
   * no role and no name) for 2.1.1 — the explanation would be rendered and
   * reachable by pointer only. Hover mode only: click mode never took a tab
   * stop, so it has nothing to give back.
   */
  useEffect(() => {
    const node = focusableAncestor;
    if (isClick || !node) return;
    node.addEventListener("focusin", show);
    node.addEventListener("focusout", hide);
    return () => {
      node.removeEventListener("focusin", show);
      node.removeEventListener("focusout", hide);
    };
  }, [focusableAncestor, isClick, show, hide]);

  useLayoutEffect(() => {
    if (visible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const margin = 8;

      // Try placements in order of preference
      const placements = [placement, "top", "bottom", "left", "right"];

      let top = 0,
        left = 0;

      for (const tryPlacement of placements) {
        if (tryPlacement === "top") {
          top = triggerRect.top - tooltipRect.height - margin;
          left =
            triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          if (top >= 0) {

            break;
          }
        } else if (tryPlacement === "bottom") {
          top = triggerRect.bottom + margin;
          left =
            triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          if (top + tooltipRect.height <= window.innerHeight) {

            break;
          }
        } else if (tryPlacement === "left") {
          top =
            triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left - tooltipRect.width - margin;
          if (left >= 0) {

            break;
          }
        } else if (tryPlacement === "right") {
          top =
            triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + margin;
          if (left + tooltipRect.width <= window.innerWidth) {

            break;
          }
        }
      }

      // Clamp to viewport
      top = Math.max(
        margin,
        Math.min(top, window.innerHeight - tooltipRect.height - margin),
      );
      left = Math.max(
        margin,
        Math.min(left, window.innerWidth - tooltipRect.width - margin),
      );

      setStyles({ top, left });
    }
  }, [visible, placement]);

  // A pending open timer must not outlive the component. Nothing else clears
  // it on unmount, so a trigger removed inside the delay window fired
  // setVisible on a component React had already torn down.
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    },
    [],
  );

  // Click mode's dismissal. A panel opened by a deliberate press has to be
  // closable by a deliberate action — a press outside it, or Escape — or a
  // keyboard user is stuck with it open.
  useEffect(() => {
    if (!isClick || !visible || typeof document === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setVisible(false);
      // Focus goes back to what opened it — never to the top of the document.
      // Hover mode has no equivalent, because nothing was focused to open it.
      helpRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // A press inside the tooltip is not a dismissal: the explanation may
      // contain a link, and text worth selecting.
      if (helpRef.current?.contains(target) || tooltipRef.current?.contains(target)) return;
      setVisible(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isClick, visible]);

  /**
   * Hover mode's dismissal, which used to be nothing at all (NEH-818).
   *
   * `hide()` is reachable only from the trigger's own `onMouseLeave` /
   * `onBlur`, so an open tooltip whose trigger never receives another
   * departure event stays on the page for the life of the document — opaque,
   * taking pointer events, over whatever opened on top of it. That is not a
   * hypothetical ordering: a press both focuses the trigger and covers it, so
   * blur cannot fire (focus stays put) and mouseleave has already been and
   * gone.
   *
   * These two listeners are on `document`, so neither depends on the trigger
   * being reachable — which is the property the trigger's own handlers lack.
   *
   * - **`pointermove`** closes it once the pointer is over neither the trigger
   *   nor the tooltip. It deliberately does not fire on the tooltip itself:
   *   WCAG 2.2 1.4.13 *Hoverable* requires the reader be able to move onto the
   *   revealed text without it vanishing, which is also why the portal keeps
   *   `pointer-events: auto`.
   * - **Escape** satisfies 1.4.13 *Dismissible*, which hover mode did not meet
   *   before: content revealed on hover or focus must be dismissable without
   *   moving the pointer or focus, and a reader whose pointer is parked had no
   *   way to clear it.
   *
   * Bound only while a hover tooltip is actually open, so the common case
   * costs nothing.
   */
  useEffect(() => {
    if (isClick || !visible || typeof document === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // No focus move: in hover mode nothing was focused to open this, and
      // stealing focus on Escape would be its own bug.
      setVisible(false);
    };
    const onPointerMove = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || tooltipRef.current?.contains(target)) return;
      // A tooltip revealed by FOCUS belongs to the focus, not to the pointer.
      // WCAG 2.2 1.4.13 Persistent requires it to stay until its trigger is
      // released, so taking it away because an unrelated mouse moved would
      // trade one conformance failure for another — and would do it to a
      // keyboard reader who never touched the mouse. Escape above is their
      // dismissal.
      if (
        document.activeElement &&
        triggerRef.current?.contains(document.activeElement)
      ) {
        return;
      }
      setVisible(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointermove", onPointerMove);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, [isClick, visible]);

  if (!tooltip) {
    return <>{children}</>;
  }

  // Only a string tooltip can serve as a name — stringifying a React element
  // would produce "[object Object]" in the accessibility tree.
  const tooltipLabel = typeof tooltip === "string" ? tooltip : undefined;


  return (
    <>
      <TooltipTrigger
        ref={triggerRef}
        // When the child is focusable it already owns the tab stop, and
        // onFocus/onBlur use bubbling focusin/focusout semantics, so the
        // tooltip still fires without the wrapper taking focus itself. Adding
        // tabIndex here regardless is what gave every tooltipped control two
        // tab stops, the second of them silent (NEH-127).
        //
        // `insideFocusable`, not `hasFocusableChild`: an ANCESTOR owns the tab
        // stop just as effectively as a descendant, and looking only downwards
        // put the same silent second stop inside every icon button in the
        // fleet (NEH-950). The ancestor-focus effect above is what keeps the
        // tooltip reachable once the trigger stops taking focus itself.
        tabIndex={isClick || insideFocusable ? undefined : 0}
        // A focusable element needs a role and a name (WCAG 2.2 4.1.2). Applied
        // only when the trigger keeps the tab stop AND nothing else names it —
        // see needsFallbackName above for why the condition matters (NEH-151).
        //
        // role="button" rather than no role: the trigger is focusable and
        // reveals content on focus, which is the closest standard role and what
        // the ARIA tooltip pattern assumes of a trigger. A focusable generic
        // with only a name still fails 4.1.2, which asks for both.
        role={!isClick && !insideFocusable && needsFallbackName ? "button" : undefined}
        aria-label={
          isClick || insideFocusable
            ? undefined
            : ariaLabel ?? (needsFallbackName ? tooltipLabel : undefined)
        }
        // Hover handlers exist only in hover mode. In click mode a drifting
        // pointer must change nothing at all — that is the entire point.
        onMouseEnter={isClick ? undefined : show}
        onMouseLeave={isClick ? undefined : hide}
        onFocus={isClick ? undefined : show}
        onBlur={isClick ? undefined : hide}
        aria-describedby={
          !isClick && !insideFocusable && visible ? tooltipId : undefined
        }
        {...rest}
      >
        {children}
        {isClick && (
          <HelpTrigger
            ref={helpRef}
            type="button"
            aria-label={helpLabel}
            aria-expanded={visible}
            aria-controls={visible ? tooltipId : undefined}
            onClick={() => setVisible((open) => !open)}
          >
            ?
          </HelpTrigger>
        )}
      </TooltipTrigger>
      {visible && typeof document !== "undefined" &&
        createPortal(
          <TooltipContent
            id={tooltipId}
            role="tooltip"
            ref={tooltipRef}
            pt={3}
            pl={8}
            pb={3}
            pr={8}
            className={tooltipRecipe({
              variant: finalVariant,
            })}
            style={{
              ...styles,
              position: "fixed",
              opacity: 1,
              pointerEvents: "auto",
              zIndex: 200000,
            }}
            onMouseEnter={isClick ? undefined : show}
            onMouseLeave={isClick ? undefined : hide}
          >
            <StyledText size={size}>{tooltip}</StyledText>
          </TooltipContent>,
          document.body,
        )
      }
    </>
  );
};

export default StyledTooltip;

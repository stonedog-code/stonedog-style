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
    borderRadius: "9999px",
    borderWidth: "1px",
    borderStyle: "solid",
    cursor: "pointer",
    fontWeight: "bold",
    lineHeight: "1",
    verticalAlign: "middle",
  },
  variants: {
    // Which side of the children the control sits on — see helpGoesFirst
    // below for how that is decided. The gap has to follow the side, or the
    // control touches its subject on one side and floats away from it on the
    // other, which is exactly the ambiguity this fix is about.
    side: {
      before: { marginRight: "4px" },
      after: { marginLeft: "4px" },
    },
  },
  defaultVariants: { side: "after" },
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
  helpLabel,
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
   * Whether the layout effect below has yet decided WHERE the click-mode help
   * control belongs (NEH-965).
   *
   * The control is a real `<button>`, and until the trigger has been measured
   * the component cannot know whether it is standing inside one. Rendering it
   * optimistically and moving it afterwards is not an option: React validates
   * DOM nesting at *render* time, against the React tree, so a single pass
   * with `<button>` inside `<button>` warns and — on a server-rendered host
   * like hopper-web — produces a hydration error, whatever the DOM ends up
   * looking like a moment later.
   *
   * So the first pass renders no control at all and the second one puts it
   * where it belongs. Both effects here are layout effects, so that settles
   * before paint and before hydration compares anything: there is no frame in
   * which a reader could see the control missing, and no server/client
   * mismatch, because the server also renders nothing.
   */
  const [helpPlacementSettled, setHelpPlacementSettled] = useState(false);

  /**
   * The element the click-mode help control is rendered into when the trigger
   * sits inside something focusable (NEH-965).
   *
   * `HelpTrigger` renders beside the child, inside the trigger wrapper. When
   * the tooltipped thing is an icon inside an icon button that lands the
   * control *inside* that button:
   *
   *     <button aria-label="Expand">   <- the consumer's control
   *       <div>                        <- TooltipTrigger
   *         <svg aria-hidden />
   *         <button aria-label="More information">?</button>   <- invalid
   *
   * `<button>` cannot be a descendant of `<button>`, and this is not a
   * preference anybody opted into: `isClick` is `trigger === "click" ||
   * !canHover`, so it is the DEFAULT rendering on every phone and tablet.
   *
   * Simply not rendering the control would trade invalid HTML for an
   * unreachable explanation — on a device that cannot hover there is no hover,
   * and tapping the button activates it rather than explaining it. So the
   * control moves *out* instead: a span inserted immediately after the
   * focusable ancestor, portalled into. Valid HTML, still visible, still
   * tappable, still in the tab sequence, and it scrolls with the page because
   * it sits in normal flow rather than being positioned over anything.
   *
   * `inline-flex` on the host rather than `display: contents`: contents would
   * let the control participate in the ancestor's parent layout directly, but
   * it was removed from the accessibility tree by browsers this package's
   * audience is still using, and an invisible help control is the bug we are
   * fixing.
   */
  const [helpHost, setHelpHost] = useState<HTMLElement | null>(null);

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

  /**
   * The child's own visible text, used to name the help control after the
   * thing it explains (NEH-769).
   *
   * A screen carrying twenty tooltips carried twenty buttons all called "More
   * information", which names nothing: a reader tabbing through hears the same
   * four words twenty times and cannot tell which one answers their question.
   * "Help: Require PIN" is the same control with a name that distinguishes it.
   *
   * Measured from the DOM rather than read from `children` because the child
   * may be any component — React cannot see the text inside a child component's
   * output, only the element it was handed.
   */
  const [subjectLabel, setSubjectLabel] = useState("");

  useLayoutEffect(() => {
    const node = triggerRef.current;
    const help = helpRef.current;

    // The help control is itself a `button`, so it matches FOCUSABLE_SELECTOR
    // and must be excluded from every question asked about the CHILD. This was
    // already wrong before the control could be rendered first — with a
    // non-focusable child the query returned the help button, so
    // aria-describedby landed on the button that already names itself instead
    // of on the thing being described. Once the control renders first it would
    // have matched every time (NEH-769).
    const found =
      Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).find(
        (candidate) => candidate !== help,
      ) ?? null;
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
    // Measured — the next render may place the help control (NEH-965). Set
    // before the `!node` bail so a trigger that never mounted a node does not
    // leave click mode permanently without its control.
    setHelpPlacementSettled(true);

    if (!node) return;

    // The child's own text — the help control's "?" deliberately excluded, or
    // every subject would be named "… ?" and a text-free child would look as
    // though it had text.
    const ownText = Array.from(node.childNodes)
      .filter((child) => child !== help)
      .map((child) => child.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    // With a focusable ancestor the help control is rendered OUTSIDE it
    // (NEH-965), so the ancestor no longer supplies context by containment and
    // the control has to carry the subject in its own name. "More information"
    // sitting on its own next to a button called "Expand" names nothing —
    // which is the twenty-identical-controls problem NEH-769 fixed for the
    // inline case, reappearing one level up.
    const ancestorText = ancestor
      ? (ancestor.getAttribute("aria-label") ?? ancestor.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    const subject = ownText || ancestorText;
    // Long enough to distinguish twenty controls, short enough that a screen
    // reader does not read a paragraph before the reader can act on it.
    setSubjectLabel(subject.length > 80 ? `${subject.slice(0, 80).trimEnd()}…` : subject);

    // parentElement, not the node itself: closest() would match our own
    // aria-label once we set one, and the answer would flip every render.
    const namedByAncestor = Boolean(
      node.parentElement?.closest("[aria-label], [aria-labelledby]"),
    );
    // Text content names an element for free; so does a labelled descendant
    // (an icon carrying its own aria-label, an <img alt>).
    const namedByContent =
      ownText.length > 0 ||
      Array.from(
        node.querySelectorAll('[aria-label], [aria-labelledby], img[alt]:not([alt=""])'),
      ).some((el) => el !== help);
    setNeedsFallbackName(!namedByAncestor && !namedByContent);
  }, [children, isClick]);

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

  /**
   * Insert the host for the portalled help control, immediately after the
   * focusable ancestor (NEH-965). A layout effect, so the control is in place
   * before paint.
   */
  useLayoutEffect(() => {
    if (!isClick || !focusableAncestor || typeof document === "undefined") {
      setHelpHost(null);
      return;
    }
    const host = document.createElement("span");
    // Named so a consumer reading the DOM can see whose node this is, and so a
    // test can assert the control landed outside the ancestor rather than
    // merely that it exists somewhere.
    host.setAttribute("data-stonedog-tooltip-help-host", "");
    host.style.display = "inline-flex";
    host.style.verticalAlign = "middle";
    focusableAncestor.after(host);
    setHelpHost(host);
    return () => {
      host.remove();
      setHelpHost(null);
    };
  }, [isClick, focusableAncestor]);

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

  /**
   * `Label → ? → Input` — the help control goes after the label and before the
   * control it explains, never after it (NEH-769).
   *
   * Not aesthetic. A screen-magnifier user reads linearly at high zoom, so a
   * `?` placed after a long input is pushed off the visible viewport entirely;
   * before the control, the reader meets the concept, can ask what it means,
   * and only then enters data.
   *
   * Consumers wrap two shapes and both have to obey that rule, which is why
   * neither a fixed "always before" nor a fixed "always after" is right:
   *
   *   `<Tooltip><Label/></Tooltip> <Input/>`      the input is OUTSIDE us, so
   *                                               the control goes AFTER  →  Label ? | Input
   *   `<Tooltip><Row><Label/><Toggle/></Row></Tooltip>`
   *                                               the control is INSIDE us, so
   *                                               it goes BEFORE          →  ? Label Toggle
   *
   * So the side keys on whether the children contain something focusable —
   * which the component already measures for its own tab-stop logic. It is
   * measured in a layout effect, so it settles before paint rather than
   * flickering into place.
   */
  const helpGoesFirst = hasFocusableChild;

  /**
   * Explicit label wins; otherwise name the control after its subject. Only
   * when there is no text at all does it fall back to the old generic name.
   */
  const resolvedHelpLabel =
    helpLabel ?? (subjectLabel ? `Help: ${subjectLabel}` : "More information");

  /**
   * The click-mode control — rendered only once its home is known, see
   * `helpPlacementSettled`.
   *
   * `stopPropagation` is load-bearing rather than defensive. A React portal
   * bubbles its events through the REACT tree, not the DOM tree, so once this
   * control is portalled out of the icon button it is still, as far as React
   * is concerned, inside it — and a press on "?" would fire the button's own
   * `onClick`. That is precisely the collision this fix exists to remove, so
   * it is stopped for the inline case too: pressing "?" asks for an
   * explanation, and must never also do the thing being explained.
   */
  const helpControl =
    isClick && helpPlacementSettled ? (
      <HelpTrigger
        ref={helpRef}
        type="button"
        side={helpGoesFirst ? "before" : "after"}
        aria-label={resolvedHelpLabel}
        aria-expanded={visible}
        aria-controls={visible ? tooltipId : undefined}
        onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          setVisible((open) => !open);
        }}
      >
        ?
      </HelpTrigger>
    ) : null;

  // Inside a focusable ancestor the control is portalled out to `helpHost`;
  // everywhere else it stays where it has always been, beside the child.
  const inlineHelpControl = focusableAncestor ? null : helpControl;

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
        // When something focusable is in play the description is set
        // imperatively on THAT element instead (see the layout effect above) —
        // it has to sit on whatever actually receives focus. This wrapper is
        // the fallback for label-only children, and it applies in click mode
        // too: help that is reachable but never announced is help a screen
        // reader user does not know exists (NEH-769).
        //
        // `insideFocusable`, not `hasFocusableChild`, so a focusable ANCESTOR
        // still owns the description rather than this wrapper (NEH-950).
        aria-describedby={!insideFocusable && visible ? tooltipId : undefined}
        {...rest}
      >
        {helpGoesFirst && inlineHelpControl}
        {children}
        {!helpGoesFirst && inlineHelpControl}
      </TooltipTrigger>
      {helpControl && helpHost && createPortal(helpControl, helpHost)}
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

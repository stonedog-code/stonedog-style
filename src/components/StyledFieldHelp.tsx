"use client";

import React, { useEffect, useRef } from "react";
import { styled } from "styled-system/jsx";
import type { HTMLStyledProps } from "styled-system/types";
import { log } from "../config/logger";
import { useFontSizeProfile } from "../config/style-config";
import { fontSizeMap, stepDownFontSize } from "../config/font-size";

/**
 * Permanent help text for a form control: below the label, above the control,
 * always visible, never interactive.
 *
 * ```tsx
 * <StyledFormLabel htmlFor="dose">Dose</StyledFormLabel>
 * <StyledFieldHelp htmlFor="dose">
 *   Milligrams per tablet, as printed on the bottle.
 * </StyledFieldHelp>
 * <StyledInputText id="dose" />
 * ```
 *
 * ## Why this exists rather than another tooltip (PRD-0037, NEH-972)
 *
 * The pattern this replaces is `StyledTooltip` plus its `HelpTrigger`, and the
 * problem with it is not placement — NEH-769 fixed the placement and the
 * pattern was still wrong. Four things fail at once:
 *
 * - **Hover-only help excludes touch entirely**, and is actively hostile to a
 *   reader with a tremor: they open tooltips by accident and cannot reliably
 *   move a pointer *into* one before it closes.
 * - **`HelpTrigger` is a `<button>`, so every instance is a tab stop.** A
 *   screenshot of one production screen showed roughly twenty of them; ~160
 *   across the app. That roughly doubles keyboard traversal, and it cannot be
 *   fixed by taking them out of the tab order — a sighted keyboard user not
 *   running a screen reader would lose the help altogether. There is no fix
 *   for the tab-stop tax that keeps a per-control control.
 * - **Twenty identical glyphs are not twenty helps, they are noise.** Older
 *   readers have measurably low tolerance for hidden information behind an
 *   abstract icon, so the pattern penalised exactly the audience it was for.
 * - It needed a **preference** (`accessibility.clickForTooltips`) to be usable
 *   on a touch device, and a preference is a thing to get wrong.
 *
 * So this component has **no trigger, no state, no preference and no
 * interaction**. It is text. That is the entire design, and every constraint
 * below follows from it:
 *
 * - it adds **zero tab stops** — no `tabindex`, no focusable element, nothing
 *   Tab can land on;
 * - it needs **no pointer**, so it sidesteps WCAG 1.4.13 (Content on Hover or
 *   Focus) rather than trying to satisfy dismissible/hoverable/persistent;
 * - it is in the DOM from first paint, so a touch reader, a keyboard reader and
 *   a screen-reader user all get the same words with no gesture at all.
 *
 * ## It wires `aria-describedby` itself, and that is deliberate
 *
 * Text sitting near a control is not a description of it. Without
 * `aria-describedby` a screen reader announces "Dose, edit text" and the help
 * is stray prose somewhere else in the reading order — which is how a field
 * ends up *looking* explained and being unexplained.
 *
 * Two things make the association hard to get wrong, because this pattern is
 * about to be applied at well over a hundred call sites and the one that gets
 * skipped is the one nobody notices:
 *
 * 1. **The id is derived, not generated.** `fieldHelpId("dose")` is
 *    `"dose-help"` — deterministic from the control's own id, so both sides can
 *    name it without passing a generated value around, and it is stable across
 *    server and client render.
 * 2. **The component sets the attribute on the control** in an effect, merging
 *    with anything already there. A call site that forgets still gets the
 *    association.
 *
 * Set imperatively rather than by cloning the child, for the reason
 * `StyledTooltip` records: `cloneElement` depends on every child component
 * forwarding the prop, and a child that quietly drops it fails invisibly. It is
 * not a wrapper for the same reason — a wrapper would have to own the control's
 * markup, and this has to drop into a form whose markup already exists.
 *
 * `useEffect` rather than `useLayoutEffect`: nothing here affects layout, and
 * the accessibility tree is read after hydration. A host may still write
 * `aria-describedby={fieldHelpId("dose")}` on the control itself if it wants
 * the association present in server-rendered HTML; the effect sees it is
 * already there and leaves it alone.
 *
 * ## Size and colour
 *
 * **One tier below the app-wide text size, never below `xs`.** The size is an
 * inline style rather than a Panda prop because Panda extracts styles by
 * parsing source at BUILD time: a prop whose value is only known at runtime
 * yields a class name with no rule behind it, and nothing errors.
 * `StyledFormLabel` and `StyledText` reach for an inline style for exactly this
 * reason. Reading the profile also matters — plain inheritance would pin the
 * help to whatever the browser default is, which in a product whose body text
 * is 1.375rem makes the help less than two-thirds the size of the text it
 * explains.
 *
 * **Colour is `textMuted`**, the emphasis axis, which resolves relative to
 * `currentColor` — so it de-emphasises against the surface it is actually on,
 * light theme or dark, rather than picking a grey that is right on one of them.
 * `StyledFieldHelp.contrast.ct.tsx` measures the rendered result against the
 * **composited** background — every ancestor layer, not the page — and asserts
 * WCAG 1.4.3 AA. Measuring against the page background is how a confidently
 * wrong pass gets produced for text that sits on a tinted chip.
 *
 * The size step and the colour step are two signals, not one, so the help still
 * reads as secondary for anyone who cannot see the colour difference.
 */

const PandaFieldHelp = styled("p", {
  base: {
    display: "block",
    // Longhands, never the `margin` shorthand. Panda emits atomic rules, and a
    // shorthand competing with a longhand for the same box is decided by
    // stylesheet order rather than by what was written.
    marginTop: "0",
    marginInline: "0",
    // The gap before the control. `StyledFormLabel` supplies the gap above.
    marginBottom: "0.5rem",
    color: "textMuted",
    // Prose, and prose that is being read carefully — a little more leading
    // than the label above it.
    lineHeight: "1.4",
    fontWeight: "normal",
    // No `fontSize`: it is resolved at runtime from the profile. See above.
  },
});

/**
 * The `id` this component gives its help text, derived from the control's id.
 *
 * Exported so a call site can put the association in server-rendered HTML —
 * `aria-describedby={fieldHelpId("dose")}` — and so a test can name the element
 * without reaching into the DOM for it. Deterministic on purpose: a generated
 * id (`useId`) cannot be named by the other half of the pair without threading
 * a value between two siblings, and threading is what gets skipped.
 */
export function fieldHelpId(controlId: string): string {
  return `${controlId}-help`;
}

/** Split an `aria-describedby` attribute into its id tokens. */
function idTokens(value: string | null): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : [];
}

export interface StyledFieldHelpProps
  extends Omit<HTMLStyledProps<"p">, "children"> {
  /**
   * The `id` of the control this describes.
   *
   * Required, and it is the whole point: without it this is prose near a
   * control rather than the control's description. Named `htmlFor` to match
   * `StyledFormLabel`, so the pair reads the same at a call site.
   */
  htmlFor: string;
  /**
   * The help itself. **Text.** Anything focusable put in here defeats the one
   * guarantee this component makes, so it is typed as `ReactNode` for
   * formatting (`<strong>`, a unit, a line break) rather than for controls.
   */
  children: React.ReactNode;
  /** Override the derived id. Rarely wanted — see `fieldHelpId`. */
  id?: string;
}

const StyledFieldHelp: React.FC<StyledFieldHelpProps> = ({
  htmlFor,
  children,
  id,
  style,
  fontSize,
  ...props
}) => {
  // Unconditional and at the top: folding this into the expression below reads
  // fine and is a hooks-order violation the moment `fontSize` is passed.
  const profile = useFontSizeProfile();
  const ref = useRef<HTMLParagraphElement | null>(null);

  const helpId = id ?? fieldHelpId(htmlFor);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // The element's own document, not the global one: a component test mounts
    // inside an iframe, and a host may portal into another window.
    const control = node.ownerDocument.getElementById(htmlFor);
    if (!control) {
      // Not thrown. A missing control is a call-site bug, but the help text is
      // still readable on screen and throwing would take the whole form down
      // over an attribute. The host hears about it through its own logger.
      log.warn(
        "StyledFieldHelp: no element has this id, so the help is not announced as the field's description",
        { htmlFor, helpId },
      );
      return;
    }

    const tokens = idTokens(control.getAttribute("aria-describedby"));
    // Already named — the call site wired it statically. Leave it be, or the
    // id lands twice and a screen reader reads the description twice.
    if (tokens.includes(helpId)) return;

    control.setAttribute("aria-describedby", [...tokens, helpId].join(" "));

    return () => {
      // Read the attribute again rather than restoring the value captured
      // above. Something else may have added its own id in the meantime — an
      // error summary is the obvious one — and restoring a stale string would
      // silently drop it.
      const remaining = idTokens(
        control.getAttribute("aria-describedby"),
      ).filter((token) => token !== helpId);
      if (remaining.length > 0) {
        control.setAttribute("aria-describedby", remaining.join(" "));
      } else {
        control.removeAttribute("aria-describedby");
      }
    };
  }, [htmlFor, helpId]);

  // Applied only when the caller named no size, so their Panda `fontSize` class
  // is not beaten by an inline declaration.
  const sized = fontSize
    ? undefined
    : fontSizeMap[stepDownFontSize(profile)] ?? fontSizeMap.sm;

  return (
    <PandaFieldHelp
      ref={ref}
      id={helpId}
      fontSize={fontSize}
      // A stable hook for the app's own end-to-end assertion that help is in
      // the DOM with no pointer interaction (PRD-0037's success criteria), and
      // for finding the call sites during the migration.
      data-field-help="true"
      style={{ ...(sized ? { fontSize: sized } : {}), ...style }}
      {...props}
    >
      {children}
    </PandaFieldHelp>
  );
};

StyledFieldHelp.displayName = "StyledFieldHelp";

export default StyledFieldHelp;
export { StyledFieldHelp };

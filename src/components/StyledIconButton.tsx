"use client";

import React from "react";
import type { HTMLStyledProps } from "styled-system/types";
import { buttonIconRecipe } from "styled-system/recipes";
import type { AllowedVariant } from "../config/types";
import { useResolvedFontSize, useStyleConfig } from "../config/style-config";
import type { FontSizeKey } from "../config/types";
import StyledTooltip from "./StyledTooltip";

/**
 * A button whose whole label is an icon.
 *
 * ## The variant coercion is necessary, not arbitrary
 *
 * `buttonIconRecipe` defines **seven** variants — `solid`, `outline`, `aurora`,
 * `glass`, `matte`, `ghost`, `none` — and the vocabulary has ten. The missing
 * three have to go somewhere, or a caller passing one gets a button with a class
 * name and no rules behind it:
 *
 * | Asked for | Rendered as | Why |
 * |---|---|---|
 * | `unstyled` | `ghost` | closest thing the recipe has to "no chrome" |
 * | `link` | `outline` | a link-styled icon button has no affordance at all |
 * | `selected` | `outline` | same — the recipe has no selected treatment |
 *
 * This is why the component does not use `useResolvedVariant`, which would send
 * all three to `solid` and give a "no chrome" request a filled background.
 * `StyledButton` does something different again, because *its* recipe defines
 * all ten. Three components, three variant sets — check the recipe before you
 * assume.
 *
 * ## An icon button MUST be named
 *
 * There is no visible text, so `aria-label` (or `tooltip`, which supplies one)
 * is the only thing standing between a screen-reader user and a control
 * announced as "button". Nothing here can enforce that, so it is asserted in the
 * tests and stated here.
 */

export type IconButtonSize = "1x" | "sm" | "md" | "lg";

/**
 * Which step of the text scale each control size draws its glyph at.
 *
 * These are the keys the old absolute values already meant. `buttonIconRecipe`
 * stated `0.75rem / 0.875rem / 1rem / 1.25rem`, which on this package's own
 * ramp is exactly `xs / sm / md / xl` — so at `fontSizeProfile="md"` on that
 * ramp every one of the four resolves to the pixel it rendered before
 * (12/14/16/20). Note `lg` maps to `xl`, not to `lg`: the original value was
 * `1.25rem`, two steps up, and preserving what shipped matters more than a
 * name lining up.
 *
 * They are `FontSizeKey`s rather than raw offsets because `resolveFontSizeKey`
 * reads a key as a step from `md` — so the table says what a reader sees
 * ("two steps below body") instead of an integer nobody can check against the
 * ramp.
 */
const GLYPH_STEP: Record<IconButtonSize, FontSizeKey> = {
  "1x": "xs",
  sm: "sm",
  md: "md",
  lg: "xl",
};

/** Variants the icon recipe actually defines. */
type IconButtonVariant = "solid" | "outline" | "aurora" | "glass" | "matte" | "ghost" | "none";

export interface StyledIconButtonProps extends HTMLStyledProps<"button"> {
  variant?: AllowedVariant;
  size?: IconButtonSize;
  children?: React.ReactNode;
  disabled?: boolean;
  /** Also supplies the accessible name when no `aria-label` is given. */
  tooltip?: string;
  placement?: "top" | "bottom" | "left" | "right";
  /**
   * Pin the glyph to its absolute step rather than following the reader's
   * profile.
   *
   * The escape hatch `StyledText` carries, for an icon inside a container whose
   * height genuinely cannot grow. Not the default: this control's 48px floor is
   * a `min-height`/`min-width`, so the box grows with the glyph rather than
   * cropping it, and an icon that refuses to grow is unreadable to exactly the
   * reader who turned the setting up.
   */
  fixedSize?: boolean;
  /** Render as something else — an anchor, for instance. */
  as?: React.ElementType;
  href?: string;
  target?: string;
  rel?: string;
}

/**
 * Props this component used to accept and no longer honours (NEH-498).
 *
 * They are dropped rather than forwarded because everything else in `rest` is
 * spread onto the element: left alone, `confirm={true}` reaches the DOM as an
 * invalid attribute and React warns about each one in the consumer's console.
 * The doc above already promised these were ignored — this is what makes that
 * true.
 *
 * This is a migration seam with an end date. Delete it once no consumer passes
 * any of them; none does today, which is why they were removed in the first
 * place.
 */
const REMOVED_PROPS = [
  "confirm",
  "confirmTitle",
  "confirmBody",
  "onConfirm",
  "loading",
  "noBackground",
] as const;

/** Map the full vocabulary onto what the recipe can actually paint. */
function toIconVariant(variant: AllowedVariant): IconButtonVariant {
  if (variant === "unstyled") return "ghost";
  if (variant === "link" || variant === "selected") return "outline";
  return variant as IconButtonVariant;
}

const StyledIconButton = React.forwardRef<HTMLButtonElement, StyledIconButtonProps>(
  function StyledIconButton(
    {
      children,
      variant,
      size = "md",
      fixedSize,
      disabled,
      tooltip,
      placement,
      as = "button",
      onClick,
      "aria-label": ariaLabel,
      ...rest
    },
    ref,
  ) {
    const { variant: appVariant } = useStyleConfig();
    const requested = variant ?? appVariant;
    const painted = toIconVariant(requested);

    /*
     * The glyph size, resolved against the reader's profile (NEH-1561).
     *
     * It used to live on the recipe as four absolute rem values, so the icon
     * measured 12/14/16/20px at every profile on every ramp. A recipe is static
     * CSS and cannot read a React context, so the relative answer has to be
     * computed here and applied inline — the same arrangement `StyledLink` and
     * `StyledButton` use.
     *
     * This sizes a TEXT glyph. An icon drawn by `StyledIcon` is boxed in px
     * from the app-wide `iconSize`, which is a separate setting and is not
     * changed here; pinning that default is step 1 of its own ordering (see
     * CLAUDE.md).
     */
    const fontSize = useResolvedFontSize({ size: GLYPH_STEP[size], fixedSize });

    const Element = as as React.ElementType;

    // zIndex is pulled out of the Panda prop bag and applied inline. Panda would
    // emit it as an atomic class, which loses to the recipe's own class in the
    // cascade — so a caller stacking a button above a sibling would find it
    // ignored.
    const { zIndex, style, className: incoming, ...restWithoutZIndex } = rest;

    for (const prop of REMOVED_PROPS) {
      delete (restWithoutZIndex as Record<string, unknown>)[prop];
    }

    return (
      <StyledTooltip tooltip={tooltip} placement={placement}>
        <Element
          ref={ref}
          className={[buttonIconRecipe({ variant: painted, size }), incoming]
            .filter(Boolean)
            .join(" ")}
          // `data-panda-variant` reports what was ASKED for, not what was
          // painted, so a caller inspecting the DOM can see their `link` was
          // honoured as a request even though the recipe drew an outline.
          data-panda-variant={requested}
          // Fall back to the tooltip for the accessible name. An icon button has
          // no visible text, so without one it announces as just "button" —
          // WCAG 4.1.2. The tooltip is already the human-readable description of
          // what the control does, so it is the right string, and an explicit
          // aria-label still wins.
          //
          // This is a fix, not a port: upstream, a tooltip named the trigger
          // ONLY when the child was not focusable. A button always is, so it got
          // aria-describedby and no name. In the originating app that left 9 of
          // 43 icon buttons unnamed (a further 10 have neither, which only the
          // call sites can fix).
          aria-label={ariaLabel ?? tooltip}
          // A caller's own `style` spreads after ours, so it still wins outright.
          style={{ fontSize, ...(style || {}), ...(zIndex !== undefined ? { zIndex } : {}) }}
          onClick={onClick}
          // Only a real <button> understands `disabled`; on an <a> it is
          // meaningless and React would emit an invalid attribute.
          disabled={as === "button" ? disabled : undefined}
          {...restWithoutZIndex}
        >
          {children}
        </Element>
      </StyledTooltip>
    );
  },
);

StyledIconButton.displayName = "StyledIconButton";

export default StyledIconButton;
export { StyledIconButton };

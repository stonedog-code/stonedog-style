"use client";

import React from "react";
import { styled } from "styled-system/jsx";
import type { HTMLStyledProps } from "styled-system/types";
import { buttonRecipe } from "styled-system/recipes";
import type { AllowedVariant } from "../config/types";
import { useResolvedFontSize, useStyleConfig } from "../config/style-config";
import type { FontSizeKey } from "../config/types";
import StyledText from "./StyledText";
import StyledSpinner from "./StyledSpinner";
import StyledTooltip from "./StyledTooltip";

/**
 * The button every other button is built from.
 *
 * ## Why this does NOT use `useResolvedVariant`
 *
 * Everywhere else, `useResolvedVariant` narrows to the five *theme* variants
 * and coerces anything else to `solid`, because most recipes define only those
 * five and passing an unknown one renders an unstyled control.
 *
 * `buttonRecipe` is the exception: it defines **all ten** — the five theme
 * variants plus `ghost`, `none`, `link`, `unstyled` and `selected`. Running the
 * usual narrowing here would silently turn every ghost and link button solid,
 * which is a visible regression at a lot of call sites. So this resolves against
 * the wider `AllowedVariant` set on purpose.
 *
 * If you add a component whose recipe covers all ten, do the same and say why.
 * If it covers only five, use `useResolvedVariant`.
 */

const PandaButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
});

export interface StyledButtonProps extends HTMLStyledProps<"button"> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Any of the ten the button recipe defines, not just the five theme ones. */
  variant?: AllowedVariant;
  children?: React.ReactNode;
  /** Disables the button and swaps the label for a spinner. */
  loading?: boolean;
  disabled?: boolean;
  tooltip?: React.ReactNode;
  /** What the spinner says while `loading`. Prefer naming the action. */
  loadText?: React.ReactNode;
  /** Keep the label on one line even when the button is narrow. */
  noWrap?: boolean;
  /**
   * Which step of the text scale the label reads at.
   *
   * **Identical to `StyledText` in every respect** — same prop, same resolution
   * through `resolveFontSizeKey`, same relative meaning. `size="sm"` is "one
   * step below body text", not a fixed 14px, and it moves with the reader's
   * font-size profile.
   *
   * The label already followed the profile before this existed, because the
   * children are wrapped in a `StyledText`; measured at 12/14/16/18/20px across
   * the five profiles. What did not follow it is the button's OWN box, which
   * had no `font-size` at all and inherited the user agent's 13.3333px — see
   * the note on `buttonRecipe`'s base. Everything sized in `em` against the
   * button rode on that number, which is to say on nothing.
   */
  size?: FontSizeKey;
  /**
   * Pin the label to the `md` step rather than following the reader's profile.
   *
   * Deliberately NOT the default, and the 48px floor is the reason it can
   * safely not be. `fixedSize` exists for a label inside a control whose HEIGHT
   * is fixed and would clip; this button's floor is a `min-height`, so the box
   * grows with the label instead of cropping it — measured 48px at every
   * profile at the bottom of the scale, and 50.4/55.4/61.4px at HopperGuard's
   * md/lg/xl. A button that refused to grow would be the one control an elderly
   * reader could not read, which is the opposite of the point.
   */
  fixedSize?: boolean;
}

const StyledButton = React.forwardRef<HTMLButtonElement, StyledButtonProps>(
  function StyledButton(
    {
      leftIcon,
      rightIcon,
      children,
      variant,
      loading,
      disabled,
      tooltip,
      noWrap,
      loadText = "Loading",
      size,
      fixedSize,
      ...rest
    },
    ref,
  ) {
    const { variant: appVariant } = useStyleConfig();
    const effectiveVariant = variant ?? appVariant;
    /*
     * The button's own box, resolved exactly as `StyledText` resolves it.
     *
     * A recipe is static CSS and cannot read a React context, so this is an
     * inline value — the same arrangement `StyledLink` uses. It matters for
     * everything measured in `em` against the button (the `IconSlot` gap, the
     * spinner) and for any child that is not routed through `StyledText`; the
     * label below gets the identical `size`/`fixedSize`, so the two can never
     * disagree.
     */
    const fontSize = useResolvedFontSize({ size, fixedSize });

    // Positioning props are pulled out of the Panda prop bag and applied as
    // inline style. Panda would otherwise emit them as atomic classes, which
    // lose to the recipe's own class in the cascade — so a caller positioning a
    // button absolutely would find it ignored.
    const { top, right, position, zIndex, ...restWithoutPosition } = rest;
    const style = {
      fontSize,
      top,
      right,
      position,
      zIndex,
      ...(noWrap ? { whiteSpace: "nowrap" as const } : {}),
      // A caller's own `style` spreads last, so it still wins outright.
      ...(rest.style || {}),
    };

    return (
      <StyledTooltip tooltip={tooltip}>
        <PandaButton
          ref={ref}
          className={buttonRecipe({ variant: effectiveVariant })}
          // A loading button must not be clickable — a second submit is the
          // classic double-charge bug — and `aria-busy` is what tells a screen
          // reader why it went inert.
          disabled={loading || disabled}
          aria-busy={loading}
          data-panda-variant={effectiveVariant}
          style={style as React.CSSProperties}
          {...restWithoutPosition}
        >
          {leftIcon && <IconSlot side="left">{leftIcon}</IconSlot>}
          {loading ? (
            <StyledSpinner loadText={loadText} />
          ) : (
            <StyledText size={size} fixedSize={fixedSize}>
              {children}
            </StyledText>
          )}
          {rightIcon && <IconSlot side="right">{rightIcon}</IconSlot>}
        </PandaButton>
      </StyledTooltip>
    );
  },
);

/**
 * Spacing for an icon beside the label.
 *
 * `em`, not `px`, so the gap tracks the button's own font size — which this
 * system changes app-wide via the font-size profile. A fixed gap looks correct
 * at `md` and wrong at both ends of the scale.
 */
const IconSlot = ({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) => (
  <span
    style={{
      [side === "left" ? "marginRight" : "marginLeft"]: "0.5em",
      display: "inline-flex",
      alignItems: "center",
    }}
  >
    {children}
  </span>
);

StyledButton.displayName = "StyledButton";

export default StyledButton;
export { StyledButton };

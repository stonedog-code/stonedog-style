"use client";

import { log } from "../config/logger";
import React from "react";
import { styled } from "styled-system/jsx";
import { css, cx } from "styled-system/css";
import StyledTooltip from "./StyledTooltip";
import { useFontSizeProfile } from "../config/style-config";
import { fontSizeMap, resolveFontSizeKey } from "../config/font-size";
import type { AllowedTextVariant } from "../config/types";
import { textRecipe } from "styled-system/recipes";

const PandaText = styled("span", textRecipe);

/**
 * The spacing props that only a BLOCK box can honour.
 *
 * Horizontal spacing is deliberately absent. `margin-left` / `margin-right`
 * work perfectly well on an inline box, and inline text inside a sentence is
 * the commonest use of this component — promoting on those would break working
 * layout to fix a different problem.
 */
const VERTICAL_SPACING_PROPS = [
  "marginTop",
  "marginBottom",
  "marginBlock",
  "marginBlockStart",
  "marginBlockEnd",
  "paddingTop",
  "paddingBottom",
  "paddingBlock",
  "paddingBlockStart",
  "paddingBlockEnd",
  "mt",
  "mb",
  "my",
  "pt",
  "pb",
  "py",
] as const;

export interface StyledTextProps
  extends React.ComponentProps<typeof PandaText> {
  children?: React.ReactNode | undefined;

  tooltip?: React.ReactNode | undefined;
  as?: React.ElementType | undefined; // Explicitly add the 'as' prop
  size?: keyof typeof fontSizeMap | undefined;
  fixedSize?: boolean | undefined;
  color?: string | undefined;
  ellipsis?: boolean | undefined;
  wrap?: boolean | undefined;

  /**
   * Render as a block box rather than the default inline one.
   *
   * Set this when you want block flow without any spacing prop to trigger it —
   * two paragraphs that should stack, for instance. A vertical margin or
   * padding implies it already; see the note on the component.
   */
  block?: boolean | undefined;

  variant?: AllowedTextVariant | undefined;
}

/**
 * `StyledText` renders a `<span>`, which is an INLINE box — and CSS ignores
 * `margin-top` / `margin-bottom` on inline boxes outright.
 *
 * So `<StyledText marginBottom="1">` used to emit the rule, put the class in
 * the DOM, report `margin-bottom: 8px` from `getComputedStyle`, and move
 * nothing. Worse, JSX strips the whitespace between two elements on separate
 * lines, so adjacent `StyledText` siblings rendered as a single run with no
 * space at all — shipped in two products as "No dates to show yetThis does not
 * mean nothing is due" and "OverviewYour Personal Dashboard" (NEH-490).
 *
 * **It worked in some places, which is what made it so hard to see.** Flex
 * items are blockified, so a `StyledText` inside a `StyledStack` becomes a
 * block and its margins apply; the identical component inside a `StyledBox`
 * stays inline and breaks. Whoever adds the prop sees it work in the component
 * they tested.
 *
 * So a vertical spacing prop promotes the box to `display: block`. This cannot
 * break anything that currently works: on an inline box those declarations are
 * already discarded, so nothing can be depending on their effect. The call
 * sites were always right — the component was accepting a prop it could not
 * honour and saying nothing.
 *
 * An explicit `display` from the caller always wins, and `block` is available
 * for the case where you want block flow with no spacing prop to imply it.
 */
function wantsBlockBox(props: StyledTextProps): boolean {
  if (props.block) return true;
  const bag = props as unknown as Record<string, unknown>;
  return VERTICAL_SPACING_PROPS.some((prop) => bag[prop] !== undefined);
}

const StyledText = React.forwardRef<HTMLSpanElement, StyledTextProps>((props, ref) => {
  log.trace("StyledText rendered");
  const {
    children,
    tooltip,
    size,
    fixedSize,
    color = "textPrimary",
    variant,
    style,
    ellipsis,
    wrap,
    textAlign,
    className,
    block: _block,
    ...rest
  } = props;
  const fontSizeProfile = useFontSizeProfile();

  const finalSize = resolveFontSizeKey({ size, fixedSize, profile: fontSizeProfile });
  const fontSize = fontSizeMap[finalSize] || fontSizeMap.md;

  const extraStyles: React.CSSProperties = {};
  // Before `ellipsis`, which sets its own `display: block` and must keep
  // winning — an ellipsised line is block for a different reason and the two
  // agree anyway.
  if (wantsBlockBox(props)) {
    extraStyles.display = "block";
  }
  if (ellipsis) {
    extraStyles.textOverflow = "ellipsis";
    extraStyles.whiteSpace = "nowrap";
    extraStyles.overflow = "hidden";
    extraStyles.display = "block";
  }
  if (wrap === false) {
    extraStyles.whiteSpace = "nowrap";
  }

  const textAlignClass = textAlign ? css({ textAlign }) : "";
  const combinedClassName = cx(className, textAlignClass);

  const textElement = (
    <PandaText
      ref={ref}
      style={{ fontSize, ...extraStyles, ...style }}
      color={color}
      variant={variant}
      className={combinedClassName}
      {...rest}
    >
      {children}
    </PandaText>
  );

  return (
    <>
      {tooltip ? (
        <StyledTooltip tooltip={tooltip}>{textElement}</StyledTooltip>
      ) : (
        textElement
      )}
    </>
  );
});

StyledText.displayName = "StyledText";

export default StyledText;

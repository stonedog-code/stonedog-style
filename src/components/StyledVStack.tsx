import React from "react";
import { vstack } from "styled-system/patterns";
import type { ConditionalValue } from "styled-system/types";
import { css, cx } from "styled-system/css";
import { stripedRecipe } from "styled-system/recipes";
import { Property } from "csstype";
import { isListElement, listStackReset, type StackElement } from "./stack-element";

export interface StyledVStackProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The element to render (default `"div"`). `"ul"`/`"ol"` drop the
   * user-agent's markers, indent and margin and keep `role="list"` (NEH-1868).
   * Before 0.36.0 this prop was IGNORED here — `as="ul"` rendered
   * `<div as="ul">` and orphaned every `<li>` inside.
   */
  as?: StackElement | undefined;
  opacity?: ConditionalValue<number> | undefined;
  gap?: ConditionalValue<string | number> | undefined;
  align?: ConditionalValue<string> | undefined;
  justify?: ConditionalValue<string> | undefined;
  width?: ConditionalValue<string> | undefined;
  w?: ConditionalValue<string> | undefined;
  marginBottom?: ConditionalValue<string> | undefined;
  mb?: ConditionalValue<string | number> | undefined;
  marginTop?: ConditionalValue<string | number> | undefined;
  mt?: ConditionalValue<string | number> | undefined;
  flexWrap?: ConditionalValue<string> | undefined;
  display?: ConditionalValue<string> | undefined;
  alignItems?: ConditionalValue<string> | undefined;
  justifyContent?: ConditionalValue<string> | undefined;
  p?: ConditionalValue<string | number> | undefined;
  py?: ConditionalValue<string | number> | undefined;
  px?: ConditionalValue<string | number> | undefined;
  pt?: ConditionalValue<string | number> | undefined;
  pb?: ConditionalValue<string | number> | undefined;
  pl?: ConditionalValue<string | number> | undefined;
  pr?: ConditionalValue<string | number> | undefined;
  minH?: ConditionalValue<string | number> | undefined;
  minHeight?: ConditionalValue<string | number> | undefined;
  minWidth?: ConditionalValue<string | number> | undefined;
  maxW?: ConditionalValue<string | number> | undefined;
  maxWidth?: ConditionalValue<string | number> | undefined;
  flex?: ConditionalValue<string | number> | undefined;
  position?: ConditionalValue<string> | undefined;
  textAlign?: ConditionalValue<string> | undefined;
  borderWidth?: ConditionalValue<string | number> | undefined;
  borderRadius?: ConditionalValue<string | number> | undefined;
  flexDirection?: ConditionalValue<Property.FlexDirection> | undefined;
  height?: ConditionalValue<string | number> | undefined;
  h?: ConditionalValue<string | number> | undefined;
  bg?: ConditionalValue<string> | undefined;
  backgroundColor?: ConditionalValue<string> | undefined;
  isStriped?: boolean | undefined;

}

export const StyledVStack: React.FC<StyledVStackProps> = ({
  as: Component = "div",
  gap = "2",
  align,
  justify,
  width,
  w,
  marginBottom,
  mb,
  marginTop,
  mt,
  flexWrap,
  display,
  alignItems,
  justifyContent,
  p,
  py,
  px,
  pt,
  pb,
  pl,
  pr,
  minH,
  minHeight,
  minWidth,
  maxW,
  maxWidth,
  flex,
  position,
  textAlign,
  borderWidth,
  borderRadius,
  flexDirection,
  height,
  h,
  bg,
  backgroundColor,
  isStriped,
  opacity,
  className,
  children,
  ...rest
}) => {  // Map React-style props to styled-system pattern props
  const mappedProps = {
    opacity,
    gap: typeof gap === "number" ? String(gap) : gap,
    alignItems: align || alignItems,
    justify: justify || justifyContent,
    width: width || w,
    marginBottom: marginBottom || mb,
    marginTop: marginTop || mt,
    flexWrap,
    display,
    p,
    py,
    px,
    pt,
    pb,
    pl,
    pr,
    minH,
    minHeight,
    minWidth,
    maxWidth: maxWidth || maxW,
    flex,
    position,
    textAlign,
    borderWidth,
    borderRadius,
    flexDirection,
    height: height || h,
    background: bg || backgroundColor,
  };

  // Remove undefined values
  Object.keys(mappedProps).forEach(
    (key) => mappedProps[key as keyof typeof mappedProps] === undefined && delete mappedProps[key as keyof typeof mappedProps],
  );

  const patternProps = mappedProps as unknown as Parameters<typeof vstack>[0];
  // The union is checked at the call site; inside, every member takes the
  // same HTML attributes, which JSX cannot see through a union of tags.
  const Element = Component as React.ElementType;
  const isList = isListElement(Component);
  const combinedClassName = cx(
    // A list merges its reset BEFORE the caller's props in one `css()` call,
    // so a caller's own `p`/`mt`/… replaces the reset's value rather than
    // racing it as a second class on the same property.
    isList ? css(listStackReset, vstack.raw(patternProps)) : vstack(patternProps),
    isStriped ? stripedRecipe() : undefined,
    className,
  );
  return (
    <Element
      className={combinedClassName}
      // Safari drops list semantics from a `list-style: none` list, so the
      // role is restated. A caller's own `role` (in `rest`) still wins.
      {...(isList ? { role: "list" } : {})}
      {...rest}
    >
      {children}
    </Element>
  );
};

StyledVStack.displayName = "StyledVStack";

export default StyledVStack;

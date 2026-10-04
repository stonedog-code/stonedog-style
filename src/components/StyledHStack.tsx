import React from "react";
import { hstack } from "styled-system/patterns";
import type { ConditionalValue } from "styled-system/types";
import { Property } from "csstype";
import { css } from "styled-system/css";
import { isListElement, listStackReset, type StackElement } from "./stack-element";

export interface StyledHStackProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {
  /**
   * The element to render (default `"div"`). Narrowed from
   * `React.ElementType` in 0.36.0 (NEH-1868) so an unsupported element is a
   * type error rather than a silent attribute. `"ul"`/`"ol"` drop the
   * user-agent's markers, indent and margin and keep `role="list"`.
   */
  as?: StackElement | undefined;
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
  minH?: ConditionalValue<string | number> | undefined;
  flexShrink?: ConditionalValue<string | number> | undefined;
  flexDirection?: ConditionalValue<Property.FlexDirection> | undefined;
  bg?: ConditionalValue<string> | undefined;
  backgroundColor?: ConditionalValue<string> | undefined;
  height?: ConditionalValue<string | number> | undefined;
  h?: ConditionalValue<string | number> | undefined;
  borderRadius?: ConditionalValue<string | number> | undefined;
  borderWidth?: ConditionalValue<string | number> | undefined;
  borderColor?: ConditionalValue<string> | undefined;
  border?: ConditionalValue<string> | undefined;
  opacity?: ConditionalValue<number> | undefined;
  color?: ConditionalValue<string> | undefined;
  _dark?: Record<string, unknown> | undefined;
  // Allow additional Panda CSS style props
  [key: string]: unknown;
}

export const StyledHStack: React.FC<StyledHStackProps> = ({
  as: Component = "div",
  gap = "2",
  align,
  justify,
  width,
  w,
  marginBottom,
  mb,
  flexWrap,
  display,
  alignItems,
  justifyContent,
  p,
  py,
  px,
  minH,
  pt,
  bg,
  backgroundColor,
  children,
  flexDirection,
  flexShrink,
  marginTop,
  mt,
  height,
  h,
  borderRadius,
  borderWidth,
  borderColor,
  border,
  opacity,
  color,
  _dark,
  className: _className,
  style: _style,
  ...rest
}) => {
  // Separate HTML attributes from style props
  const htmlAttrs: Record<string, unknown> = {};
  const extraStyleProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key.startsWith("on") || key.startsWith("data-") || key.startsWith("aria-") || ["id", "ref", "role", "tabIndex", "draggable", "title"].includes(key)) {
      htmlAttrs[key] = value;
    } else {
      extraStyleProps[key] = value;
    }
  }

  // Map React-style props to styled-system pattern props
  const mappedProps: Record<string, unknown> = {
    gap: typeof gap === "number" ? String(gap) : gap,
    // `alignItems`, not `align`. The generated `hstack` pattern destructures
    // only `justify` and `gap`, hard-codes `alignItems: "center"`, then spreads
    // the rest — so only a key literally named `alignItems` overrides that
    // centre. `align` is not a Panda utility either, so it used to survive into
    // `css()` and emit a class name with no rule behind it (NEH-288).
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
    minH,
    pt,
    background: bg || backgroundColor,
    flexDirection,
    flexShrink,
    height: height || h,
    borderRadius,
    borderWidth,
    borderColor,
    border,
    opacity,
    color,
    _dark,
    ...extraStyleProps,
  };

  // Remove undefined values
  Object.keys(mappedProps).forEach(
    (key) => mappedProps[key] === undefined && delete mappedProps[key],
  );

  const patternProps = mappedProps as Parameters<typeof hstack>[0];
  const isList = isListElement(Component);

  return (
    <Component
      // A list merges its reset BEFORE the caller's props in one `css()`
      // call, so a caller's `listStyle`/`p`/`mt` replaces the reset's value.
      className={isList ? css(listStackReset, hstack.raw(patternProps)) : hstack(patternProps)}
      style={_style}
      // Safari drops list semantics from a `list-style: none` list, so the
      // role is restated. A caller's own `role` (in `htmlAttrs`) still wins.
      {...(isList ? { role: "list" } : {})}
      {...htmlAttrs}
    >
      {children}
    </Component>
  );
};

StyledHStack.displayName = "StyledHStack";

export default StyledHStack;

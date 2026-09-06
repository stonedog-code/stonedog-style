import React from "react";
import { styled } from "styled-system/jsx";
import { boxRecipe, type BoxRecipeVariantProps } from "styled-system/recipes";
import type { HTMLStyledProps, ConditionalValue } from "styled-system/types";
import { Property } from "csstype";
import { css, cx } from "styled-system/css";
import StyledGrid from "./StyledGrid";
import StyledVStack from "./StyledVStack";

interface StyledGridPanelProps {
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  children: React.ReactNode;
}

const StyledGridPanel: React.FC<StyledGridPanelProps> = ({
  leftPanel,
  rightPanel,
  children,
}) => {
  const hasPanels = leftPanel || rightPanel;

  if (!hasPanels) {
    return <div style={{ width: "100%", height: "100%" }}>{children}</div>;
  }

  return (
    <StyledGrid
      width="100%"
      height="100%"
      gap={0}
      templateColumns="min-content 1fr min-content"
      alignItems="stretch"
      data-testid="styled-grid-panel"
    >
      <StyledBox itemID="left-panel" mr="3" style={{ gridColumn: 1 }}>{leftPanel}</StyledBox>
      <StyledBox style={{ width: "100%", height: "100%", gridColumn: 2 }}>
        {children}
      </StyledBox>
      <StyledBox itemID="right-panel" ml="3" style={{ overflowY: "auto", height: "100%", gridColumn: 3 }}>
        {rightPanel}
      </StyledBox>
    </StyledGrid>
  );
};

export interface StyledBoxProps
  extends HTMLStyledProps<"div">,
  BoxRecipeVariantProps {
  as?: React.ElementType;
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  topPanel?: React.ReactNode;
  bottomPanel?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  mt?: ConditionalValue<Property.MarginTop | number>;
  mb?: ConditionalValue<Property.MarginBottom | number>;
  ml?: ConditionalValue<Property.MarginLeft | number>;
  mr?: ConditionalValue<Property.MarginRight | number>;
  p?: ConditionalValue<Property.Padding | number>;
  pt?: ConditionalValue<Property.PaddingTop | number>;
  pb?: ConditionalValue<Property.PaddingBottom | number>;
  pl?: ConditionalValue<Property.PaddingLeft | number>;
  pr?: ConditionalValue<Property.PaddingRight | number>;
  px?: ConditionalValue<Property.Padding | number>;
  py?: ConditionalValue<Property.Padding | number>;
  m?: ConditionalValue<Property.Margin | number>;
  mx?: ConditionalValue<Property.Margin | number>;
  my?: ConditionalValue<Property.Margin | number>;
  width?: ConditionalValue<Property.Width | number>;
  w?: ConditionalValue<Property.Width | number>;
  height?: ConditionalValue<Property.Height | number>;
  h?: ConditionalValue<Property.Height | number>;
  minH?: ConditionalValue<Property.MinHeight | number>;
  maxW?: ConditionalValue<Property.MaxWidth | number>;
  display?: ConditionalValue<Property.Display>;
  flexDirection?: ConditionalValue<Property.FlexDirection>;
  alignItems?: ConditionalValue<Property.AlignItems>;
  justifyContent?: ConditionalValue<Property.JustifyContent>;
  bg?: ConditionalValue<Property.Background>;
  background?: ConditionalValue<Property.Background>;
  color?: ConditionalValue<Property.Color>;
  borderRadius?: ConditionalValue<Property.BorderRadius | number>;
  border?: ConditionalValue<Property.Border | number>;
  borderWidth?: ConditionalValue<Property.BorderWidth | number>;
  borderColor?: ConditionalValue<Property.BorderColor>;
  boxShadow?: ConditionalValue<Property.BoxShadow>;
  position?: ConditionalValue<Property.Position>;
  top?: ConditionalValue<Property.Top | number>;
  right?: ConditionalValue<Property.Right | number>;
  bottom?: ConditionalValue<Property.Bottom | number>;
  left?: ConditionalValue<Property.Left | number>;
  zIndex?: ConditionalValue<Property.ZIndex | number>;
  overflow?: ConditionalValue<Property.Overflow>;
  overflowX?: ConditionalValue<Property.OverflowX>;
  overflowY?: ConditionalValue<Property.OverflowY>;
  textAlign?: ConditionalValue<Property.TextAlign>;
  gap?: ConditionalValue<Property.Gap | number>;
  noWrap?: boolean;
  scrollbar?: "auto" | "on" | "off";
}

/**
 * The layout props that describe how a caller wants THEIR CHILDREN arranged.
 *
 * Without `noWrap`, `StyledBox` puts children three levels down:
 *
 * ```
 * StyledBoxRoot        ← these props used to land here, and only here
 *   └ StyledVStack     ← ...whose only child is this
 *       └ div
 *           └ StyledGridPanel
 *               └ div  ← a plain block div, where the children actually live
 * ```
 *
 * So a root flex container laid out exactly ONE item and the caller's children
 * stayed in ordinary block flow — `display="flex" flexDirection="column"` did
 * nothing, `alignItems` centred a wrapper, and `gap` separated nothing.
 *
 * The visible cost, three times over: two adjacent `StyledText` siblings render
 * as one welded run, because `StyledText` is a `<span>` and JSX strips the
 * whitespace between elements on separate lines. Hopper Vitals shipped
 * `264.2Weight` and `Sep 6Record another to see a trend.` (NEH-1473), which is
 * the same symptom NEH-490 fixed twice at the call site. Fixing it at the call
 * site is why it came back.
 *
 * **This cannot break anything that currently works.** These declarations were
 * discarded before — a flex container with one child arranges nothing — so
 * nothing can be depending on their effect. Same argument `StyledText`'s block
 * promotion makes for vertical margins on an inline box.
 *
 * They are FORWARDED, not moved: the root keeps them too, so a caller relying
 * on the root's own box (a `gap` between header, content and footer, say) is
 * unaffected.
 *
 * Sizing props are deliberately absent — `width`, `height`, `padding`,
 * `margin`, `overflow` and friends genuinely apply to the root's own box, and
 * copying them inward would double padding and re-clip content.
 */
const LAYOUT_PROPS = [
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "alignContent",
  "justifyContent",
  "justifyItems",
  "gap",
  "rowGap",
  "columnGap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  "placeItems",
  "placeContent",
] as const;

/**
 * Did the caller ask for a layout of their own?
 *
 * When they did, and nothing else needs the wrapper, `StyledBox` renders the
 * children DIRECTLY inside the root so the root really is their parent — which
 * is what makes every Panda prop work, `gap` included.
 *
 * Forwarding the props as inline CSS was tried first and is wrong: `gap="2"` is
 * a Panda spacing TOKEN, not a length, so `style={{ gap: "2" }}` is invalid CSS
 * and silently dropped. Panda resolves tokens at build time for props on a
 * styled component; it cannot for a runtime value written into a style
 * attribute. Making the root the parent sidesteps the problem entirely — the props
 * stay exactly where Panda already handles them.
 */
function wantsOwnLayout(rest: Record<string, unknown>): boolean {
  return LAYOUT_PROPS.some((prop) => rest[prop] !== undefined && rest[prop] !== null);
}

const StyledBoxRoot = styled("div", boxRecipe);

const StyledBox = React.forwardRef<HTMLDivElement, StyledBoxProps>(
  ({
    as,
    children,
    leftPanel,
    rightPanel,
    topPanel,
    bottomPanel,
    header,
    footer,
    noWrap,
    scrollbar,
    textAlign,
    zIndex,
    className,
    ...rest
  },
    ref,
  ) => {

    // Create class for filtered properties
    const filteredPropsClass = css({
      // Only include if defined to avoid overriding with undefined
      ...(textAlign && { textAlign }),
      ...(zIndex !== undefined && { zIndex })
    });
    const combinedClassName = cx(className, filteredPropsClass);

    const resolvedHeader = topPanel || header;
    const resolvedFooter = bottomPanel || footer;

    // scrollbar prop controls inner content overflow
    const innerOverflow: Property.Overflow = scrollbar === "auto" ? "auto" : scrollbar === "on" ? "scroll" : "hidden";

    // Does the caller lay out their own children? If so the wrapper is what
    // stands between their props and the elements those props describe.
    const callerLaysOutChildren = wantsOwnLayout(rest as Record<string, unknown>);

    if (noWrap) {
      if (resolvedHeader || resolvedFooter) {
        return (
          <StyledBoxRoot ref={ref} {...(as ? { as } : {})} className={combinedClassName} display="flex" flexDirection="column" {...rest}>
            {resolvedHeader}
            <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
            {resolvedFooter}
          </StyledBoxRoot>
        );
      }
      return (
        <StyledBoxRoot ref={ref} {...(as ? { as } : {})} className={combinedClassName} {...rest}>
          {children}
        </StyledBoxRoot>
      );
    }
    /*
      The caller lays out their own children and nothing else needs the
      wrapper, so the root parents them directly.

      Gated on there being no header, footer, panels or scrollbar: each of
      those is a real reason the wrapper exists, and this must not take any of
      them away. What is left is the case where the wrapper only ever stood
      between a caller's layout props and the children they describe.
    */
    if (
      callerLaysOutChildren &&
      !resolvedHeader &&
      !resolvedFooter &&
      !leftPanel &&
      !rightPanel &&
      scrollbar === undefined
    ) {
      return (
        <StyledBoxRoot ref={ref} {...(as ? { as } : {})} className={combinedClassName} {...rest}>
          {children}
        </StyledBoxRoot>
      );
    }

    return (
      <StyledBoxRoot ref={ref} {...(as ? { as } : {})} className={combinedClassName} {...rest}>
        <StyledVStack gap="0" width="100%" height="100%" style={{ overflow: innerOverflow }}>
          {resolvedHeader}
          <div style={{ flex: 1, minHeight: 0, width: "100%", overflow: innerOverflow }}>
            <StyledGridPanel leftPanel={leftPanel} rightPanel={rightPanel}>
              {children}
            </StyledGridPanel>
          </div>
          {resolvedFooter}
        </StyledVStack>
      </StyledBoxRoot>
    );
  },
);

StyledBox.displayName = "StyledBox";
export default StyledBox;
export { StyledBox };

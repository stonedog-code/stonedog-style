import React from "react";
import StyledStack from "./StyledStack";
import StyledHStack from "./StyledHStack";
import StyledVStack from "./StyledVStack";
import { css } from "styled-system/css";

/** Mount targets for `StyledStack.ct.tsx` (NEH-1868). */

const items = (
  <>
    <li style={{ height: "20px" }}>one</li>
    <li style={{ height: "20px" }}>two</li>
    <li style={{ height: "20px" }}>three</li>
  </>
);

export function StackLists() {
  return (
    <div>
      <StyledStack as="ul" gap="4" data-testid="stack-ul">
        {items}
      </StyledStack>
      <StyledStack as="ol" gap="4" data-testid="stack-ol">
        {items}
      </StyledStack>
      <StyledVStack as="ul" gap="4" data-testid="vstack-ul">
        {items}
      </StyledVStack>
      <StyledStack as="ul" direction="row" gap="4" data-testid="row-ul">
        {items}
      </StyledStack>
      <StyledStack gap="4" data-testid="stack-div">
        <div style={{ height: "20px" }}>one</div>
        <div style={{ height: "20px" }}>two</div>
      </StyledStack>
    </div>
  );
}

/** A caller's own spacing and list style must beat the reset. */
export function StackListOverrides() {
  return (
    <div>
      <StyledVStack as="ul" gap="2" mt="4" px="4" data-testid="spaced">
        {items}
      </StyledVStack>
      <StyledVStack as="ul" gap="2" p="4" data-testid="padded">
        {items}
      </StyledVStack>
      <StyledHStack as="ol" gap="2" listStyle="decimal" data-testid="numbered">
        {items}
      </StyledHStack>
    </div>
  );
}

/**
 * A caller's `className` on every stack, row and list forms included
 * (NEH-1883). The class is a real Panda rule — written as a literal so the
 * extractor emits it — and sets a property no stack pattern touches, so a
 * computed `outline-style: dashed` can only have come from the caller's class.
 */
const callerClass = css({ outlineStyle: "dashed" });

export function StackClassNames() {
  return (
    // The class string rides on the wrapper: a ct file can import components
    // from a harness, not plain values.
    <div data-caller-class={callerClass}>
      <StyledHStack className={callerClass} data-testid="hstack">
        <span>a</span>
      </StyledHStack>
      <StyledHStack as="ul" className={callerClass} data-testid="hstack-ul">
        {items}
      </StyledHStack>
      <StyledVStack className={callerClass} data-testid="vstack">
        <span>a</span>
      </StyledVStack>
      <StyledStack direction="row" className={callerClass} data-testid="stack-row">
        <span>a</span>
      </StyledStack>
      <StyledStack direction={{ base: "row", md: "column" }} className={callerClass} data-testid="stack-responsive-row">
        <span>a</span>
      </StyledStack>
      <StyledStack className={callerClass} data-testid="stack-column">
        <span>a</span>
      </StyledStack>
    </div>
  );
}

export default StackLists;

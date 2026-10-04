import React from "react";
import StyledStack from "./StyledStack";
import StyledHStack from "./StyledHStack";
import StyledVStack from "./StyledVStack";

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

export default StackLists;

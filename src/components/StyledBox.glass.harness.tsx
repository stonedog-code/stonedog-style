import React from "react";
import { boxRecipe } from "styled-system/recipes";
import StyledHeading from "./StyledHeading";
import StyledText from "./StyledText";

/**
 * Mount target for `StyledBox.glass.contrast.ct.tsx` (NEH-1952).
 *
 * The shape of the largest consumer's dashboard tile, reduced to what paints
 * text: a `div` carrying `boxRecipe({ variant: "glass" })` directly — which is
 * how that tile applies it — holding a heading with a quieter "kind" span, a
 * subtitle in default `StyledText`, and a bare span that takes the box's own
 * colour. The tile sits on a page painted `boxBgMain`, which is what the host's
 * page behind a tile is, so a translucent surface composites over the same
 * colour it did in the app.
 *
 * Lives here, not in the spec, because Playwright CT cannot mount a component
 * declared inside the spec module.
 */
export function GlassTileHarness() {
  return (
    <div
      data-testid="page"
      style={{ background: "var(--colors-box-bg-main)", color: "var(--colors-text-main)", padding: 24 }}
    >
      <div data-testid="tile" className={boxRecipe({ variant: "glass" })}>
        <StyledHeading addSeparator={false}>
          <span data-testid="title">Pharmacy</span>{" "}
          <span data-testid="kind" style={{ fontSize: "0.8em" }}>
            Website
          </span>
        </StyledHeading>
        <StyledText data-testid="subtitle" size="sm">
          Great for finding websites.
        </StyledText>
        <span data-testid="box-text">Plain text the box itself colours</span>
      </div>
    </div>
  );
}

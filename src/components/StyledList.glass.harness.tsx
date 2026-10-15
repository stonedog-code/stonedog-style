import React from "react";
import { boxRecipe } from "styled-system/recipes";
import StyledList from "./StyledList";
import StyledText from "./StyledText";

/**
 * Mount target for `StyledList.glass.contrast.ct.tsx` (NEH-2068).
 *
 * The largest consumer's task-summary tile, reduced to what paints text: a
 * glass tile (`boxRecipe({ variant: "glass" })`, applied directly as that tile
 * does) holding a glass list. One row is a `StyledText`, which states
 * `textPrimary` itself; the other is bare text that inherits the tile's own
 * colour. The tile sits on a page painted `boxBgMain`.
 *
 * Lives here, not in the spec, because Playwright CT cannot mount a component
 * declared inside the spec module.
 */
export function GlassListTileHarness() {
  return (
    <div
      data-testid="page"
      style={{ background: "var(--colors-box-bg-main)", color: "var(--colors-text-main)", padding: 24 }}
    >
      <div data-testid="tile" className={boxRecipe({ variant: "glass" })}>
        <StyledList.Root variant="glass" data-testid="list">
          <StyledList.Item variant="glass">
            <StyledText data-testid="row-text">Pick up prescriptions</StyledText>
          </StyledList.Item>
          <StyledList.Item variant="glass">
            <span data-testid="row-bare">Call the pharmacy</span>
          </StyledList.Item>
        </StyledList.Root>
      </div>
    </div>
  );
}

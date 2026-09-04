import React from "react";
import StyledSimpleGrid from "./StyledSimpleGrid";

/**
 * Mount targets for grid-track-shrink.ct.tsx.
 *
 * They live here rather than in the spec because Playwright CT cannot mount a
 * component declared inside the spec — the mount call is hoisted and evaluated
 * in the browser bundle, which never sees the test module's scope.
 *
 * The fixture's whole job is a child whose **min-content width is wider than
 * its container**. That is the only kind of child that can expose the defect:
 * with a bare `1fr` track — which CSS resolves as `minmax(auto, 1fr)` — the
 * `auto` floor is the grid item's automatic minimum size, so an item that
 * cannot shrink drags the whole track past the grid's container. A long
 * `white-space: nowrap` string is the smallest honest way to build one.
 *
 * The container is a fixed pixel width rather than the viewport, so every
 * assertion means the same thing at all four component-test viewports.
 */

const CONTAINER_WIDTH = 320;

const UNSHRINKABLE_TEXT =
  "Supercalifragilisticexpialidocious-diagnostic-label-that-will-not-wrap-anywhere-at-all";

function UnshrinkableChild() {
  return <div data-testid="unshrinkable" style={{ whiteSpace: "nowrap" }}>{UNSHRINKABLE_TEXT}</div>;
}

function FixedContainer({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="container" style={{ width: `${CONTAINER_WIDTH}px` }}>
      {children}
    </div>
  );
}

/**
 * `columns` children: the first cannot shrink, the rest are ordinary. With a
 * bare `1fr` every track is equal, so ONE unshrinkable child inflates them all
 * — which is why the two-column case fails harder than the one-column case.
 */
function gridChildren(columns: number) {
  return Array.from({ length: columns }, (_, index) =>
    index === 0 ? <UnshrinkableChild key={index} /> : <div key={index}>short</div>,
  );
}

/** The child on its own, with no grid — the sentinel that it really cannot shrink. */
export function UnshrinkableProbe() {
  return (
    <FixedContainer>
      <UnshrinkableChild />
    </FixedContainer>
  );
}

export function SimpleGridProbe({
  columns,
  minTrackWidth,
}: {
  columns: number;
  minTrackWidth?: string;
}) {
  return (
    <FixedContainer>
      {/* Spread rather than pass `undefined`: `exactOptionalPropertyTypes` is on,
          and more to the point the guard has to exercise the component's OWN
          default, not a value the fixture supplied that happens to match it. */}
      <StyledSimpleGrid
        data-testid="grid"
        columns={columns}
        {...(minTrackWidth === undefined ? {} : { minTrackWidth })}
      >
        {gridChildren(columns)}
      </StyledSimpleGrid>
    </FixedContainer>
  );
}

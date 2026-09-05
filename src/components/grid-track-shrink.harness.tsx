import React from "react";
import StyledSimpleGrid from "./StyledSimpleGrid";
import StyledGrid from "./StyledGrid";

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

/**
 * ---------------------------------------------------------------------------
 * StyledGrid (NEH-1453)
 * ---------------------------------------------------------------------------
 *
 * **The column counts below are 5, 7 and 11, and that is load-bearing — do not
 * "tidy" them to 1, 2 and 3.**
 *
 * `StyledGrid` used to hand its computed `grid-template-columns` to Panda as a
 * style prop. Panda extracts styles by statically parsing source, so a runtime
 * value produced a class *name* with no rule behind it — and where that
 * appeared to work in an app it was a coincidence: the class name is derived
 * from the value, so a consumer whose own source happened to contain the same
 * literal somewhere else got a rule by accident. HopperGuard has exactly that
 * for `repeat(1, 1fr)` and `repeat(2, 1fr)`.
 *
 * A fixture using 1, 2 or 3 columns could therefore pass for the wrong reason
 * the moment anybody adds such a literal to this package. Nothing in any design
 * hard-codes a 5-, 7- or 11-column track list, so these cannot collide.
 *
 * The counts are also all > 1, which matters independently: the pre-fix
 * rendering was a SINGLE implicit content-sized track, so any assertion on the
 * track *count* fails against it.
 */

export function GridProbe({
  columns,
  minTrackWidth,
}: {
  columns: number | { base?: number; sm?: number; md?: number; lg?: number; xl?: number };
  minTrackWidth?: string;
}) {
  const count =
    typeof columns === "number"
      ? columns
      : Math.max(...Object.values(columns).filter((n): n is number => typeof n === "number"));
  return (
    <FixedContainer>
      <StyledGrid
        data-testid="grid"
        columns={columns}
        {...(minTrackWidth === undefined ? {} : { minTrackWidth })}
      >
        {gridChildren(count)}
      </StyledGrid>
    </FixedContainer>
  );
}

/**
 * A literal `templateColumns`, which is NOT a Panda property name and so was
 * never extracted even when written as a static string at the call site.
 *
 * The spec passes the value in rather than the harness owning it: every
 * constant here would otherwise be imported by the spec, and Playwright CT's
 * mount transform re-declares any harness import a mount call references,
 * which collides with the spec-side use ("Identifier ... has already been
 * declared", raised at collection, reported as "No tests found").
 */
export function GridTemplateColumnsProbe({ template }: { template: string }) {
  return (
    <FixedContainer>
      <StyledGrid data-testid="grid" templateColumns={template}>
        <div>a</div>
        <div>b</div>
      </StyledGrid>
    </FixedContainer>
  );
}

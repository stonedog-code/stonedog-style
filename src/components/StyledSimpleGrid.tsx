"use client";

import React, { useState, useEffect, useCallback } from "react";
import { styled } from "styled-system/jsx";
import type { HTMLStyledProps } from "styled-system/types";

// Panda CSS breakpoints (in px)
const BREAKPOINTS: Record<string, number> = {
  base: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

interface StyledSimpleGridProps extends Omit<HTMLStyledProps<"div">, "columns"> {
  columns?: number | { base?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gridTemplateRows?: string;
  gap?: string | number;
  /**
   * The minimum size of each `columns`-generated track. Defaults to `"0"`.
   *
   * `columns={n}` emits `repeat(n, minmax(<minTrackWidth>, 1fr))`. The default
   * of `0` lets a track shrink below its content's min-content width, which is
   * what keeps the grid inside its container.
   *
   * Pass `"auto"` to restore the pre-0.21.0 behaviour, in which a track refuses
   * to shrink below its widest unbreakable child and the whole grid grows past
   * its container. That is occasionally what you want — a deliberately
   * horizontally scrolled strip — but it now has to be asked for by name.
   */
  minTrackWidth?: string;
}

const PandaSimpleGrid = styled("div", {
  base: {
    display: "grid",
  },
});

/**
 * Resolve a responsive columns object to the correct value for the current window width.
 * Walks breakpoints from largest to smallest, returning the first match.
 */
function resolveResponsiveColumns(
  columns: { base?: number; sm?: number; md?: number; lg?: number; xl?: number },
  windowWidth: number,
): number {
  const ordered = ["xl", "lg", "md", "sm", "base"] as const;
  for (const bp of ordered) {
    // Read once and narrow, rather than testing then re-indexing with `!`. The
    // non-null assertion was hiding the fact that BREAKPOINTS[bp] is also an
    // indexed read and equally unchecked.
    const columnsAtBreakpoint = columns[bp];
    const minimumWidth = BREAKPOINTS[bp];
    if (columnsAtBreakpoint !== undefined && minimumWidth !== undefined) {
      if (windowWidth >= minimumWidth) return columnsAtBreakpoint;
    }
  }
  return columns.base ?? 1;
}

const StyledSimpleGrid: React.FC<StyledSimpleGridProps> = ({
  columns,
  gridTemplateRows,
  gap,
  minTrackWidth = "0",
  style,
  children,
  ...rest
}) => {
  const [resolvedCols, setResolvedCols] = useState<number>(() => {
    if (typeof columns === "number") return columns;
    if (typeof columns === "object" && columns !== null) {
      return columns.base ?? 1;
    }
    return 1;
  });

  const recalculate = useCallback(() => {
    if (typeof columns === "number") {
      setResolvedCols(columns);
    } else if (typeof columns === "object" && columns !== null) {
      setResolvedCols(resolveResponsiveColumns(columns, window.innerWidth));
    }
  }, [columns]);

  useEffect(() => {
    recalculate();
    window.addEventListener("resize", recalculate);
    return () => window.removeEventListener("resize", recalculate);
  }, [recalculate]);

  // Runtime-computed grid values MUST use inline style — Panda CSS drops them at build time
  //
  // `minmax(minTrackWidth, 1fr)`, not a bare `1fr`. In CSS `1fr` IS shorthand
  // for `minmax(auto, 1fr)`, and that `auto` floor is the grid item's automatic
  // minimum size — its min-content. So one child that cannot shrink (a long
  // unbroken string, a `white-space: nowrap` row, a fixed-width control) drags
  // the track wider than the grid's own container, and every sibling sized
  // `width: 100%` inherits the overflow. Measured on HopperGuard's dashboard at
  // 375px: a 1-column grid resolved a 425.875px track inside a 375px container,
  // and the shell clipped rather than scrolled (NEH-1446, NEH-1447).
  //
  // Guarded by grid-track-shrink.ct.tsx, which measures the resolved track in a
  // real browser. jsdom cannot see this at all — it has no layout engine, so it
  // reports every box as 0x0 and would agree that a 426px track fits 375px.
  const gridStyles: React.CSSProperties = {
    ...style,
    gridTemplateColumns: `repeat(${resolvedCols}, minmax(${minTrackWidth}, 1fr))`,
    gridTemplateRows,
    gap,
  };

  return (
    <PandaSimpleGrid
      {...rest}
      style={gridStyles}
    >
      {children}
    </PandaSimpleGrid>
  );
};

export default StyledSimpleGrid;
export { StyledSimpleGrid };

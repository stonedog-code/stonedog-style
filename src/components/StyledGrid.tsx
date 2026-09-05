import { styled, type HTMLStyledProps } from "styled-system/jsx";
import { cx, css } from "styled-system/css";
import { stripedRecipe } from "styled-system/recipes";
import React from "react";
import { log } from "../config/logger";

const PandaGrid = styled("div", {
  base: {
    display: "grid",
  },
});

/**
 * The breakpoints this component's responsive objects understand.
 *
 * Exactly the six declared by the preset, plus `base`. Order matters: the
 * runtime fills a value forward from each key to the next, so this array is the
 * cascade.
 */
const GRID_BREAKPOINTS = ["base", "sm", "md", "lg", "xl", "2xl", "3xl"] as const;

export type GridBreakpoint = (typeof GRID_BREAKPOINTS)[number];

/** A plain value, or one value per breakpoint. */
export type GridResponsiveValue<T> = T | Partial<Record<GridBreakpoint, T>>;

/*
 * ---------------------------------------------------------------------------
 * Why the track definitions travel as CSS custom properties (NEH-1453)
 * ---------------------------------------------------------------------------
 *
 * `StyledGrid` used to compute its `grid-template-*` values at runtime and hand
 * them to Panda as style props:
 *
 *     resolvedColumns = `repeat(${columns}, 1fr)`;
 *     <PandaGrid gridTemplateColumns={resolvedColumns} />
 *
 * Panda extracts styles by **statically parsing source at build time**. A value
 * computed at runtime is never seen by `panda cssgen`, so Panda's runtime
 * constructs a class *name* derived from the value and no rule is ever emitted
 * for it. Measured in this package's own component tier, `<StyledGrid
 * columns={2}>` inside a 320px container:
 *
 *     class="d_grid grid-tc_repeat(2,_1fr)"
 *     inline style: null
 *     computed grid-template-columns: 445.188px   <- ONE implicit, content-sized track
 *     rules in the sheet mentioning grid-template-columns: 1, and it is
 *       `.grid-tc_max-content_1fr` from StyledDefinitionList
 *
 * The same is true of `templateColumns` / `templateRows` / `templateAreas`,
 * which are not Panda property names at all, so even a static literal at the
 * call site is never extracted.
 *
 * Where it appeared to work in an app it was a **coincidence**: the class name
 * is derived from the value, so a consumer whose own source happened to contain
 * the same literal elsewhere got a rule by accident. That is why the fix cannot
 * simply rewrite the emitted string — a new string breaks the coincidence and
 * silently drops the columns.
 *
 * So the value has to reach the element by a route that does not depend on
 * static extraction. Inline `style` is that route, and it is what
 * `StyledSimpleGrid` already does. But a plain inline `grid-template-columns`
 * cannot carry media queries, which is why `StyledSimpleGrid` pays for the
 * responsive form with a JS resize listener (no server-rendered value, a
 * listener per grid, a flash on first paint).
 *
 * This component avoids that trade by splitting the two halves:
 *
 *   - the **rules** are literals in this file, so Panda really does extract
 *     them, one per breakpoint, with real `@media` conditions;
 *   - the **values** ride in on inline custom properties, which are never
 *     extracted, never parsed by Panda, and always applied.
 *
 * Result: real CSS breakpoints, correct on the server, no resize listener, and
 * no upper bound on the column count.
 *
 * The runtime fills a value FORWARD across breakpoints rather than relying on
 * nested `var()` fallbacks, so each rule is a flat `var(--x, none)`. `none` is
 * the initial value of every `grid-template-*` property, so an axis nobody set
 * resolves to exactly what it would have been.
 */

const TRACK_VAR = {
  columns: "--sds-grid-tc",
  rows: "--sds-grid-tr",
  areas: "--sds-grid-ta",
} as const;

type GridAxis = keyof typeof TRACK_VAR;

/**
 * One class per axis, applied only when that axis has a value.
 *
 * They are separate constants on purpose. A single combined class would declare
 * `grid-template-rows: none` on every grid, which is the initial value but is
 * still a *declaration* — and it would then race, at equal specificity, with
 * any `grid-template-rows` a consumer set through `className`. An axis nobody
 * asked about is left untouched instead.
 *
 * Every value below is a string LITERAL. That is the entire point: Panda has to
 * be able to read them without running anything.
 */
const AXIS_CLASS: Record<GridAxis, string> = {
  columns: css({
    gridTemplateColumns: "var(--sds-grid-tc-base, none)",
    sm: { gridTemplateColumns: "var(--sds-grid-tc-sm, none)" },
    md: { gridTemplateColumns: "var(--sds-grid-tc-md, none)" },
    lg: { gridTemplateColumns: "var(--sds-grid-tc-lg, none)" },
    xl: { gridTemplateColumns: "var(--sds-grid-tc-xl, none)" },
    "2xl": { gridTemplateColumns: "var(--sds-grid-tc-2xl, none)" },
    "3xl": { gridTemplateColumns: "var(--sds-grid-tc-3xl, none)" },
  }),
  rows: css({
    gridTemplateRows: "var(--sds-grid-tr-base, none)",
    sm: { gridTemplateRows: "var(--sds-grid-tr-sm, none)" },
    md: { gridTemplateRows: "var(--sds-grid-tr-md, none)" },
    lg: { gridTemplateRows: "var(--sds-grid-tr-lg, none)" },
    xl: { gridTemplateRows: "var(--sds-grid-tr-xl, none)" },
    "2xl": { gridTemplateRows: "var(--sds-grid-tr-2xl, none)" },
    "3xl": { gridTemplateRows: "var(--sds-grid-tr-3xl, none)" },
  }),
  areas: css({
    gridTemplateAreas: "var(--sds-grid-ta-base, none)",
    sm: { gridTemplateAreas: "var(--sds-grid-ta-sm, none)" },
    md: { gridTemplateAreas: "var(--sds-grid-ta-md, none)" },
    lg: { gridTemplateAreas: "var(--sds-grid-ta-lg, none)" },
    xl: { gridTemplateAreas: "var(--sds-grid-ta-xl, none)" },
    "2xl": { gridTemplateAreas: "var(--sds-grid-ta-2xl, none)" },
    "3xl": { gridTemplateAreas: "var(--sds-grid-ta-3xl, none)" },
  }),
};

/**
 * Spread a responsive value across every breakpoint, carrying each value
 * forward until the next one overrides it.
 *
 * Filling forward is what lets each emitted rule be a flat `var(--x, none)`: at
 * `lg` the rule reads `--sds-grid-tc-lg`, so that property has to hold the
 * value in force at `lg` whether it was set there or inherited from `md`.
 *
 * Returns `undefined` when the caller supplied nothing, so the axis class is
 * not applied at all.
 */
function resolveAxis(
  value: GridResponsiveValue<string> | undefined,
  componentName: string,
): Partial<Record<GridBreakpoint, string>> | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === "string") {
    const filled: Partial<Record<GridBreakpoint, string>> = {};
    for (const breakpoint of GRID_BREAKPOINTS) filled[breakpoint] = value;
    return filled;
  }

  if (typeof value !== "object") return undefined;

  const unsupported = Object.keys(value).filter(
    (key) => !(GRID_BREAKPOINTS as readonly string[]).includes(key),
  );
  if (unsupported.length > 0) {
    // Loud rather than silent. Panda conditions other than a breakpoint
    // (`_hover`, `_dark`, the array syntax) cannot be carried by a custom
    // property, because there is no rule here that reads one under that
    // condition. Before NEH-1453 they were dropped without a word; now they are
    // dropped with one. Reach for `className={css({ ... })}` instead, which
    // Panda extracts from the call site.
    log.warn(`[${componentName}] ignoring unsupported responsive key(s)`, {
      unsupported,
      supported: GRID_BREAKPOINTS,
    });
  }

  const filled: Partial<Record<GridBreakpoint, string>> = {};
  let carried: string | undefined;
  for (const breakpoint of GRID_BREAKPOINTS) {
    const declared = (value as Partial<Record<GridBreakpoint, string>>)[breakpoint];
    if (declared !== undefined) carried = declared;
    if (carried !== undefined) filled[breakpoint] = carried;
  }
  return Object.keys(filled).length > 0 ? filled : undefined;
}

/**
 * `repeat(n, minmax(<minTrackWidth>, 1fr))`, not `repeat(n, 1fr)`.
 *
 * In CSS `1fr` **is** shorthand for `minmax(auto, 1fr)`, and that `auto` floor
 * is the grid item's automatic minimum size — its min-content. One child that
 * cannot shrink therefore drags the whole track past the grid's container, and
 * every sibling sized `width: 100%` inherits the overflow (NEH-1446/NEH-1447,
 * measured at 425.875px inside a 375px container).
 *
 * `StyledSimpleGrid` made this change in 0.21.0 and `StyledGrid` deliberately
 * did not, because at the time the emitted string still had to match a literal
 * in the consumer's own source for any rule to exist at all — a new string
 * would have broken that coincidence and dropped the columns entirely. Once the
 * value stops travelling through Panda, that objection disappears, which is why
 * the two changes belong in the same commit and not before it.
 */
function columnsToTemplate(count: number, minTrackWidth: string): string {
  return `repeat(${count}, minmax(${minTrackWidth}, 1fr))`;
}

function columnsToTemplateValue(
  columns: GridResponsiveValue<number>,
  minTrackWidth: string,
): GridResponsiveValue<string> | undefined {
  if (typeof columns === "number") return columnsToTemplate(columns, minTrackWidth);
  if (typeof columns !== "object" || columns === null) return undefined;

  const mapped: Partial<Record<GridBreakpoint, string>> = {};
  for (const [key, count] of Object.entries(columns)) {
    if (typeof count === "number") {
      mapped[key as GridBreakpoint] = columnsToTemplate(count, minTrackWidth);
    }
  }
  return mapped;
}

/** Write one axis' resolved values out as inline custom properties. */
function writeAxisVars(
  target: Record<string, string>,
  axis: GridAxis,
  resolved: Partial<Record<GridBreakpoint, string>>,
) {
  for (const breakpoint of GRID_BREAKPOINTS) {
    const value = resolved[breakpoint];
    if (value !== undefined) target[`${TRACK_VAR[axis]}-${breakpoint}`] = value;
  }
}

export interface StyledGridProps
  extends Omit<
    HTMLStyledProps<"div">,
    "columns" | "gridTemplateColumns" | "gridTemplateRows" | "gridTemplateAreas"
  > {
  children?: React.ReactNode;
  isStriped?: boolean;
  showGridLines?: boolean;
  /**
   * A `grid-template-columns` value, or one per breakpoint.
   *
   * Narrower than Panda's `ConditionalValue` on purpose: only `base` and the
   * six preset breakpoints are carried. Any other condition is ignored with a
   * warning — see `resolveAxis`.
   */
  templateColumns?: GridResponsiveValue<string>;
  templateRows?: GridResponsiveValue<string>;
  templateAreas?: GridResponsiveValue<string>;
  /** Alias for `templateColumns`; takes precedence when both are supplied. */
  gridTemplateColumns?: GridResponsiveValue<string>;
  gridTemplateRows?: GridResponsiveValue<string>;
  gridTemplateAreas?: GridResponsiveValue<string>;
  /** Column count. Emits `repeat(n, minmax(minTrackWidth, 1fr))`. */
  columns?: GridResponsiveValue<number>;
  /**
   * The minimum size of each `columns`-generated track. Defaults to `"0"`.
   *
   * Pass `"auto"` to let a track refuse to shrink below its widest unbreakable
   * child, which is occasionally what you want — a deliberately horizontally
   * scrolled strip — but now has to be asked for by name. Mirrors
   * `StyledSimpleGrid`.
   */
  minTrackWidth?: string;
}

const StyledGrid = React.forwardRef<HTMLDivElement, StyledGridProps>(
  (
    {
      isStriped,
      showGridLines,
      className,
      style,
      templateColumns,
      templateRows,
      templateAreas,
      gridTemplateColumns,
      gridTemplateRows,
      gridTemplateAreas,
      columns,
      minTrackWidth = "0",
      ...props
    },
    ref,
  ) => {
    // Explicit template wins over the `columns` shorthand, as before.
    const columnsValue =
      gridTemplateColumns ??
      templateColumns ??
      (columns === undefined ? undefined : columnsToTemplateValue(columns, minTrackWidth));

    const resolved: Record<GridAxis, Partial<Record<GridBreakpoint, string>> | undefined> = {
      columns: resolveAxis(columnsValue, "StyledGrid"),
      rows: resolveAxis(gridTemplateRows ?? templateRows, "StyledGrid"),
      areas: resolveAxis(gridTemplateAreas ?? templateAreas, "StyledGrid"),
    };

    const trackVars: Record<string, string> = {};
    const axisClasses: string[] = [];
    for (const axis of ["columns", "rows", "areas"] as const) {
      const axisValues = resolved[axis];
      if (axisValues === undefined) continue;
      writeAxisVars(trackVars, axis, axisValues);
      axisClasses.push(AXIS_CLASS[axis]);
    }

    const combinedClassName = cx(
      isStriped ? stripedRecipe() : undefined,
      showGridLines
        ? css({
          "& > *": {
            outline: "1px solid",
            outlineColor: "borderBgPrimary",
            backgroundColor: "boxBgPrimary",
            borderRadius: "15px",
          },
        })
        : undefined,
      ...axisClasses,
      className,
    );

    const childrenDetails = React.Children.map(props.children, (child) => {
      if (React.isValidElement(child)) {
        const element = child as React.ReactElement<{ id?: string }>;
        const params = element.props;
        return {
          key: child.key,
          id: params?.id,
          type: typeof child.type === 'string' ? child.type : (child.type as React.FunctionComponent).displayName || (child.type as React.FunctionComponent).name || 'Unknown',
          isNull: child === null
        };
      }
      return "Non-Element Child";
    });

    log.debug("[StyledGrid] Rendering Grid", {
      childCount: React.Children.count(props.children),
      showGridLines,
      childrenDetails
    });

    // The caller's own `style` goes first: a `grid-template-columns` they set
    // inline is their business and should still beat our class. Our custom
    // properties are appended so nothing can accidentally shadow them.
    const mergedStyle =
      Object.keys(trackVars).length > 0
        ? ({ ...style, ...trackVars } as React.CSSProperties)
        : style;

    return (
      <PandaGrid
        ref={ref}
        className={combinedClassName}
        {...(mergedStyle === undefined ? {} : { style: mergedStyle })}
        {...props}
      />
    );
  },
);

StyledGrid.displayName = "StyledGrid";

export default StyledGrid;

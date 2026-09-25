"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import StyledBox from "../StyledBox";
import StyledCollapsible from "../StyledCollapsible";
import StyledText from "../StyledText";
import { ChartDataTable } from "./ChartDataTable";
import { useResolvedFontSize } from "../../config/style-config";
import { ChartEmpty, ChartFrame, ChartSingleReading } from "./ChartFrame";
import { ChartLegend } from "./ChartLegend";
import { ChartRangeControl } from "./ChartRangeControl";
import { CHART_GRID_VAR, CHART_SURFACE_VAR } from "./chart-palette";
import { useSeededRange, type ChartRangeKey } from "./chart-range";
import {
  plottableRows,
  resolveSeries,
  shouldShowLegend,
  type ResolvedChartSeries,
} from "./chart-series";
import type { BaseChartProps, ChartValueFormatter, ChartDomain } from "./chart-types";
import { SR_ONLY } from "./sr-only";

/**
 * One chart component: a plot, the same numbers as a table, a range control
 * and fullscreen (NEH-1521).
 *
 * ## The table is there by default, and `"collapsible"` is the considered
 * exception (NEH-1521, NEH-1642, NEH-1647)
 *
 * `showTable` defaults to `true`, and every `StyledChart` then renders its
 * table beneath the plot — on a dashboard widget as readily as in fullscreen
 * or an export. That default was chosen over a "toggle when the widget is
 * small" compromise, and the reasoning is intact:
 *
 * - A toggle is a hidden state. The reader has to remember which view they are
 *   in and that the other exists, which is working memory spent on the tool
 *   rather than on their own readings.
 * - Always-visible satisfies "provide a text alternative" by construction,
 *   with nothing to discover.
 * - Nothing swaps, so there is no `role="tablist"`, no `aria-selected`, no
 *   `aria-live` announcement and no focus management — and no way for the two
 *   halves to disagree about which one you are reading.
 *
 * The cost is real: each widget roughly doubles in height. It is paid in
 * `ChartDataTable`, which scrolls its own body with a sticky header past a
 * handful of rows so that a year of daily readings cannot push the rest of the
 * page off the screen.
 *
 * **What that argument does not cover is EIGHT charts stacked in one widget**,
 * where eight always-open tables is the page nobody can scroll. So the choice
 * is per-caller rather than per-package: `showTable="collapsible"` puts the
 * same table behind a `StyledCollapsible`, and `tableDefaultOpen` says which
 * state it starts in. A surface the original argument was made about — one
 * chart, one table — simply keeps the default and is unchanged.
 *
 * The disclosure is assembled HERE rather than by the host, so it rides inside
 * `body` and therefore appears in the fullscreen overlay with no host wiring —
 * and so that two products cannot word the control differently
 * (`chartTableDisclosureName` is the one place it is spelled). Its eight
 * accessibility criteria are asserted in
 * `../StyledChartTableDisclosure.ct.tsx`.
 *
 * ## The plot is a seam, not a dependency
 *
 * This package adds no charting library. `renderPlot` receives everything a
 * mark needs — the rows, the resolved series with their colours, dashes and
 * hatches, the axis formatters — and the host renders it with whatever it
 * already has, keeping that library's bundle cost behind its own lazy import.
 *
 * The default is not a stub: with no `renderPlot`, the component is a titled,
 * ranged, fullscreen-able TABLE of the series. That is a working chart for
 * every purpose except the picture, and it is deliberately the fallback rather
 * than an error, because the numbers were always the thing the reader came
 * for. `data-plot="absent"` marks the case so a host can assert it never
 * happens in production.
 *
 * ## Panda and sizes
 *
 * Every metric in this subtree is inline `style`. Panda extracts LITERAL style
 * values by statically parsing source, so `minHeight={size}` emits no rule and
 * still lands a class name in the DOM — a silent failure with no build error.
 * Sizes that should follow the host reach it through a custom property with a
 * literal fallback, never through a token key, which is meaningless inline.
 */

const DEFAULT_HEIGHT = 250;
const DEFAULT_EMPTY = "Not enough data to chart yet.";

/** The collapsible table's trigger, for a host's browser tier. */
export const CHART_TABLE_TRIGGER_TESTID = "chart-table-disclosure";
/** The region that trigger controls, for a host's browser tier. */
export const CHART_TABLE_REGION_TESTID = "chart-table-disclosure-region";

/**
 * What the collapsible table's control is called, everywhere.
 *
 * One function rather than a string at each call site: WCAG 3.2.4 Consistent
 * Identification is that a control reads the same wherever it is met, and a
 * wording rule kept by convention is a wording rule that drifts.
 *
 * `subject` is the metric or the measure — "Weight", "Adherence" — never the
 * chart's full heading, which carries the range ("Weight — Last 7 days") and
 * would put a date range inside a control name.
 */
export function chartTableDisclosureName(subject: string): string {
  return `${subject} data table`;
}

/**
 * The open/closed cue a sighted reader gets, since `aria-expanded` is not one.
 *
 * Text, not artwork: this package ships no icons at all and never will, so an
 * indicator here has to be something a font already has. A host that wants its
 * own glyph composes `StyledCollapsible` directly.
 */
const DISCLOSURE_INDICATOR = { expanded: "▾", collapsed: "▸" } as const;

/** Everything the host's mark renderer needs, and nothing it has to re-derive. */
export interface ChartPlotArgs {
  data: Record<string, unknown>[];
  /** Series with their slot, colour variable, dash and hatch already resolved. */
  series: ResolvedChartSeries[];
  xKey: string;
  height: number;
  /** The plot's accessible name. `""` means deliberately decorative. */
  label: string;
  yDomain?: ChartDomain | undefined;
  tickFormatter?: ChartValueFormatter | undefined;
  labelFormatter?: ChartValueFormatter | undefined;
  xTicks?: string[] | undefined;
  showLegend: boolean;
  /** True while the chart is in its fullscreen overlay. */
  fullscreen: boolean;
}

export type ChartPlotRenderer = (args: ChartPlotArgs) => React.ReactNode;

export interface StyledChartProps extends BaseChartProps {
  /** The panel heading. Omit for an unframed container. */
  title?: React.ReactNode;
  /** Tighter padding, for a frame inside a dashboard widget. */
  compact?: boolean;
  /** Renders the mark. See the seam note above. */
  renderPlot?: ChartPlotRenderer;
  /** Extra controls placed beside the range control. */
  toolbar?: React.ReactNode;

  // --- range ---------------------------------------------------------------
  /**
   * The range this chart STARTS in, and adopts whenever the page changes it.
   *
   * Defaulted-and-controllable rather than controlled or uncontrolled: the
   * page seeds every chart, and a reader can then change one without
   * disturbing the others. See `useSeededRange` for why neither pure form can
   * express that.
   */
  range?: ChartRangeKey;
  /** Called for a reader's own choice. Never for adopting a new seed. */
  onRangeChange?: (range: ChartRangeKey) => void;
  /** Which ranges to offer. Omit for all five. */
  ranges?: readonly ChartRangeKey[];
  /** Hide the range control on a chart whose range the page owns entirely. */
  showRangeControl?: boolean;

  // --- fullscreen ----------------------------------------------------------
  /** Hide the fullscreen button. */
  showFullscreen?: boolean;

  // --- table ---------------------------------------------------------------
  /** The table's caption. Defaults to naming the chart. */
  tableCaption?: string;
  /** What the x column is called. */
  xLabel?: string;
  /** Rows before the table body scrolls. */
  tableScrollAfterRows?: number;
  /**
   * `true` (the default) renders the table under the plot; `false` suppresses
   * it, which is reserved for a chart with no tabular reading;
   * `"collapsible"` puts it behind a disclosure. See the component docblock
   * for why the default is what it is and when to depart from it.
   */
  showTable?: boolean | "collapsible";
  /**
   * What the table is OF — "Weight", "Adherence" — naming the collapsible's
   * control. Defaults to `label`, which is usually right; supply it when the
   * accessible name is a sentence rather than a subject.
   *
   * Ignored unless `showTable === "collapsible"`.
   */
  tableSubject?: string;
  /**
   * The state a collapsible table starts in. Default `false`.
   *
   * Defaulted-and-uncontrolled: the caller says where it starts, the reader
   * owns it thereafter. A chart that is the whole page opens it; a widget
   * stacking several does not.
   */
  tableDefaultOpen?: boolean;

  /** Shown under a single reading, in the host's own words. */
  singleReadingHint?: string;
  /** Legend swatch style — bars get a filled swatch, lines a stroked rule. */
  legendVariant?: "line" | "bar";
}

export const StyledChart: React.FC<StyledChartProps> = ({
  data,
  series,
  label,
  title,
  compact = false,
  xKey = "date",
  height = DEFAULT_HEIGHT,
  yDomain,
  tickFormatter,
  labelFormatter,
  xTicks,
  showLegend,
  emptyMessage = DEFAULT_EMPTY,
  minPoints = 2,
  renderPlot,
  toolbar,
  range = "week",
  onRangeChange,
  ranges,
  showRangeControl = true,
  showFullscreen = true,
  tableCaption,
  xLabel = "Date",
  tableScrollAfterRows,
  showTable = true,
  tableSubject,
  tableDefaultOpen = false,
  singleReadingHint,
  legendVariant = "line",
  "data-testid": testId,
}) => {
  /**
   * The fullscreen control's label size, resolved against the reader's profile
   * rather than pinned to a tier (NEH-1645). See `FULLSCREEN_BUTTON_STYLE` for
   * why it cannot live beside the rest of that button's appearance.
   */
  const controlFontSize = useResolvedFontSize({ size: "md" });
  const instanceId = useId().replace(/:/g, "");
  const resolved = resolveSeries(series, instanceId);
  const [activeRange, chooseRange] = useSeededRange(range, onRangeChange);
  const [fullscreen, setFullscreen] = useState(false);
  /*
   * The disclosure's state is held HERE rather than left inside
   * `StyledCollapsible`, for two reasons that both come from `body` being
   * rendered twice while fullscreen is open — once inert behind the overlay,
   * once in it.
   *
   * - The indicator has to follow the state, and `StyledCollapsible` takes
   *   `trigger` as a fixed node without handing its state back. Uncontrolled,
   *   the glyph could only ever be static, leaving `aria-expanded` as the sole
   *   cue and a sighted reader with nothing — the colour-is-never-the-only-cue
   *   rule, applied to state.
   * - One state means the copy in the overlay opens at the same place the one
   *   behind it was left, instead of resetting because it is a second instance.
   */
  const [tableOpen, setTableOpen] = useState(tableDefaultOpen);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const exitRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setFullscreen(false), []);

  /*
   * Fullscreen is an in-page overlay, NOT the Fullscreen API.
   *
   * `requestFullscreen` hides the browser's own chrome, and with it the back
   * button and the tab strip — for a reader who is not certain how they got
   * to a page, removing the way back is disorienting in a way that a bigger
   * chart does not repay. It also needs a user gesture, is refused outright in
   * some embedded webviews, and cannot be styled or reliably tested. An
   * overlay behaves identically everywhere, prints, and is one `Escape` away
   * from gone.
   */
  useEffect(() => {
    if (!fullscreen) return;
    // Captured INSIDE the effect, not read in the cleanup. `triggerRef.current`
    // at cleanup time is whatever React has left there, and eslint is right to
    // flag it — this is also why the trigger button stays mounted behind the
    // overlay rather than being conditionally removed. A ref to an unmounted
    // node is null, focus lands on <body>, and a keyboard reader closing the
    // overlay is returned to the top of the page.
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    exitRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      void trigger;
    };
  }, [fullscreen, close]);

  /*
   * Focus goes back to the trigger in a SEPARATE effect, keyed on leaving
   * fullscreen rather than on the overlay's cleanup.
   *
   * Cleanup runs before React commits the render that removes `inert` from the
   * page behind, and `.focus()` on an inert element is a silent no-op — focus
   * lands on <body>, which for a keyboard reader means starting the page
   * again from the top. Measured: the test asserting this failed with the
   * button plainly present in the DOM, which is exactly how quiet the failure
   * is.
   */
  const wasFullscreen = useRef(false);
  useEffect(() => {
    if (wasFullscreen.current && !fullscreen) triggerRef.current?.focus();
    wasFullscreen.current = fullscreen;
  }, [fullscreen]);

  const table = (
    <ChartDataTable
      data={data}
      series={resolved}
      xKey={xKey}
      xLabel={xLabel}
      caption={tableCaption ?? `${label || "Chart"} — the same readings as a table`}
      {...(tickFormatter ? { headerFormatter: tickFormatter } : {})}
      {...(tableScrollAfterRows !== undefined
        ? { scrollAfterRows: tableScrollAfterRows }
        : {})}
    />
  );

  // `label` may deliberately be `""` — "this chart is decorative" — and an
  // empty subject would name the control " data table". Hence `||`, not `??`.
  const disclosureName = chartTableDisclosureName(tableSubject || label || "Chart");
  const indicator = tableOpen ? "expanded" : "collapsed";

  const plotted = plottableRows(data, resolved);
  const plotHeight = fullscreen ? Math.max(height, 420) : height;

  const legendOn = shouldShowLegend(resolved.length, showLegend);

  let plot: React.ReactNode;
  let plotAbsent = false;
  if (plotted.length === 0) {
    plot = <ChartEmpty message={emptyMessage} height={plotHeight} />;
  } else if (plotted.length === 1 && plotted.length < minPoints) {
    /*
     * Three outcomes, not two.
     *
     * `emptyMessage` says some form of "nothing recorded", and printing that
     * over a reader's single real reading is a false statement about their own
     * data. Nothing plottable keeps the message; exactly one plottable row
     * shows the reading; two or more draw the mark.
     */
    const row = plotted[0]!;
    const formatWhen = labelFormatter ?? tickFormatter;
    const rawWhen = row[xKey];
    plot = (
      <ChartSingleReading
        readings={resolved
          .filter((s) => row[s.dataKey] != null)
          .map((s) => ({
            label: s.label,
            value: String(row[s.dataKey]),
            ...(s.unit ? { unit: s.unit } : {}),
          }))}
        when={rawWhen == null ? "" : (formatWhen ?? String)(String(rawWhen))}
        height={plotHeight}
        {...(singleReadingHint ? { hint: singleReadingHint } : {})}
      />
    );
  } else if (plotted.length < minPoints) {
    plot = <ChartEmpty message={emptyMessage} height={plotHeight} />;
  } else if (renderPlot) {
    plot = (
      <>
        {renderPlot({
          data,
          series: resolved,
          xKey,
          height: plotHeight,
          label,
          yDomain,
          tickFormatter,
          labelFormatter,
          xTicks,
          showLegend: legendOn,
          fullscreen,
        })}
        {legendOn && <ChartLegend series={resolved} variant={legendVariant} />}
      </>
    );
  } else {
    plotAbsent = true;
    plot = null;
  }

  const body = (
    <>
      {(showRangeControl || toolbar || showFullscreen) && (
        <StyledBox
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
        >
          {showRangeControl ? (
            <ChartRangeControl
              value={activeRange}
              onChange={chooseRange}
              label={`Range for ${label || (typeof title === "string" ? title : "chart")}`}
              {...(ranges ? { ranges } : {})}
            />
          ) : (
            <span />
          )}
          <StyledBox display="flex" alignItems="center" gap={2}>
            {toolbar}
            {showFullscreen && (
              <button
                ref={triggerRef}
                type="button"
                data-testid="chart-fullscreen-open"
                onClick={() => setFullscreen(true)}
                style={{ ...FULLSCREEN_BUTTON_STYLE, fontSize: controlFontSize }}
              >
                {/*
                  * A visible word, not an icon alone. Every control in this
                  * system carries a label a reader can read; an expand glyph
                  * is a convention, and a convention is a thing you have to
                  * already know.
                  */}
                Full screen
                <span style={SR_ONLY}>
                  {` — opens ${label || "this chart"} larger`}
                </span>
              </button>
            )}
          </StyledBox>
        </StyledBox>
      )}

      <div data-plot={plotAbsent ? "absent" : "present"}>{plot}</div>

      {showTable !== false && data.length > 0 && (
        /*
         * A plain div, not `<StyledBox mt={3}>`. StyledBox renders an inner
         * wrapper carrying `overflow: hidden` and `height: 100%`, which is
         * right for the layout cases it exists for and wrong here: it clips
         * the table's own scroll container, which is the one thing making an
         * always-present 365-row table usable.
         *
         * It also keeps the trigger and the region as IMMEDIATE siblings —
         * `StyledCollapsible` renders a fragment of exactly `<button>` then
         * `<div>` — so the next Tab after the control lands in what it just
         * revealed rather than somewhere past it (WCAG 2.4.3).
         */
        <div style={{ marginTop: "0.75rem" }}>
          {showTable === "collapsible" ? (
            <StyledCollapsible
              open={tableOpen}
              onOpenChange={setTableOpen}
              aria-label={disclosureName}
              triggerTestId={CHART_TABLE_TRIGGER_TESTID}
              contentTestId={CHART_TABLE_REGION_TESTID}
              trigger={
                <>
                  {/*
                   * `aria-hidden`, because the words beside it already say
                   * this. An announced indicator adds a second, wordless
                   * mention of the same control to a screen reader's list.
                   */}
                  <span
                    aria-hidden="true"
                    data-chart-table-indicator={indicator}
                    style={{ display: "inline-flex" }}
                  >
                    {DISCLOSURE_INDICATOR[indicator]}
                  </span>
                  {/*
                   * A `StyledText`, not a bare string. `CollapsibleTrigger` is
                   * a raw styled `<button>`, and a `<button>` inherits no
                   * font-size from the document — so raw text here would sit at
                   * the UA sheet's 13.33px at every font-size profile.
                   */}
                  <StyledText>{disclosureName}</StyledText>
                </>
              }
            >
              {table}
            </StyledCollapsible>
          ) : (
            table
          )}
        </div>
      )}
    </>
  );

  const framed = (
    <ChartFrame
      compact={compact}
      {...(title !== undefined ? { title } : {})}
      {...(testId ? { "data-testid": testId } : {})}
    >
      {body}
    </ChartFrame>
  );

  if (!fullscreen) return framed;

  return (
    <>
      {/*
        * The page behind the overlay is `inert` while it is open: not
        * focusable, not clickable, not reachable by a screen reader's virtual
        * cursor. That is what makes `aria-modal` true rather than merely
        * asserted — one attribute in place of a hand-rolled focus trap that
        * would have to enumerate every focusable descendant of an arbitrary
        * host's `toolbar`.
        *
        * `display: contents` so the wrapper itself has no layout effect. The
        * trigger button stays MOUNTED inside it, deliberately: the effect
        * above returns focus to it, and a ref to an unmounted node is null.
        */}
      <div style={{ display: "contents" }} inert>
        {framed}
      </div>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === "string" ? title : "Chart")}
        data-testid="chart-fullscreen"
        style={{
          position: "fixed",
          inset: 0,
          // A literal rather than a custom property: `zIndex` is typed
          // `number | "auto"`, and a host that needs a different layer wraps
          // this in its own stacking context rather than re-typing the prop.
          zIndex: 1400,
          background: CHART_SURFACE_VAR,
          overflow: "auto",
          padding: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "0.5rem",
          }}
        >
          <button
            ref={exitRef}
            type="button"
            data-testid="chart-fullscreen-close"
            onClick={close}
            style={{ ...FULLSCREEN_BUTTON_STYLE, fontSize: controlFontSize }}
          >
            Exit full screen
          </button>
        </div>
        {body}
      </div>
    </>
  );
};

/**
 * The fullscreen buttons' metrics.
 *
 * A shared object rather than two copies, and inline rather than a Panda prop
 * for the reason the component docblock gives. 48px is the house tap-target
 * floor; `currentColor` on the border keeps the control's contrast tied to its
 * own label rather than to a second, separately-drifting colour choice.
 */
const FULLSCREEN_BUTTON_STYLE: React.CSSProperties = {
  minHeight: "max(48px, var(--stonedog-chart-control-size, 48px))",
  minWidth: "max(48px, var(--stonedog-chart-control-size, 48px))",
  paddingInline: "0.75rem",
  /*
   * NO `fontSize` HERE, deliberately (NEH-1645).
   *
   * It used to read `var(--font-sizes-md, 1rem)`, which looks like the house
   * mechanism and is inert: the thirteen `--font-sizes-*` properties are
   * declared once at `:root` with static values, so naming a tier pins this
   * button at that tier for every profile. Following the reader needs
   * `useResolvedFontSize`, and a hook cannot be called from a module-level
   * constant — so the size is applied at each use site, where the component
   * can call it. The rest of the button's appearance stays shared here.
   */
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: CHART_GRID_VAR,
  borderRadius: 6,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

export default StyledChart;

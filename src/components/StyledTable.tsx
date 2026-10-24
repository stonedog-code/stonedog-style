"use client";

import React from "react";
import { styled } from "styled-system/jsx";
import { log } from "../config/logger";
import StyledBox from "./StyledBox";
import StyledScrollbar from "./StyledScrollbar";
import { useResolvedFontSize } from "../config/style-config";
import type { FontSizeKey } from "../config/types";

/**
 * A data table that renders real table elements.
 *
 * Extracted from HopperGuard, where it began as Chakra's `Table.*` compound
 * component. Chakra rendered real `<table>` markup and the app's e2e spec
 * asserts `toHaveRole("table")`, so every part here is pinned to the semantic
 * element Chakra produced rather than to a styled `<div>`. A div grid is
 * pixel-identical and an accessibility regression: screen readers announce row
 * and column position from the table role, and lose it entirely on divs.
 *
 * The compound shape is deliberate. `Header` takes a column list because that
 * is the shape every consumer already had; the rest are thin passthroughs so a
 * caller can drop to raw rows and cells whenever the list shape does not fit.
 */

/** A column for `StyledTable.Header`. Extra props reach the `<th>`. */
export interface ColumnDefinition
  extends React.ComponentProps<typeof PandaTableColumnHeader> {
  key: string;
  label: string;
}

const PandaTableRoot = styled("table", {
  base: {
    borderCollapse: "collapse",
    textAlign: "start",
    verticalAlign: "top",
    // Digits share a column width, so numeric cells line up down the table.
    fontVariantNumeric: "lining-nums tabular-nums",
    /**
     * MEASURED off the originating Chakra build with getComputedStyle, not
     * derived from tokens: font 14px / line-height 20px, cells 12px on every
     * side, a 1px rule under each cell. Reasoning from the token scale instead
     * (fontSize md, py 2) put the table 51px too tall — the font, not the
     * padding, drove the difference.
     *
     * ## The measurement stands; the hardcoded px does not (NEH-1561)
     *
     * `fontSize: "14px"` was a **px literal**, which this repo forbids outright
     * — "never a hardcoded px font size — the scale is rem-based so it honours
     * the browser's own font setting, which is the affordance users with low
     * vision actually reach for" (CLAUDE.md, "Adding or changing a component",
     * rule 3). It ignored the browser's setting AND the reader's profile: a
     * table rendered 14px at all five profiles on both ramps.
     *
     * That is the worst of the five components to freeze. A table is where this
     * product puts vitals, medication lists and schedules — dense rows of small
     * text, read by the people the type scale exists for, at the one size the
     * setting could not reach.
     *
     * **The Chakra baseline is preserved exactly, and by arithmetic rather than
     * by luck.** `StyledTable` defaults `textSize` to `sm`, one step below body,
     * which at `profile="md"` on this package's ramp resolves to `0.875rem` =
     * **14px**; `1.4286` × 14 = **20.0px**, the measured line height. So the
     * pin was never needed to hold the baseline — only to hold it still.
     *
     * These two are the static fallback for a bare `PandaTableRoot`;
     * `StyledTable` overrides the font size inline with the resolved step. The
     * line height is unitless deliberately, so it tracks whatever that is
     * instead of needing its own resolution.
     */
    fontSize: "var(--font-sizes-sm, 0.875rem)",
    lineHeight: "1.4286",
  },
  variants: {
    /**
     * `size` was a Chakra recipe prop. Without a variant declared here it would
     * fall through to the DOM as an invalid `size` attribute on `<table>`.
     *
     * Only `md` is measured against the original — it is what the visual
     * baseline captured. `sm` and `lg` are proportional and UNVERIFIED; treat
     * them as a reasonable scale rather than as a reproduction of anything.
     */
    size: {
      sm: { "& th, & td": { padding: "8px" } },
      md: { "& th, & td": { padding: "12px" } },
      lg: { "& th, & td": { padding: "16px" } },
    },
  },
  defaultVariants: { size: "md" },
});

const PandaTableHeader = styled("thead");
const PandaTableBody = styled("tbody");
const PandaTableFooter = styled("tfoot");
/**
 * A row, and — when it can be activated — an interactive one (NEH-2081).
 *
 * Every consumer that wanted a clickable row hand-built a raw `<table>` and
 * painted its own hover; one painted a fixed `#f7fafc` from `onMouseEnter`,
 * unreadable in every dark theme. The shape that invites the mistake was the
 * only one on offer. This is the other shape:
 *
 * - **hover and focus paint a contract pair**, `boxBgSecondary` with
 *   `textSecondary` — a theme surface via the host's custom properties, never
 *   a colour, and the text that belongs on it stated in the same rule (the
 *   NEH-1788 rule: a state is a pairing too). Focus paints what hover paints,
 *   because for a keyboard reader focus IS the pointer; the outline is the
 *   second cue, so the state is never colour alone.
 * - **48px**, the house tap-target floor. On a `<tr>` `height` is a minimum
 *   (a row grows with its content), so it is stated as `height` rather than
 *   the `min-height` the other controls use, which a table row ignores.
 *
 * The cells inherit the row's colour. A `StyledText` inside a cell states its
 * own (`textPrimary`) and will not follow the hover — the same caveat
 * `StyledButton` carries; say `color="inherit"` on it.
 */
const PandaTableRow = styled("tr", {
  base: {},
  variants: {
    interactive: {
      true: {
        cursor: "pointer",
        height: "48px",
        _hover: { backgroundColor: "boxBgSecondary", color: "textSecondary" },
        _focusVisible: {
          backgroundColor: "boxBgSecondary",
          color: "textSecondary",
          outline: "3px solid",
          outlineColor: "buttonBgAccent",
          outlineOffset: "-3px",
        },
      },
      false: {},
    },
  },
});

/**
 * The 1px rule under each cell.
 *
 * Chakra's own CSS drew this. `border="sm"` on the cell emits NOTHING — an
 * empty computed `border` shorthand on a real `<td>` — so it is restored
 * explicitly.
 *
 * `borderBgPrimary` is the token, never a palette literal: a hardcoded
 * `neutral.200` is invisible to the host's theme and does not follow the colour
 * mode, which is the whole reason this package refuses literal colours.
 *
 * ## Longhands, and why the obvious shorthand is wrong
 *
 * The originating app wrote `borderBottom: "1px solid"` alongside
 * `borderColor: <token>`. That looks equivalent and is not: `border-bottom` is
 * a SHORTHAND, so it also sets `border-bottom-color`, and omitting the colour
 * resets it to its initial value — `currentColor`. Whichever declaration Panda
 * emits second wins, so the cell rule painted the text colour (black on a light
 * theme) instead of the token, on every table.
 *
 * That is a false-pass waiting to happen, because black IS a real colour: a
 * test asserting only "the border resolved to something" goes green on it.
 * `StyledTable.ct.tsx` re-points the custom property and asserts the border
 * follows, which is the assertion that actually distinguishes the two.
 */
const CELL_RULE = {
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "borderBgPrimary",
} as const;

const PandaTableColumnHeader = styled("th", {
  base: { fontWeight: "medium", textAlign: "start", ...CELL_RULE },
});
const PandaTableCell = styled("td", { base: { ...CELL_RULE } });
const PandaTableCaption = styled("caption");

export type StyledTableProps = React.ComponentProps<typeof PandaTableRoot> & {
  /**
   * Which step of the text scale the table's cells read at.
   *
   * **Relative, exactly as `size` is on `StyledText`** — `textSize="md"` is
   * body size, the default `sm` is one step below it. See the note on
   * `PandaTableRoot`'s base for why the 14px it replaces had to go.
   *
   * It is `textSize` and not `size` for one unglamorous reason: `size` is
   * already taken on this component, by the Chakra-inherited variant that sets
   * cell PADDING (`sm`/`md`/`lg`). Two different meanings under one name on one
   * element is how a call site ends up changing the thing it did not mean to,
   * so the new prop takes the longer name rather than the old one being
   * repurposed underneath existing callers.
   */
  textSize?: FontSizeKey;
  /** Pin to the `md` step rather than following the reader's profile. */
  fixedSize?: boolean;
};

const StyledTable: React.FC<StyledTableProps> = ({
  children,
  textSize = "sm",
  fixedSize,
  style,
  ...props
}) => {
  log.trace("StyledTable rendered");
  /*
   * A `styled()` base is static CSS and cannot read a React context, so the
   * relative size is resolved here and applied inline. The cells inherit it,
   * and `line-height` is unitless on the base, so one declaration moves the
   * whole table in proportion.
   */
  const fontSize = useResolvedFontSize({ size: textSize, fixedSize });
  return (
    // `overflow: hidden` on the outer box clips the scroll container's corners
    // to the box radius; the scrollbar inside is what actually scrolls.
    <StyledBox
      overflow="hidden"
      data-testid="styled-table-container"
      border={0}
      py={0}
      px={0}
    >
      <StyledScrollbar p={0} data-testid="styled-table-scrollbar" border={0}>
        <PandaTableRoot
          {...props}
          // A caller's own `style` spreads after ours, so it still wins outright.
          style={{ fontSize, ...style }}
          data-testid="styled-table-root"
        >
          {children}
        </PandaTableRoot>
      </StyledScrollbar>
    </StyledBox>
  );
};

export interface StyledTableHeaderProps {
  columns: ColumnDefinition[];
}

const StyledHeader: React.FC<StyledTableHeaderProps> = ({ columns }) => (
  <PandaTableHeader>
    <PandaTableRow>
      {columns.map(({ key, label, ...rest }) => (
        <PandaTableColumnHeader key={key} {...rest}>
          {label}
        </PandaTableColumnHeader>
      ))}
    </PandaTableRow>
  </PandaTableHeader>
);
StyledHeader.displayName = "StyledTable.Header";

export interface StyledTableBodyProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * `header` and `footer` render as siblings, not children — `<thead>` and
 * `<tfoot>` are invalid inside `<tbody>`, and nesting them there is silently
 * reparented by the browser rather than reported.
 */
const StyledBody: React.FC<StyledTableBodyProps> = ({
  children,
  header,
  footer,
}) => (
  <>
    {header}
    <PandaTableBody>{children}</PandaTableBody>
    {footer}
  </>
);
StyledBody.displayName = "StyledTable.Body";

type StyledTableFooterProps = React.ComponentProps<typeof PandaTableFooter>;
const StyledFooter: React.FC<StyledTableFooterProps> = (props) => (
  <PandaTableFooter {...props} />
);
StyledFooter.displayName = "StyledTable.Footer";

export type StyledTableRowProps = Omit<
  React.ComponentProps<typeof PandaTableRow>,
  "interactive"
> & {
  /**
   * Makes the row an activatable control (NEH-2081).
   *
   * With it set the row is in the tab order (`tabIndex` 0, overridable),
   * Enter and Space activate it, a click activates it, and hover/focus paint
   * the `boxBgSecondary`/`textSecondary` pair. Without it the row is a plain
   * `<tr>`, byte-identical to before this prop existed.
   *
   * The row keeps its native `row` role — overriding it to `button` would take
   * the cells out of the table's accessibility tree — so a screen reader
   * announces the cells' content. Pass `aria-label` when that content does not
   * say what activation does ("Open Ada Lovelace's account").
   *
   * A click or key that comes from a control INSIDE the row (a button or link
   * in a cell) does not activate the row: that control owns its own event.
   */
  onActivate?: (() => void) | undefined;
};

/** Interactive elements a click or key inside the row belongs to, not the row. */
const NESTED_CONTROL = "a[href],button,input,select,textarea,summary,[role=button],[role=link],[contenteditable=true]";

function fromNestedControl(event: React.SyntheticEvent<HTMLTableRowElement>): boolean {
  const target = event.target as Element | null;
  if (!target || target === event.currentTarget) return false;
  const control = target.closest(NESTED_CONTROL);
  return control !== null && control !== event.currentTarget && event.currentTarget.contains(control);
}

const StyledRow = React.forwardRef<HTMLTableRowElement, StyledTableRowProps>(
  function StyledRow({ onActivate, onClick, onKeyDown, tabIndex, ...rest }, ref) {
    if (!onActivate) {
      return (
        <PandaTableRow
          ref={ref}
          onClick={onClick}
          onKeyDown={onKeyDown}
          {...(tabIndex !== undefined ? { tabIndex } : {})}
          {...rest}
        />
      );
    }
    return (
      <PandaTableRow
        ref={ref}
        interactive
        tabIndex={tabIndex ?? 0}
        data-interactive=""
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || fromNestedControl(event)) return;
          onActivate();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || fromNestedControl(event)) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          // Space would scroll the page; Enter in a nested form would submit it.
          event.preventDefault();
          onActivate();
        }}
        {...rest}
      />
    );
  },
);
StyledRow.displayName = "StyledTable.Row";

type StyledColumnHeaderProps = React.ComponentProps<
  typeof PandaTableColumnHeader
>;
const StyledColumnHeader: React.FC<StyledColumnHeaderProps> = (props) => (
  <PandaTableColumnHeader {...props} />
);
StyledColumnHeader.displayName = "StyledTable.ColumnHeader";

type StyledTableCellProps = React.ComponentProps<typeof PandaTableCell>;
const StyledCell: React.FC<StyledTableCellProps> = (props) => (
  <PandaTableCell {...props} />
);
StyledCell.displayName = "StyledTable.Cell";

type StyledTableCaptionProps = React.ComponentProps<typeof PandaTableCaption>;
const StyledCaption: React.FC<StyledTableCaptionProps> = (props) => (
  <PandaTableCaption {...props} />
);
StyledCaption.displayName = "StyledTable.Caption";

interface StyledTableComponent extends React.FC<StyledTableProps> {
  Header: typeof StyledHeader;
  Body: typeof StyledBody;
  Footer: typeof StyledFooter;
  Row: typeof StyledRow;
  ColumnHeader: typeof StyledColumnHeader;
  Cell: typeof StyledCell;
  Caption: typeof StyledCaption;
}

const StyledTableExport = StyledTable as StyledTableComponent;
StyledTableExport.Header = StyledHeader;
StyledTableExport.Body = StyledBody;
StyledTableExport.Footer = StyledFooter;
StyledTableExport.Row = StyledRow;
StyledTableExport.ColumnHeader = StyledColumnHeader;
StyledTableExport.Cell = StyledCell;
StyledTableExport.Caption = StyledCaption;

export { StyledTableExport as StyledTable };
export default StyledTableExport;

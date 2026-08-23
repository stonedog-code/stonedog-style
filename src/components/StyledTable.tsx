"use client";

import React from "react";
import { styled } from "styled-system/jsx";
import { log } from "../config/logger";
import StyledBox from "./StyledBox";
import StyledScrollbar from "./StyledScrollbar";

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
    // MEASURED off the originating Chakra build with getComputedStyle, not
    // derived from tokens: font 14px / line-height 20px, cells 12px on every
    // side, a 1px rule under each cell. Reasoning from the token scale instead
    // (fontSize md, py 2) put the table 51px too tall — the font, not the
    // padding, drove the difference.
    fontSize: "14px",
    lineHeight: "20px",
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
const PandaTableRow = styled("tr");

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

export type StyledTableProps = React.ComponentProps<typeof PandaTableRoot>;

const StyledTable: React.FC<StyledTableProps> = ({ children, ...props }) => {
  log.trace("StyledTable rendered");
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
        <PandaTableRoot {...props} data-testid="styled-table-root">
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

type StyledTableRowProps = React.ComponentProps<typeof PandaTableRow>;
const StyledRow: React.FC<StyledTableRowProps> = (props) => (
  <PandaTableRow {...props} />
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

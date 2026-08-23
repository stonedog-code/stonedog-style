import { render, screen } from "@testing-library/react";
import StyledTable, { type ColumnDefinition } from "../StyledTable";

/**
 * `StyledTable`, at the tier that can answer semantics and structure.
 *
 * What it deliberately does NOT assert: the cell rule's colour. It paints
 * through `borderBgPrimary`, which resolves to a custom property, and jsdom
 * resolves neither — an assertion here would be the vacuous kind NEH-406 was
 * about. `StyledTable.ct.tsx` measures it in a real engine.
 *
 * The role assertions are the point of this file. This component exists as a
 * real `<table>` rather than a div grid *only* for the accessibility tree, and
 * that difference is invisible in a screenshot — so if it is not asserted here
 * it is not asserted anywhere.
 */

const COLUMNS: ColumnDefinition[] = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
];

describe("StyledTable", () => {
  it("renders a real table, not a div grid", () => {
    render(
      <StyledTable>
        <StyledTable.Body>
          <StyledTable.Row>
            <StyledTable.Cell>Ada</StyledTable.Cell>
          </StyledTable.Row>
        </StyledTable.Body>
      </StyledTable>,
    );
    // getByRole("table") only resolves for real table markup; a styled <div>
    // returns nothing here however identical it looks on screen.
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("gives every header cell the columnheader role, in the order given", () => {
    render(
      <StyledTable>
        <StyledTable.Body header={<StyledTable.Header columns={COLUMNS} />}>
          <StyledTable.Row>
            <StyledTable.Cell>Ada</StyledTable.Cell>
            <StyledTable.Cell>Engineer</StyledTable.Cell>
          </StyledTable.Row>
        </StyledTable.Body>
      </StyledTable>,
    );
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Name",
      "Role",
    ]);
  });

  /**
   * `<thead>` and `<tfoot>` are invalid inside `<tbody>`. A browser silently
   * reparents them rather than reporting it, so nesting them would look fine
   * and put the header row outside the row group the reader announces.
   */
  it("renders header and footer as siblings of tbody, never inside it", () => {
    render(
      <StyledTable>
        <StyledTable.Body
          header={<StyledTable.Header columns={COLUMNS} />}
          footer={
            <StyledTable.Footer>
              <StyledTable.Row>
                <StyledTable.Cell>Total</StyledTable.Cell>
              </StyledTable.Row>
            </StyledTable.Footer>
          }
        >
          <StyledTable.Row>
            <StyledTable.Cell>Ada</StyledTable.Cell>
          </StyledTable.Row>
        </StyledTable.Body>
      </StyledTable>,
    );
    const table = screen.getByRole("table");
    expect(table.querySelector("tbody thead")).toBeNull();
    expect(table.querySelector("tbody tfoot")).toBeNull();
    expect(table.querySelector(":scope > thead")).not.toBeNull();
    expect(table.querySelector(":scope > tfoot")).not.toBeNull();
  });

  it("forwards extra column props to the th", () => {
    render(
      <StyledTable>
        <StyledTable.Body
          header={
            <StyledTable.Header
              columns={[{ key: "name", label: "Name", scope: "col" }]}
            />
          }
        >
          <StyledTable.Row>
            <StyledTable.Cell>Ada</StyledTable.Cell>
          </StyledTable.Row>
        </StyledTable.Body>
      </StyledTable>,
    );
    expect(screen.getByRole("columnheader")).toHaveAttribute("scope", "col");
  });

  /**
   * The recipe tier this package can test and the originating app cannot: it
   * mocks `styled-system/*` wholesale, so no test there can see what a variant
   * produced. Asserting the classes DIFFER rather than naming one keeps this
   * from breaking on every Panda hash change while still failing if `size`
   * stops being a variant — which is the real regression, since an undeclared
   * `size` falls through to the DOM as an invalid attribute on `<table>`.
   */
  it("emits different classes per size, and no size attribute on the table", () => {
    const { unmount } = render(<StyledTable size="sm" />);
    const sm = screen.getByRole("table").className;
    expect(screen.getByRole("table")).not.toHaveAttribute("size");
    unmount();

    render(<StyledTable size="lg" />);
    const lg = screen.getByRole("table").className;
    expect(sm).not.toEqual(lg);
  });

  it("names every compound part for the React tree", () => {
    expect(StyledTable.Header.displayName).toBe("StyledTable.Header");
    expect(StyledTable.Body.displayName).toBe("StyledTable.Body");
    expect(StyledTable.Footer.displayName).toBe("StyledTable.Footer");
    expect(StyledTable.Row.displayName).toBe("StyledTable.Row");
    expect(StyledTable.ColumnHeader.displayName).toBe("StyledTable.ColumnHeader");
    expect(StyledTable.Cell.displayName).toBe("StyledTable.Cell");
    expect(StyledTable.Caption.displayName).toBe("StyledTable.Caption");
  });
});

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

/**
 * `StyledTable.Row onActivate` — the wiring half (NEH-2081). What it paints,
 * and whether the painted text is legible, is `StyledTable.interactive.ct.tsx`.
 */
describe("StyledTable.Row onActivate", () => {
  const { fireEvent } = jest.requireActual<typeof import("@testing-library/react")>(
    "@testing-library/react",
  );

  function renderRows(onActivate: () => void) {
    render(
      <StyledTable>
        <StyledTable.Body>
          <StyledTable.Row data-testid="interactive" onActivate={onActivate}>
            <StyledTable.Cell>Ada</StyledTable.Cell>
            <StyledTable.Cell>
              <button type="button" data-testid="nested">
                Reset
              </button>
              <input aria-label="Note" data-testid="nested-input" />
            </StyledTable.Cell>
          </StyledTable.Row>
          <StyledTable.Row data-testid="plain">
            <StyledTable.Cell>Grace</StyledTable.Cell>
          </StyledTable.Row>
        </StyledTable.Body>
      </StyledTable>,
    );
    return {
      row: screen.getByTestId("interactive"),
      plain: screen.getByTestId("plain"),
    };
  }

  it("keeps the row role and puts the row in the tab order; a plain row is untouched", () => {
    const { row, plain } = renderRows(() => {});
    // The native role, not an attribute: a `<tr>` is a row by construction,
    // and nothing here overrides it to `button`.
    expect(row).not.toHaveAttribute("role");
    expect(screen.getAllByRole("row")).toContain(row);
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).toHaveAttribute("data-interactive");
    expect(plain).not.toHaveAttribute("tabindex");
    expect(plain).not.toHaveAttribute("data-interactive");
    // Still a row of the table, not a control lifted out of it.
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("activates on click, Enter and Space, and Space does not scroll the page", () => {
    const onActivate = jest.fn();
    const { row } = renderRows(onActivate);
    fireEvent.click(row);
    expect(onActivate).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onActivate).toHaveBeenCalledTimes(2);
    const space = fireEvent.keyDown(row, { key: " " });
    expect(onActivate).toHaveBeenCalledTimes(3);
    // `fireEvent` returns false when the default was prevented.
    expect(space).toBe(false);
    // Any other key is not an activation.
    fireEvent.keyDown(row, { key: "ArrowDown" });
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("a click or key from a control inside the row belongs to that control", () => {
    const onActivate = jest.fn();
    renderRows(onActivate);
    fireEvent.click(screen.getByTestId("nested"));
    fireEvent.keyDown(screen.getByTestId("nested"), { key: "Enter" });
    fireEvent.keyDown(screen.getByTestId("nested-input"), { key: " " });
    expect(onActivate).not.toHaveBeenCalled();
    // ...but a click on a plain cell is the row's.
    fireEvent.click(screen.getByText("Ada"));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("composes with a caller's own handlers and honours their preventDefault", () => {
    const onActivate = jest.fn();
    const onClick = jest.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <StyledTable>
        <StyledTable.Body>
          <StyledTable.Row data-testid="r" onActivate={onActivate} onClick={onClick} tabIndex={-1}>
            <StyledTable.Cell>Ada</StyledTable.Cell>
          </StyledTable.Row>
        </StyledTable.Body>
      </StyledTable>,
    );
    const row = screen.getByTestId("r");
    expect(row).toHaveAttribute("tabindex", "-1");
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("without onActivate a row accepts no interactive variant and forwards nothing extra", () => {
    const { plain } = renderRows(() => {});
    expect(plain.className).not.toMatch(/interactive/);
  });
});

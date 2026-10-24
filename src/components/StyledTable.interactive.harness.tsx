import React from "react";
import StyledTable from "./StyledTable";

/**
 * Mount target for `StyledTable.interactive.ct.tsx` (NEH-2081).
 *
 * A user-administration table reduced to what the interactive row has to get
 * right: two activatable rows and one plain row, on a page painted
 * `boxBgMain` with `textMain`, so the hover and focus pair composite over the
 * same surface they would in a consumer. The activation count is written to
 * the DOM so the spec can read it without a callback crossing the bridge.
 *
 * The second interactive row holds a button, so the spec can prove a click on
 * a nested control does not activate the row.
 *
 * Lives here, not in the spec, because Playwright CT cannot mount a component
 * declared inside the spec module.
 */
export function InteractiveTableHarness() {
  const [activated, setActivated] = React.useState<string[]>([]);
  const activate = (who: string) => setActivated((a) => [...a, who]);
  return (
    <div
      data-testid="page"
      style={{ background: "var(--colors-box-bg-main)", color: "var(--colors-text-main)", padding: 24 }}
    >
      <StyledTable>
        <StyledTable.Body
          header={
            <StyledTable.Header
              columns={[
                { key: "name", label: "Name" },
                { key: "role", label: "Role" },
              ]}
            />
          }
        >
          <StyledTable.Row data-testid="row-ada" onActivate={() => activate("ada")}>
            <StyledTable.Cell data-testid="cell-ada">Ada Lovelace</StyledTable.Cell>
            <StyledTable.Cell>Engineer</StyledTable.Cell>
          </StyledTable.Row>
          <StyledTable.Row data-testid="row-grace" onActivate={() => activate("grace")}>
            <StyledTable.Cell data-testid="cell-grace">Grace Hopper</StyledTable.Cell>
            <StyledTable.Cell>
              <button type="button" data-testid="nested-button" onClick={() => activate("button")}>
                Reset password
              </button>
            </StyledTable.Cell>
          </StyledTable.Row>
          <StyledTable.Row data-testid="row-plain">
            <StyledTable.Cell data-testid="cell-plain">Total</StyledTable.Cell>
            <StyledTable.Cell>2</StyledTable.Cell>
          </StyledTable.Row>
        </StyledTable.Body>
      </StyledTable>
      <output data-testid="activated">{activated.join(",")}</output>
    </div>
  );
}

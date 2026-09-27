import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import StyledTabs, {
  StyledTabList,
  StyledTabPanel,
  tabElementId,
  tabPanelElementId,
} from "../StyledTabs";

/**
 * The wiring half. Roles, names, the id relationships and the keyboard map —
 * all of which jsdom can answer.
 *
 * What it deliberately does NOT assert: anything about pixels. The tap-target
 * floor, the wrap at 320px and whether the label's font size actually moves
 * with the reader's profile are all in `StyledTabs.ct.tsx`, because jsdom has
 * no layout engine and reports every box as zero-sized — an assertion about a
 * 48px target would pass here over a 0px element.
 */

const TABS = [
  { value: "passkeys", label: "Passkeys" },
  { value: "sessions", label: "Sessions" },
  { value: "history", label: "History" },
] as const;

function renderList(value = "passkeys", onValueChange = jest.fn()) {
  render(
    <StyledTabList
      tabs={TABS}
      value={value}
      onValueChange={onValueChange}
      ariaLabel="Security sections"
      idPrefix="security"
    />,
  );
  return onValueChange;
}

describe("the ids", () => {
  it("derives a tab id from the prefix and the value", () => {
    expect(tabElementId("security", "passkeys")).toBe("security-passkeys");
  });

  it("derives the panel id from the same pair", () => {
    // Both halves of the relationship are computable from the prefix and the
    // value, so a call site never has to thread a generated id between the
    // list and the panel — threading is what gets skipped.
    expect(tabPanelElementId("security", "passkeys")).toBe(
      "security-passkeys-panel",
    );
  });
});

describe("StyledTabList", () => {
  it("is a tablist with an accessible name", () => {
    renderList();
    expect(
      screen.getByRole("tablist", { name: "Security sections" }),
    ).toBeInTheDocument();
  });

  it("renders one tab per item", () => {
    renderList();
    expect(screen.getAllByRole("tab")).toHaveLength(TABS.length);
  });

  it("each tab is a real button, not a div wearing a role", () => {
    // The platform then owns Enter, Space, focus and the disabled semantics —
    // including activation on key-up, which hand-rolled handling misses.
    renderList();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.tagName).toBe("BUTTON");
    }
  });

  it("is type=button, so a tab never submits a surrounding form", () => {
    renderList();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("type", "button");
    }
  });

  it("marks exactly one tab selected", () => {
    renderList("sessions");
    const selected = screen
      .getAllByRole("tab")
      .filter((tab) => tab.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName("Sessions");
  });

  it("is ONE tab stop: only the selected tab has tabindex 0", () => {
    // The whole point of the pattern. Without the roving tabindex a reader
    // Tabs past n-1 tabs to reach the panel.
    renderList("sessions");
    const stops = screen
      .getAllByRole("tab")
      .filter((tab) => tab.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName("Sessions");
  });

  it("puts aria-controls on the selected tab only", () => {
    // The inactive panels are not mounted, so naming their ids would reference
    // elements that are not in the document — axe's `aria-valid-attr-value`,
    // and nothing a screen reader can follow.
    renderList("sessions");
    const withControls = screen
      .getAllByRole("tab")
      .filter((tab) => tab.hasAttribute("aria-controls"));
    expect(withControls).toHaveLength(1);
    expect(withControls[0]).toHaveAttribute(
      "aria-controls",
      "security-sessions-panel",
    );
  });

  it("selects on click", () => {
    const onValueChange = renderList();
    fireEvent.click(screen.getByTestId("security-sessions"));
    expect(onValueChange).toHaveBeenCalledWith("sessions");
  });

  it("puts the tab id on the tab itself, so a click lands on the control", () => {
    renderList();
    expect(screen.getByTestId("security-history")).toHaveAttribute(
      "role",
      "tab",
    );
  });

  describe("the keyboard map", () => {
    it.each([
      ["ArrowRight", "passkeys", "sessions"],
      ["ArrowLeft", "sessions", "passkeys"],
      ["Home", "history", "passkeys"],
      ["End", "passkeys", "history"],
    ])("%s from %s selects %s", (key, from, expected) => {
      const onValueChange = renderList(from);
      fireEvent.keyDown(screen.getByTestId(`security-${from}`), { key });
      expect(onValueChange).toHaveBeenCalledWith(expected);
    });

    it("ArrowRight wraps from the last tab to the first", () => {
      const onValueChange = renderList("history");
      fireEvent.keyDown(screen.getByTestId("security-history"), {
        key: "ArrowRight",
      });
      expect(onValueChange).toHaveBeenCalledWith("passkeys");
    });

    it("ArrowLeft wraps from the first tab to the last", () => {
      const onValueChange = renderList("passkeys");
      fireEvent.keyDown(screen.getByTestId("security-passkeys"), {
        key: "ArrowLeft",
      });
      expect(onValueChange).toHaveBeenCalledWith("history");
    });

    it.each(["ArrowUp", "ArrowDown"])(
      "%s does nothing: the list is horizontal",
      (key) => {
        // The list WRAPS onto a second row on a narrow screen, but reading
        // order stays left-to-right — binding the vertical keys would promise
        // an ordering the list does not have.
        const onValueChange = renderList("sessions");
        fireEvent.keyDown(screen.getByTestId("security-sessions"), { key });
        expect(onValueChange).not.toHaveBeenCalled();
      },
    );

    it("leaves Tab alone", () => {
      // preventDefault is called only for the keys the handler claims. Swallow
      // Tab and the reader cannot leave the tablist at all.
      const onValueChange = renderList("sessions");
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      screen.getByTestId("security-sessions").dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("prevents the default for a key it DOES handle", () => {
      // ArrowLeft/Right scroll the nearest scrollable ancestor otherwise, so
      // moving between tabs would also move the page under the reader.
      renderList("sessions");
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      screen.getByTestId("security-sessions").dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it("moves focus with the selection", () => {
      // "Automatic activation" means both move together. Without the focus
      // move the reader is left on a tab that is no longer the tab stop.
      renderList("passkeys");
      fireEvent.keyDown(screen.getByTestId("security-passkeys"), {
        key: "ArrowRight",
      });
      expect(screen.getByTestId("security-sessions")).toHaveFocus();
    });

    it("survives a one-tab list rather than moving off the end", () => {
      const onValueChange = jest.fn();
      render(
        <StyledTabList
          tabs={[{ value: "only", label: "Only" }]}
          value="only"
          onValueChange={onValueChange}
          ariaLabel="One"
          idPrefix="one"
        />,
      );
      fireEvent.keyDown(screen.getByTestId("one-only"), { key: "ArrowRight" });
      expect(onValueChange).toHaveBeenCalledWith("only");
    });
  });
});

describe("StyledTabPanel", () => {
  it("is a tabpanel labelled by its tab", () => {
    render(
      <>
        <StyledTabList
          tabs={TABS}
          value="sessions"
          onValueChange={() => {}}
          ariaLabel="Security sections"
          idPrefix="security"
        />
        <StyledTabPanel idPrefix="security" value="sessions">
          Two devices
        </StyledTabPanel>
      </>,
    );
    // Named through aria-labelledby, which only resolves because the tab's own
    // id is what the panel points at — the relationship, not just the role.
    expect(
      screen.getByRole("tabpanel", { name: "Sessions" }),
    ).toBeInTheDocument();
  });

  it("points back at the tab that controls it", () => {
    render(
      <StyledTabPanel idPrefix="security" value="sessions">
        x
      </StyledTabPanel>,
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "security-sessions-panel");
    expect(panel).toHaveAttribute("aria-labelledby", "security-sessions");
  });

  it("is focusable, so Tab does not skip the panel's prose", () => {
    render(
      <StyledTabPanel idPrefix="security" value="sessions">
        Text with no control in it
      </StyledTabPanel>,
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
  });

  it("establishes no font size, so a host's text keeps inheriting", () => {
    // A labelled region, not a text container. Asserted on the SOURCE rather
    // than on a rendered value: a `var(--font-sizes-*)` reference is dropped
    // by jsdom's CSS parser, so a style assertion here would compare "" with
    // "" and pass for every possible expectation.
    // `__dirname`, not `import.meta.url`: this package's jest runs the suite as
    // CommonJS, where `import.meta` is a syntax error rather than an empty
    // object — so the wrong one fails the whole file before an assertion runs.
    const source = readFileSync(
      resolve(__dirname, "..", "StyledTabs.tsx"),
      "utf8",
    );
    const panelSource = source.slice(source.indexOf("export function StyledTabPanel"));
    expect(panelSource.length).toBeGreaterThan(100);
    expect(panelSource).not.toMatch(/fontSize/);
  });
});

describe("the namespace export", () => {
  it("carries List and Panel", () => {
    expect(StyledTabs.List).toBe(StyledTabList);
    expect(StyledTabs.Panel).toBe(StyledTabPanel);
  });
});

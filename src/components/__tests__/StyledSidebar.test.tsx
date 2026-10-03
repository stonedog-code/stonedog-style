import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StyledSidebar, { type SidebarItem } from "../StyledSidebar";
import { StonedogStyleProvider } from "../../config/style-config";
import type { LinkComponent } from "../../config/link-component";

/**
 * StyledSidebar, against PRD-0001.
 *
 * The tests worth having here are the ones that pin *decisions*, not markup:
 * that the component never reorders or filters, that selection survives a
 * filter, that paging resets when the item set changes, and that nothing
 * responds to hover. Each of those is a behaviour someone could plausibly
 * "improve" into a bug.
 */
const TOOLS: SidebarItem[] = [
  { id: "calendar", label: "Calendar", description: "Events & appointments", help: "Shows what is coming up." },
  { id: "notes", label: "Notes", description: "Reminders & messages" },
  { id: "tasks", label: "Tasks", description: "Daily to-do items" },
  { id: "sites", label: "Sites", description: "Saved links & pages" },
];

function renderSidebar(props: Partial<React.ComponentProps<typeof StyledSidebar>> = {}) {
  const onSelect = jest.fn();
  const utils = render(
    <StyledSidebar items={TOOLS} onSelect={onSelect} heading="TOOLS" {...props} />,
  );
  return { onSelect, ...utils };
}

describe("StyledSidebar — landmark", () => {
  it("renders a named navigation landmark", () => {
    // Regression: this was `as="nav"` on StyledBox, which does not reach the
    // DOM through Panda's factory — so the sidebar rendered a plain div with
    // an aria-label naming nothing, and screen-reader users had no landmark to
    // jump to. Every behaviour test still passed.
    render(<StyledSidebar items={TOOLS} onSelect={jest.fn()} aria-label="Care Tools" />);
    expect(screen.getByRole("navigation", { name: "Care Tools" })).toBeInTheDocument();
  });

  it("defaults the landmark name when the host gives none", () => {
    render(<StyledSidebar items={TOOLS} onSelect={jest.fn()} />);
    expect(screen.getByRole("navigation", { name: "Tools" })).toBeInTheDocument();
  });
});

describe("StyledSidebar — items", () => {
  it("renders every tool with its name, not an icon alone", () => {
    renderSidebar();
    for (const tool of TOOLS) {
      expect(screen.getByText(tool.label)).toBeInTheDocument();
    }
  });

  it("shows descriptions, and drops them when collapsed — but never the names", () => {
    const { rerender } = renderSidebar();
    expect(screen.getByText("Events & appointments")).toBeInTheDocument();

    rerender(<StyledSidebar items={TOOLS} onSelect={jest.fn()} collapsed />);

    expect(screen.queryByText("Events & appointments")).not.toBeInTheDocument();
    // The name survives collapsing. An icon-only rail is what this component
    // refuses to become BY DEFAULT — the §20a opt-in below is the only way to
    // get one, and this assertion is what stops it becoming the default by
    // accident in a later edit.
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it("reports the chosen tool", () => {
    const { onSelect } = renderSidebar();
    fireEvent.click(screen.getByTestId("sidebar-item-notes"));
    expect(onSelect).toHaveBeenCalledWith("notes");
  });

  it("renders items in the order given — it never sorts", () => {
    const reversed = [...TOOLS].reverse();
    render(<StyledSidebar items={reversed} onSelect={jest.fn()} />);
    const rendered = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rendered[0]).toContain("Sites");
    expect(rendered[3]).toContain("Calendar");
  });
});

describe("StyledSidebar — selection", () => {
  it("marks the selected tool for assistive technology", () => {
    renderSidebar({ selectedId: "tasks" });
    expect(screen.getByTestId("sidebar-item-tasks")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("sidebar-item-notes")).not.toHaveAttribute("aria-current");
  });

  it("keeps the selection when the host filters that tool out", () => {
    const { rerender } = renderSidebar({ selectedId: "tasks" });
    // The host narrowed `items` — the reader is searching, not navigating away.
    rerender(
      <StyledSidebar items={[TOOLS[0]!]} selectedId="tasks" onSelect={jest.fn()} />,
    );
    expect(screen.getByTestId("sidebar-item-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-item-tasks")).not.toBeInTheDocument();
  });
});

describe("StyledSidebar — help", () => {
  it("offers help only for tools that have it", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "What does Calendar do?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "What does Notes do?" })).not.toBeInTheDocument();
  });

  it("opens on click and not on hover", () => {
    renderSidebar();
    const help = screen.getByRole("button", { name: "What does Calendar do?" });

    fireEvent.mouseEnter(help);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(help);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});

describe("StyledSidebar — overflow", () => {
  it("scrolls by default, with no pager", () => {
    renderSidebar();
    expect(screen.queryByTestId("sidebar-next")).not.toBeInTheDocument();
  });

  it("pages when asked, stating the position in words", () => {
    renderSidebar({ overflow: "paging", itemsPerPage: 2 });

    expect(screen.getByTestId("sidebar-page-status")).toHaveTextContent("Page 1 of 2");
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Tasks")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-next"));

    expect(screen.getByTestId("sidebar-page-status")).toHaveTextContent("Page 2 of 2");
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("disables the pager at each end rather than wrapping", () => {
    renderSidebar({ overflow: "paging", itemsPerPage: 2 });
    expect(screen.getByTestId("sidebar-prev")).toBeDisabled();
    fireEvent.click(screen.getByTestId("sidebar-next"));
    expect(screen.getByTestId("sidebar-next")).toBeDisabled();
  });

  it("resets to page 1 when the item set changes", () => {
    const { rerender } = renderSidebar({ overflow: "paging", itemsPerPage: 2 });
    fireEvent.click(screen.getByTestId("sidebar-next"));
    expect(screen.getByTestId("sidebar-page-status")).toHaveTextContent("Page 2 of 2");

    // A search narrowed the list. Without the reset the reader is stranded on
    // a page that no longer exists.
    rerender(
      <StyledSidebar items={[TOOLS[0]!]} onSelect={jest.fn()} overflow="paging" itemsPerPage={2} />,
    );

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-page-status")).not.toBeInTheDocument();
  });
});

describe("StyledSidebar — empty and collapsing", () => {
  it("announces an empty result instead of showing a blank panel", () => {
    render(
      <StyledSidebar items={[]} onSelect={jest.fn()} emptyState="No tools match that search." />,
    );
    const empty = screen.getByTestId("sidebar-empty");
    expect(empty).toHaveTextContent("No tools match that search.");
    // role="status" so a screen reader learns the search found nothing.
    expect(empty).toHaveAttribute("role", "status");
  });

  it("collapses by explicit press, with a name that says what happens next", () => {
    const onCollapsedChange = jest.fn();
    renderSidebar({ onCollapsedChange });

    const toggle = screen.getByRole("button", { name: "Hide tool descriptions" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseEnter(toggle);
    expect(onCollapsedChange).not.toHaveBeenCalled(); // never on hover

    fireEvent.click(toggle);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it("omits the collapse control when the host does not handle it", () => {
    renderSidebar();
    expect(screen.queryByTestId("sidebar-collapse")).not.toBeInTheDocument();
  });
});

describe("StyledSidebar — keyboard reach", () => {
  /**
   * The *pixel* half of §G24 — a visible focus ring, a working Enter — is in
   * StyledSidebar.ct.tsx, because jsdom neither lays out nor translates a
   * keypress on a native button into a click. What jsdom CAN answer is the
   * structural half, and it is the half that silently regresses: a control
   * built from a div, or one taken out of the tab order.
   */
  it("builds every control from a real button, none of them removed from the tab order", () => {
    renderSidebar({ overflow: "paging", itemsPerPage: 2, onCollapsedChange: jest.fn() });

    const controls = [
      screen.getByTestId("sidebar-item-calendar"),
      screen.getByRole("button", { name: "What does Calendar do?" }),
      screen.getByTestId("sidebar-prev"),
      screen.getByTestId("sidebar-next"),
      screen.getByTestId("sidebar-collapse"),
    ];

    for (const control of controls) {
      expect(control.tagName).toBe("BUTTON");
      // `type="button"` matters wherever a host drops this inside a form: the
      // default is `submit`, and choosing a tool would post the page.
      expect(control).toHaveAttribute("type", "button");
      expect(control).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("gives the help control one accessible name, not two", () => {
    // StyledTooltip used to name its wrapper as well as its trigger, so the
    // same control was announced twice with different words (NEH-151). In click
    // mode the wrapper must stay anonymous.
    renderSidebar();
    const help = screen.getByRole("button", { name: "What does Calendar do?" });
    expect(screen.getAllByRole("button", { name: "What does Calendar do?" })).toHaveLength(1);
    expect(help.parentElement).not.toHaveAttribute("aria-label");
    expect(help.parentElement).not.toHaveAttribute("role");
  });
});

describe("StyledSidebar — scroll mode", () => {
  it("puts the list in the library's scroll container, and only in scroll mode", () => {
    // §D14. The old suite could only see that no pager rendered, which is
    // equally true of a rail that silently cuts the remaining tools off.
    const { rerender } = renderSidebar();
    expect(screen.getByTestId("sidebar-scroll")).toContainElement(
      screen.getByTestId("sidebar-items"),
    );

    rerender(<StyledSidebar items={TOOLS} onSelect={jest.fn()} overflow="paging" />);
    expect(screen.queryByTestId("sidebar-scroll")).not.toBeInTheDocument();
  });
});

describe("StyledSidebar — token compliance", () => {
  /**
   * The package's oldest defect class, and this component carried two of them:
   * an inline `style={{ background: "var(--colors-box-bg-accent)" }}` for the
   * selected row, and `color="fg.muted"` on the description — a token from a
   * namespace nothing here defines, which Panda passed through as the literal
   * `color: fg.muted` and the browser discarded. Neither produced a build
   * error, a console warning, or a failing test; the muted description simply
   * never rendered muted.
   *
   * Both now go through the token layer, which is the only thing that
   * re-points under a consumer's `cssVarPrefix` — and, just as usefully, the
   * only thing a stylesheet grep can see.
   */
  it("paints the selected row from tokens rather than an inline custom property", () => {
    renderSidebar({ selectedId: "tasks" });
    const selected = screen.getByTestId("sidebar-item-tasks");

    expect(selected.getAttribute("style") ?? "").not.toContain("var(--");
    expect(selected.className).toContain("bd-c_borderBgAccent");
    expect(selected.className).toContain("bg_boxBgAccent");
  });

  it("distinguishes the selected row by weight as well as colour", () => {
    // WCAG 1.4.1 — the border and background are a colour signal, so the
    // label's weight has to carry it too, or greyscale loses the selection.
    renderSidebar({ selectedId: "tasks" });
    const selectedLabel = screen.getByText("Tasks");
    const plainLabel = screen.getByText("Notes");
    expect(selectedLabel.className).not.toBe(plainLabel.className);
    expect(selectedLabel.className).toContain("fw_bold");
  });

  it("names a description colour the token contract actually defines", () => {
    renderSidebar();
    const description = screen.getByText("Events & appointments");
    expect(description.className).toContain("c_textSecondary");
    expect(description.className).not.toContain("fg.muted");
  });
});

/**
 * The icon-only rail — PRD §20a.
 *
 * §20 rejects an icon-only rail outright. §20a is the documented exception a
 * host may opt into, and these tests pin the two things that make it
 * defensible rather than merely possible: the name is never actually lost, and
 * turning it on is a deliberate act.
 *
 * The most valuable assertion here is the one about the DEFAULT. Two other
 * products consume this component and neither asked for this; the failure that
 * matters is not "the opt-in is broken" but "the opt-in became the default and
 * nobody noticed".
 */
describe("StyledSidebar — icon-only collapse (§20a opt-in)", () => {
  const ICONS: SidebarItem[] = TOOLS.map((t) => ({
    ...t,
    icon: <span data-testid={`icon-${t.id}`}>◆</span>,
  }));

  it("is OFF unless asked for, even when collapsed", () => {
    render(<StyledSidebar items={ICONS} onSelect={jest.fn()} collapsed />);
    // Collapsed alone still shows names. This is §20 holding.
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it("drops the visible names only when collapsed AND opted in", () => {
    const { rerender } = render(
      <StyledSidebar items={ICONS} onSelect={jest.fn()} iconOnlyWhenCollapsed />,
    );
    // Opted in but expanded — names still render. Both conditions are needed.
    expect(screen.getByText("Calendar")).toBeInTheDocument();

    rerender(
      <StyledSidebar items={ICONS} onSelect={jest.fn()} collapsed iconOnlyWhenCollapsed />,
    );
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    // The icon is what is left. An item rendering neither would be an empty
    // button — the failure mode of getting this ternary wrong.
    expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
  });

  it("keeps the tool's name as the button's accessible name", () => {
    render(
      <StyledSidebar items={ICONS} onSelect={jest.fn()} collapsed iconOnlyWhenCollapsed />,
    );
    // The mitigation the whole exception rests on. Without it a screen reader
    // announces "button" and the rail is unusable rather than merely terse.
    expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
  });

  it("does not duplicate the name when the label is visible", () => {
    // A name in BOTH aria-label and the text content is announced twice. The
    // aria-label exists only to replace a label that is not being rendered.
    render(<StyledSidebar items={ICONS} onSelect={jest.fn()} iconOnlyWhenCollapsed />);
    expect(screen.getByTestId("sidebar-item-calendar")).not.toHaveAttribute("aria-label");
  });

  it("still reports the chosen tool when it is icon-only", () => {
    const onSelect = jest.fn();
    render(
      <StyledSidebar items={ICONS} onSelect={onSelect} collapsed iconOnlyWhenCollapsed />,
    );
    fireEvent.click(screen.getByTestId("sidebar-item-notes"));
    expect(onSelect).toHaveBeenCalledWith("notes");
  });

  it("offers help-on-press when the host asks for it", () => {
    // The click trigger renders StyledTooltip's own control, which is the only
    // mode a touch reader can reach — the tooltip has no touch trigger, so on a
    // tablet the hover mode reveals nothing at all.
    render(
      <StyledSidebar
        items={ICONS}
        onSelect={jest.fn()}
        collapsed
        iconOnlyWhenCollapsed
        collapsedTooltipTrigger="click"
      />,
    );
    expect(
      screen.getAllByRole("button", { name: "What does Calendar do?" }).length,
    ).toBeGreaterThan(0);
  });

  it("says it will show NAMES, not descriptions, when icon-only", () => {
    // A reader who cannot identify the glyphs is exactly the one reaching for
    // this control, and "Show tool descriptions" would understate what it does.
    render(
      <StyledSidebar
        items={ICONS}
        onSelect={jest.fn()}
        collapsed
        iconOnlyWhenCollapsed
        onCollapsedChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId("sidebar-collapse")).toHaveAttribute(
      "aria-label",
      "Show tool names",
    );
  });
});

describe("StyledSidebar — uncontrolled collapse", () => {
  it("starts collapsed when asked, and can be expanded without a host handler", () => {
    // A host that only wants "start collapsed" should not have to own the
    // state. Gating the control on onCollapsedChange would have left such a
    // host with a permanently collapsed rail and no way out.
    render(<StyledSidebar items={TOOLS} onSelect={jest.fn()} defaultCollapsed />);
    expect(screen.queryByText("Events & appointments")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-collapse"));
    expect(screen.getByText("Events & appointments")).toBeInTheDocument();
  });

  it("lets a controlled host win", () => {
    render(
      <StyledSidebar
        items={TOOLS}
        onSelect={jest.fn()}
        collapsed={false}
        defaultCollapsed
        onCollapsedChange={jest.fn()}
      />,
    );
    // `collapsed` is supplied, so `defaultCollapsed` is ignored entirely.
    expect(screen.getByText("Events & appointments")).toBeInTheDocument();
  });

  it("tells a controlled host about the press rather than moving on its own", () => {
    const onCollapsedChange = jest.fn();
    render(
      <StyledSidebar
        items={TOOLS}
        onSelect={jest.fn()}
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
      />,
    );
    fireEvent.click(screen.getByTestId("sidebar-collapse"));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    // Still expanded: the host owns the value and has not changed it yet.
    expect(screen.getByText("Events & appointments")).toBeInTheDocument();
  });
});

/**
 * `href` items (0.34.0). The navigation landmark used to hold only buttons, so
 * every destination announced as "button", could not be opened in a new tab,
 * and made the host `router.push` from `onSelect`. These pin the link form —
 * and, just as much, that an item WITHOUT `href` is still exactly the button it
 * was, because three products render this component today.
 */
describe("StyledSidebar — href items render as links", () => {
  const LINKED: SidebarItem[] = [
    { id: "home", label: "Home", href: "/home" },
    { id: "filings", label: "Filings", href: "/filings", description: "What is due" },
    { id: "legacy", label: "Legacy tool" },
  ];

  it("renders a real link with the destination, not a button", () => {
    render(<StyledSidebar items={LINKED} />);
    const link = screen.getByRole("link", { name: /Filings/ });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/filings");
    expect(screen.queryByRole("button", { name: /Filings/ })).not.toBeInTheDocument();
  });

  it("marks the selected link aria-current=page, and only that one", () => {
    render(<StyledSidebar items={LINKED} selectedId="filings" />);
    expect(screen.getByRole("link", { name: /Filings/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Home/ })).not.toHaveAttribute("aria-current");
  });

  it("leaves an item without href as the button it always was", () => {
    render(<StyledSidebar items={LINKED} selectedId="legacy" onSelect={jest.fn()} />);
    const button = screen.getByRole("button", { name: /Legacy tool/ });
    expect(button).toHaveAttribute("type", "button");
    // The button form keeps its own token; changing it would move every
    // existing consumer's accessibility tree.
    expect(button).toHaveAttribute("aria-current", "true");
  });

  it("tells onSelect about an ordinary click, but not a modified one", () => {
    const onSelect = jest.fn();
    render(<StyledSidebar items={LINKED} onSelect={onSelect} />);
    const link = screen.getByRole("link", { name: /Home/ });
    // jsdom does not navigate; the point is only which clicks count.
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledWith("home");
  });

  it("renders through the host's linkComponent when one is configured", () => {
    const HostLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
      function HostLink(props, ref) {
        return <a ref={ref} data-host-link="yes" {...props} />;
      },
    ) as unknown as LinkComponent;
    render(
      <StonedogStyleProvider linkComponent={HostLink}>
        <StyledSidebar items={LINKED} />
      </StonedogStyleProvider>,
    );
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("data-host-link", "yes");
  });

  it("keeps the tool's name as the link's name on the icon-only rail", () => {
    render(
      <StyledSidebar
        items={[{ id: "home", label: "Home", href: "/home", icon: <svg aria-hidden="true" /> }]}
        collapsed
        iconOnlyWhenCollapsed
      />,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
  });
});

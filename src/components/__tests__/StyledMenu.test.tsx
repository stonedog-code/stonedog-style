import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StyledMenu, { type StyledMenuItem } from "../StyledMenu";

/**
 * StyledMenu — the wiring and keyboard half of the WAI-ARIA menu-button
 * pattern. Sizes and paint are the component tier's (`StyledMenu.ct.tsx`).
 */

const ENTITIES: StyledMenuItem[] = [
  { id: "acme", label: "Acme Ltd" },
  { id: "beta", label: "Beta LLC" },
  { id: "gamma", label: "Gamma Trust" },
];

function setup(props: Partial<React.ComponentProps<typeof StyledMenu>> = {}) {
  const onSelect = jest.fn();
  const user = userEvent.setup();
  const utils = render(
    <>
      <StyledMenu
        label="Acme Ltd"
        aria-label="Switch organisation, current: Acme Ltd"
        items={ENTITIES}
        currentId="beta"
        onSelect={onSelect}
        {...(props as object)}
      />
      <button type="button">Elsewhere</button>
    </>,
  );
  const trigger = screen.getByTestId("styled-menu-trigger");
  const menu = screen.getByTestId("styled-menu-menu");
  return { onSelect, user, trigger, menu, ...utils };
}

describe("StyledMenu — trigger", () => {
  it("announces a menu it controls, collapsed", () => {
    const { trigger, menu } = setup();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(menu).toHaveAttribute("role", "menu");
    expect(menu).toHaveAttribute("aria-labelledby", trigger.id);
    expect(menu).not.toBeVisible();
  });

  it("opens on a press with focus on the CURRENT item", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("styled-menu-item-beta")).toHaveFocus();
  });

  it("opens on ArrowDown, and on ArrowUp at the last item", async () => {
    const { user, trigger } = setup({ currentId: undefined });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("styled-menu-item-acme")).toHaveFocus();
    await user.keyboard("{Escape}");
    await user.keyboard("{ArrowUp}");
    expect(screen.getByTestId("styled-menu-item-gamma")).toHaveFocus();
  });

  it("opens with Enter and with Space, once each — not open-then-shut", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("StyledMenu — inside the menu", () => {
  it("moves with the arrows, wrapping at both ends, and jumps with Home/End", async () => {
    const { user, trigger } = setup({ currentId: "acme" });
    await user.click(trigger);
    const [a, b, c] = ENTITIES.map((e) => screen.getByTestId(`styled-menu-item-${e.id}`));
    expect(a).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(c).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(a).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(b).toHaveFocus();
    await user.keyboard("{End}");
    expect(c).toHaveFocus();
    await user.keyboard("{Home}");
    expect(a).toHaveFocus();
  });

  it("jumps to an item by its first letter", async () => {
    const { user, trigger } = setup({ currentId: "acme" });
    await user.click(trigger);
    await user.keyboard("g");
    expect(screen.getByTestId("styled-menu-item-gamma")).toHaveFocus();
  });

  it("is one tab stop: every item takes tabindex -1", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    for (const item of screen.getAllByRole("menuitemradio")) {
      expect(item).toHaveAttribute("tabindex", "-1");
    }
  });

  it("Escape closes it and returns focus to the trigger", async () => {
    const { user, trigger, menu } = setup();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(menu).not.toBeVisible();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("activating an item reports it, closes, and returns focus", async () => {
    const { user, trigger, onSelect, menu } = setup();
    await user.click(trigger);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("gamma");
    expect(menu).not.toBeVisible();
    expect(trigger).toHaveFocus();
  });

  it("closes when focus leaves it (focusout), without dragging focus back", async () => {
    const { user, trigger, menu } = setup();
    await user.click(trigger);
    await user.tab();
    expect(menu).not.toBeVisible();
    expect(trigger).not.toHaveFocus();
  });

  it("closes on a pointer press outside it", async () => {
    const { user, trigger, menu } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(menu).not.toBeVisible();
  });

  it("a disabled item is announced and focusable, but does nothing", async () => {
    const onSelect = jest.fn();
    render(
      <StyledMenu
        label="Account"
        items={[{ id: "a", label: "Billing", disabled: true }, { id: "b", label: "Sign out" }]}
        selection="current"
        onSelect={onSelect}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("styled-menu-trigger"));
    const billing = screen.getByTestId("styled-menu-item-a");
    expect(billing).toHaveFocus();
    expect(billing).toHaveAttribute("aria-disabled", "true");
    expect(billing).not.toBeDisabled();
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("StyledMenu — the current item is marked, never disabled", () => {
  it("checked mode: menuitemradio, aria-checked on exactly the current item", () => {
    setup();
    const radios = screen.getAllByRole("menuitemradio", { hidden: true });
    expect(radios).toHaveLength(3);
    const checked = radios.filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked.map((r) => r.textContent)).toEqual([expect.stringContaining("Beta LLC")]);
    for (const r of radios) {
      expect(r).not.toBeDisabled();
      expect(r).not.toHaveAttribute("aria-disabled");
    }
  });

  it("current mode: menuitem with aria-current on the current item", () => {
    setup({ selection: "current" });
    const items = screen.getAllByRole("menuitem", { hidden: true });
    expect(items).toHaveLength(3);
    expect(screen.getByTestId("styled-menu-item-beta")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("styled-menu-item-acme")).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("styled-menu-item-beta")).not.toHaveAttribute("aria-checked");
  });

  it("draws the state too — a check mark, not colour alone", () => {
    setup();
    expect(screen.getByTestId("styled-menu-item-beta").textContent).toContain("✓");
    expect(screen.getByTestId("styled-menu-item-acme").textContent).not.toContain("✓");
  });
});

describe("StyledMenu — links", () => {
  it("renders an href item as a link with the menuitem role", async () => {
    const onSelect = jest.fn();
    render(
      <StyledMenu
        label="Account"
        selection="current"
        items={[{ id: "settings", label: "Settings", href: "/settings" }]}
        onSelect={onSelect}
      />,
    );
    const item = screen.getByTestId("styled-menu-item-settings");
    expect(item.tagName).toBe("A");
    expect(item).toHaveAttribute("href", "/settings");
    expect(item).toHaveAttribute("role", "menuitem");
    act(() => {
      fireEvent.click(item, { ctrlKey: true });
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("StyledMenu — locked", () => {
  it("renders the value as a labelled static <dl>: no trigger, no menu, no tab stop", () => {
    render(
      <StyledMenu
        locked
        lockedLabel="Organisation"
        label="Acme Ltd"
        items={[{ id: "acme", label: "Acme Ltd" }]}
        currentId="acme"
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu", { hidden: true })).not.toBeInTheDocument();
    const locked = screen.getByTestId("styled-menu-locked");
    expect(locked.tagName).toBe("DL");
    expect(locked.querySelector("dt")?.textContent).toBe("Organisation");
    expect(locked.querySelector("dd")?.textContent).toBe("Acme Ltd");
  });
});

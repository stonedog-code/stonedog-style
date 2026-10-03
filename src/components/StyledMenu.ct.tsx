import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { MenuSwitcher, MenuAccount, MenuLocked } from "./StyledMenu.harness";

/**
 * StyledMenu in a real browser — the half jsdom cannot answer: target sizes,
 * whether a `hidden` panel really disappears under a `display: flex` base,
 * whether the menu stays on a 375px screen, whether the z-index token resolved,
 * and whether focus is visible.
 */

/** Every class on the element that no stylesheet rule mentions. */
async function unmatchedClasses(locator: Locator): Promise<string[]> {
  return locator.evaluate((el: HTMLElement) => {
    const selectors: string[] = [];
    const walk = (list: CSSRule[]) => {
      for (const rule of list) {
        if ("selectorText" in rule) selectors.push((rule as CSSStyleRule).selectorText);
        if ("cssRules" in rule) walk(Array.from((rule as CSSGroupingRule).cssRules));
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(Array.from(sheet.cssRules));
      } catch {
        continue;
      }
    }
    const joined = selectors.join("\n");
    return Array.from(el.classList).filter((cls) => !joined.includes(`.${CSS.escape(cls)}`));
  });
}

test.describe("closed", () => {
  test("the panel is genuinely not rendered — `hidden` beats the flex base", async ({ mount }) => {
    const component = await mount(<MenuSwitcher />);
    const menu = component.getByRole("menu", { includeHidden: true });
    await expect(menu).toBeHidden();
    expect(await menu.evaluate((el) => getComputedStyle(el).display)).toBe("none");
  });
});

test.describe("targets", () => {
  for (const profile of ["xs", "md", "xl"] as const) {
    test(`trigger and every item clear 48px at the ${profile} profile`, async ({ mount }) => {
      const component = await mount(<MenuSwitcher profile={profile} />);
      const trigger = component.getByRole("button", { name: /switch organisation/ });
      const tbox = await trigger.boundingBox();
      expect(tbox!.height).toBeGreaterThanOrEqual(48);
      expect(tbox!.width).toBeGreaterThanOrEqual(48);
      await trigger.click();
      const items = component.getByRole("menuitemradio");
      await expect(items).toHaveCount(3);
      for (const item of await items.all()) {
        const box = await item.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(48);
      }
    });
  }

  test("item text follows the reader's profile", async ({ mount }) => {
    const small = await mount(<MenuSwitcher profile="xs" />);
    await small.getByRole("button").click();
    const xs = await small
      .getByRole("menuitemradio")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    await small.unmount();
    const large = await mount(<MenuSwitcher profile="xl" />);
    await large.getByRole("button").click();
    const xl = await large
      .getByRole("menuitemradio")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(xl).toBeGreaterThan(xs);
  });
});

test.describe("placement", () => {
  for (const align of ["start", "end"] as const) {
    test(`a long option stays on screen when aligned to the ${align}`, async ({ mount, page }) => {
      const component = await mount(<MenuSwitcher align={align} long />);
      await component.getByRole("button").click();
      const menu = component.getByRole("menu");
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      // The long label wraps inside the item rather than overflowing it.
      const item = component.getByTestId("styled-menu-item-long");
      const overflow = await item.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("sits on the menu layer — the z-index token resolved to a number", async ({ mount }) => {
    const component = await mount(<MenuSwitcher />);
    await component.getByRole("button").click();
    const z = await component.getByRole("menu").evaluate((el) => getComputedStyle(el).zIndex);
    expect(z).toBe("300");
  });

  test("every class on the panel and an item has a rule behind it", async ({ mount }) => {
    const component = await mount(<MenuSwitcher />);
    await component.getByRole("button").click();
    expect(await unmatchedClasses(component.getByRole("menu"))).toEqual([]);
    expect(await unmatchedClasses(component.getByRole("menuitemradio").first())).toEqual([]);
  });
});

test.describe("keyboard and focus", () => {
  test("ArrowDown opens on the current item; arrows, Escape and focus return work", async ({
    mount,
    page,
  }) => {
    const component = await mount(<MenuSwitcher />);
    const trigger = component.getByRole("button");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(component.getByRole("menuitemradio", { name: /Beta LLC/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(component.getByRole("menuitemradio", { name: /Gamma/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(component.getByRole("menuitemradio", { name: /Acme/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("the focused item shows a ring and the accent surface, not the resting one", async ({
    mount,
    page,
  }) => {
    const component = await mount(<MenuSwitcher />);
    await component.getByRole("button").focus();
    await page.keyboard.press("ArrowDown");
    const focused = component.getByRole("menuitemradio", { name: /Beta LLC/ });
    const resting = component.getByRole("menuitemradio", { name: /Acme/ });
    await expect(focused).toBeFocused();
    const read = (l: Locator) =>
      l.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, outline: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
    const f = await read(focused);
    const r = await read(resting);
    expect(f.outline).not.toBe("none");
    expect(f.width).toBeGreaterThan(0);
    expect(f.bg).not.toBe(r.bg);
    expect(r.bg).toBe("rgba(0, 0, 0, 0)");
  });

  test("choosing an item switches, closes, and returns focus to the trigger", async ({
    mount,
    page,
  }) => {
    const component = await mount(<MenuSwitcher />);
    const trigger = component.getByRole("button");
    await trigger.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(component.getByRole("menu", { includeHidden: true })).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toContainText("Gamma Charitable Trust");
  });

  test("Tab out closes it (focusout) and focus goes on", async ({ mount, page }) => {
    const component = await mount(<MenuAccount />);
    await component.getByRole("button", { name: "Account" }).click();
    await page.keyboard.press("Tab");
    await expect(component.getByRole("menu", { includeHidden: true })).toBeHidden();
    await expect(component.getByRole("button", { name: "After the menu" })).toBeFocused();
  });

  test("a press outside closes it", async ({ mount, page }) => {
    const component = await mount(<MenuAccount />);
    await component.getByRole("button", { name: "Account" }).click();
    await expect(component.getByRole("menu")).toBeVisible();
    await page.mouse.click(5, page.viewportSize()!.height - 5);
    await expect(component.getByRole("menu", { includeHidden: true })).toBeHidden();
  });
});

test.describe("current, disabled and link items", () => {
  test("the current item is checked, drawn with a mark and weight, and still focusable", async ({
    mount,
  }) => {
    const component = await mount(<MenuSwitcher />);
    await component.getByRole("button").click();
    const current = component.getByRole("menuitemradio", { name: /Beta LLC/ });
    await expect(current).toHaveAttribute("aria-checked", "true");
    await expect(current).toBeEnabled();
    await expect(current).toBeFocused();
    await expect(current).toContainText("✓");
    const weights = await component.getByRole("menuitemradio").evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el.querySelector("span + span span")!).fontWeight)),
    );
    expect(weights[1]).toBeGreaterThan(weights[0]!);
  });

  test("a disabled item is reachable by arrow and announced, not skipped", async ({ mount, page }) => {
    const component = await mount(<MenuAccount />);
    await component.getByRole("button", { name: "Account" }).click();
    await page.keyboard.press("ArrowDown");
    const billing = component.getByRole("menuitem", { name: "Billing" });
    await expect(billing).toBeFocused();
    await expect(billing).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await expect(component.getByTestId("last")).toHaveText("none");
  });

  test("a link item navigates and reports the choice", async ({ mount, page }) => {
    const component = await mount(<MenuAccount />);
    await component.getByRole("button", { name: "Account" }).click();
    const profile = component.getByRole("menuitem", { name: "Profile" });
    await expect(profile).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#profile$/);
    await expect(component.getByTestId("last")).toHaveText("profile");
  });
});

test.describe("locked", () => {
  test("renders a labelled value with nothing to operate", async ({ mount }) => {
    const component = await mount(<MenuLocked />);
    await expect(component.getByRole("button")).toHaveCount(0);
    await expect(component.getByRole("term")).toHaveText("Organisation");
    await expect(component.getByRole("definition")).toHaveText("Acme Ltd");
  });
});

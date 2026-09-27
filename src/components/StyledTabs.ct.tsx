import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import {
  TabsHarness,
  TabsAtTwoProfiles,
  TabsInANarrowBox,
  ShortTabsInANarrowBox,
} from "./StyledTabs.harness";

/**
 * The half jsdom cannot answer.
 *
 * Three different questions live here, and each one is unanswerable in the unit
 * tier for a different reason:
 *
 * 1. **The tap target.** jsdom has no layout engine and reports every box as
 *    zero-sized, so an assertion that a tab is at least 48×48 passes there over
 *    a 0×0 element — a green over an empty set, in one line.
 * 2. **Whether the styles exist at all.** Panda extracts by statically parsing
 *    source, and it passes an unknown token through verbatim: the class lands
 *    in the DOM, the stylesheet says `background-color: boxBgSecondary`, the
 *    browser discards the declaration, and nothing errors. `bg:
 *    "buttonBgHover"`, `color: "fg.muted"` and `zIndex: "modal"` all shipped in
 *    this package that way. `unmatchedClasses` below asks the stylesheet
 *    directly whether each emitted class has a rule behind it.
 * 3. **Whether the reader's font-size profile reaches the label.** Every
 *    `fontSizeMap` entry is a `var(--font-sizes-*, …)` reference, which jsdom's
 *    CSS parser rejects against the `font-size` grammar — so it drops the
 *    declaration, the element ends up with no `style` attribute, and
 *    `toHaveStyle` compares "" with "" and passes for every possible expected
 *    value. Only a real engine resolves it.
 */

/** Every class on the element that no stylesheet rule mentions. */
async function unmatchedClasses(locator: Locator): Promise<string[]> {
  return locator.evaluate((el: HTMLElement) => {
    const selectors: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRule[];
      try {
        rules = Array.from(sheet.cssRules);
      } catch {
        continue;
      }
      const walk = (list: CSSRule[]) => {
        for (const rule of list) {
          if ("selectorText" in rule) {
            selectors.push((rule as CSSStyleRule).selectorText);
          }
          if ("cssRules" in rule) {
            walk(Array.from((rule as CSSGroupingRule).cssRules));
          }
        }
      };
      walk(rules);
    }
    const joined = selectors.join("\n");
    return Array.from(el.classList).filter(
      (cls) => !joined.includes(`.${CSS.escape(cls)}`),
    );
  });
}

const paint = (locator: Locator) =>
  locator.evaluate((el: HTMLElement) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      color: s.color,
      underlineWidth: s.borderBottomWidth,
      underlineColor: s.borderBottomColor,
      weight: s.fontWeight,
      fontSize: s.fontSize,
    };
  });

test.describe("the tap target", () => {
  test("every tab meets the 48x48 floor", async ({ mount }) => {
    // The component arrived from an application at 44px — WCAG 2.5.5 AAA, but
    // below this package's own floor, on a primary navigation control.
    const component = await mount(<TabsHarness />);
    const tabs = component.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i += 1) {
      const box = await tabs.nth(i).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
  });

  test("the floor survives the smallest font-size profile", async ({ mount }) => {
    // It is a min-height, not padding that happens to add up — so the smallest
    // label must not be able to shrink the target under the floor.
    const component = await mount(<TabsHarness profile="xs" />);
    const box = await component.getByRole("tab").first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });
});

test.describe("the styles actually render", () => {
  test("no class on a tab is missing its rule", async ({ mount }) => {
    const component = await mount(<TabsHarness />);
    const tab = component.getByRole("tab").first();
    const classes = await tab.evaluate((el: HTMLElement) =>
      Array.from(el.classList),
    );
    // The input set, so this cannot pass over an element Panda styled with
    // nothing at all.
    expect(classes.length).toBeGreaterThan(5);
    expect(await unmatchedClasses(tab)).toEqual([]);
  });

  test("no class on the tablist is missing its rule", async ({ mount }) => {
    const component = await mount(<TabsHarness />);
    const list = component.getByRole("tablist");
    const classes = await list.evaluate((el: HTMLElement) =>
      Array.from(el.classList),
    );
    expect(classes.length).toBeGreaterThan(3);
    expect(await unmatchedClasses(list)).toEqual([]);
  });

  test("the selected tab paints a real surface and a real text colour", async ({
    mount,
  }) => {
    // Both halves. A token the contract does not define emits the bare name,
    // which the browser drops — so what comes back would be the inherited
    // colour and `rgba(0, 0, 0, 0)`, identical to an unselected tab.
    const component = await mount(<TabsHarness />);
    const selected = await paint(component.getByTestId("security-passkeys"));
    expect(selected.background).toMatch(/^rgba?\(/);
    expect(selected.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(selected.color).toMatch(/^rgba?\(/);
    expect(selected.color).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("selection is carried by three signals, not by colour alone", async ({
    mount,
  }) => {
    // WCAG 1.4.1. The underline and the weight are what a reader who cannot
    // distinguish the two surfaces has to go on.
    const component = await mount(<TabsHarness />);
    const selected = await paint(component.getByTestId("security-passkeys"));
    const other = await paint(component.getByTestId("security-sessions"));

    expect(selected.underlineWidth).toBe("4px");
    expect(selected.underlineColor).not.toBe(other.underlineColor);
    expect(Number(selected.weight)).toBeGreaterThan(Number(other.weight));
    expect(selected.background).not.toBe(other.background);
  });

  test("the underline colour is a resolved colour, not a dropped token", async ({
    mount,
  }) => {
    const component = await mount(<TabsHarness />);
    const selected = await paint(component.getByTestId("security-passkeys"));
    expect(selected.underlineColor).toMatch(/^rgba?\(/);
    // `transparent` is what an unselected tab states, so the selected one
    // reading it back would mean the token never resolved.
    expect(selected.underlineColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("the reader's font-size profile reaches the label", () => {
  test("a larger profile renders a larger label", async ({ mount }) => {
    const component = await mount(<TabsAtTwoProfiles />);
    const small = await paint(component.getByTestId("small-passkeys"));
    const large = await paint(component.getByTestId("large-passkeys"));
    expect(parseFloat(large.fontSize)).toBeGreaterThan(
      parseFloat(small.fontSize),
    );
  });

  test("the label itself moves, not only the button box", async ({ mount }) => {
    // The box and the label are given the same step deliberately. Measuring
    // only the box would pass over a label pinned by its own rule.
    const component = await mount(<TabsAtTwoProfiles />);
    const labelSize = (testId: string) =>
      component
        .getByTestId(testId)
        .locator("span")
        .first()
        .evaluate((el: HTMLElement) => parseFloat(getComputedStyle(el).fontSize));
    expect(await labelSize("large-passkeys")).toBeGreaterThan(
      await labelSize("small-passkeys"),
    );
  });

  test("the button box is not stranded at the user agent's size", async ({
    mount,
  }) => {
    // A <button> inherits no font size from the page. Left alone it sits at
    // Chromium's 13.3333px at every profile, and everything measured in `em`
    // against it rides on that number.
    const component = await mount(<TabsHarness profile="xl" />);
    const { fontSize } = await paint(component.getByTestId("security-passkeys"));
    expect(parseFloat(fontSize)).toBeGreaterThan(14);
  });
});

test.describe("reflow", () => {
  const overflow = (locator: Locator) =>
    locator.evaluate((el: HTMLElement) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));

  test("wraps onto a second row rather than scrolling at 320px", async ({
    mount,
  }) => {
    // A horizontally scrolling tablist is a WCAG 1.4.10 failure: the tabs past
    // the fold are not discoverable.
    //
    // Labels that genuinely do not fit — see the harness. The first version of
    // this test used three short ones, which fit on one row at 320px, so it
    // asserted a wrap that never happened and failed at all four viewports on
    // a component that was correct.
    const component = await mount(<TabsInANarrowBox />);
    const { scrollWidth, clientWidth } = await overflow(
      component.getByRole("tablist"),
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    const first = await component.getByRole("tab").nth(0).boundingBox();
    const last = await component.getByRole("tab").nth(2).boundingBox();
    expect(last!.y).toBeGreaterThan(first!.y);
  });

  test("a list that fits stays on one row", async ({ mount }) => {
    // The control. Without it, "no horizontal overflow" would be equally true
    // of a list that overflowed and was clipped, and "it wrapped" would not
    // distinguish wrapping from wrapping always.
    const component = await mount(<ShortTabsInANarrowBox />);
    const { scrollWidth, clientWidth } = await overflow(
      component.getByRole("tablist"),
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    const first = await component.getByRole("tab").nth(0).boundingBox();
    const last = await component.getByRole("tab").nth(2).boundingBox();
    expect(last!.y).toBe(first!.y);
  });
});

test.describe("keyboard operation in a real browser", () => {
  test("one Tab reaches the list, a second leaves it", async ({
    mount,
    page,
  }) => {
    // The roving tabindex, measured rather than inferred from the attribute.
    const component = await mount(<TabsHarness />);
    await page.keyboard.press("Tab");
    await expect(component.getByTestId("security-passkeys")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(component.getByTestId("security-sessions")).not.toBeFocused();
    await expect(component.getByTestId("panel")).toBeFocused();
  });

  test("ArrowRight moves the focus and the selection together", async ({
    mount,
    page,
  }) => {
    const component = await mount(<TabsHarness />);
    await component.getByTestId("security-passkeys").focus();
    await page.keyboard.press("ArrowRight");
    await expect(component.getByTestId("security-sessions")).toBeFocused();
    await expect(component.getByTestId("security-sessions")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("ArrowLeft wraps to the last tab", async ({ mount, page }) => {
    const component = await mount(<TabsHarness />);
    await component.getByTestId("security-passkeys").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(component.getByTestId("security-history")).toBeFocused();
  });

  test("the focus ring is visible, and outside the tab's own box", async ({
    mount,
    page,
  }) => {
    // An outline with `outline-offset` sits clear of the 4px underline. A ring
    // drawn inside the border is the one a reader with low vision misses.
    const component = await mount(<TabsHarness />);
    await page.keyboard.press("Tab");
    const ring = await component
      .getByTestId("security-passkeys")
      .evaluate((el: HTMLElement) => {
        const s = getComputedStyle(el);
        return {
          width: s.outlineWidth,
          style: s.outlineStyle,
          offset: s.outlineOffset,
          color: s.outlineColor,
        };
      });
    expect(ring.style).toBe("solid");
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(3);
    expect(parseFloat(ring.offset)).toBeGreaterThan(0);
    expect(ring.color).toMatch(/^rgba?\(/);
  });

  test("Space activates a tab, because it is a real button", async ({
    mount,
    page,
  }) => {
    const component = await mount(<TabsHarness initial="sessions" />);
    await component.getByTestId("security-passkeys").focus();
    await page.keyboard.press("Space");
    await expect(component.getByTestId("security-passkeys")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

test.describe("the panel", () => {
  test("is labelled by its tab and swaps with the selection", async ({
    mount,
  }) => {
    const component = await mount(<TabsHarness />);
    await expect(component.getByTestId("panel")).toHaveAttribute(
      "aria-labelledby",
      "security-passkeys",
    );
    await component.getByTestId("security-history").click();
    await expect(component.getByTestId("panel")).toHaveAttribute(
      "aria-labelledby",
      "security-history",
    );
  });

  test("only one panel is in the document at a time", async ({ mount }) => {
    // Which is why only the selected tab may carry `aria-controls`.
    const component = await mount(<TabsHarness />);
    await expect(component.getByRole("tabpanel")).toHaveCount(1);
  });
});

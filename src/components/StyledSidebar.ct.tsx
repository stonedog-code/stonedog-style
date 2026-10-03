import { test, expect } from "@playwright/experimental-ct-react";
import {
  SidebarBasic,
  SidebarScrolling,
  SidebarPaging,
  SidebarLongLabels,
  SidebarIconOnly,
  SidebarIconOnlyScrolling,
  SidebarIconOnlyAtDensity,
  SidebarLinks,
  SidebarLinksIconOnly,
} from "./StyledSidebar.harness";

/**
 * StyledSidebar in a real browser.
 *
 * Everything NEH-223 asks for that jsdom structurally cannot answer lives here:
 * target sizes, overflow, whether scroll mode scrolls, whether selection is
 * visible, and whether a keypress on a native button does what a keypress does.
 * The jest suite next door owns the wiring — which callback fired, which ARIA
 * attribute is set — and neither tier can stand in for the other.
 *
 * Worth stating plainly: jsdom reports every box as 0×0, so a "48px floor" test
 * there passes on a control that renders 12px tall. That is the whole reason
 * this file exists.
 */

/** The floors from PRD-0001 §A4: 48 everywhere, 60 for a tool row. */
const ITEM_FLOOR = 60;
const CONTROL_FLOOR = 48;

test.describe("target sizes", () => {
  test("every tool row clears the 60px row floor", async ({ mount }) => {
    const component = await mount(<SidebarBasic />);
    const rows = component.getByTestId(/^sidebar-item-/);
    const count = await rows.count();
    expect(count).toBe(4);

    for (let i = 0; i < count; i++) {
      const box = (await rows.nth(i).boundingBox())!;
      expect(box.height, `row ${i} fell under the row floor`).toBeGreaterThanOrEqual(ITEM_FLOOR);
      // Width is not the interesting axis for a full-width row, but a rail that
      // collapsed to nothing would still pass a height-only assertion.
      expect(box.width).toBeGreaterThanOrEqual(CONTROL_FLOOR);
    }
  });

  test("the help control clears the 48px floor and is not clipped by the row", async ({ mount, page }) => {
    const component = await mount(<SidebarBasic />);
    const help = component.getByRole("button", { name: "What does Calendar do?" });
    const box = (await help.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(CONTROL_FLOOR);
    expect(box.width).toBeGreaterThanOrEqual(CONTROL_FLOOR);

    // It sits beside a row that used to claim `width: 100%`, which pushed it
    // off the rail entirely at 375px. Assert it is actually inside.
    const rail = (await page.getByTestId("rail").boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(rail.x + rail.width + 1);
  });

  test("the pager and collapse controls clear the 48px floor", async ({ mount }) => {
    const component = await mount(<SidebarPaging />);
    for (const testId of ["sidebar-prev", "sidebar-next", "sidebar-collapse"]) {
      const box = (await component.getByTestId(testId).boundingBox())!;
      expect(box.height, `${testId} fell under the floor`).toBeGreaterThanOrEqual(CONTROL_FLOOR);
      expect(box.width, `${testId} fell under the floor`).toBeGreaterThanOrEqual(CONTROL_FLOOR);
    }
  });
});

test.describe("overflow", () => {
  test("scroll mode actually scrolls once the host constrains the height", async ({ mount }) => {
    // 30 tools in a 400px rail. Before this, nothing asserted that the scroll
    // container could scroll at all — the jest suite could only see that a pager
    // was absent, which is true of a rail that silently cuts tools off (§D17).
    const component = await mount(<SidebarScrolling />);
    const scroller = component.getByTestId("sidebar-scroll");

    const metrics = await scroller.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));

    expect(metrics.overflowY).toBe("auto");
    expect(metrics.clientHeight).toBeGreaterThan(0);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // And it moves. A container that reports overflow but refuses to scroll
    // hides the remaining tools just as completely.
    await scroller.evaluate((el) => el.scrollBy(0, 200));
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test("paging shows a bounded page and never overflows the rail", async ({ mount, page }) => {
    const component = await mount(<SidebarPaging />);
    await expect(component.getByTestId("sidebar-page-status")).toHaveText("Page 1 of 8");
    await expect(component.getByTestId(/^sidebar-item-/)).toHaveCount(4);

    const rail = await page.getByTestId("rail").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    // 1px of tolerance for sub-pixel rounding; anything more is a real spill.
    expect(rail.scrollWidth).toBeLessThanOrEqual(rail.clientWidth + 1);
  });

  test("a long tool name wraps instead of spilling out of the rail", async ({ mount, page }) => {
    // PRD §A3. `min-width: 0` on the label column is what makes this true —
    // a flex child defaults to `min-width: auto` and refuses to shrink below
    // its longest word, so the row grows and the rail scrolls sideways.
    const component = await mount(<SidebarLongLabels />);
    const rail = await page.getByTestId("rail").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(rail.scrollWidth).toBeLessThanOrEqual(rail.clientWidth + 1);

    // It wrapped rather than being cut off: the row is taller than one line.
    const box = (await component.getByTestId("sidebar-item-long").boundingBox())!;
    expect(box.height).toBeGreaterThan(ITEM_FLOOR);
  });
});

test.describe("selection", () => {
  test("is drawn, and not by colour alone", async ({ mount }) => {
    const component = await mount(<SidebarBasic />);
    const read = (testId: string) =>
      component.getByTestId(testId).evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          borderColor: s.borderTopColor,
          background: s.backgroundColor,
          // The label carries the non-colour half of the signal.
          weight: getComputedStyle(el.querySelector("span span")!).fontWeight,
        };
      });

    const selected = await read("sidebar-item-calendar");
    const plain = await read("sidebar-item-notes");

    // The colours resolved — an unresolved token would leave these at the
    // initial value, which is exactly how `color: fg.muted` went unnoticed.
    expect(selected.borderColor).not.toBe(plain.borderColor);
    expect(selected.borderColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(selected.background).not.toBe(plain.background);
    expect(selected.background).not.toBe("rgba(0, 0, 0, 0)");

    // WCAG 1.4.1: greyscale, high contrast and colour blindness all keep this.
    expect(Number(selected.weight)).toBeGreaterThan(Number(plain.weight));
  });

  test("moves on Enter, so the rail is usable without a pointer", async ({ mount, page }) => {
    const component = await mount(<SidebarBasic />);
    await component.getByTestId("sidebar-item-notes").focus();
    await page.keyboard.press("Enter");
    await expect(component.getByTestId("sidebar-item-notes")).toHaveAttribute("aria-current", "true");
    await expect(component.getByTestId("sidebar-item-calendar")).not.toHaveAttribute("aria-current", "true");
  });
});

test.describe("keyboard", () => {
  test("tabs through every control in reading order", async ({ mount, page }) => {
    // §G24. The order matters as much as the reachability: a help control that
    // lands after the whole list is a help control nobody finds.
    const component = await mount(<SidebarBasic />);
    await component.getByTestId("sidebar-item-calendar").focus();

    await page.keyboard.press("Tab");
    await expect(component.getByRole("button", { name: "What does Calendar do?" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(component.getByTestId("sidebar-item-notes")).toBeFocused();
  });

  test("opens help with a keypress, closes it with Escape, and gives focus back", async ({ mount, page }) => {
    // §B7. Escape has to work or a keyboard user is stuck with the panel open;
    // focus has to return or they resume at the top of the document.
    const component = await mount(<SidebarBasic />);
    const help = component.getByRole("button", { name: "What does Calendar do?" });

    await help.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(help).toBeFocused();
  });

  test("shows a focus indicator that is not just the cursor", async ({ mount }) => {
    // A rail operated by keyboard with no visible focus ring is unusable for
    // exactly the readers this component is built for.
    const component = await mount(<SidebarBasic />);
    const row = component.getByTestId("sidebar-item-tasks");
    await row.focus();
    const outline = await row.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });
});

/**
 * The §20a icon-only rail.
 *
 * jsdom said the labels are gone and the aria-label is present, which is the
 * wiring. It cannot say whether the rail actually got narrower — its whole
 * point — nor whether an item stripped of its label still presents a target a
 * shaky hand can hit. Both are only answerable here.
 */
test.describe("icon-only collapse (§20a)", () => {
  test("survives a rail too narrow for labels — the component does NOT narrow itself", async ({
    mount,
  }) => {
    // The finding this test exists to pin. `iconOnlyWhenCollapsed` recovers NO
    // horizontal space on its own: the sidebar fills whatever width the host
    // gives it, so a host that flips the flag and leaves its container at 260px
    // has given up the visible names for nothing — silently, with no build
    // error. Narrowing the container is the host's half.
    //
    // So what the component owes is weaker and testable: it must survive being
    // narrowed. Nothing inside may force a minimum width that makes a 72px rail
    // overflow.
    // `component` IS the rail — it is the harness's root element, so looking
    // for the rail's testid *inside* it finds nothing and times out.
    const component = await mount(<SidebarIconOnly />);
    const rail = (await component.boundingBox())!;
    const sidebar = (await component.getByTestId("styled-sidebar").boundingBox())!;

    expect(rail.width).toBeLessThanOrEqual(80);
    expect(
      sidebar.width,
      "the sidebar overflowed a rail narrow enough to be worth collapsing for",
    ).toBeLessThanOrEqual(rail.width + 1);
  });

  test("keeps a hittable target after losing the label", async ({ mount }) => {
    const component = await mount(<SidebarIconOnly />);
    const rows = component.getByTestId(/^sidebar-item-/);
    const count = await rows.count();
    expect(count).toBe(4);

    for (let i = 0; i < count; i++) {
      const box = (await rows.nth(i).boundingBox())!;
      // The row floor still applies: the label was what gave these rows their
      // width, so this is exactly where a target quietly collapses to the size
      // of a glyph.
      expect(box.height, `row ${i} fell under the row floor`).toBeGreaterThanOrEqual(ITEM_FLOOR);
      expect(box.width, `row ${i} fell under the control floor`).toBeGreaterThanOrEqual(
        CONTROL_FLOOR,
      );
    }
  });

  test("expanding brings the names back", async ({ mount }) => {
    const component = await mount(<SidebarIconOnly />);
    await expect(component.getByText("Calendar")).toBeHidden();

    await component.getByTestId("sidebar-collapse").click();

    // Uncontrolled, so the component owns this — a host that only wanted
    // "start collapsed" must not end up with a rail it cannot open.
    await expect(component.getByText("Calendar")).toBeVisible();
  });
});

/**
 * Clipping in a narrow rail — reported from production on 0.853.0.
 *
 * "The expand button and each icon are cut off due to the scrollbar."
 *
 * The mechanism: `StyledScrollbar` is `scrollbarWidth: thick` with `0.5rem` of
 * padding-right. A thick scrollbar is ~15-17px, so at a 72px rail the usable
 * width after the sidebar's own padding and the scroll gutter is less than the
 * 48px target the items are supposed to keep — and the item button is
 * `minWidth: 0`, so it shrinks rather than refusing.
 *
 * These measure against the SCROLL CONTAINER's client box rather than the
 * viewport. An element can sit fully inside the window and still be clipped by
 * the scrollbar of its own parent, which is exactly what was reported and what
 * a viewport-based assertion would miss.
 */
test.describe("narrow rail does not clip its controls", () => {
  test("no tool icon is cut off by the scroll gutter", async ({ mount }) => {
    // The SCROLLING harness, deliberately. Four tools do not overflow, so no
    // scrollbar exists and nothing is clipped — which is exactly why the first
    // round of §20a tests passed while production was visibly broken.
    const component = await mount(<SidebarIconOnlyScrolling />);
    const scroll = component.getByTestId("sidebar-scroll");
    const clip = (await scroll.boundingBox())!;
    // The scrollbar lives inside the border box, so the content a reader can
    // actually see ends at clientWidth, not at the box's right edge.
    const clientWidth = await scroll.evaluate((el) => el.clientWidth);
    const visibleRight = clip.x + clientWidth;

    const rows = component.getByTestId(/^sidebar-item-/);
    expect(await rows.count()).toBeGreaterThan(4);

    // The first few, which are the ones on screen. Rows below the fold have a
    // box too, but clipping is a horizontal question and the top rows answer it.
    for (let i = 0; i < 3; i++) {
      const box = (await rows.nth(i).boundingBox())!;
      expect(
        box.x + box.width,
        `tool row ${i} is clipped by the scroll gutter`,
      ).toBeLessThanOrEqual(visibleRight);
    }
  });

  test("the collapse control is fully inside the rail", async ({ mount }) => {
    const component = await mount(<SidebarIconOnly />);
    const rail = (await component.boundingBox())!;
    const toggle = (await component.getByTestId("sidebar-collapse").boundingBox())!;

    expect(toggle.x, "the collapse control starts left of the rail").toBeGreaterThanOrEqual(
      rail.x - 0.5,
    );
    expect(
      toggle.x + toggle.width,
      "the collapse control overflows the rail",
    ).toBeLessThanOrEqual(rail.x + rail.width + 0.5);
  });
});

/**
 * "It needs more padding to ensure on each density the icons and expand button
 * are fully visible."
 *
 * Every rung, because the report named all of them and the ladder spans 12px of
 * padding between `tight` and `airy`. A rail that fits at `standard` and
 * overflows at `airy` is the failure worth catching, and a fixed-density
 * harness would exercise exactly one of the five.
 */
const DENSITY_RUNGS = ["tight", "compact", "standard", "spacious", "airy"] as const;

test.describe("icon-only rail fits at every density", () => {
  for (const step of DENSITY_RUNGS) {
    test(`nothing overflows the rail at ${step}`, async ({ mount }) => {
      const component = await mount(<SidebarIconOnlyAtDensity step={step} />);
      const rail = (await component.getByTestId("rail").boundingBox())!;
      const right = rail.x + rail.width + 0.5;

      const toggle = (await component.getByTestId("sidebar-collapse").boundingBox())!;
      expect(
        toggle.x + toggle.width,
        `the collapse control overflows the rail at ${step}`,
      ).toBeLessThanOrEqual(right);

      const rows = component.getByTestId(/^sidebar-item-/);
      for (let i = 0; i < 3; i++) {
        const box = (await rows.nth(i).boundingBox())!;
        expect(
          box.x + box.width,
          `tool row ${i} overflows the rail at ${step}`,
        ).toBeLessThanOrEqual(right);
        // And it must still be reachable — shrinking to fit is not fitting.
        expect(
          box.width,
          `tool row ${i} fell under the control floor at ${step}`,
        ).toBeGreaterThanOrEqual(CONTROL_FLOOR);
      }
    });
  }

  test("reserves the scrollbar gutter rather than laying out underneath it", async ({
    mount,
  }) => {
    // The mechanism, asserted because the SYMPTOM is not reproducible here:
    // headless Chromium uses overlay scrollbars, which occupy zero width, so
    // the clipping a desktop reader sees cannot happen in this browser at all.
    // Asserting `scrollbar-gutter` is what makes the guard mean something on
    // the machines where the bug was reported.
    const component = await mount(<SidebarIconOnlyAtDensity step="standard" />);
    const gutter = await component
      .getByTestId("sidebar-scroll")
      .evaluate((el) => getComputedStyle(el).scrollbarGutter);
    expect(gutter).toContain("stable");
  });
});

/**
 * `href` items render as `<a>` (0.34.0). The button rows above already prove
 * the box; these prove the LINK form inherits all of it — an anchor is
 * `display: inline` with a link colour and an underline by default, so a
 * shared recipe that silently failed to apply would show up here and nowhere
 * else.
 */
test.describe("href items", () => {
  test("are links, and clear the same 60px row floor", async ({ mount }) => {
    const component = await mount(<SidebarLinks />);
    const rows = component.getByRole("link");
    await expect(rows).toHaveCount(4);
    for (const row of await rows.all()) {
      const box = await row.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(60);
    }
  });

  test("carry no UA link underline or link colour", async ({ mount }) => {
    const component = await mount(<SidebarLinks />);
    const style = await component.getByTestId("sidebar-item-notes").evaluate((el) => {
      const s = getComputedStyle(el);
      return { decoration: s.textDecorationLine, color: s.color, display: s.display };
    });
    expect(style.decoration).toBe("none");
    // `inherit` from the context the harness paints — not the UA's link blue.
    expect(style.color).toBe("rgb(1, 2, 3)");
    expect(style.display).toBe("flex");
  });

  test("the selected link is drawn like the selected button, and announced as the page", async ({ mount }) => {
    const component = await mount(<SidebarLinks />);
    const selected = component.getByTestId("sidebar-item-calendar");
    const plain = component.getByTestId("sidebar-item-notes");
    await expect(selected).toHaveAttribute("aria-current", "page");
    await expect(plain).not.toHaveAttribute("aria-current");
    const bg = (l: typeof selected) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg(selected)).not.toBe(await bg(plain));
    expect(await bg(selected)).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("Enter follows the link and selection follows it", async ({ mount, page }) => {
    const component = await mount(<SidebarLinks />);
    await component.getByTestId("sidebar-item-tasks").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#tasks$/);
    await expect(component.getByTestId("sidebar-item-tasks")).toHaveAttribute("aria-current", "page");
  });

  test("on the icon-only rail a link keeps its name and a 48px target", async ({ mount }) => {
    const component = await mount(<SidebarLinksIconOnly />);
    const link = component.getByRole("link", { name: "Calendar" });
    const box = await link.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });
});

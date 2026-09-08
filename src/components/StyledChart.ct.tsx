import { test, expect } from "@playwright/experimental-ct-react";
import {
  ChartInNarrowWidget,
  ChartWithShortTable,
  ChartWithYearOfRows,
} from "./StyledChart.harness";

/**
 * `StyledChart` in a real browser, at real viewports.
 *
 * The jest suite answers everything structural — is it a `<table>`, does the
 * active range carry `aria-pressed`, does a gap print a dash. None of that
 * needs layout, and jsdom cannot answer anything that does: it will happily
 * agree that a 365-row table fits a 500px widget and that a 20px button is a
 * 48px tap target.
 *
 * So this file owns exactly the claims jsdom cannot make:
 *
 * | claim | why it needs a browser |
 * |---|---|
 * | every control is at least 48x48 | jsdom reports a zero-sized box for everything |
 * | the table scrolls INSIDE its own box | needs `scrollHeight` against a laid-out `clientHeight` |
 * | the header stays put while it scrolls | `position: sticky` is a layout behaviour |
 * | the page never scrolls sideways | needs a real document with a real width |
 * | the active range differs by more than colour | needs the computed style the cascade produced |
 *
 * ## Every assertion reports its input-set size
 *
 * A tap-target sweep that finds zero controls passes. So each one asserts how
 * many elements it examined before asserting anything about them — a count
 * that did not move when a control was added is the tell.
 */

/**
 * The house tap-target floor.
 *
 * WCAG 2.2 AA asks 24x24. This system asks 48, because its audience's pointing
 * accuracy is the reason it exists; 60 is preferred and not enforced here,
 * since the range row has to hold five spelled-out labels on a 375px screen.
 */
const TAP_MIN = 48;

test.describe("tap targets", () => {
  test("every control in the chart is at least 48x48", async ({ mount, page }) => {
    await mount(<ChartWithShortTable />);

    const buttons = page.locator("button");
    const count = await buttons.count();
    // The input-set size, asserted before anything is concluded from it. Five
    // ranges plus the fullscreen button.
    expect(count, "controls examined").toBe(6);

    const undersized: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const b = buttons.nth(i);
      const box = await b.boundingBox();
      const name = (await b.textContent())?.trim() ?? `#${i}`;
      if (!box || box.width < TAP_MIN || box.height < TAP_MIN) {
        undersized.push(`${name}: ${box?.width}x${box?.height}`);
      }
    }
    expect(undersized).toEqual([]);
  });

  test("still 48x48 at 375px, where the five labels have to wrap", async ({
    mount,
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mount(<ChartWithShortTable />);
    const buttons = page.locator("button");
    expect(await buttons.count(), "controls examined").toBe(6);
    for (let i = 0; i < 6; i += 1) {
      const box = await buttons.nth(i).boundingBox();
      expect(box!.height, `control ${i} height`).toBeGreaterThanOrEqual(TAP_MIN);
      expect(box!.width, `control ${i} width`).toBeGreaterThanOrEqual(TAP_MIN);
    }
  });
});

test.describe("the active range is not distinguished by colour alone", () => {
  test("differs in weight and in border, as the cascade actually computes it", async ({
    mount,
    page,
  }) => {
    await mount(<ChartWithShortTable />);
    const active = page.getByTestId("chart-range-week");
    const inactive = page.getByTestId("chart-range-day");

    const read = (loc: typeof active) =>
      loc.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          weight: s.fontWeight,
          borderColor: s.borderBottomColor,
          borderWidth: s.borderBottomWidth,
          color: s.color,
        };
      });

    const a = await read(active);
    const i = await read(inactive);

    expect(a.weight).not.toBe(i.weight);
    expect(a.borderColor).not.toBe(i.borderColor);
    // Same border width either way, so choosing one does not move the row.
    expect(a.borderWidth).toBe(i.borderWidth);
    expect(a.borderWidth).toBe("3px");
    // `currentColor` resolves to the label's own colour, which is what makes
    // the border's contrast unable to drift below the text's.
    expect(a.borderColor).toBe(a.color);
  });
});

test.describe("the always-present table pays for its own height", () => {
  test("a week of readings does not scroll", async ({ mount, page }) => {
    await mount(<ChartWithShortTable />);
    const box = page.getByTestId("chart-data-table-scroll");
    await expect(box).toHaveAttribute("data-scrolls", "false");
    const m = await box.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    }));
    expect(m.scrollH).toBeLessThanOrEqual(m.clientH + 1);
  });

  test("a year of readings scrolls inside its own box, not down the page", async ({
    mount,
    page,
  }) => {
    await mount(<ChartWithYearOfRows />);
    const box = page.getByTestId("chart-data-table-scroll");
    await expect(box).toHaveAttribute("data-scrolls", "true");

    const m = await box.evaluate((el) => ({
      rows: el.querySelectorAll("tbody tr").length,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    }));
    expect(m.rows, "rows rendered").toBe(365);
    // The whole point: 365 rows of content, capped box.
    expect(m.scrollH).toBeGreaterThan(m.clientH * 5);
    expect(m.clientH).toBeLessThan(400);
  });

  test("the header stays put while the body scrolls", async ({ mount, page }) => {
    await mount(<ChartWithYearOfRows />);
    const box = page.getByTestId("chart-data-table-scroll");
    const header = page.getByRole("columnheader", { name: "Date" });

    // Measured between TWO scrolled positions, not against the unscrolled
    // one. Before any scroll the header sits below the caption; the first
    // 32px of scroll is the caption leaving, which is the header arriving at
    // its sticky position rather than the header moving. Comparing against
    // the resting position reports a 32px "failure" on a working sticky
    // header — a control that measures the wrong thing and looks right.
    await box.evaluate((el) => el.scrollTo(0, 600));
    await page.waitForTimeout(50);
    const at600 = (await header.boundingBox())!.y;

    await box.evaluate((el) => el.scrollTo(0, 1800));
    await page.waitForTimeout(50);
    const at1800 = (await header.boundingBox())!.y;

    // Sticky, not scrolled away. Without it, a reader 200 rows down a year of
    // readings has no idea which column is which.
    expect(Math.abs(at1800 - at600)).toBeLessThan(2);

    // And the body really did move under it — otherwise this passes over a
    // table that did not scroll at all.
    const moved = await box.evaluate((el) => el.scrollTop);
    expect(moved).toBeGreaterThan(1000);
  });
});

test.describe("the page never scrolls sideways", () => {
  for (const width of [375, 390, 768, 1280]) {
    test(`a six-column table in a 320px widget at ${width}px`, async ({
      mount,
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await mount(<ChartInNarrowWidget />);

      // The table itself is wider than the widget — if it were not, this test
      // would pass over a case that never arises.
      const overflowing = await page
        .getByTestId("chart-data-table-scroll")
        .evaluate((el) => ({
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
        }));
      expect(overflowing.scrollW, "table content width").toBeGreaterThan(
        overflowing.clientW,
      );

      /*
       * The question asked directly: CAN the page be scrolled sideways.
       *
       * `document.documentElement.scrollWidth` is NOT the same question and
       * answers it wrongly — measured here at 546 against a 390px viewport
       * while the page was in fact unscrollable and `body.scrollWidth` was
       * exactly 390. It counts the layout box of content inside an
       * already-scrolling descendant. Asserting on it would have failed a
       * correct component and, worse, would have passed a broken one wherever
       * the numbers happened to line up.
       */
      const doc = await page.evaluate(() => {
        window.scrollTo(9999, 0);
        return {
          scrolledTo: window.scrollX,
          bodyScrollW: document.body.scrollWidth,
          clientW: document.documentElement.clientWidth,
        };
      });
      expect(doc.scrolledTo, "how far the page scrolled sideways").toBe(0);
      expect(doc.bodyScrollW).toBeLessThanOrEqual(doc.clientW + 1);

      /*
       * And the thing that caused it, named.
       *
       * The gap cells' visually-hidden labels were `position: absolute`. With
       * no positioned ancestor their containing block is the page, so they
       * were clipped by nothing and extended the document past the viewport
       * while being 1x1 and invisible. Asserting the cause as well as the
       * symptom means a future sr-only "tidy-up" fails here rather than in a
       * bug report about a page that scrolls sideways on a phone.
       */
      const hidden = await page.evaluate(() => {
        const spans = Array.from(
          document.querySelectorAll('td[data-gap="true"] span'),
        ).filter((el) => getComputedStyle(el).clipPath !== "none");
        return {
          count: spans.length,
          positioned: spans.filter(
            (el) => getComputedStyle(el).position !== "static",
          ).length,
        };
      });
      expect(hidden.count, "visually-hidden gap labels examined").toBeGreaterThan(0);
      expect(hidden.positioned).toBe(0);
    });
  }
});

test.describe("fullscreen", () => {
  test("covers the viewport, makes the page behind inert, and gives it back", async ({
    mount,
    page,
  }) => {
    await mount(<ChartWithShortTable />);
    await page.getByTestId("chart-fullscreen-open").click();

    const dialog = page.getByRole("dialog");
    const box = (await dialog.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);

    // The page behind is inert, which is what makes `aria-modal` true rather
    // than merely asserted.
    await expect(page.locator("div[inert]")).toHaveCount(1);
    // The same table, in the overlay.
    await expect(dialog.getByRole("table")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("div[inert]")).toHaveCount(0);
    await expect(page.getByTestId("chart-fullscreen-open")).toBeFocused();
  });
});

test.describe("what the always-present table costs", () => {
  /**
   * Not an assertion about a number nobody agreed to — a REPORT.
   *
   * NEH-1521 accepted that each widget roughly doubles in height. The value of
   * measuring it here is that a host sizing a widget shell has a real figure to
   * size against, and that a change which quietly triples it shows up in a run
   * rather than on a dashboard.
   */
  test("reports the chart's height with and without its table", async ({
    mount,
    page,
  }, testInfo) => {
    await mount(<ChartWithShortTable />);
    const frameH = await page
      .locator("[data-plot]")
      .evaluate((el) => el.parentElement!.getBoundingClientRect().height);
    const tableH = await page
      .getByTestId("chart-data-table-scroll")
      .evaluate((el) => el.getBoundingClientRect().height);

    testInfo.annotations.push({
      type: "height",
      description: `frame ${Math.round(frameH)}px, of which table ${Math.round(tableH)}px`,
    });

    // The only thing asserted is that the table is a real share of the height
    // — if it collapsed to nothing, every other test here would still pass.
    expect(tableH).toBeGreaterThan(80);
  });
});

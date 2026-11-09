import { test, expect } from "@playwright/experimental-ct-react";
import { isTransparent } from "./__tests__/fixtures/colour";
import {
  ListHarness,
  ListFragmentHarness,
  ListOverflowHarness,
  ListWithSparkLineHarness,
} from "./StyledList.harness";

/**
 * Two facts here are browser-only.
 *
 * **`gap` replaced a hand-written margin.** The old version cloned
 * `marginBottom` onto every child but the last. Whether rows end up actually
 * separated is a layout question, and jsdom reports every box as 0×0 — it would
 * agree that rows are spaced whether or not they are.
 *
 * **The row separator has to paint.** The item slot's `borderBottom` comes from
 * the recipe, and a token the preset never defined passes through as a literal
 * the browser discards (NEH-301). Only computed style separates "declared" from
 * "rendered".
 */

test.describe("StyledList", () => {
  test("gap actually separates the rows", async ({ mount }) => {
    const component = await mount(<ListHarness gap="2rem" />);
    const items = component.locator("li");

    const first = await items.nth(0).boundingBox();
    const second = await items.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    // 2rem at the harness's root font size. Asserting "meaningfully more than
    // touching" rather than an exact px so a type-scale change does not make
    // this brittle — the defect being guarded is zero separation.
    const separation = second!.y - (first!.y + first!.height);
    expect(separation).toBeGreaterThan(8);
  });

  test("no gap means no separation", async ({ mount }) => {
    const component = await mount(<ListHarness />);
    const items = component.locator("li");
    const first = await items.nth(0).boundingBox();
    const second = await items.nth(1).boundingBox();

    const separation = second!.y - (first!.y + first!.height);
    expect(Math.abs(separation)).toBeLessThan(1);
  });

  test("rows do not carry a stray inline margin", async ({ mount }) => {
    // The old implementation wrote `marginBottom` into each child's inline
    // style, which silently overwrote any margin the caller had set there.
    const component = await mount(<ListHarness gap="2rem" />);
    const inline = await component
      .locator("li")
      .first()
      .evaluate((el) => (el as HTMLElement).style.marginBottom);
    expect(inline).toBe("");
  });

  test("draws a separator under every row but the last", async ({ mount }) => {
    const component = await mount(<ListHarness />);
    const items = component.locator("li");

    const firstBorder = await items
      .first()
      .evaluate((el) => getComputedStyle(el).borderBottomWidth);
    const lastBorder = await items
      .last()
      .evaluate((el) => getComputedStyle(el).borderBottomWidth);

    expect(firstBorder).not.toBe("0px");
    expect(lastBorder).toBe("0px");
  });

  test("the default variant paints a surface", async ({ mount }) => {
    // The defect this migration fixes: the old default asked the recipe for
    // `variant: "list"`, which the recipe does not define, so the list rendered
    // with no surface at all and looked merely unstyled.
    const component = await mount(<ListHarness />);
    const bg = await component.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(isTransparent(bg)).toBe(false);
  });

  test("a row rendered inside a fragment is styled like the others", async ({
    mount,
  }) => {
    // Under the old cloning approach the class landed on the fragment and was
    // discarded, so these rows rendered bare — visible only as a row with no
    // padding, which reads as a content problem rather than a component one.
    const component = await mount(<ListFragmentHarness />);

    const items = component.locator("li");
    const direct = await items
      .nth(0)
      .evaluate((el) => getComputedStyle(el).paddingLeft);
    const fragmented = await items
      .nth(1)
      .evaluate((el) => getComputedStyle(el).paddingLeft);

    expect(fragmented).toBe(direct);
    expect(fragmented).not.toBe("0px");
  });

  test("does not overflow a narrow viewport", async ({ mount, page }) => {
    const component = await mount(<ListOverflowHarness />);

    const box = await component.boundingBox();
    const viewport = page.viewportSize();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
  });

  test("a sparkline in a row keeps its width", async ({ mount }) => {
    // `flexShrink: 0` on the svg. The list root is a flex column, so a row is
    // a flex item — and a sparkline in a cramped row is exactly where a
    // shrinking svg collapses into a vertical line. jsdom cannot see it.
    const component = await mount(<ListWithSparkLineHarness />);

    const svg = await component.locator("svg").boundingBox();
    expect(svg).not.toBeNull();
    expect(svg!.width).toBeCloseTo(80, 0);
  });
});

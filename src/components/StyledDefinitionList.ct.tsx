import { test, expect } from "@playwright/experimental-ct-react";
import { isTransparent } from "./__tests__/fixtures/colour";
import { DefinitionListHarness } from "./StyledDefinitionList.harness";

/**
 * The row separators are the whole reason this file exists.
 *
 * `dlRecipe` drew them with `& > li:not(:last-child)` — and a `<dl>` contains
 * `<dt>` and `<dd>`, never `<li>`, so the selector matched nothing in the only
 * element the recipe is ever applied to. The rule was present and valid, and
 * had never once rendered.
 *
 * jsdom cannot see this. It reports the *declaration* a stylesheet contains,
 * not what the cascade resolved for an element, so a selector that matches
 * nothing and a selector that matches look identical there. Only a real engine
 * computing real styles can tell them apart — which is precisely how the defect
 * survived in the first place.
 */

test.describe("StyledDefinitionList", () => {
  test("draws a separator under every pair but the last", async ({ mount }) => {
    const component = await mount(<DefinitionListHarness />);
    const dds = component.locator("dd");

    const firstBorder = await dds
      .first()
      .evaluate((el) => getComputedStyle(el).borderBottomWidth);
    const lastBorder = await dds
      .last()
      .evaluate((el) => getComputedStyle(el).borderBottomWidth);

    // The assertion that fails against the pre-fix recipe: `0px` on both.
    expect(firstBorder).not.toBe("0px");
    expect(lastBorder).toBe("0px");
  });

  test("the separator has a real colour, not a dropped token", async ({
    mount,
  }) => {
    // A token the preset never defined passes through as a literal, which the
    // browser discards — the NEH-301 defect class. A transparent or absent
    // colour means the line is invisible even though the width is set.
    const component = await mount(<DefinitionListHarness />);
    const colour = await component
      .locator("dd")
      .first()
      .evaluate((el) => getComputedStyle(el).borderBottomColor);

    expect(isTransparent(colour)).toBe(false);
  });

  test("lays terms and definitions out in two columns", async ({ mount }) => {
    // `grid-template-columns: max-content 1fr`. In jsdom every box is 0×0, so
    // it would agree with any layout at all.
    const component = await mount(<DefinitionListHarness />);
    const term = await component.locator("dt").first().boundingBox();
    const def = await component.locator("dd").first().boundingBox();

    expect(term).not.toBeNull();
    expect(def).not.toBeNull();
    // Side by side, not stacked: the definition starts to the right of the
    // term and shares its row.
    expect(def!.x).toBeGreaterThan(term!.x + term!.width - 1);
    expect(Math.abs(def!.y - term!.y)).toBeLessThan(term!.height);
  });

  test("the surface paints", async ({ mount }) => {
    const component = await mount(<DefinitionListHarness />);
    const bg = await component.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // `solid` sets `bg: boxBgAccent`. An undefined token renders nothing —
    // which is exactly what NEH-301 found across nine declarations.
    expect(isTransparent(bg)).toBe(false);
  });
});

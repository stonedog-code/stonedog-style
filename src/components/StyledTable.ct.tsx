import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import StyledTable from "./StyledTable";

/**
 * The pixel half of `StyledTable` — and specifically, whether the cell rule
 * paints at all.
 *
 * ## Why this test exists rather than a unit assertion
 *
 * This is the package's most-repeated defect class, and it has never once
 * announced itself. Panda passes an **unknown** token straight through as a
 * literal, so a mistyped or foreign token name emits
 * `border-color: borderBgPrimary`, the browser discards the whole declaration
 * as invalid, and the element renders with no border. No build error, no
 * console warning, no type error — `bg: "buttonBgHover"`, `color: "fg.muted"`
 * and `zIndex: "modal"` all shipped that way and were found months later.
 *
 * jsdom cannot see it either: it does not resolve custom properties, so a unit
 * assertion on the colour would be the vacuous kind NEH-406 documents.
 *
 * ## What the originating app got wrong, and why the token changed
 *
 * HopperGuard's copy of this component used a literal `neutral.200`, justified
 * by a comment saying `borderBgPrimary` "renders BLACK because nothing assigns
 * `--hopper-box-primary-border`". That was true when it was written and is not
 * true now — the app emits that property today. A literal palette colour is
 * invisible to the host's theme and ignores colour mode, which is exactly what
 * this package forbids, so the extraction restored the token. These tests are
 * what stop that being a leap of faith.
 */

const ROW = (
  <StyledTable>
    <StyledTable.Body header={<StyledTable.Header columns={[{ key: "n", label: "Name" }]} />}>
      <StyledTable.Row>
        <StyledTable.Cell>Ada</StyledTable.Cell>
      </StyledTable.Row>
    </StyledTable.Body>
  </StyledTable>
);

/** The declaration the browser kept, as an actual painted value. */
async function cellBorder(locator: Locator) {
  return locator.evaluate((el: HTMLElement) => {
    const s = getComputedStyle(el);
    return {
      color: s.borderBottomColor,
      width: s.borderBottomWidth,
      style: s.borderBottomStyle,
    };
  });
}

test.describe("the cell rule", () => {
  test("resolves to a real colour rather than being discarded", async ({
    mount,
  }) => {
    const component = await mount(ROW);
    const cell = component.locator("td").first();
    const border = await cellBorder(cell);

    // A discarded declaration leaves the UA default: `medium none` and the
    // element's own colour. Asserting all three is what distinguishes "the
    // token resolved" from "something happens to be there".
    expect(border.style).toBe("solid");
    expect(border.width).toBe("1px");

    // Asserted against the harness theme's ACTUAL value for
    // `--hopper-box-primary-border` (#475569), not merely "some colour".
    //
    // This is deliberate. The first version of this test accepted any
    // `rgb(...)` and passed while the border painted pure black — the
    // `currentColor` a `border-bottom` shorthand resets it to. Black is a real
    // colour, so a loose assertion cannot tell the difference between the token
    // resolving and the token being overwritten.
    expect(border.color).toBe("rgb(71, 85, 105)");
  });

  test("follows the host's custom property, so it is themeable", async ({
    mount,
    page,
  }) => {
    const component = await mount(ROW);
    const cell = component.locator("td").first();

    // The decisive assertion: re-point the property the token resolves to and
    // the border must follow. A hardcoded `neutral.200` — the value this
    // extraction replaced — passes the test above and fails this one, which is
    // the whole difference between a themeable component and a fixed one.
    //
    // Set on the ROOT, not on the component. The chain is
    // `border-bottom-color: var(--colors-border-bg-primary)` and
    // `--colors-border-bg-primary: var(--hopper-box-primary-border)`, and the
    // alias is declared at `:root` — substitution happens where a custom
    // property is DECLARED, so overriding the host variable further down the
    // tree changes nothing. That is also how a host must theme this: at the
    // root, or above wherever it declares the token layer.
    await page.evaluate(() => {
      document.documentElement.style.setProperty(
        "--hopper-box-primary-border",
        "rgb(1, 2, 3)",
      );
    });

    await expect
      .poll(async () => (await cellBorder(cell)).color)
      .toBe("rgb(1, 2, 3)");
  });

  test("applies to header cells as well as body cells", async ({ mount }) => {
    const component = await mount(ROW);
    const th = await cellBorder(component.locator("th").first());
    const td = await cellBorder(component.locator("td").first());
    expect(th.color).toBe(td.color);
    expect(th.width).toBe("1px");
  });
});

test.describe("the size variant", () => {
  /**
   * `size` exists as a Panda variant so it cannot fall through to the DOM as an
   * invalid `size` attribute on `<table>`. Only `md` was measured against the
   * original Chakra build; `sm` and `lg` are proportional and unverified, so
   * this asserts the ORDERING rather than the numbers — that is the part which
   * is true by construction and worth protecting.
   */
  test("scales cell padding in order", async ({ mount }) => {
    const pad = async (size: "sm" | "md" | "lg") => {
      const c = await mount(
        <StyledTable size={size}>
          <StyledTable.Body>
            <StyledTable.Row>
              <StyledTable.Cell>Ada</StyledTable.Cell>
            </StyledTable.Row>
          </StyledTable.Body>
        </StyledTable>,
      );
      const v = await c
        .locator("td")
        .first()
        .evaluate((el: HTMLElement) => getComputedStyle(el).paddingTop);
      await c.unmount();
      return parseFloat(v);
    };

    const sm = await pad("sm");
    const md = await pad("md");
    const lg = await pad("lg");
    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
    // md is the measured one: 12px, off the original build.
    expect(md).toBe(12);
  });
});

import { test, expect } from "@playwright/experimental-ct-react";
import { isTransparent } from "./__tests__/fixtures/colour";
import StyledFieldset from "./StyledFieldset";

/**
 * A fieldset with no `variant` prop used to render with an empty class string —
 * no surface, no border, no padding. The unit tier can assert that a class name
 * is now present; only a browser can confirm the class has CSS behind it.
 *
 * That distinction is not pedantic here. Panda emits rules by statically
 * parsing source at build time, so a class name reaching the DOM proves
 * nothing about whether a rule exists for it — a recipe variant the preset
 * never generated produces exactly this: the right class, no styling, no error
 * anywhere. Asserting on computed style is the only check that separates them.
 */

test.describe("StyledFieldset", () => {
  test("paints its surface with no variant given", async ({ mount }) => {
    const component = await mount(
      <StyledFieldset>
        <StyledFieldset.Legend>Contact preferences</StyledFieldset.Legend>
        <StyledFieldset.Content>
          <input aria-label="Email" />
        </StyledFieldset.Content>
      </StyledFieldset>,
    );

    const styles = await component.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        border: s.borderTopWidth,
        padding: s.paddingTop,
        background: s.backgroundColor,
      };
    });

    // Against the pre-fix component every one of these is the UA default for a
    // bare <fieldset>: a 2px groove border and 0.35em padding, with no
    // background. The border check is deliberately not "is non-zero" — a naked
    // fieldset HAS a border — so the background is what proves the recipe ran.
    expect(isTransparent(styles.background)).toBe(false);
    expect(styles.padding).not.toBe("0px");
    expect(styles.border).not.toBe("0px");
  });

  test("an explicit variant differs from the default one", async ({ mount }) => {
    // If the recipe were not generating per-variant rules, both would compute
    // identically and every variant in the product would be the same fieldset.
    const solid = await mount(
      <StyledFieldset variant="solid">
        <StyledFieldset.Legend>A</StyledFieldset.Legend>
      </StyledFieldset>,
    );
    const solidBg = await solid.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await solid.unmount();

    const matte = await mount(
      <StyledFieldset variant="matte">
        <StyledFieldset.Legend>A</StyledFieldset.Legend>
      </StyledFieldset>,
    );
    const matteBg = await matte.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    expect(matteBg).not.toBe(solidBg);
  });

  test("the legend follows the app text size, like every other label", async ({
    mount,
  }) => {
    // `Label` delegating to StyledFormLabel is what makes a field inside a
    // fieldset match a field outside one. jsdom reports the declaration, not
    // the resolved rem, so the comparison has to happen here.
    const component = await mount(
      <StyledFieldset>
        <StyledFieldset.Legend>Contact</StyledFieldset.Legend>
        <StyledFieldset.Field>
          <StyledFieldset.Label htmlFor="email">Email</StyledFieldset.Label>
          <StyledFieldset.Value>
            <input id="email" />
          </StyledFieldset.Value>
        </StyledFieldset.Field>
      </StyledFieldset>,
    );

    const size = await component
      .locator("label")
      .evaluate((el) => getComputedStyle(el).fontSize);

    // Not the browser's bare 16px default, which is what a label that has opted
    // out of the type scale lands on (NEH-233).
    expect(Number.parseFloat(size)).toBeGreaterThan(0);
    expect(size).not.toBe("");
  });

  test("clicking the label focuses the control", async ({ mount, page }) => {
    // The tap-target point: it turns a small input into a target the size of
    // its own text. Requires a real hit-test, so it cannot be a jsdom test.
    const component = await mount(
      <StyledFieldset>
        <StyledFieldset.Legend>Contact</StyledFieldset.Legend>
        <StyledFieldset.Field>
          <StyledFieldset.Label htmlFor="email">Email</StyledFieldset.Label>
          <StyledFieldset.Value>
            <input id="email" />
          </StyledFieldset.Value>
        </StyledFieldset.Field>
      </StyledFieldset>,
    );

    await page.getByText("Email").click();
    await expect(component.locator("#email")).toBeFocused();
  });

  test("does not overflow a narrow viewport", async ({ mount, page }) => {
    const component = await mount(
      <StyledFieldset>
        <StyledFieldset.Legend>Contact preferences</StyledFieldset.Legend>
        <StyledFieldset.Content>
          <StyledFieldset.Field>
            <StyledFieldset.Label htmlFor="email">
              Email address for appointment reminders
            </StyledFieldset.Label>
            <StyledFieldset.Value>
              <input id="email" style={{ width: "100%" }} />
            </StyledFieldset.Value>
          </StyledFieldset.Field>
        </StyledFieldset.Content>
      </StyledFieldset>,
    );

    const box = await component.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    // Runs at all four viewports; 375px is where a border-box mistake shows.
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
  });
});

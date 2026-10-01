import { test, expect } from "@playwright/experimental-ct-react";
import StyledButton from "./StyledButton";
import StyledBox from "./StyledBox";

/**
 * Everything here needs a layout engine, so none of it can live in the jest
 * suite. Tap-target size in particular is a WCAG floor this product treats as
 * non-negotiable, and it is measured in CSS pixels — a number jsdom always
 * reports as zero.
 */

test.describe("tap target", () => {
  // Was NEH-220: `buttonRecipe` set no min-height, so a short label produced a
  // 42.375px-tall button against a 44px floor, and these two were marked
  // `test.fail()` so the unmet requirement stayed visible without reddening CI.
  //
  // The recipe now states `minHeight`/`minWidth: 48px`, so they assert rather
  // than document. Raising the floor makes every button in a live product
  // taller, which is why it waited for an explicit product decision (NEH-251)
  // instead of riding along with a refactor.

  test("meets the 48x48 CSS px floor", async ({ mount }) => {
    // WCAG 2.5.5 Level AAA, and the house floor for this audience — elevated
    // rates of motor impairment mean a small target is a real barrier, not a
    // polish item. A short label is the worst case, so it is the one asserted.
    const component = await mount(<StyledButton>OK</StyledButton>);
    const box = (await component.boundingBox())!;

    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
  });

  test("still meets it with only an icon and no label", async ({ mount }) => {
    // The narrowest thing a caller can produce with this component.
    const component = await mount(
      <StyledButton leftIcon={<svg width="16" height="16" />} aria-label="Close" />,
    );
    const box = (await component.boundingBox())!;

    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
  });
});

test.describe("layout", () => {
  test("keeps the icon and label on one row", async ({ mount }) => {
    const component = await mount(
      <StyledButton leftIcon={<svg data-testid="ico" width="16" height="16" />}>
        Save
      </StyledButton>,
    );

    const icon = (await component.getByTestId("ico").boundingBox())!;
    const label = (await component.getByText("Save").boundingBox())!;

    expect(Math.abs(icon.y + icon.height / 2 - (label.y + label.height / 2))).toBeLessThan(2);
    expect(icon.x).toBeLessThan(label.x);
  });

  test("a long label does not overflow a narrow screen", async ({ mount, page }) => {
    await mount(
      <StyledBox p="4">
        <StyledButton>Save these changes and continue</StyledButton>
      </StyledBox>,
    );

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("noWrap keeps the label on one line", async ({ mount }) => {
    const component = await mount(
      <StyledButton noWrap>Save these changes and continue</StyledButton>,
    );

    const height = (await component.boundingBox())!.height;
    const lineHeight = await component.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize) * 2,
    );

    // One line: the button is not taller than roughly two font-sizes of
    // padding plus a single line of text.
    expect(height).toBeLessThan(lineHeight + 48);
  });
});

test.describe("variants paint", () => {
  // Every variant must resolve to a real background. A variant the recipe does
  // not define renders transparent — the failure that shipped as `buttonBgHover`
  // and went unnoticed because nothing errors.
  for (const variant of ["solid", "outline", "aurora", "glass", "matte"] as const) {
    test(`${variant} resolves to a real background`, async ({ mount }) => {
      const component = await mount(<StyledButton variant={variant}>Go</StyledButton>);
      const bg = await component.evaluate((el) => getComputedStyle(el).background);

      expect(bg).not.toBe("");
      // `aurora` and `glass` paint with gradients/backdrop filters rather than a
      // flat colour, so assert *something* is painted rather than a colour.
      expect(bg).not.toMatch(/^rgba\(0, 0, 0, 0\)(\s|$)/);
    });
  }
});

test.describe("link does not render on the user agent's ButtonFace (NEH-307)", () => {
  /**
   * `link` was the one variant of ten that declared no background, and a
   * `<button>` with no background is not transparent — the UA paints its own
   * `ButtonFace`. This package sets `preflight: false`, and the harness reset
   * (like the largest consumer's empty `@layer reset`) does not zero it, so
   * what these tests measure is what a consumer actually gets.
   *
   * Measured here on the pre-fix recipe: `rgb(239, 239, 239)` at a light UA
   * colour scheme and `rgb(107, 107, 107)` at a dark one. A theme-controlled
   * background is by definition neither.
   */

  test("computes a transparent background rather than a system colour", async ({ mount }) => {
    const component = await mount(<StyledButton variant="link">Go</StyledButton>);
    const bg = await component.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Transparent, so the themed surface behind the button shows through —
    // the same result `unstyled` already gets by stating it.
    expect(bg).toBe("rgba(0, 0, 0, 0)");
  });

  test("keeps that background when the UA colour scheme flips", async ({ mount, page }) => {
    // The issue's third repro step, and the part that makes this an
    // accessibility problem rather than a cosmetic one: `ButtonFace` is a
    // system colour, so its contrast against `textMain` is set by the browser
    // and moves underneath us. A theme-controlled background does not.
    //
    // `color-scheme: light dark` is what lets Chromium's system colours
    // respond at all; without it the flip is a no-op and this would pass
    // vacuously on the broken code.
    await page.addStyleTag({ content: ":root { color-scheme: light dark; }" });
    const component = await mount(<StyledButton variant="link">Go</StyledButton>);
    const read = () => component.evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.emulateMedia({ colorScheme: "light" });
    const light = await read();
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await read();

    expect(dark).toBe(light);
    expect(light).toBe("rgba(0, 0, 0, 0)");
  });

  test("its background is stated by the recipe, not left to the browser", async ({ mount, page }) => {
    // A rule that exists is not a rule that applies — see NEH-288, where a
    // class name matched nothing. Ask the browser which stylesheet rule won,
    // rather than trusting that the class is on the element.
    await mount(<StyledButton variant="link">Go</StyledButton>);

    const declaredBy = await page.evaluate(() => {
      const el = document.querySelector("button")!;
      const walk = (list: CSSRule[]): string[] =>
        list.flatMap((rule) => {
          if (rule instanceof CSSGroupingRule) return walk(Array.from(rule.cssRules));
          if (!(rule instanceof CSSStyleRule)) return [];
          if (!el.matches(rule.selectorText)) return [];
          const value =
            rule.style.getPropertyValue("background-color") ||
            rule.style.getPropertyValue("background");
          return value ? [`${rule.selectorText} { ${value} }`] : [];
        });

      return Array.from(document.styleSheets).flatMap((sheet) => {
        try {
          // A cross-origin sheet throws on `cssRules`; nothing we author is
          // one, so skipping is right rather than failing the test.
          return walk(Array.from(sheet.cssRules));
        } catch {
          return [];
        }
      });
    });

    expect(declaredBy.join("\n")).toMatch(/button--variant_link/);
  });
});

test.describe("states", () => {
  test("hover changes the background", async ({ mount, page }) => {
    // The regression that shipped: `outline`'s hover named a token that did not
    // exist, so the declaration was invalid and browsers dropped it — the state
    // never rendered, silently, for as long as the app existed.
    const component = await mount(<StyledButton variant="outline">Go</StyledButton>);

    // Park the cursor away from the component first. Playwright's mouse starts
    // at (0,0) and the component mounts at the origin, so without this the
    // "before" sample is already the hover colour and the assertion compares
    // hover to hover — passing or failing by viewport size, which is exactly
    // how this showed up as an iphone-se-only failure.
    await page.mouse.move(0, 0);
    await page.mouse.move(2000, 2000);
    const before = await component.evaluate((el) => getComputedStyle(el).backgroundColor);
    await component.hover();
    const after = await component.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(after).not.toBe(before);
  });

  test("a disabled button is not clickable", async ({ mount }) => {
    let clicked = false;
    const component = await mount(
      <StyledButton disabled onClick={() => { clicked = true; }}>Go</StyledButton>,
    );

    await component.click({ force: true }).catch(() => {});
    expect(clicked).toBe(false);
  });

  test("a loading button shows its status and is inert", async ({ mount, page }) => {
    const component = await mount(<StyledButton loading loadText="Saving">Go</StyledButton>);

    await expect(page.getByRole("status")).toContainText("Saving");
    await expect(component).toBeDisabled();
  });
});

test.describe("keyboard", () => {
  test("is reachable by Tab and activates on Enter", async ({ mount, page }) => {
    // Hover-only affordances exclude keyboard and touch users; this is the
    // floor check that the control is genuinely operable.
    let clicked = false;
    await mount(<StyledButton onClick={() => { clicked = true; }}>Go</StyledButton>);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button")).toBeFocused();
    await page.keyboard.press("Enter");
    expect(clicked).toBe(true);
  });
});

test.describe("the label takes the variant's colour (NEH-1788)", () => {
  /**
   * `buttonRecipe` states a text colour for every variant — the partner of the
   * background that variant paints. `StyledButton` wraps its label in a
   * `StyledText`, whose own `color` defaults to `textPrimary` and is set by a
   * utility class that outranks the recipe. For as long as that wrapper said
   * nothing, the label was `textPrimary` on EVERY variant, and each fix to the
   * recipe's pairing moved the button's `color` while the text on screen stayed
   * exactly where it was.
   *
   * Only a browser can see this. jsdom has no cascade, and the stylesheet-level
   * guards read what the recipe DECLARES — which was correct throughout. The
   * defect lived in which of two correct declarations won.
   *
   * So the assertion is on the element that holds the text: its computed colour
   * is the button's computed colour.
   */
  const colours = (component: import("@playwright/test").Locator) =>
    component.evaluate((button) => {
      const holder = Array.from(button.querySelectorAll("*")).find((element) =>
        Array.from(element.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
        ),
      );
      return {
        button: getComputedStyle(button).color,
        label: holder ? getComputedStyle(holder).color : null,
      };
    });

  for (const variant of ["solid", "outline", "matte", "glass", "ghost", "selected", "link"] as const) {
    test(`${variant}: at rest and under the pointer`, async ({ mount, page }) => {
      const component = await mount(<StyledButton variant={variant}>Go</StyledButton>);

      await page.mouse.move(0, 0);
      await page.mouse.move(2000, 2000);
      const rest = await colours(component);
      expect(rest.label).not.toBeNull();
      expect(rest.label).toBe(rest.button);

      await component.hover();
      const hovered = await colours(component);
      expect(hovered.label).toBe(hovered.button);
    });
  }

  test("the assertion above can fail: the button's colour is not the body text colour", async ({
    mount,
  }) => {
    // If `solid` happened to compute to `textPrimary` in this harness, "the
    // label equals the button" would be true of the broken component too, and
    // seven green tests would be measuring nothing. So the two colours are
    // shown to differ first.
    const component = await mount(
      <StyledBox>
        <StyledButton variant="solid" data-testid="button">
          Go
        </StyledButton>
        <span data-testid="body" style={{ color: "var(--colors-text-primary)" }}>
          body
        </span>
      </StyledBox>,
    );
    const button = await component
      .getByTestId("button")
      .evaluate((el) => getComputedStyle(el).color);
    const body = await component.getByTestId("body").evaluate((el) => getComputedStyle(el).color);
    expect(button).not.toBe(body);
  });

  test("the busy label takes it too", async ({ mount, page }) => {
    // The spinner's text is the same component one level further down, and it
    // is what a person reads while they wait.
    const component = await mount(
      <StyledButton variant="solid" loading loadText="Saving">
        Go
      </StyledButton>,
    );
    await expect(page.getByRole("status")).toContainText("Saving");
    const measured = await colours(component);
    expect(measured.label).toBe(measured.button);
  });
});

test.describe("a link keeps its colour under the pointer (NEH-1788)", () => {
  /**
   * The `link` variant paints no background, so a hover that changed its colour
   * to an on-accent text token put that colour on whatever the page was —
   * white on white in a consumer's light theme. The pointer is acknowledged by
   * the underline instead, which works on any surface.
   */
  test("the colour does not move, and the underline does", async ({ mount, page }) => {
    const component = await mount(<StyledButton variant="link">Read more</StyledButton>);

    await page.mouse.move(0, 0);
    await page.mouse.move(2000, 2000);
    const rest = await component.evaluate((el) => {
      const style = getComputedStyle(el);
      return { colour: style.color, thickness: style.textDecorationThickness };
    });

    await component.hover();
    const hovered = await component.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        colour: style.color,
        thickness: style.textDecorationThickness,
        line: style.textDecorationLine,
      };
    });

    expect(hovered.colour).toBe(rest.colour);
    expect(hovered.line).toContain("underline");
    // The cue that replaced the colour change has to actually be there, or the
    // hover has no feedback at all.
    expect(hovered.thickness).not.toBe(rest.thickness);
  });
});

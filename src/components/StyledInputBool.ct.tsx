import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import StyledInputBool from "./StyledInputBool";

/**
 * The tap-target question, which is the whole reason this component wraps its
 * label rather than sitting beside it — and which jsdom reports as 0×0.
 */

test.describe("StyledInputBool", () => {
  test("the label is part of the clickable target", async ({ mount, page }) => {
    // A bare checkbox is ~14×14 CSS px, far under the 48×48 floor (WCAG 2.5.5 AAA is 44; the house floor is 48).
    // Clicking the *text* must toggle it — that is what makes the control
    // usable for someone with a tremor.
    const component = await mount(<StyledInputBool label="Send me email" />);
    await page.getByText("Send me email").click();
    await expect(component.locator("input")).toBeChecked();
  });

  test("the target spans the label, not just the box", async ({ mount }) => {
    const component = await mount(<StyledInputBool label="Send me email" />);
    // `component` IS the label: StyledHStack renders `as="label"`, and a
    // locator searches DESCENDANTS, so `.locator("label")` finds nothing here.
    const target = await component.boundingBox();
    const box = await component.locator("input").boundingBox();
    expect(target).not.toBeNull();
    expect(box).not.toBeNull();
    // Materially wider than the checkbox alone — the assertion that would fail
    // if someone unwrapped the label into a sibling.
    expect(target!.width).toBeGreaterThan(box!.width * 2);
  });

  test("is reachable and operable by keyboard", async ({ mount, page }) => {
    const component = await mount(<StyledInputBool label="Send me email" />);
    await page.keyboard.press("Tab");
    await expect(component.locator("input")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(component.locator("input")).toBeChecked();
  });

  test("carries a visible focus indicator", async ({ mount, page }) => {
    // Keyboard reachability is worth nothing if the user cannot see where they
    // are.
    const component = await mount(<StyledInputBool label="Send me email" />);
    await page.keyboard.press("Tab");
    const outline = await component
      .locator("input")
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("a long label wraps rather than overflowing the viewport", async ({
    mount,
    page,
  }) => {
    const component = await mount(
      <StyledInputBool label="Send me a reminder before every scheduled appointment" />,
    );
    const box = await component.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
  });

  /**
   * These assert only on properties a native checkbox actually PAINTS, and
   * that distinction is the whole lesson of NEH-234.
   *
   * The control is `<input type="checkbox">` at `appearance: auto`, so the
   * widget is drawn by the UA. Chromium *computes* `background-color` and
   * `border-*` on it and then paints neither — verified in this harness by
   * screenshotting a raw input with a red border and a slate background and
   * getting back the default white box. So the obvious assertion is worse than
   * no assertion: the previous version of this test read `backgroundColor` off
   * solid and ghost, saw two different values, and passed, while both
   * checkboxes were drawn identically on screen. A green test measuring
   * something invisible is how this defect survived long enough to be filed,
   * attempted, and filed again.
   *
   * What the same probe showed the widget DOES honour, and what these therefore
   * assert on: `box-shadow`, `accent-color`, and `outline`.
   */
  const painted = (component: Locator, testId: string) =>
    component.getByTestId(testId).evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.boxShadow} | ${s.accentColor}`;
    });

  test("the variant reaches the control", async ({ mount }) => {
    // Both in ONE mount: a second `mount()` in the same test fails with
    // "container that already has a React root". Side by side is better anyway,
    // since it compares them under identical layout.
    const component = await mount(
      <>
        <StyledInputBool label="solid" variant="solid" data-testid="solid" />
        <StyledInputBool label="outline" variant="outline" data-testid="outline" />
      </>,
    );
    expect(await painted(component, "solid")).not.toBe(
      await painted(component, "outline"),
    );
  });

  test("solid and outline are visually distinct", async ({ mount }) => {
    // NEH-234: these two of the five app-wide appearances were declared
    // identically, so a user switching the whole app from solid to outline
    // watched every other control change and every checkbox stay put.
    //
    // `outline` earns its name through a ring the UA does paint, since the
    // `border` that would express it on any other recipe is discarded here.
    const component = await mount(
      <>
        <StyledInputBool label="solid" variant="solid" data-testid="solid" />
        <StyledInputBool label="outline" variant="outline" data-testid="outline" />
      </>,
    );
    const ring = (testId: string) =>
      component.getByTestId(testId).evaluate((el) => getComputedStyle(el).boxShadow);

    expect(await ring("solid")).toBe("none");
    expect(await ring("outline")).not.toBe("none");
    // Themed, not a literal — the ring has to follow the host like everything
    // else. This is the harness theme's `--hopper-box-primary-border`.
    expect(await ring("outline")).toContain("rgb(71, 85, 105)");
  });

  /**
   * NEH-310 — the generalisation of the test above, and the one that would
   * have caught this defect the first time.
   *
   * NEH-234 fixed `solid` vs `outline` and asserted exactly that pair. The
   * other six went on differing only in `background`, `background-image`,
   * `color` and a pseudo-element — every one discarded by a native checkbox —
   * so six of the eight appearances rendered identically and a pairwise test
   * could not see it.
   *
   * This asserts the property that actually matters: **no two variants paint
   * the same.** It fails on the pre-fix recipe with six collisions, and it
   * cannot be satisfied by adding another invisible declaration.
   */
  /**
   * Written out rather than imported from `INPUT_BOOL_VARIANTS`, which is what
   * you would reach for first.
   *
   * Playwright CT rewrites imports from a component module into mount
   * references, so pulling a plain constant out of `StyledInputBool.tsx`
   * alongside the default import fails at build with
   * `Identifier 'StyledInputBool' has already been declared`.
   *
   * The drift that copy invites is closed on the jest side instead:
   * `StyledInputBool.test.tsx` asserts this list equals `INPUT_BOOL_VARIANTS`,
   * so adding a variant without extending this one fails there.
   *
   * Seven, not eight: the recipe also defines `button`, which the component
   * deliberately omits — see the comment on that constant.
   */
  const VARIANTS = [
    "solid",
    "outline",
    "aurora",
    "glass",
    "matte",
    "ghost",
    "none",
  ] as const;

  /**
   * `solid` and `none` are expected to be EQUAL, and that is the honest answer
   * rather than a gap.
   *
   * Every lever this control has is additive — a ring, a halo, a checked
   * colour. `none` means "do not style this", so its only honest rendering is
   * the bare widget, which is exactly what `solid` is. Giving `none` a ring to
   * make a distinctness test pass would leave the variant named `none` as the
   * only one wearing decoration.
   *
   * Asserted as an equality below rather than skipped, so that if the
   * `appearance: none` redesign (option 2 on NEH-310) ever makes them
   * separable, this fails and asks for the pair to be re-judged.
   */
  const CONVERGENT: ReadonlyArray<readonly [string, string]> = [
    ["solid", "none"],
  ];

  test("no two variants render identically, except the documented pair", async ({
    mount,
  }) => {
    const component = await mount(
      <>
        {VARIANTS.map((v) => (
          <StyledInputBool key={v} label={v} variant={v} data-testid={v} />
        ))}
      </>,
    );

    // Only properties the widget was verified to PAINT. `background-color` and
    // `border-*` are excluded on purpose: Chromium computes them and paints
    // neither, so including them would make this pass against the very defect
    // it exists to catch — which is how the original survived for months.
    //
    // `border-radius` is excluded for a stronger reason than that: on this
    // control it does not even compute (NEH-310). It reports `0px` for every
    // variant whatever the stylesheet says, so including it would add a column
    // that is constant by construction — noise that looks like coverage.
    const signature = (testId: string) =>
      component.getByTestId(testId).evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.boxShadow} | ${s.accentColor}`;
      });

    const expectedEqual = (a: string, b: string) =>
      CONVERGENT.some(
        ([x, y]) => (x === a && y === b) || (x === b && y === a),
      );

    const seen = new Map<string, string>();
    for (const variant of VARIANTS) {
      const sig = await signature(variant);
      const collision = seen.get(sig);
      if (collision !== undefined && expectedEqual(collision, variant)) continue;
      expect(
        collision,
        `"${variant}" paints identically to "${collision}" — both are ${sig}`,
      ).toBeUndefined();
      seen.set(sig, variant);
    }

    // Six distinct renderings across seven variants, the one repeat being the
    // documented `solid` / `none` convergence.
    expect(seen.size).toBe(VARIANTS.length - CONVERGENT.length);
  });

  test("the convergent pair really is convergent", async ({ mount }) => {
    // The other direction. Without this, `CONVERGENT` is an unchecked excuse
    // list: a future variant that accidentally collided with `solid` could be
    // added to it and the suite would stay green. This asserts the pair is
    // equal, so the entry has to be earned.
    const component = await mount(
      <>
        <StyledInputBool label="solid" variant="solid" data-testid="solid" />
        <StyledInputBool label="none" variant="none" data-testid="none" />
      </>,
    );

    const paint = (testId: string) =>
      component.getByTestId(testId).evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.boxShadow} | ${s.accentColor}`;
      });

    expect(await paint("solid")).toBe(await paint("none"));
  });

  test("every variant keeps the checked state legible", async ({ mount }) => {
    // The constraint that shapes the whole fix. Distinguishing an appearance
    // must not cost state legibility — `outline` learned this when a recessive
    // `accentColor` made a ticked box dark-on-dark, which is the one state the
    // control exists to communicate. So appearance is carried by the ring, and
    // every variant keeps the same checked colour.
    const component = await mount(
      <>
        {VARIANTS.map((v) => (
          <StyledInputBool
            key={v}
            label={v}
            variant={v}
            defaultChecked
            data-testid={v}
          />
        ))}
      </>,
    );

    const accents = new Set<string>();
    for (const variant of VARIANTS) {
      const accent = await component
        .getByTestId(variant)
        .evaluate((el) => getComputedStyle(el).accentColor);
      expect(accent, `"${variant}" accent-color`).not.toBe("auto");
      accents.add(accent);
    }

    // One colour across all eight. If this ever legitimately grows, the ring
    // rule above has to be revisited rather than this loosened.
    expect(accents.size).toBe(1);
  });

  test("the checked state is themed rather than the browser's default blue", async ({
    mount,
  }) => {
    // `accent-color` is one of the few properties the native widget honours,
    // and it is what carries the host's theme into the tick. Without it a
    // checked box is Chromium's blue in every theme this package can wear.
    const component = await mount(
      <StyledInputBool label="on" defaultChecked data-testid="on" />,
    );
    const accent = await component
      .getByTestId("on")
      .evaluate((el) => getComputedStyle(el).accentColor);
    expect(accent).not.toBe("auto");
  });

  test("the focus ring follows the theme", async ({ mount, page }) => {
    // It was a hardcoded `#3182ce` — Panda's blue, fixed in every theme
    // including dark and high-contrast, where it is the one thing a keyboard
    // user cannot afford to lose (NEH-234).
    const component = await mount(<StyledInputBool label="on" data-testid="on" />);
    await page.keyboard.press("Tab");
    const ring = await component
      .getByTestId("on")
      .evaluate((el) => getComputedStyle(el).outlineColor);
    // The harness theme's `--hopper-text-pop-text`.
    expect(ring).toBe("rgb(56, 189, 248)");
  });
});

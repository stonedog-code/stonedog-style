import { test, expect } from "@playwright/experimental-ct-react";
import StyledIcon from "./StyledIcon";
import StyledButton from "./StyledButton";
import { FaLikeGlyph } from "./StyledIcon.harness";

/**
 * Where the glyph actually lands inside its box (NEH-562).
 *
 * `StyledIcon` sizes its wrapper in **pixels** and lets the icon set size the
 * glyph from **font-size**. Those are two independent numbers, and the wrapper
 * was `display: inline-block`, so the glyph sat on a text baseline rather than
 * in the middle of the box it was given. Font Awesome's own stylesheet then
 * adds `vertical-align: -0.125em`, pushing it a further ~2px down.
 *
 * The visible result was a product-wide 1–2px sag on every button icon, and an
 * outright bottom-aligned plus wherever the glyph's em size exceeded its box —
 * `StyledPlus` defaults to `1x` (a 20px box) while the base recipe sets the
 * font size to `--font-sizes-2xl` (24px by fallback), so it overhung by 4px and
 * hung out of the bottom.
 *
 * None of this is visible to jest: jsdom reports every box as zero-sized, so
 * two elements always agree about where their centres are. `StyledButton.ct.tsx`
 * already asserted icon/label centring and passed throughout, because it hands
 * the button a bare `<svg width="16" height="16">` — a plain replaced element
 * with no baseline offset and no font-size dependence, which is the one shape
 * that could not reproduce the bug. The stand-in below is FA-shaped on purpose.
 */

/** Vertical centre of a bounding box, in page coordinates. */
const midY = (box: { y: number; height: number }) => box.y + box.height / 2;

test.describe("glyph centring", () => {
  // `1x` is not one of the four sizes the recipe defines, so it takes the base
  // font size (24px) inside a 20px box — the worst case, and the one users
  // reported as "bottom-aligned outright".
  test("centres a glyph larger than its own box", async ({ mount }) => {
    const component = await mount(<StyledIcon icon={<FaLikeGlyph />} size="1x" />);

    const box = (await component.boundingBox())!;
    const glyph = (await component.getByTestId("glyph").boundingBox())!;

    expect(Math.abs(midY(glyph) - midY(box))).toBeLessThanOrEqual(1);
  });

  test("centres a glyph smaller than its own box", async ({ mount }) => {
    // `sm` sets the font size to 1em — 16px by inheritance — in a 16px box.
    const component = await mount(<StyledIcon icon={<FaLikeGlyph />} size="sm" />);

    const box = (await component.boundingBox())!;
    const glyph = (await component.getByTestId("glyph").boundingBox())!;

    expect(Math.abs(midY(glyph) - midY(box))).toBeLessThanOrEqual(1);
  });
});

/**
 * The product-facing assertion. NEH-435 established that this product's text
 * scale varies, so a single font size proves nothing — an offset expressed in
 * `em` disappears at one size and is obvious at another.
 */
test.describe("icon and label agree in a button", () => {
  for (const fontSize of ["14px", "24px"]) {
    test(`centres agree at ${fontSize}`, async ({ mount }) => {
      const component = await mount(
        <div style={{ fontSize }}>
          <StyledButton leftIcon={<StyledIcon icon={<FaLikeGlyph />} size="1x" />}>
            Start a collection
          </StyledButton>
        </div>,
      );

      const glyph = (await component.getByTestId("glyph").boundingBox())!;
      const label = (await component.getByText("Start a collection").boundingBox())!;

      expect(Math.abs(midY(glyph) - midY(label))).toBeLessThanOrEqual(1);
    });
  }
});

import { test, expect } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import StyledImageUpload from "./StyledImageUpload";

/**
 * The pixel half of `StyledImageUpload` (NEH-1117).
 *
 * jsdom reports every box as zero-sized, so the unit tier agrees just as
 * readily with a 16px tap target as with a 48px one — and the unit suite says
 * so in as many words, deferring size and colour to this file. There was no
 * such file until this issue; the control had been 16x16 since the extraction
 * with nothing able to see it.
 *
 * The remove control is the case that matters, and for the same reason
 * `StyledTag.ct.tsx` exists: a small glyph floating on the corner of a small
 * tile is exactly where a hit area silently ends up "whatever the padding
 * happens to produce".
 *
 * Measured on `origin/main` before changing anything, at every viewport:
 * **16 x 16**, against a stated floor of 48.
 */

/** A real 1x1 PNG, so the preview's object URL resolves to an actual image. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function upload(page: Page, ...names: string[]) {
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      names.map((name) => ({ name, mimeType: "image/png", buffer: PNG })),
    );
  // The previews replace the dropzone, so this is the settle signal.
  await expect(page.getByRole("button", { name: `Remove ${names[0]}` })).toBeVisible();
}

test.describe("the remove control's tap target", () => {
  test("meets the 48x48 CSS px floor", async ({ mount, page }) => {
    // 48, not WCAG 2.5.5 AAA's 44 — the house minimum is deliberately above
    // the standard, because it is calibrated for the general population and
    // this library's largest consumer serves an often-elderly, sometimes
    // motor-impaired audience.
    await mount(<StyledImageUpload maxFiles={2} />);
    await upload(page, "cat.png");

    const box = (await page
      .getByRole("button", { name: "Remove cat.png" })
      .boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
  });

  test("does not drag the preview tile's layout with it", async ({ mount, page }) => {
    // The other half, and the tension `StyledTag` solves with negative block
    // margin: a floor that grew the tile would make a row of 96px previews
    // into something else, and the obvious remedy — shrinking the control —
    // is the one that reintroduces the sub-48 target.
    //
    // 96px preview + the item's own 8px padding on each side.
    await mount(<StyledImageUpload maxFiles={2} />);
    await upload(page, "cat.png");

    const tile = (await page.locator("img[alt='cat.png']").boundingBox())!;
    expect(tile.width).toBe(96);
    expect(tile.height).toBe(96);
  });

  test("stays inside its own preview, so two of them cannot collide", async ({
    mount,
    page,
  }) => {
    // The issue's sharper point: the control FLOATS on the tile corner, so a
    // bigger hit area is only a fix if it does not start overhanging its
    // neighbour. Two previews side by side is the arrangement that shows it.
    await mount(<StyledImageUpload maxFiles={2} />);
    await upload(page, "cat.png", "dog.png");

    const first = (await page
      .getByRole("button", { name: "Remove cat.png" })
      .boundingBox())!;
    const second = (await page
      .getByRole("button", { name: "Remove dog.png" })
      .boundingBox())!;

    // Two targets, and the input-set size stated so "they do not overlap"
    // cannot pass over one preview or none.
    expect(await page.getByRole("button", { name: /^Remove / }).count()).toBe(2);

    const overlapsHorizontally =
      first.x < second.x + second.width && second.x < first.x + first.width;
    const overlapsVertically =
      first.y < second.y + second.height && second.y < first.y + first.height;
    expect(overlapsHorizontally && overlapsVertically).toBe(false);
  });

  test("does not push the preview grid off the screen", async ({ mount, page }) => {
    // Re-checked at every viewport, `iphone-se` (375px) above all: two 96px
    // previews plus a control that grew by 32px in each direction is exactly
    // the arithmetic that starts overflowing a narrow screen.
    await mount(<StyledImageUpload maxFiles={2} />);
    await upload(page, "cat.png", "dog.png");

    const viewport = page.viewportSize()!;
    for (const name of ["cat.png", "dog.png"]) {
      const box = (await page
        .getByRole("button", { name: `Remove ${name}` })
        .boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }
  });

  test("still removes the preview when pressed", async ({ mount, page }) => {
    // A hit area that grew but stopped working is not an improvement. Pressed
    // at the CENTRE of the new box — the part that did not exist before.
    await mount(<StyledImageUpload maxFiles={2} />);
    await upload(page, "cat.png", "dog.png");

    await page.getByRole("button", { name: "Remove cat.png" }).click();
    await expect(page.getByRole("button", { name: "Remove cat.png" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove dog.png" })).toHaveCount(1);
  });
});

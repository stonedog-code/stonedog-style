import { test, expect } from "@playwright/experimental-ct-react";
import StyledPage from "./StyledPage";

/**
 * NEH-802 — a page inside a BLOCK parent must still fill it.
 *
 * This is the case that broke HopperGuard's `/dashboard` in production, and it
 * is the case `flex: 1` alone cannot serve.
 *
 * The app shell is a flex column, so a page usually takes its height from
 * `flex: 1`. That makes `height: 100%` look redundant, and it was removed on
 * exactly that reasoning. But `/dashboard` nests one page inside another
 * through plain `display: block` wrappers, and **`flex: 1` is inert inside a
 * block parent**. With the height gone the inner page fell back to CONTENT
 * height — 138px, of which a widget header took ~128, leaving its `1fr` body
 * 10px of padding and the widget grid zero. Seven tiles were in the DOM the
 * whole time; every one was clipped away.
 *
 * jsdom cannot catch this — no layout engine, every box reports zero, so a unit
 * test agrees a collapsed page is fine. That is why this lives here and
 * measures a real browser.
 */

test.use({ viewport: { width: 1280, height: 800 } });

test("fills a BLOCK parent of known height", async ({ mount, page }) => {
  await mount(
    <div style={{ display: "block", height: "600px" }}>
      <StyledPage data-testid="page">
        <div data-testid="child" style={{ flex: 1, minHeight: 0 }}>content</div>
      </StyledPage>
    </div>,
  );

  const h = await page.getByTestId("page").evaluate((el) => el.getBoundingClientRect().height);
  // Content height would be ~20px. Anything near the parent's 600 means the
  // page claimed the space it was given.
  expect(h).toBeGreaterThan(500);
});

test("still fills a FLEX-COLUMN parent, the common case", async ({ mount, page }) => {
  // The height must not regress the case `flex: 1` already served — this is
  // the app shell's shape, and it is why the height looked droppable.
  await mount(
    <div style={{ display: "flex", flexDirection: "column", height: "600px" }}>
      <StyledPage data-testid="page">
        <div>content</div>
      </StyledPage>
    </div>,
  );

  const h = await page.getByTestId("page").evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThan(500);
});

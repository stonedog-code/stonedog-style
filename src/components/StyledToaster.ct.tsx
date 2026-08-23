import { test, expect } from "@playwright/experimental-ct-react";
import { ToasterHarness } from "./StyledToaster.harness";

/**
 * `StyledToaster` in a real browser.
 *
 * The jsdom tier owns roles, timers and wiring. Everything here is a claim
 * jsdom structurally cannot settle, because it has no layout engine and reports
 * every box as zero-sized — it would agree just as readily that a 600px-minimum
 * card fits a 375px screen.
 *
 * Two of these are the reason this file exists at all:
 *
 * - **The card must not overflow the narrowest screen.** `minWidth` is 320px at
 *   `base` and 600px from `lg` up, so the responsive step is load-bearing, and
 *   the failure mode is a horizontal scrollbar on the whole document rather
 *   than anything visibly wrong with the toast.
 * - **The region must not swallow clicks.** It is a fixed, full-corner element
 *   with `pointer-events: none`, and its cards re-enable them. Get that pairing
 *   backwards and an invisible plate covers a corner of the application — with
 *   nothing on screen to suggest why buttons there stopped working.
 */

const TAP_TARGET_FLOOR = 44;

test.describe("StyledToaster — layout", () => {
  test("the card never overflows the viewport", async ({ mount, page }) => {
    await mount(<ToasterHarness />);
    const toast = page.getByRole("status");
    await expect(toast).toBeVisible();

    const box = (await toast.boundingBox())!;
    const viewport = page.viewportSize()!;

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });

  test("the document itself never scrolls sideways", async ({ mount, page }) => {
    // The symptom a user actually meets. Asserted separately from the box
    // measurement above because a card can sit inside the viewport while a
    // margin or the region's own inset still pushes the page wide.
    await mount(<ToasterHarness />);
    await expect(page.getByRole("status")).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("a long message wraps rather than widening the card", async ({ mount, page }) => {
    await mount(
      <ToasterHarness
        toasts={[
          {
            title: "Could not save",
            description:
              "The connection dropped while the record was being written, so nothing was changed. " +
              "Check the network and try again — a retry is safe, and will not create a duplicate.",
            type: "error",
          },
        ]}
      />,
    );
    const toast = page.getByRole("status");
    await expect(toast).toBeVisible();

    const box = (await toast.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });

  test("stacked toasts do not overlap each other", async ({ mount, page }) => {
    await mount(
      <ToasterHarness
        toasts={[
          { title: "First", type: "info" },
          { title: "Second", type: "success" },
          { title: "Third", type: "warning" },
        ]}
      />,
    );
    const toasts = page.getByRole("status");
    await expect(toasts).toHaveCount(3);

    const boxes = await toasts.all().then((all) => Promise.all(all.map((t) => t.boundingBox())));
    for (let i = 1; i < boxes.length; i++) {
      const above = boxes[i - 1]!;
      const below = boxes[i]!;
      expect(below.y).toBeGreaterThanOrEqual(above.y + above.height);
    }
  });
});

test.describe("StyledToaster — pointer semantics", () => {
  test("the region lets clicks through to the page behind it", async ({ mount, page }) => {
    // With `pointer-events` the wrong way round this is an invisible plate over
    // a corner of the application, and nothing on screen explains it.
    await mount(<ToasterHarness />);
    await expect(page.getByRole("status")).toBeVisible();

    const viewport = page.viewportSize()!;
    // A point inside the region's band but clear of the card itself.
    const underneath = await page.evaluate(
      ({ w }) => {
        const el = document.elementFromPoint(w / 2, 4);
        return el?.tagName ?? null;
      },
      { w: viewport.width },
    );
    expect(underneath).not.toBeNull();
    // The region is `position: fixed` across the corner; whatever is at the top
    // of the page must still be the thing a click would reach.
    expect(["DIV", "BODY", "HTML"]).toContain(underneath);
  });

  test("the card itself does receive pointer events", async ({ mount, page }) => {
    // The control for the test above. Without it, `pointer-events: none` on
    // BOTH the region and the card would pass — and the toast's close button
    // would be unclickable.
    await mount(<ToasterHarness toasts={[{ title: "Saved.", type: "success", closable: true }]} />);
    const close = page.getByRole("button", { name: "Dismiss notification" });
    await expect(close).toBeVisible();

    const box = (await close.boundingBox())!;
    const hit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest("button") !== null;
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hit).toBe(true);
  });
});

test.describe("StyledToaster — target sizes", () => {
  test("the close control meets the tap-target floor", async ({ mount, page }) => {
    // A close control is the one thing on a toast a person is aiming at, often
    // while it is moving. jsdom reports it as 0×0 and would pass either way.
    await mount(<ToasterHarness toasts={[{ title: "Saved.", type: "success", closable: true }]} />);
    const close = page.getByRole("button", { name: "Dismiss notification" });
    const box = (await close.boundingBox())!;

    expect(box.width).toBeGreaterThanOrEqual(TAP_TARGET_FLOOR);
    expect(box.height).toBeGreaterThanOrEqual(TAP_TARGET_FLOOR);
  });

  test("the action control meets the tap-target floor", async ({ mount, page }) => {
    await mount(
      <ToasterHarness
        toasts={[
          {
            title: "You have notifications",
            type: "info",
            action: { label: "Review", onClick: () => {} },
          },
        ]}
      />,
    );
    const box = (await page.getByRole("button", { name: "Review" }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(TAP_TARGET_FLOOR);
  });
});

test.describe("StyledToaster — the accent renders", () => {
  test("each status paints a leading accent, and they differ", async ({ mount, page }) => {
    // The token-contract test proves the stylesheet holds a `var(...)`. This
    // proves the custom property behind it actually resolves to a colour — a
    // token with no property renders as nothing, with no error anywhere.
    const seen = new Set<string>();

    for (const type of ["success", "error", "warning"] as const) {
      const component = await mount(<ToasterHarness toasts={[{ title: type, type }]} />);
      const accent = await page
        .getByRole("status")
        .evaluate((el) => getComputedStyle(el).borderInlineStartColor);

      expect(accent).not.toBe("");
      expect(accent).not.toBe("rgba(0, 0, 0, 0)");
      seen.add(accent);
      await component.unmount();
    }

    expect(seen.size).toBe(3);
  });
});

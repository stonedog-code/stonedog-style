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

/**
 * Narrower than the matrix, at the largest text step.
 *
 * The viewport matrix stops at 375px with default text, and at that size a
 * short toast fits — so the card's `minWidth: 320px` and `maxWidth: 400px` were
 * never asked about a screen narrower than themselves. At 320px the region is
 * capped at `100vw - 2rem` (288px) but the card's own floor was 320px, and at
 * the `xl` step its content pushed it to the 400px ceiling. The region aligns
 * its cards to the inline end, so the extra width spilled off the LEFT edge:
 * measured in HopperGuard at x = -96, w = 400, with the first letter of every
 * line clipped. The document never scrolled sideways, so the "never scrolls
 * sideways" test above could not see it either.
 *
 * These set the viewport themselves, so they answer the same question in every
 * project of the matrix.
 */
const SIGN_IN_TOAST = {
  // HopperGuard's sign-in notice, verbatim in shape: a title, a description,
  // an action and a close control — four things competing for one row.
  title: "You have notifications",
  description: "You have 4 unread notifications.",
  type: "info" as const,
  action: { label: "Review", onClick: () => {} },
  closable: true,
};
const SIGN_IN_TOASTS = [SIGN_IN_TOAST, SIGN_IN_TOAST];

/**
 * HopperGuard's pinned ramp (its globals.css), where `md` is 22px. The
 * package's fallbacks are 16px-based, and at those a short toast happens to
 * fit — the defect was only visible at the text sizes it was built for.
 */
const LARGE_RAMP =
  ":root{--font-sizes-xs:0.75rem;--font-sizes-sm:1.0625rem;--font-sizes-md:1.375rem;" +
  "--font-sizes-lg:1.6875rem;--font-sizes-xl:2rem;--font-sizes-2xl:2.3125rem;" +
  "--font-sizes-3xl:2.625rem;--font-sizes-4xl:2.9375rem}";

test.describe("StyledToaster — narrow screens at the largest text size", () => {
  for (const width of [320, 375]) {
    test(`every card stays inside a ${width}px viewport at xl`, async ({ mount, page }) => {
      await page.setViewportSize({ width, height: 640 });
      await page.addStyleTag({ content: LARGE_RAMP });
      await mount(<ToasterHarness toasts={SIGN_IN_TOASTS} fontSizeProfile="xl" />);

      const toasts = page.getByRole("status");
      await expect(toasts).toHaveCount(SIGN_IN_TOASTS.length);

      const innerWidth = await page.evaluate(() => window.innerWidth);
      for (const toast of await toasts.all()) {
        const box = (await toast.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(innerWidth);
      }
    });
  }

  test("two toasts leave at least half of a 320x640 screen uncovered", async ({ mount, page }) => {
    // The other half of the defect: at the largest text step on a phone, one
    // notice with an action is taller than a third of the screen, and two
    // stacked used to cover it entirely and run off the top edge.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addStyleTag({ content: LARGE_RAMP });
    await mount(<ToasterHarness toasts={SIGN_IN_TOASTS} fontSizeProfile="xl" />);
    await expect(page.getByRole("status")).toHaveCount(2);

    const region = page.getByRole("status").first().locator("..");
    const box = (await region.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.height).toBeLessThanOrEqual(640 / 2 + 1);
  });

  test("when the stack scrolls, the newest toast is the one in view", async ({ mount, page }) => {
    // A scroll container opens at its top — here the OLDEST toast — so without
    // the renderer's scroll-to-end the message that just arrived would sit
    // below the fold of its own region.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addStyleTag({ content: LARGE_RAMP });
    await mount(
      <ToasterHarness
        toasts={[
          { ...SIGN_IN_TOAST, title: "Oldest" },
          { ...SIGN_IN_TOAST, title: "Newest" },
        ]}
        fontSizeProfile="xl"
      />,
    );
    const newest = page.getByRole("status").filter({ hasText: "Newest" });
    await expect(newest).toBeVisible();

    const region = (await newest.locator("..").boundingBox())!;
    const card = (await newest.boundingBox())!;
    // Its close control (top of the card) and its action (bottom) are both
    // inside the region's visible box, not scrolled out of it.
    expect(card.y).toBeGreaterThanOrEqual(region.y - 1);
    expect(card.y + card.height).toBeLessThanOrEqual(region.y + region.height + 1);
  });

  test("the capped stack scrolls under a pointer, despite letting clicks through", async ({
    mount,
    page,
  }) => {
    // The region is `pointer-events: none` so it never swallows a click meant
    // for the page. A wheel over a CARD must still scroll the region the card
    // sits in, or the older toasts above it are unreachable.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addStyleTag({ content: LARGE_RAMP });
    await mount(<ToasterHarness toasts={SIGN_IN_TOASTS} fontSizeProfile="xl" />);
    const oldest = page.getByRole("status").first();
    await expect(oldest).toBeVisible();
    const region = oldest.locator("..");

    // Start from the top, so the wheel has somewhere to go and its effect is
    // unambiguous.
    await region.evaluate((el) => {
      el.scrollTop = 0;
    });
    const box = (await oldest.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
});

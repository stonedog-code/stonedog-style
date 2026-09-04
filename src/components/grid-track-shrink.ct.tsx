import { test, expect } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import { SimpleGridProbe, UnshrinkableProbe } from "./grid-track-shrink.harness";

/**
 * `columns={n}` must not let a track outgrow the grid's own container.
 *
 * The defect (NEH-1447, the cause behind NEH-1446): `columns={n}` used to emit
 * `repeat(n, 1fr)`. In CSS `1fr` **is** shorthand for `minmax(auto, 1fr)`, and
 * that `auto` floor is the grid item's *automatic minimum size* — its
 * min-content. So one child that cannot shrink drags the whole track wider than
 * the container, and every sibling sized `width: 100%` inherits the overflow.
 * Measured on HopperGuard's dashboard at 375×812: a 425.875px track inside a
 * 375px container, clipped rather than scrolled by an `overflow: hidden` shell.
 *
 * **This belongs here and nowhere else.** jsdom has no layout engine — every
 * element reports a zero-sized box — so a jsdom test will happily agree that a
 * 426px track fits a 375px container. Only a real browser can answer it.
 *
 * The suite is built so it cannot pass vacuously:
 *
 * | test | planted (`1fr`) | fixed (`minmax(0, 1fr)`) |
 * |---|---|---|
 * | the fixture really is unshrinkable | passes | passes |
 * | `minTrackWidth="auto"` still overflows | passes | passes |
 * | the default track fits its container | **FAILS** | passes |
 *
 * The first two are sentinels: they assert that something really was pushing
 * the track wider. Without them the guard could go green because the fixture
 * shrank on its own — which is exactly the trap a sibling spec in hopper-web
 * fell into on the day this was written; it passed with both clamps deleted.
 *
 * Every test runs at all four viewport projects.
 *
 * **`StyledGrid` is deliberately not covered here, and not changed.** It hands
 * its `columns` value to Panda as a *style prop*, and Panda extracts styles by
 * statically parsing source at build time — so a value computed at runtime
 * produces a class name with no rule behind it. Measured: `columns={2}` renders
 * `class="d_grid grid-tc_repeat(2,_minmax(0,_1fr))"`, no matching stylesheet
 * rule anywhere, and one implicit content-sized 550.906px track. It has never
 * emitted a track of its own; where it appears to work in an app, the app's own
 * source happens to contain the same literal elsewhere. Rewriting the emitted
 * string would break exactly that coincidence, which is why this change stops
 * at StyledSimpleGrid — that one uses inline style and is always applied.
 */

const EPSILON = 0.5;

interface GridMetrics {
  containerWidth: number;
  gridScrollWidth: number;
  tracks: number[];
  trackTotal: number;
}

/**
 * Read the **resolved** track sizes out of the browser.
 *
 * `getComputedStyle().gridTemplateColumns` returns used pixel values once the
 * grid is laid out (`"320px"`, `"160px 160px"`). That is the number this bug is
 * about; asserting the declared string instead would agree with itself either
 * way and prove nothing.
 */
async function measureGrid(page: Page): Promise<GridMetrics> {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="container"]');
    const grid = document.querySelector('[data-testid="grid"]');
    if (!(container instanceof HTMLElement) || !(grid instanceof HTMLElement)) {
      throw new Error("grid-track-shrink fixture did not mount");
    }
    const tracks = window
      .getComputedStyle(grid)
      .gridTemplateColumns.split(/\s+/)
      .filter(Boolean)
      .map((value) => Number.parseFloat(value));
    return {
      containerWidth: container.getBoundingClientRect().width,
      gridScrollWidth: grid.scrollWidth,
      tracks,
      trackTotal: tracks.reduce((sum, size) => sum + size, 0),
    };
  });
}

/**
 * The TRACK is the assertion, deliberately — not the grid's `scrollWidth`.
 *
 * Once the track is clamped, an item whose content still cannot shrink paints
 * outside its own cell, so `grid.scrollWidth` stays at the content width (551px
 * against a 320px container, measured). That is the item's business — its own
 * `overflow`, `text-overflow` or wrapping — and it is unchanged by this fix.
 * What this component controls, and what NEH-1446 was actually caused by, is the
 * track: a track wider than its container relays the overflow to every sibling
 * sized `width: 100%`, which is how one stubborn child moved a whole dashboard.
 */
async function expectTracksFitContainer(page: Page, expectedTracks: number) {
  const { containerWidth, trackTotal, tracks } = await measureGrid(page);
  expect(containerWidth).toBeGreaterThan(0);
  expect(tracks).toHaveLength(expectedTracks);
  expect(trackTotal).toBeLessThanOrEqual(containerWidth + EPSILON);
}

async function expectTracksOverflowContainer(page: Page) {
  const { containerWidth, trackTotal } = await measureGrid(page);
  expect(containerWidth).toBeGreaterThan(0);
  expect(trackTotal).toBeGreaterThan(containerWidth + EPSILON);
}

test.describe("StyledSimpleGrid columns tracks", () => {
  test("SENTINEL: the fixture's child really cannot shrink to the container", async ({
    mount,
    page,
  }) => {
    // Passes in BOTH the planted and the fixed state, by design. If this ever
    // fails, every guard below is measuring nothing: the child would have fit
    // whatever the track was sized at.
    await mount(<UnshrinkableProbe />);

    const measurements = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="container"]');
      const child = document.querySelector('[data-testid="unshrinkable"]');
      if (!(container instanceof HTMLElement) || !(child instanceof HTMLElement)) {
        throw new Error("grid-track-shrink fixture did not mount");
      }
      return {
        containerWidth: container.getBoundingClientRect().width,
        childMinContent: child.scrollWidth,
      };
    });

    expect(measurements.childMinContent).toBeGreaterThan(measurements.containerWidth + 40);
  });

  test('SENTINEL: minTrackWidth="auto" still overflows, so the pressure is real', async ({
      mount,
      page,
    }) => {
      // The escape hatch, and the second sentinel. It reproduces the pre-0.21.0
      // behaviour on demand — which is both what a host that genuinely needs a
      // content-sized track has to be able to ask for by name, and proof that
      // this fixture is pushing the track past the container. Passes in both
      // states.
      await mount(<SimpleGridProbe columns={1} minTrackWidth="auto" />);
      await expectTracksOverflowContainer(page);
    });

    test("GUARD: one column does not outgrow its container", async ({ mount, page }) => {
      await mount(<SimpleGridProbe columns={1} />);
      await expectTracksFitContainer(page, 1);
    });

    test("GUARD: two columns split the container rather than each claiming their content", async ({
      mount,
      page,
    }) => {
      await mount(<SimpleGridProbe columns={2} />);
      await expectTracksFitContainer(page, 2);
    });
});

import { test, expect } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";
import {
  GridProbe,
  GridTemplateColumnsProbe,
  SimpleGridProbe,
  UnshrinkableProbe,
} from "./grid-track-shrink.harness";

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
 * **`StyledGrid` is now covered too (NEH-1453), and for a different defect.**
 * It handed its computed `grid-template-columns` to Panda as a *style prop*,
 * and Panda extracts styles by statically parsing source at build time — so a
 * value computed at runtime produced a class *name* with no rule behind it.
 * Measured here before the fix, `<StyledGrid columns={2}>` in a 320px
 * container:
 *
 * ```
 * class="d_grid grid-tc_repeat(2,_1fr)"
 * inline style: null
 * computed grid-template-columns: 445.188px   <- ONE implicit, content-sized track
 * rules in the sheet mentioning grid-template-columns: 1, and it is
 *   `.grid-tc_max-content_1fr` from StyledDefinitionList
 * ```
 *
 * Note what that means for a guard: asserting the element *has* a class would
 * have passed against the broken code, because the class really was emitted.
 * Only the COMPUTED value distinguishes the two states, which is why every
 * assertion below reads `getComputedStyle().gridTemplateColumns`.
 *
 * Where it appeared to work in an app it was a coincidence — the class name is
 * derived from the value, so a consumer whose own source contained the same
 * literal elsewhere got a rule by accident. See the harness for why these
 * fixtures use 5, 7 and 11 columns rather than 1, 2 and 3.
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

/**
 * The preset's breakpoints, restated so a viewport can be mapped to the column
 * count `GRID_COLUMNS_RESPONSIVE` puts in force there.
 *
 * The component-test matrix runs every test at four viewports, so a responsive
 * fixture asserts a DIFFERENT answer in each project — which is the point: the
 * responsive object is the form the only real call site in the fleet uses
 * (`columns={{ base: 1, md: 2, lg: 3 }}`), and a guard that only ever checked
 * one viewport would not have covered it.
 */
const MD = 768;
const LG = 1024;

/**
 * **These column counts are load-bearing — do not "tidy" them to 1, 2 and 3.**
 *
 * The pre-fix class name was derived from the value, so a grid only rendered
 * when the *consumer's own source* happened to contain the same literal
 * somewhere else. HopperGuard has exactly that for `repeat(1, 1fr)` and
 * `repeat(2, 1fr)`. A fixture using 1, 2 or 3 columns could therefore pass for
 * the wrong reason the moment anybody adds such a literal to this package.
 * Nothing in any design hard-codes a 5-, 7- or 11-column track list.
 *
 * They are also all > 1, which matters independently: the pre-fix rendering was
 * a SINGLE implicit content-sized track, so any assertion on the track *count*
 * fails against it.
 *
 * They live in the spec rather than the harness because Playwright CT's mount
 * transform re-declares harness imports that a mount call references, and a
 * name used both inside and outside a mount collides at collection.
 */
const GRID_COLUMNS_FLAT = 7;
const GRID_COLUMNS_RESPONSIVE = { base: 5, md: 7, lg: 11 } as const;

/** Two uneven tracks, so the assertion cannot be met by an even split. */
const GRID_TEMPLATE_LITERAL = "1fr 3fr";

function expectedResponsiveColumns(viewportWidth: number): number {
  if (viewportWidth >= LG) return GRID_COLUMNS_RESPONSIVE.lg;
  if (viewportWidth >= MD) return GRID_COLUMNS_RESPONSIVE.md;
  return GRID_COLUMNS_RESPONSIVE.base;
}

test.describe("StyledGrid columns tracks (NEH-1453)", () => {
  test("GUARD: a flat column count resolves that many real tracks", async ({ mount, page }) => {
    // Fails against the pre-fix component, which resolved ONE implicit
    // content-sized track (445.188px inside a 320px container) because the
    // class it emitted had no rule behind it anywhere in the stylesheet.
    await mount(<GridProbe columns={GRID_COLUMNS_FLAT} />);
    await expectTracksFitContainer(page, GRID_COLUMNS_FLAT);
  });

  test("GUARD: a responsive column object resolves per viewport", async ({
    mount,
    page,
  }, testInfo) => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const expected = expectedResponsiveColumns(viewport!.width);

    await mount(<GridProbe columns={GRID_COLUMNS_RESPONSIVE} />);
    const { tracks, containerWidth, trackTotal } = await measureGrid(page);

    // Named in the failure so a red run says which viewport disagreed rather
    // than only which project.
    expect(
      tracks.length,
      `${testInfo.project.name} (${viewport!.width}px) should resolve ${expected} tracks`,
    ).toBe(expected);
    expect(trackTotal).toBeLessThanOrEqual(containerWidth + EPSILON);
  });

  test("GUARD: a literal templateColumns reaches the element", async ({ mount, page }) => {
    // `templateColumns` is not a Panda property name, so even a static literal
    // at the call site was never extracted — this failed before the fix too,
    // which the issue's blast-radius note did not account for. `1fr 3fr` is
    // asserted as a RATIO so the assertion cannot be met by an even split.
    await mount(<GridTemplateColumnsProbe template={GRID_TEMPLATE_LITERAL} />);
    const { tracks, containerWidth } = await measureGrid(page);

    expect(tracks, `templateColumns="${GRID_TEMPLATE_LITERAL}"`).toHaveLength(2);
    expect(tracks[1]! / tracks[0]!).toBeCloseTo(3, 1);
    expect(tracks[0]! + tracks[1]!).toBeLessThanOrEqual(containerWidth + EPSILON);
  });

  test('GUARD: minTrackWidth="auto" still opts back into content-sized tracks', async ({
    mount,
    page,
  }) => {
    // The escape hatch, matching StyledSimpleGrid. It is also a sentinel: it
    // proves the fixture's unshrinkable child really is pushing on the track,
    // so the guards above are not passing because everything happened to fit.
    await mount(<GridProbe columns={GRID_COLUMNS_FLAT} minTrackWidth="auto" />);
    await expectTracksOverflowContainer(page);
  });
});

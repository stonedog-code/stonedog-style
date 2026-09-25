import { test, expect } from "@playwright/experimental-ct-react";
// `Page` is not re-exported by the component-test entry point — it comes from
// the base package, and `tsc` is the only tier that says so.
import type { Page } from "@playwright/test";
import {
  ChartTableAlwaysVisible,
  ChartTableBothDefaults,
  ChartTableCollapsedByDefault,
  ChartTableOpenByDefault,
} from "./StyledChartTableDisclosure.harness";

/**
 * `showTable="collapsible"`, in a real browser (NEH-1647).
 *
 * ## Where these assertions came from
 *
 * They are a port of `apps/web/test/ct/chart-table-disclosure.ct.tsx` in
 * HopperGuard, which asserted the same eight criteria against the app-level
 * composition NEH-1647 moved in here. Copied from that file rather than
 * re-derived, so the contract that shipped is the contract that survives the
 * move — and so the app's spec can simply be deleted rather than translated.
 *
 * **One is adapted, and the adaptation is not a weakening.** Criterion 7's
 * indicator check there reads a Font Awesome `data-icon` off an `<svg>`. This
 * package ships no icon artwork at all and never will, so its indicator is a
 * text glyph carrying `data-chart-table-indicator`. The claim is unchanged —
 * same words, same accessible name, an indicator that differs only by state —
 * and it is read off an attribute instead of an SVG.
 *
 * ## Why this is the component tier and not jsdom
 *
 * jsdom can answer none of the interesting ones: it has no focus model, so
 * `Tab` does not exist and `document.activeElement` never moves; it has no
 * layout engine, so a control's tap target is 0×0; and `checkVisibility()` is a
 * browser computation, not an attribute read. A unit test can assert that the
 * `hidden` attribute is present. Only a browser can say the region is therefore
 * gone from the focus order — which is the criterion, not the attribute.
 *
 * This tier is in this package's gate (`gate:ct`, NEH-1317) and is the required
 * `Component tests (4 viewports)` context on the repo. Verify rather than
 * trusting this line:
 *
 *   gh api repos/stonedog-code/stonedog-style/branches/main/protection \
 *     -q '.required_status_checks.contexts'
 *
 * ## The planted failure, and exactly what it caught
 *
 * `StyledCollapsible` was replaced in `StyledChart` with a hand-rolled trigger
 * plus a region CLIPPED rather than `hidden` — `aria-expanded`, `aria-controls`
 * and the accessible name all still correct, only the hiding weakened. That is
 * the criterion-3 failure: a table that has left the screen and not the
 * document. Recorded in the PR with the counts it produced.
 *
 * Inherited from the source file, and still worth knowing: **the tab-order
 * probe did NOT fire on the equivalent plant there**, because a clipped scroll
 * box does not become a tab stop. `checkVisibility()` is the line carrying
 * criterion 3; `tabOrderFrom` corroborates it. Anyone widening this spec should
 * know which assertion is load-bearing.
 */

/** The house floor, above WCAG 2.5.5 AAA's 44. */
const TAP_MIN = 48;

const TRIGGER = '[data-testid="chart-table-disclosure"]';
const REGION = '[data-testid="chart-table-disclosure-region"]';
const INDICATOR = "[data-chart-table-indicator]";

/**
 * Walk the document's real tab order and report what each stop is.
 *
 * Returns a label per stop — the testid where there is one, else the tag name
 * — plus whether that element sits inside the disclosure region. Reading the
 * sequence rather than asserting inside the loop means a failure names where
 * focus actually went instead of saying only that it was wrong.
 */
async function tabOrderFrom(page: Page, startSelector: string, steps: number) {
  await page.locator(startSelector).focus();
  const stops: { label: string; insideRegion: boolean }[] = [];
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate((regionSelector) => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return { label: "(none)", insideRegion: false };
        const region = document.querySelector(regionSelector);
        return {
          label: el.getAttribute("data-testid") ?? el.tagName.toLowerCase(),
          insideRegion: Boolean(region && region.contains(el)),
        };
      }, REGION),
    );
  }
  return stops;
}

test.describe("criterion 1, 4, 5, 6 — what the control IS", () => {
  test("is a native button, named for the content, pointing at the region", async ({
    mount,
    page,
  }) => {
    await mount(<ChartTableCollapsedByDefault />);
    const trigger = page.locator(TRIGGER);

    // 1 — a real <button>, so Enter and Space are the browser's job.
    expect(await trigger.evaluate((el) => el.tagName)).toBe("BUTTON");
    expect(await trigger.getAttribute("type")).toBe("button");

    // 4 — the name says what the content IS. Visible words, not an aria-label
    // over a bare glyph: an indicator alone assumes the reader knows it.
    await expect(trigger).toHaveAccessibleName("Weight data table");
    expect((await trigger.textContent())?.trim()).toContain("Weight data table");

    // 5 — aria-controls resolves to the region that actually holds the table.
    const controls = await trigger.getAttribute("aria-controls");
    expect(controls, "aria-controls").toBeTruthy();
    const regionId = await page.locator(REGION).getAttribute("id");
    expect(controls).toBe(regionId);

    // 6 — a focus ring the browser really paints, and the house tap floor.
    const box = (await trigger.boundingBox())!;
    expect(box.width, "trigger width").toBeGreaterThanOrEqual(TAP_MIN);
    expect(box.height, "trigger height").toBeGreaterThanOrEqual(TAP_MIN);
    await trigger.focus();
    const outline = await trigger.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        style: cs.outlineStyle,
        width: parseFloat(cs.outlineWidth || "0"),
        shadow: cs.boxShadow,
      };
    });
    expect(
      outline.style !== "none" && outline.width > 0 ? true : outline.shadow !== "none",
      `focus indicator (outline ${outline.style} ${outline.width}px, shadow ${outline.shadow})`,
    ).toBe(true);
  });
});

test.describe("criterion 2, 3 — the state is real, and hiding really hides", () => {
  test("collapsed: aria-expanded false, and the region is gone from view AND from the focus order", async ({
    mount,
    page,
  }) => {
    await mount(<ChartTableCollapsedByDefault />);
    const trigger = page.locator(TRIGGER);
    const region = page.locator(REGION);

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Asked of the browser, not read off the attribute: `hidden` can be
    // defeated by a `display` rule, and `checkVisibility()` is what a user and
    // an assistive technology actually get.
    expect(await region.evaluate((el) => el.checkVisibility())).toBe(false);
    await expect(region).toBeHidden();

    const stops = await tabOrderFrom(page, TRIGGER, 3);
    expect(
      stops.some((s) => s.insideRegion),
      `tab stops after the trigger: ${stops.map((s) => s.label).join(" → ")}`,
    ).toBe(false);
    // Non-vacuity: Tab did move somewhere. A press that focused nothing would
    // satisfy the assertion above while measuring nothing at all.
    expect(stops[0]!.label, "the first stop after the trigger").toBe("sentinel-after");
  });

  test("expanded: aria-expanded true, the region is visible, and it IS in the focus order", async ({
    mount,
    page,
  }) => {
    await mount(<ChartTableOpenByDefault />);
    const trigger = page.locator(TRIGGER);
    const region = page.locator(REGION);

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await region.evaluate((el) => el.checkVisibility())).toBe(true);
    await expect(region.getByRole("table")).toBeVisible();

    /*
     * The CONTROL for the test above: it proves the probe can see a tab stop
     * inside the region at all.
     *
     * The table has no links or inputs in it, so its only tab stop is the
     * scroll box Chromium makes focusable once the body overflows — which is
     * why the fixture carries fourteen rows against a threshold of eight.
     * Without this assertion the collapsed case would be describing a document
     * with nothing focusable in it either way: a green over an empty set.
     */
    const stops = await tabOrderFrom(page, TRIGGER, 3);
    expect(
      stops.some((s) => s.insideRegion),
      `tab stops after the trigger: ${stops.map((s) => s.label).join(" → ")}`,
    ).toBe(true);
  });

  test("the state follows the keyboard, on Enter and on Space", async ({ mount, page }) => {
    await mount(<ChartTableCollapsedByDefault />);
    const trigger = page.locator(TRIGGER);
    const region = page.locator(REGION);
    await trigger.focus();

    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await region.evaluate((el) => el.checkVisibility())).toBe(true);

    await page.keyboard.press("Space");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(await region.evaluate((el) => el.checkVisibility())).toBe(false);

    // Focus stayed on the control across both presses. A disclosure that
    // rebuilds its button drops focus to <body>, and the next press goes
    // nowhere (NEH-933).
    expect(
      await page.evaluate(
        (sel) => document.activeElement === document.querySelector(sel),
        TRIGGER,
      ),
    ).toBe(true);
  });
});

test.describe("criterion 7, 8 — the same control, in the right place", () => {
  test("the two defaults really differ, and NOTHING else about the control does", async ({
    mount,
    page,
  }) => {
    await mount(<ChartTableBothDefaults />);
    const triggers = page.locator(TRIGGER);
    expect(await triggers.count(), "disclosures examined").toBe(2);

    const open = triggers.nth(0);
    const collapsed = triggers.nth(1);

    // The thing that differs — and it differs.
    await expect(open).toHaveAttribute("aria-expanded", "true");
    await expect(collapsed).toHaveAttribute("aria-expanded", "false");

    // Everything else is identical: same words, same accessible name, same
    // kind of indicator. 3.2.4 Consistent Identification is about the control
    // reading the same wherever it is met.
    const describe = (locator: typeof open) =>
      locator.evaluate((el) => {
        const glyph = el.querySelector("[data-chart-table-indicator]");
        /*
         * The WORDS, with the decoration removed — and this is the one place
         * the port had to change shape rather than just names.
         *
         * HopperGuard's indicator is an `<svg>`, which contributes no text, so
         * comparing raw `textContent` there compared the label. Here the
         * indicator is a character, so raw `textContent` is "▸Weight data
         * table" against "▾Weight data table" and the comparison would fail on
         * the one thing that is SUPPOSED to differ. Stripping every
         * `aria-hidden` descendant is what a screen reader does to these
         * contents anyway, so this is the same claim read correctly rather
         * than a relaxed one.
         */
        const copy = el.cloneNode(true) as HTMLElement;
        copy.querySelectorAll("[aria-hidden='true']").forEach((n) => n.remove());
        return {
          text: (copy.textContent ?? "").trim(),
          name: el.getAttribute("aria-label"),
          state: glyph?.getAttribute("data-chart-table-indicator") ?? "(none)",
          mark: (glyph?.textContent ?? "(none)").trim(),
        };
      });
    const a = await describe(open);
    const b = await describe(collapsed);
    // Non-vacuity: stripping the decoration must not have stripped the label
    // too. An empty string equals an empty string for every possible control.
    expect(a.text, "the words in the open trigger").toBe("Weight data table");
    expect(b.text).toBe(a.text);
    expect(b.name).toBe(a.name);
    // The indicator is present on both and points the other way, which is the
    // state cue a sighted reader gets instead of `aria-expanded`.
    expect(a.state, "open indicator").toBe("expanded");
    expect(b.state, "collapsed indicator").toBe("collapsed");
    expect(a.mark, "open glyph").not.toBe("(none)");
    expect(b.mark, "collapsed glyph").not.toBe("(none)");
    expect(b.mark).not.toBe(a.mark);
  });

  test("criterion 8 — the region is the trigger's immediate next sibling", async ({
    mount,
    page,
  }) => {
    await mount(<ChartTableCollapsedByDefault />);
    // So the next Tab after the trigger lands in what it just revealed, rather
    // than somewhere past it.
    const adjacent = await page.evaluate(
      ({ triggerSel, regionSel }) => {
        const trigger = document.querySelector(triggerSel);
        const region = document.querySelector(regionSel);
        return Boolean(trigger && region && trigger.nextElementSibling === region);
      },
      { triggerSel: TRIGGER, regionSel: REGION },
    );
    expect(adjacent, "the region immediately follows the trigger").toBe(true);
  });

  test("the indicator follows the state rather than being painted once", async ({
    mount,
    page,
  }) => {
    await mount(<ChartTableCollapsedByDefault />);
    const indicator = page.locator(INDICATOR);
    const before = await indicator.textContent();

    await expect(indicator).toHaveAttribute("data-chart-table-indicator", "collapsed");
    await page.locator(TRIGGER).click();
    await expect(indicator).toHaveAttribute("data-chart-table-indicator", "expanded");
    expect((await indicator.textContent())?.trim()).not.toBe((before ?? "").trim());

    // It is decoration, not a second mention of the control: a screen reader
    // reads the words, and the glyph is hidden from it.
    await expect(indicator).toHaveAttribute("aria-hidden", "true");
  });
});

test.describe("the default did NOT move", () => {
  /*
   * Every test above is about a disclosure existing. None of them would notice
   * if `showTable="collapsible"` had become the package default and every chart
   * in every consumer had silently grown a toggle — which is precisely the
   * silent-default-change hazard this repo's CLAUDE.md opens with.
   */
  test("showTable defaults to an always-visible table, with no trigger and nothing hidden", async ({
    mount,
    page,
  }) => {
    const component = await mount(<ChartTableAlwaysVisible />);

    await expect(component.getByRole("table")).toBeVisible();
    expect(await page.locator(TRIGGER).count(), "disclosure triggers").toBe(0);
    expect(await page.locator(REGION).count(), "disclosure regions").toBe(0);
  });
});

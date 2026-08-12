import { test, expect } from "@playwright/experimental-ct-react";
import { EmphasisHarness } from "./emphasis.harness";

/**
 * The emphasis tiers, measured in a browser (NEH-519).
 *
 * It has to be this tier, twice over. jsdom cannot resolve a custom property at
 * all, and it cannot evaluate `color-mix` — so a jest assertion on these would
 * be the vacuous kind NEH-406 was about. And the *whole claim* of the relative
 * default is about a computed result: that it de-emphasises whatever colour it
 * inherits, on any theme, while staying legible.
 *
 * The harness theme defines no `--hopper-text-muted-text`, which is the point:
 * what these measure is the FALLBACK — the thing a host gets for saying
 * nothing, and therefore the thing that has to be right without anybody
 * configuring it.
 */

/** Relative luminance, per WCAG 2.x. */
function luminance([r, g, b]: number[]): number {
  const channel = (v: number) => {
    const s = v! / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function contrast(fg: number[], bg: number[]): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
}

/**
 * A computed colour → 0-255 channels, composited onto `bg` when translucent.
 *
 * **`color-mix` does not compute to `rgb()`.** Chromium reports it as
 * `color(srgb 0.972549 0.980392 0.988235 / 0.78)` — a different function, and
 * 0-1 channels rather than 0-255. Assuming `rgb()` here silently produced
 * channel values under 1, which read as near-black and would have made every
 * contrast assertion below meaningless. Found by running this file, not by
 * reading the spec.
 */
function parse(value: string, bg?: number[]): number[] {
  const nums = value.match(/[\d.]+/g)!.map(Number);
  const scale = value.startsWith("color(") ? 255 : 1;
  const [r, g, b, a = 1] = nums;
  const rgb = [r! * scale, g! * scale, b! * scale];
  if (a === 1 || !bg) return rgb;
  return [0, 1, 2].map((i) => a * rgb[i]! + (1 - a) * bg[i]!);
}

test.describe("the emphasis tiers", () => {
  test("resolve to a real colour, so the fallback is not dead", async ({ mount }) => {
    // The first thing that would go wrong: `color-mix` unsupported, the
    // declaration dropped, and both tiers silently inheriting the normal
    // colour. That renders *fine* — which is exactly why it needs asserting.
    const component = await mount(<EmphasisHarness />);
    const read = (id: string) =>
      component.getByTestId(id).evaluate((el) => getComputedStyle(el).color);

    const normal = await read("normal");
    const muted = await read("muted");
    const subtle = await read("subtle");

    for (const value of [normal, muted, subtle]) {
      expect(value).not.toBe("");
      // `color(srgb …)` as well as `rgb(…)`: a browser reports a color-mix
      // result in the former, and pinning only the latter fails on a working
      // implementation.
      expect(value).toMatch(/^(rgba?|color)\(/);
    }
    expect(muted).not.toBe(normal);
    expect(subtle).not.toBe(normal);
    expect(subtle).not.toBe(muted);
  });

  test("step DOWN in emphasis, in that order", async ({ mount }) => {
    // A hierarchy that is not monotonic is not a hierarchy. If muted and subtle
    // ever swap, every stepper built on them reads backwards.
    const component = await mount(<EmphasisHarness />);
    const bg = parse(
      await component.evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    const read = async (id: string) =>
      contrast(
        parse(
          await component.getByTestId(id).evaluate((el) => getComputedStyle(el).color),
          bg,
        ),
        bg,
      );

    const normal = await read("normal");
    const muted = await read("muted");
    const subtle = await read("subtle");

    expect(normal).toBeGreaterThan(muted);
    expect(muted).toBeGreaterThan(subtle);
  });

  // The whole risk of alpha de-emphasis: it buys hierarchy with contrast, and
  // past some point it has spent the legibility too. 4.5:1 is AA for body text.
  // These measurements are what DECIDE the percentages in EMPHASIS_TOKENS — if
  // a future change to them fails here, the change is wrong, not the threshold.
  //
  // One test per surface rather than a loop: Playwright's `mount` can only be
  // called once per test ("a container that already has a React root"), so the
  // looping version failed on its second iteration for a reason that had
  // nothing to do with contrast.
  for (const [surface, base] of [
    ["boxBgMain", "textMain"],
    ["boxBgPrimary", "textPrimary"],
  ] as const) {
    test(`both tiers clear WCAG AA on ${surface}`, async ({ mount }) => {
      const component = await mount(<EmphasisHarness surface={surface} base={base} />);
      const bg = parse(
        await component.evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      for (const id of ["muted", "subtle"]) {
        const fg = parse(
          await component.getByTestId(id).evaluate((el) => getComputedStyle(el).color),
          bg,
        );
        expect(contrast(fg, bg), `${id} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test("follow the inherited colour rather than a fixed one", async ({ mount, page }) => {
    // THE claim the relative default rests on. If these ever resolved to a
    // literal, they would look right on the theme they were picked against and
    // wrong on every other — which is the defect the fallback-free rule exists
    // to prevent, and the reason this exception had to be narrow.
    const component = await mount(<EmphasisHarness />);
    const before = await component
      .getByTestId("muted")
      .evaluate((el) => getComputedStyle(el).color);

    await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>('[data-testid="surface"]')!;
      surface.style.color = "rgb(255, 0, 0)";
    });

    const after = await component
      .getByTestId("muted")
      .evaluate((el) => getComputedStyle(el).color);

    expect(after).not.toBe(before);
    // Red in, red out — de-emphasised, not replaced.
    expect(parse(after)[0]).toBeGreaterThan(parse(after)[1]!);
    expect(parse(after)[0]).toBeGreaterThan(parse(after)[2]!);
  });

  test("a host property overrides the default entirely", async ({ mount, page }) => {
    // The other half of the contract: the default is a default, not a fixed
    // behaviour. A host that wants a different step says so.
    const component = await mount(<EmphasisHarness />);
    await page.evaluate(() => {
      document.documentElement.style.setProperty(
        "--hopper-text-muted-text",
        "rgb(0, 255, 0)",
      );
    });
    const muted = await component
      .getByTestId("muted")
      .evaluate((el) => getComputedStyle(el).color);
    expect(muted).toBe("rgb(0, 255, 0)");
  });
});

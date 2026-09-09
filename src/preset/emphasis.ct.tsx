import { test, expect } from "@playwright/experimental-ct-react";
import { EmphasisHarness, EmphasisOnTintedChip } from "./emphasis.harness";

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
        const ratio = contrast(fg, bg);
        // Attached as well as asserted (NEH-974). A margin that erodes without
        // crossing 4.5 is invisible in a pass/fail, and these two percentages
        // are exactly the kind of value that gets nudged.
        await test.info().attach(`contrast — ${id} on ${surface}`, {
          body: `ratio ${ratio.toFixed(2)}:1  (fg ${fg.map(Math.round).join(", ")} on bg ${bg.map(Math.round).join(", ")})`,
          contentType: "text/plain",
        });
        expect(ratio, `${id} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  /**
   * The third surface — a translucent chip over an opaque themed card
   * (NEH-974).
   *
   * ## What this issue's premise got wrong, and what it got right
   *
   * NEH-974 says `textSubtle` at 64% "is measured nowhere". **It is measured
   * here, and has been since this file landed on 2026-08-12** — the two
   * assertions above run over BOTH tiers on `boxBgMain` and `boxBgPrimary`,
   * in Chromium, compositing the `color-mix` alpha onto the surface. The
   * comment in `semantic-variables.ts` that the issue quotes was written a
   * week later and asserted the opposite of the file sitting next to it; that
   * comment is corrected in the same change as this test.
   *
   * What the issue is RIGHT about is the third surface. The two above read the
   * background off ONE element, which is only sound because both harness
   * surfaces are opaque. A translucent chip's own `background-color` says
   * nothing about what shows through it, and this is the case that produced a
   * confidently wrong pass elsewhere in this fleet — a checker read the page
   * while the text sat on a tinted chip over a dark card, and reported a ratio
   * describing a rendering nobody ever saw.
   *
   * So the surface here is **composited** rather than read: walk `<html>` down
   * to the text in paint order, paint each ancestor's `background-color` over
   * a 1x1 canvas starting from the UA white, then paint the text's own colour
   * over the result. The alpha maths is the browser's, and the numbers come out
   * of a real painted pixel. Same technique as
   * `components/StyledFieldHelp.contrast.ct.tsx`, which does this for
   * `textMuted` alone; it is repeated inline rather than imported because
   * Playwright serialises the function into the page, where this module's scope
   * does not exist.
   */
  function measureComposited(el: Element): {
    ratio: number;
    text: string;
    surface: string;
    ratioAgainstPage: number;
    page: string;
  } {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context — the measurement cannot be trusted");

    const paint = (colour: string): [number, number, number] => {
      // A colour the canvas refuses leaves `fillStyle` at its previous value,
      // which would silently measure the wrong thing. Detect it instead.
      const sentinel = "#010203";
      ctx.fillStyle = sentinel;
      ctx.fillStyle = colour;
      if (ctx.fillStyle === sentinel && colour.replace(/\s/g, "") !== sentinel) {
        throw new Error(`the browser could not parse the colour "${colour}"`);
      }
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r ?? 0, g ?? 0, b ?? 0];
    };
    const reset = (rgb: [number, number, number]) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      ctx.fillRect(0, 0, 1, 1);
    };

    const chain: Element[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      chain.push(node);
    }
    chain.reverse();

    reset([255, 255, 255]);
    for (const node of chain) paint(getComputedStyle(node).backgroundColor);
    const s = ctx.getImageData(0, 0, 1, 1).data;
    const surfaceRgb: [number, number, number] = [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0];
    const textRgb = paint(getComputedStyle(el).color);

    // The same text over the PAGE background — the wrong measurement, computed
    // on purpose so the test can prove the right one differs from it.
    reset([255, 255, 255]);
    for (const node of [document.documentElement, document.body]) {
      if (node) paint(getComputedStyle(node).backgroundColor);
    }
    const p = ctx.getImageData(0, 0, 1, 1).data;
    const pageRgb: [number, number, number] = [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
    const textOverPage = paint(getComputedStyle(el).color);

    const lum = ([r, g, b]: [number, number, number]) => {
      const ch = (v: number) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const ratioOf = (
      a: [number, number, number],
      b: [number, number, number],
    ) => {
      const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x);
      return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
    };
    const show = (rgb: [number, number, number]) =>
      `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

    return {
      ratio: ratioOf(textRgb, surfaceRgb),
      text: show(textRgb),
      surface: show(surfaceRgb),
      ratioAgainstPage: ratioOf(textOverPage, pageRgb),
      page: show(pageRgb),
    };
  }

  test("both tiers clear WCAG AA on a translucent chip over a card", async ({
    mount,
  }) => {
    const component = await mount(<EmphasisOnTintedChip />);

    for (const id of ["muted", "subtle"]) {
      const result = await component.getByTestId(id).evaluate(measureComposited);
      // Attached as well as asserted, so an eroding margin is visible in the
      // diff of a run rather than only at the moment it finally fails.
      await test.info().attach(`contrast — ${id} on a tinted chip over a card`, {
        body: [
          `text     ${result.text}`,
          `surface  ${result.surface}   (composited from the ancestor chain)`,
          `ratio    ${result.ratio.toFixed(2)}:1`,
          ``,
          `page bg  ${result.page}`,
          `ratio if measured against the page instead: ${result.ratioAgainstPage.toFixed(2)}:1`,
        ].join("\n"),
        contentType: "text/plain",
      });
      expect(result.ratio, `${id} on a tinted chip over a card`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("the composited surface is not the page background — the walk is doing work", async ({
    mount,
  }) => {
    // The non-vacuity check for the test above. If the walk silently fell back
    // to reading the page, it would still pass while measuring a rendering
    // nobody sees. These two answers must disagree.
    const component = await mount(<EmphasisOnTintedChip />);
    const result = await component.getByTestId("subtle").evaluate(measureComposited);

    expect(result.surface).not.toBe(result.page);
  });

  test("the tiers are translucent, so compositing is required rather than optional", async ({
    mount,
  }) => {
    // Pin the premise the whole measurement rests on. If `textSubtle` ever
    // became an opaque colour, everything above would still be correct but its
    // central difficulty would be gone, and a later reader would reasonably
    // wonder why it is written this way.
    const component = await mount(<EmphasisOnTintedChip />);
    for (const id of ["muted", "subtle"]) {
      const colour = await component
        .getByTestId(id)
        .evaluate((el) => getComputedStyle(el).color);
      expect(colour, id).toMatch(/rgba|color\(|\/\s*0?\.\d+/);
    }
  });

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

import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import {
  HelpOnCard,
  HelpOnPage,
  HelpOnTintedChip,
} from "./StyledFieldHelp.harness";

/**
 * Inline help is smaller than the text around it and painted in a muted colour.
 * That combination is the classic quiet WCAG 1.4.3 failure, so it is measured
 * here rather than asserted by eye.
 *
 * ## It is measured against the surface the text ACTUALLY paints on
 *
 * The tempting shortcut is to read the page background and compare. That is how
 * a confidently wrong pass gets produced: elsewhere in this fleet a success
 * message was checked against the page while it was rendered on a tinted chip
 * over a card, and the reported ratio described a rendering nobody ever saw.
 *
 * So the background here is **composited**, not read:
 *
 * 1. walk from `<html>` down to the text element, in paint order;
 * 2. start from the UA canvas (white) and paint each ancestor's
 *    `background-color` over it with `source-over` alpha compositing;
 * 3. paint the element's own `color` over the result to get the pixel the
 *    reader actually sees.
 *
 * The compositing is done by a real `CanvasRenderingContext2D`, so the alpha
 * maths is the browser's rather than this file's, and the values that come back
 * are read out of an actual painted pixel.
 *
 * ## Three surfaces, and the third is the one that matters
 *
 * `HelpOnTintedChip` puts the help on a `color-mix(... transparent)` chip over
 * an opaque themed card — a translucent layer whose own `background-color`
 * tells you nothing about what is behind it. The last test in this file proves
 * the walk is doing real work by measuring the same text against the page
 * background as well and asserting the two answers disagree. Without that, a
 * composite that quietly fell back to reading the page would pass everything
 * above it.
 *
 * ## What is asserted, and what is only reported
 *
 * The **threshold** is WCAG 1.4.3 AA for normal-size text: 4.5:1. Help text is
 * deliberately below the 18.66px/24px "large text" boundary at the default
 * scale, so the 3:1 allowance does not apply to it and is not used here.
 *
 * The measured ratios are attached to the test report as well as asserted, so
 * a change that erodes the margin without crossing the line is visible in the
 * diff of a run rather than only at the moment it finally fails.
 */

/** WCAG 1.4.3 AA, normal-size text. Not 3:1 — see the note above. */
const AA_NORMAL_TEXT = 4.5;

/**
 * The measurement, in one self-contained function.
 *
 * It has to be self-contained: Playwright serialises the function source and
 * runs it inside the page, so anything it closes over in this module is not
 * there. That is also why the WCAG maths is repeated inline rather than
 * imported.
 */
function measureContrast(el: Element): {
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

  /**
   * Paint one CSS colour over whatever the canvas already holds and read the
   * resulting pixel. The browser does the alpha compositing, so `rgba(...)`,
   * `color-mix(...)` and `color(srgb ...)` all work without this file knowing
   * how any of them serialise.
   */
  const paint = (colour: string): [number, number, number] => {
    // A colour the canvas will refuse leaves `fillStyle` at its previous value,
    // which would silently measure the wrong thing. Detect that rather than
    // trusting it.
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

  // The chain, in paint order: <html> first, the text element last.
  const chain: Element[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    chain.push(node);
  }
  chain.reverse();

  // The UA canvas. Nothing in the harness paints the root, so this is what
  // shows through every transparent layer above it.
  reset([255, 255, 255]);
  for (const node of chain) {
    paint(getComputedStyle(node).backgroundColor);
  }
  const surface = ctx.getImageData(0, 0, 1, 1).data;
  const surfaceRgb: [number, number, number] = [
    surface[0] ?? 0,
    surface[1] ?? 0,
    surface[2] ?? 0,
  ];

  // The text, composited over that surface.
  const textRgb = paint(getComputedStyle(el).color);

  // The same text over the PAGE background instead — the wrong measurement,
  // computed on purpose so a test can prove the right one differs from it.
  reset([255, 255, 255]);
  const pageChain = [document.documentElement, document.body].filter(Boolean);
  for (const node of pageChain) {
    paint(getComputedStyle(node).backgroundColor);
  }
  const pageBg = ctx.getImageData(0, 0, 1, 1).data;
  const pageRgb: [number, number, number] = [
    pageBg[0] ?? 0,
    pageBg[1] ?? 0,
    pageBg[2] ?? 0,
  ];
  const textOverPage = paint(getComputedStyle(el).color);

  // WCAG 2.x relative luminance, sRGB.
  const luminance = ([r, g, b]: [number, number, number]) => {
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    );
  };
  const contrast = (
    a: [number, number, number],
    b: [number, number, number],
  ) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
  };
  const show = (rgb: [number, number, number]) =>
    `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

  return {
    ratio: contrast(textRgb, surfaceRgb),
    text: show(textRgb),
    surface: show(surfaceRgb),
    ratioAgainstPage: contrast(textOverPage, pageRgb),
    page: show(pageRgb),
  };
}

/** Measure the help text, and attach the numbers to the run's report. */
async function measure(help: Locator, label: string) {
  const result = await help.evaluate(measureContrast);
  await test.info().attach(`contrast — ${label}`, {
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
  return result;
}

test.describe("StyledFieldHelp — contrast against the surface it paints on", () => {
  test("clears AA on the page", async ({ mount }) => {
    const component = await mount(<HelpOnPage />);
    const result = await measure(
      component.locator("[data-field-help]"),
      "page",
    );
    expect(result.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  test("clears AA on an opaque themed card", async ({ mount }) => {
    // The muted colour is `currentColor`-relative, so on a dark card it has to
    // de-emphasise a LIGHT text colour. A fixed grey would be right on the page
    // and unreadable here.
    const component = await mount(<HelpOnCard />);
    const result = await measure(
      component.locator("[data-field-help]"),
      "opaque card",
    );
    expect(result.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  test("clears AA on a translucent chip over that card", async ({ mount }) => {
    // Nothing about this surface can be read from one element: the chip's own
    // `background-color` is 40% of a colour over something the chip does not
    // know about.
    const component = await mount(<HelpOnTintedChip />);
    const result = await measure(
      component.locator("[data-field-help]"),
      "tinted chip over card",
    );
    expect(result.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  test("the composited surface is not the page background — the measurement is doing work", async ({
    mount,
  }) => {
    // The non-vacuity check for this whole file. If the walk silently fell back
    // to reading the page, every assertion above would still pass while
    // measuring a rendering nobody sees. Here the two answers must disagree,
    // and disagree by enough that one of them is a pass and the other is not.
    const component = await mount(<HelpOnTintedChip />);
    const result = await measure(
      component.locator("[data-field-help]"),
      "tinted chip — real surface vs page background",
    );

    expect(result.surface).not.toBe(result.page);
    expect(result.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    // Light text on a dark chip, checked against a white page, reads as a
    // failure. That is the wrong answer, and it is what this file exists to
    // avoid reporting.
    expect(result.ratioAgainstPage).toBeLessThan(AA_NORMAL_TEXT);
  });

  test("the text colour is translucent, so compositing is required rather than optional", async ({
    mount,
  }) => {
    // If `textMuted` ever became an opaque colour this file would still be
    // correct but its central difficulty would be gone, and a later reader
    // would reasonably wonder why it is written this way. Pin the premise.
    const component = await mount(<HelpOnCard />);
    const colour = await component
      .locator("[data-field-help]")
      .evaluate((el) => getComputedStyle(el).color);
    expect(colour).toMatch(/rgba|\/\s*0?\.\d+/);
  });
});

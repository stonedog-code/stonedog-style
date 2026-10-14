import { test, expect } from "@playwright/experimental-ct-react";
import { GlassTileHarness } from "./StyledBox.glass.harness";
import { SYSTEM_THEME_SURFACES } from "../preset/__tests__/fixtures/system-theme-surfaces";

/**
 * `box glass` text, measured in a real engine across every SYSTEM theme of
 * the largest consumer, both modes (NEH-1952).
 *
 * The jest tier (`box-glass-surface-pairing.test.ts`) does the arithmetic from
 * the stylesheet. This tier answers what jest cannot: which colour each piece
 * of text inside the tile ACTUALLY computes to once the cascade has run — the
 * heading and subtitle state their own colour through `textRecipe`, and the
 * box's `color` never reaches them — and what surface it lands on after the
 * browser has composited every layer.
 *
 * The method is `StyledFieldHelp.contrast.ct.tsx`'s: walk `<html>` → the text
 * element in paint order, composite each `background-color` on a 1×1 canvas,
 * paint the text colour over it, read the pixels back, compute WCAG 2.x.
 *
 * The theme is applied to `<html>`, not to a wrapper. The `--colors-*`
 * properties are declared on `:root` as `var(--hopper-…)`, and a custom
 * property referencing another is resolved where it is DECLARED — so
 * overriding `--hopper-*` lower down would leave every token at the harness
 * theme's value and this suite would measure one palette eighteen times.
 * The first test below asserts the theme really moved.
 */

const AA_NORMAL_TEXT = 4.5;

/** Self-contained: Playwright serialises this and runs it in the page. */
function measure(el: Element): { ratio: number; text: string; surface: string } {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context — the measurement cannot be trusted");
  const paint = (colour: string): [number, number, number] => {
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
  const chain: Element[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) chain.push(node);
  chain.reverse();
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.fillRect(0, 0, 1, 1);
  let surface: [number, number, number] = [255, 255, 255];
  for (const node of chain) surface = paint(getComputedStyle(node).backgroundColor);
  const text = paint(getComputedStyle(el).color);
  const lum = ([r, g, b]: [number, number, number]) => {
    const ch = (v: number) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const [hi, lo] = [lum(text), lum(surface)].sort((x, y) => y - x);
  const show = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  return { ratio: ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05), text: show(text), surface: show(surface) };
}

const TEXT_IDS = ["title", "kind", "subtitle", "box-text"] as const;

test.describe("box glass — tile text clears AA on every SYSTEM theme", () => {
  test("the theme really moves between theme/modes (the set is not one palette)", async ({
    mount,
    page,
  }) => {
    const seen = new Set<string>();
    for (const tm of SYSTEM_THEME_SURFACES.slice(0, 4)) {
      await page.evaluate((vars) => {
        for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
      }, tm.vars);
      const component = await mount(<GlassTileHarness />);
      seen.add(
        await component.getByTestId("tile").evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      await component.unmount();
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  for (const tm of SYSTEM_THEME_SURFACES) {
    test(`${tm.theme} ${tm.mode}`, async ({ mount, page }) => {
      await page.evaluate((vars) => {
        for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
      }, tm.vars);
      const component = await mount(<GlassTileHarness />);

      // The surface is opaque: its alpha is 1, so the page behind cannot move
      // the ratio. `color-mix(... transparent)` would serialise with an alpha.
      // Checked AFTER the ratios are measured, so a translucent surface still
      // reports its numbers rather than stopping at the first assertion.
      const tileBg = await component
        .getByTestId("tile")
        .evaluate((el) => getComputedStyle(el).backgroundColor);

      const report: string[] = [`tile bg ${tileBg}`];
      const failures: string[] = [];
      for (const id of TEXT_IDS) {
        const r = await component.getByTestId(id).evaluate(measure);
        report.push(`${id.padEnd(9)} ${r.text} on ${r.surface} = ${r.ratio.toFixed(2)}:1`);
        if (r.ratio < AA_NORMAL_TEXT) failures.push(`${id} ${r.ratio.toFixed(2)}:1`);
      }
      await test.info().attach(`contrast — ${tm.theme} ${tm.mode}`, {
        body: report.join("\n"),
        contentType: "text/plain",
      });
      expect({ opaque: /^rgb\(/.test(tileBg), failures }).toEqual({ opaque: true, failures: [] });
    });
  }
});

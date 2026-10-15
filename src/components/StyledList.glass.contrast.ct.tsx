import { test, expect } from "@playwright/experimental-ct-react";
import { GlassListTileHarness } from "./StyledList.glass.harness";
import { SYSTEM_THEME_SURFACES } from "../preset/__tests__/fixtures/system-theme-surfaces";

/**
 * `list glass` rows, measured in a real engine on a glass tile across every
 * SYSTEM theme of the largest consumer, both modes (NEH-2068).
 *
 * The jest tier (`list-glass-surface-pairing.test.ts`) does the arithmetic
 * from the stylesheet. This tier composites every layer the browser actually
 * paints between `<html>` and the row — the page, the opaque glass tile, and
 * whatever the list root lays over it — and scores the row's computed colour
 * against that. Before NEH-2068 the root laid 5% white over the tile and four
 * theme/modes measured 4.16–4.36:1.
 *
 * The method is `StyledBox.glass.contrast.ct.tsx`'s, copied rather than
 * imported because Playwright serialises `measure` into the page and it must
 * be self-contained. The theme goes on `<html>` for the reason that spec
 * gives: `--colors-*` resolve where they are declared, on `:root`.
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

const ROW_IDS = ["row-text", "row-bare"] as const;

test.describe("list glass — rows on a glass tile clear AA on every SYSTEM theme", () => {
  test("the list root paints nothing and blurs nothing", async ({ mount }) => {
    const component = await mount(<GlassListTileHarness />);
    const root = await component.getByTestId("list").evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, image: s.backgroundImage, backdrop: s.backdropFilter };
    });
    expect(root).toEqual({ bg: "rgba(0, 0, 0, 0)", image: "none", backdrop: "none" });
  });

  test("the theme really moves between theme/modes (the set is not one palette)", async ({
    mount,
    page,
  }) => {
    const seen = new Set<string>();
    for (const tm of SYSTEM_THEME_SURFACES.slice(0, 4)) {
      await page.evaluate((vars) => {
        for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
      }, tm.vars);
      const component = await mount(<GlassListTileHarness />);
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
      const component = await mount(<GlassListTileHarness />);

      const report: string[] = [];
      const failures: string[] = [];
      for (const id of ROW_IDS) {
        const r = await component.getByTestId(id).evaluate(measure);
        report.push(`${id.padEnd(8)} ${r.text} on ${r.surface} = ${r.ratio.toFixed(2)}:1`);
        if (r.ratio < AA_NORMAL_TEXT) failures.push(`${id} ${r.ratio.toFixed(2)}:1`);
      }
      await test.info().attach(`contrast — ${tm.theme} ${tm.mode}`, {
        body: report.join("\n"),
        contentType: "text/plain",
      });
      expect({ examined: report.length, failures }).toEqual({ examined: ROW_IDS.length, failures: [] });
    });
  }
});

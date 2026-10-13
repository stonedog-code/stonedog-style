/**
 * The chart tooltip is a solid, readable card on every theme (NEH-2042).
 *
 * It shipped see-through: its background, border colour and text colour were
 * Panda style props holding values computed in another module, which Panda
 * cannot extract — so the classes reached the DOM with no rule behind them.
 * Only a real browser can see that, because jsdom drops a `var()` value and
 * every assertion against it passes (NEH-406).
 *
 * What is asserted, and why each:
 *
 * - the base layer computes to an OPAQUE colour — the property that went
 *   missing, measured as the browser resolved it;
 * - the painted surface (base + themed layer, composited by a canvas) differs
 *   from both stripes, so the plot cannot show through;
 * - text clears 4.5:1 against that composited surface, not against the page;
 * - the border is a real colour at text strength, not the grid's.
 */

import { test, expect } from "@playwright/experimental-ct-react";
import { DarkTranslucentTooltip, LightMinimalTooltip } from "./ChartTooltip.harness";

const AA_NORMAL_TEXT = 4.5;

/** Self-contained: Playwright serialises it into the page. */
function paintOf(el: Element) {
  const cs = getComputedStyle(el);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  const paint = (colour: string): [number, number, number] => {
    const sentinel = "#010203";
    ctx.fillStyle = sentinel;
    ctx.fillStyle = colour;
    if (ctx.fillStyle === sentinel) throw new Error(`unparseable colour "${colour}"`);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
  };

  const alphaOf = (colour: string) => {
    const m = colour.match(/rgba?\(([^)]+)\)/);
    if (!m) return 0;
    const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
    return parts.length === 4 ? Number(parts[3]) : 1;
  };

  const lum = ([r, g, b]: [number, number, number]) => {
    const ch = (v: number) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const ratio = (a: [number, number, number], b: [number, number, number]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
  };

  // Over BOTH stripes: an opaque card paints the same pixel over either.
  const surfaceOver = (stripe: string) => {
    ctx.clearRect(0, 0, 1, 1);
    paint(stripe);
    paint(cs.backgroundColor);
    const layer = cs.backgroundImage.match(/linear-gradient\((rgba?\([^)]*\))/)?.[1];
    return layer ? paint(layer) : paint("rgba(0, 0, 0, 0)");
  };
  const overWhite = surfaceOver("rgb(255, 255, 255)");
  const overBlack = surfaceOver("rgb(0, 0, 0)");
  ctx.clearRect(0, 0, 1, 1);
  paint("rgb(0, 0, 0)");
  paint(cs.backgroundColor);
  const layer = cs.backgroundImage.match(/linear-gradient\((rgba?\([^)]*\))/)?.[1];
  if (layer) paint(layer);
  const text = paint(cs.color);

  return {
    baseColour: cs.backgroundColor,
    baseAlpha: alphaOf(cs.backgroundColor),
    overWhite,
    overBlack,
    textRatio: ratio(text, overBlack),
    borderStyle: cs.borderTopStyle,
    borderWidth: cs.borderTopWidth,
    borderColour: cs.borderTopColor,
    textColour: cs.color,
  };
}

type Mount = Parameters<Parameters<typeof test>[2]>[0]["mount"];

// The CT bundler finds mounted components by the JSX it sees at the call, so
// each fixture is named literally here rather than passed through a variable.
const FIXTURES: [string, (mount: Mount) => ReturnType<Mount>][] = [
  ["dark theme with a translucent surface", (mount) => mount(<DarkTranslucentTooltip />)],
  ["light host that defines no tooltip tokens", (mount) => mount(<LightMinimalTooltip />)],
];

for (const [name, mountFixture] of FIXTURES) {
  test.describe(name, () => {
    test("the card is opaque, so the plot cannot show through", async ({ mount }) => {
      const c = await mountFixture(mount);
      const p = await c.getByTestId("chart-tooltip").evaluate(paintOf);
      expect(p.baseAlpha, `base ${p.baseColour}`).toBe(1);
      expect(p.overWhite).toEqual(p.overBlack);
    });

    test("its text clears AA against the surface it actually paints", async ({ mount }) => {
      const c = await mountFixture(mount);
      const tip = c.getByTestId("chart-tooltip");
      const p = await tip.evaluate(paintOf);
      expect(p.textRatio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      // Every line inherits the card's text colour — no dimmed heading.
      for (const line of await tip.locator("span").filter({ hasText: /\S/ }).all()) {
        const { colour, opacity } = await line.evaluate((el) => ({
          colour: getComputedStyle(el).color,
          opacity: getComputedStyle(el).opacity,
        }));
        expect(colour).toBe(p.textColour);
        expect(opacity).toBe("1");
      }
    });

    test("its border is a solid 1px line in the text colour", async ({ mount }) => {
      const c = await mountFixture(mount);
      const p = await c.getByTestId("chart-tooltip").evaluate(paintOf);
      expect(p.borderStyle).toBe("solid");
      expect(p.borderWidth).toBe("1px");
      expect(p.borderColour).toBe(p.textColour);
    });
  });
}

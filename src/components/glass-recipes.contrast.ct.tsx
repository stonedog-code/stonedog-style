import { test, expect } from "@playwright/experimental-ct-react";
import { GlassRecipeHarness } from "./glass-recipes.harness";
import { SYSTEM_THEME_SURFACES } from "../preset/__tests__/fixtures/system-theme-surfaces";

/**
 * The four remaining glass variants — `dl-list`, `form`, `stack`,
 * `input-radio` — measured in a real engine across every SYSTEM theme of the
 * largest consumer, both modes, in both places a consumer puts them
 * (NEH-2075).
 *
 * NEH-2068 removed the glass LIST root's 5% white tint because four theme/modes
 * fell below AA on a glass tile, and left these four as a hypothesis: each
 * painted `rgba(255, 255, 255, 0.1)` behind a `blur(10px)` backdrop and pinned
 * `color: textPrimary`. Measured here before anything was changed:
 *
 * | placement | what fell below 4.5:1 |
 * | -- | -- |
 * | on a glass tile (opaque `boxBgPrimary`) | 10% white under `textPrimary`: **4 of 18** theme/modes, identically on all four recipes — 3.78:1 (Autumn Magic light, Scandinavian Farm light), 3.79:1 (Midnight dark), 3.95:1 (Scandinavian Farm dark) |
 * | on the page (`boxBgMain`) | the pinned `textPrimary` is the partner of a surface the page is not: **4 of 18** on the bare, inheriting span, all four recipes — 1.04:1 (Autumn Magic light, Scandinavian Farm light: near-white on near-white) and 1.18:1 (Ocean Breeze dark, Zen dark) |
 *
 * Two defects, one per placement, and one fix for both: the variant paints no
 * surface of its own and pins no text colour, so whatever holds it — tile or
 * page — supplies the pairing its host already validated. That is what `list
 * glass` and `box matte` do, for the same reason. The `form` row was first
 * read as "no failures" because its tests had TIMED OUT on a wrong mount —
 * a timeout is not a pass, and the parser now counts it as one.
 *
 * The jest tier (`glass-recipes-surface-pairing.test.ts`) does the arithmetic
 * from the stylesheet. This tier composites every layer the browser actually
 * paints between `<html>` and the text and scores the text's computed colour
 * against that.
 *
 * The method is `StyledList.glass.contrast.ct.tsx`'s, copied rather than
 * imported because Playwright serialises `measure` into the page and it must
 * be self-contained. The theme goes on `<html>` for the reason that spec
 * gives: `--colors-*` resolve where they are declared, on `:root`.
 */

const AA_NORMAL_TEXT = 4.5;

/** The four recipes NEH-2068 left for measurement, by their recipe className. */
const GLASS_RECIPES = ["dl-list", "form", "stack", "input-radio"] as const;
type GlassRecipe = (typeof GLASS_RECIPES)[number];

/** Where a consumer puts one: in a glass tile, or straight on the page. */
const PLACEMENTS = ["tile", "page"] as const;
type Placement = (typeof PLACEMENTS)[number];

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

/**
 * What is measured where. On the tile both texts: the `StyledText` (which
 * states `textPrimary`, the tile's own partner) and the bare span (which
 * inherits it). On the page only the bare span — a `StyledText` straight on
 * the page measures `StyledText`'s default against `boxBgMain`, which is the
 * same number with or without this variant, and is the reason `box glass`
 * paints `boxBgPrimary` (NEH-1952). The variant's own contribution on the
 * page is what the bare span sees: nothing painted, the page's ink inherited.
 */
const TEXT_IDS: Record<Placement, readonly string[]> = {
  tile: ["t-text", "t-bare"],
  page: ["t-bare"],
};
const EXAMINED_PER_THEME = Object.values(TEXT_IDS).reduce((n, ids) => n + ids.length, 0);

/** The element that carries the recipe's variant class, per recipe. */
function surfaceOf(recipe: GlassRecipe): string {
  // The radio recipe is a slot recipe: the glass paint is on each ITEM, and
  // `data-testid="surface"` lands on the group root. The CHECKED item is the
  // one to read, deliberately: the base recipe used to lay a 20% blue over it
  // with no paired ink, and the measurement that found it (4.23:1 on a Zen
  // dark tile) was taken on this item.
  return recipe === "input-radio" ? "label[data-checked]" : '[data-testid="surface"]';
}

for (const recipe of GLASS_RECIPES) {
  test.describe(`${recipe} glass — text clears AA wherever the variant sits`, () => {
    test("the variant paints nothing, blurs nothing and pins no text colour", async ({
      mount,
      page,
    }) => {
      // A theme whose page text and primary text DIFFER, so "inherits" is a
      // real question. On the harness theme the two happen to be the same
      // colour, and a pinned `textPrimary` would read as inherited.
      const distinct = SYSTEM_THEME_SURFACES.find(
        (tm) => tm.vars["--hopper-box-main-text"] !== tm.vars["--hopper-box-primary-text"],
      )!;
      await page.evaluate((vars) => {
        for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
      }, distinct.vars);
      const component = await mount(<GlassRecipeHarness recipe={recipe} placement="page" />);
      const read = await component.locator(surfaceOf(recipe)).first().evaluate((el) => {
        const s = getComputedStyle(el);
        const parent = getComputedStyle(el.parentElement!);
        return {
          bg: s.backgroundColor,
          image: s.backgroundImage,
          backdrop: s.backdropFilter,
          // Inheriting: the surface's colour is its parent's, not a token of
          // its own. On the harness page that parent is `textMain`.
          inherits: s.color === parent.color,
        };
      });
      expect(read).toEqual({ bg: "rgba(0, 0, 0, 0)", image: "none", backdrop: "none", inherits: true });
    });

    for (const tm of SYSTEM_THEME_SURFACES) {
      test(`${tm.theme} ${tm.mode}`, async ({ mount, page }) => {
        await page.evaluate((vars) => {
          for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
        }, tm.vars);

        const report: string[] = [];
        const failures: string[] = [];
        for (const placement of PLACEMENTS) {
          const component = await mount(<GlassRecipeHarness recipe={recipe} placement={placement} />);
          for (const id of TEXT_IDS[placement]) {
            const r = await component.getByTestId(id).evaluate(measure);
            report.push(`${placement.padEnd(5)} ${id.padEnd(7)} ${r.text} on ${r.surface} = ${r.ratio.toFixed(2)}:1`);
            if (r.ratio < AA_NORMAL_TEXT) failures.push(`${placement} ${id} ${r.ratio.toFixed(2)}:1`);
          }
          await component.unmount();
        }
        await test.info().attach(`contrast — ${recipe} ${tm.theme} ${tm.mode}`, {
          body: report.join("\n"),
          contentType: "text/plain",
        });
        expect({ examined: report.length, failures }).toEqual({
          examined: EXAMINED_PER_THEME,
          failures: [],
        });
      });
    }
  });
}

test("the theme really moves between theme/modes (the set is not one palette)", async ({
  mount,
  page,
}) => {
  const seen = new Set<string>();
  for (const tm of SYSTEM_THEME_SURFACES.slice(0, 4)) {
    await page.evaluate((vars) => {
      for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
    }, tm.vars);
    const component = await mount(<GlassRecipeHarness recipe="stack" placement="tile" />);
    seen.add(await component.getByTestId("tile").evaluate((el) => getComputedStyle(el).backgroundColor));
    await component.unmount();
  }
  expect(seen.size).toBeGreaterThan(1);
});

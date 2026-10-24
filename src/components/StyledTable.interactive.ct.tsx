import { test, expect } from "@playwright/experimental-ct-react";
import { InteractiveTableHarness } from "./StyledTable.interactive.harness";
import { SYSTEM_THEME_SURFACES } from "../preset/__tests__/fixtures/system-theme-surfaces";

/**
 * `StyledTable.Row onActivate` — the interactive row, in a real engine
 * (NEH-2081).
 *
 * The jest tier proves the wiring: tab order, Enter and Space, a nested
 * control keeping its own click. This tier answers what jsdom cannot:
 *
 * - the hovered and the focused row paint a surface, and the cell text on it
 *   clears 4.5:1 — measured across every SYSTEM theme of the largest
 *   consumer, both modes, so a dark host theme is covered as well as a light
 *   one;
 * - the row is at least 48px tall with one line of text, at every viewport;
 * - a plain row paints nothing on hover, and is not in the tab order.
 *
 * The contrast method is `StyledFieldHelp.contrast.ct.tsx`'s, copied rather
 * than imported because Playwright serialises `measure` into the page and it
 * must be self-contained. The theme goes on `<html>`: `--colors-*` resolve
 * where they are declared, on `:root`.
 */

const AA_NORMAL_TEXT = 4.5;
const TAP_TARGET_FLOOR = 48;

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

test.describe("StyledTable.Row onActivate", () => {
  test("an interactive row is at least 48px tall; a plain row is left alone", async ({ mount }) => {
    const component = await mount(<InteractiveTableHarness />);
    const interactive = await component.getByTestId("row-ada").boundingBox();
    const plain = await component.getByTestId("row-plain").boundingBox();
    expect(interactive?.height ?? 0).toBeGreaterThanOrEqual(TAP_TARGET_FLOOR);
    // The plain row is the control: one line of 14px text in 12px cells is
    // well under 48, so the floor is what the interactive row adds.
    expect(plain?.height ?? 0).toBeLessThan(TAP_TARGET_FLOOR);
  });

  test("a plain row paints nothing on hover and is not in the tab order", async ({ mount }) => {
    const component = await mount(<InteractiveTableHarness />);
    const plain = component.getByTestId("row-plain");
    await plain.hover();
    const read = await plain.evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      tabindex: el.getAttribute("tabindex"),
      cursor: getComputedStyle(el).cursor,
    }));
    expect(read).toEqual({ bg: "rgba(0, 0, 0, 0)", tabindex: null, cursor: "auto" });
  });

  test("hover paints a surface the plain row does not", async ({ mount }) => {
    const component = await mount(<InteractiveTableHarness />);
    const row = component.getByTestId("row-ada");
    const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    await row.hover();
    const after = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(before).toBe("rgba(0, 0, 0, 0)");
    expect(after).not.toBe("rgba(0, 0, 0, 0)");
    await expect(row).toHaveCSS("cursor", "pointer");
  });

  test("Tab reaches the row, Enter and Space activate it, a nested control keeps its click", async ({
    mount,
    page,
  }) => {
    const component = await mount(<InteractiveTableHarness />);
    // The mounted root IS the page div; click its corner to park focus before Tab.
      await component.click({ position: { x: 2, y: 2 } });
    await page.keyboard.press("Tab");
    await expect(component.getByTestId("row-ada")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press(" ");
    await expect(component.getByTestId("activated")).toHaveText("ada,ada");

    await page.keyboard.press("Tab");
    await expect(component.getByTestId("row-grace")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(component.getByTestId("nested-button")).toBeFocused();
    await page.keyboard.press("Enter");
    // The button's own activation, and NOT the row's.
    await expect(component.getByTestId("activated")).toHaveText("ada,ada,button");

    await component.getByTestId("nested-button").click();
    await expect(component.getByTestId("activated")).toHaveText("ada,ada,button,button");
    await component.getByTestId("cell-grace").click();
    await expect(component.getByTestId("activated")).toHaveText("ada,ada,button,button,grace");
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
      const component = await mount(<InteractiveTableHarness />);
      const row = component.getByTestId("row-ada");
      await row.hover();
      seen.add(await row.evaluate((el) => getComputedStyle(el).backgroundColor));
      await component.unmount();
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  for (const tm of SYSTEM_THEME_SURFACES) {
    test(`${tm.theme} ${tm.mode}: hovered and focused cell text clears AA`, async ({ mount, page }) => {
      await page.evaluate((vars) => {
        for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
      }, tm.vars);
      const component = await mount(<InteractiveTableHarness />);
      const row = component.getByTestId("row-ada");
      const cell = component.getByTestId("cell-ada");

      const report: string[] = [];
      const failures: string[] = [];

      await row.hover();
      const hovered = await cell.evaluate(measure);
      report.push(`hover ${hovered.text} on ${hovered.surface} = ${hovered.ratio.toFixed(2)}:1`);
      if (hovered.ratio < AA_NORMAL_TEXT) failures.push(`hover ${hovered.ratio.toFixed(2)}:1`);

      // Move the pointer away, then reach the row by keyboard so :focus-visible
      // applies (a programmatic focus() after a click may not show it).
      await page.mouse.move(0, 0);
      // The mounted root IS the page div; click its corner to park focus before Tab.
      await component.click({ position: { x: 2, y: 2 } });
      await page.keyboard.press("Tab");
      await expect(row).toBeFocused();
      const focused = await cell.evaluate(measure);
      report.push(`focus ${focused.text} on ${focused.surface} = ${focused.ratio.toFixed(2)}:1`);
      if (focused.ratio < AA_NORMAL_TEXT) failures.push(`focus ${focused.ratio.toFixed(2)}:1`);
      // And the focused row really painted: the surface is not the page's.
      const painted = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
      if (painted === "rgba(0, 0, 0, 0)") failures.push("focus painted no surface");

      await test.info().attach(`contrast — ${tm.theme} ${tm.mode}`, {
        body: report.join("\n"),
        contentType: "text/plain",
      });
      expect({ examined: report.length, failures }).toEqual({ examined: 2, failures: [] });
    });
  }
});

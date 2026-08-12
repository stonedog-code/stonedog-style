import { test, expect } from "@playwright/experimental-ct-react";
import { AlertHarness } from "./StyledAlert.harness";

/**
 * `StyledAlert` in a real browser (NEH-421).
 *
 * The jsdom tier owns roles and wiring. Everything here is a claim jsdom cannot
 * settle: the chips resolve through custom properties AND through `color-mix`,
 * neither of which jsdom evaluates, so a contrast assertion there would pass
 * against any value at all.
 *
 * What is being proven is the reason the status tokens are allowed a default:
 * that ONE default reads correctly on a dark surface and on a light one. A
 * fixed `#fee2e2` chip would pass on light and be a glaring slab on dark, and
 * nothing short of measuring both would catch it.
 */

const STATUSES = ["info", "success", "warning", "error"] as const;

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
 * `color-mix` computes to `color(srgb 0.1 0.2 0.3 / 0.14)` — a different
 * function from `rgb()`, and 0-1 channels. Compositing is not optional here:
 * every status chip IS translucent by design, so its raw channels describe a
 * colour nobody can see. What a reader perceives is the blend.
 */
function parse(value: string, bg?: number[]): number[] {
  const nums = value.match(/[\d.]+/g)!.map(Number);
  const scale = value.startsWith("color(") ? 255 : 1;
  const [r, g, b, a = 1] = nums;
  const rgb = [r! * scale, g! * scale, b! * scale];
  if (a === 1 || !bg) return rgb;
  return [0, 1, 2].map((i) => a * rgb[i]! + (1 - a) * bg[i]!);
}

// Both ends of the range a host might place an alert on. The harness theme
// defines none of the status properties, so these measure the DEFAULTS — what a
// consumer gets for configuring nothing, which is the whole point of them
// having one.
const SURFACES = [
  { name: "dark", surface: "#0f172a", text: "#f8fafc" },
  { name: "light", surface: "#ffffff", text: "#0f172a" },
] as const;

/**
 * Which statuses this PACKAGE is answerable for.
 *
 * `info` paints from `boxInfo` and `borderBgAccent` — tokens the HOST supplies,
 * with no fallback, like the rest of the contract. Whether those clear contrast
 * is the theme's business, not this component's, and asserting it here would be
 * measuring the test harness's palette rather than anything shipped. (It does
 * not, as it happens: the harness's accent border sits at 1.72:1 on its own
 * surface. That is a finding about the harness theme, not about StyledAlert.)
 *
 * The other three carry package defaults, so the package owns their numbers.
 */
const PACKAGE_DEFAULTED = ["success", "warning", "error"] as const;

/**
 * Text legibility is measured on the harness's OWN surface only, and that is a
 * real constraint rather than a convenience.
 *
 * `textSuccess` / `textWarning` / `textError` are host-supplied and
 * theme-specific: the harness theme is dark, so its success green is a LIGHT
 * green. Placing that on a white page pairs a dark-theme foreground with a
 * light-theme background — a combination no real host produces, since a light
 * theme would define dark status text. Measuring it produced three failures
 * that said nothing about this component.
 *
 * What genuinely has to work on both surfaces is the CHIP, because that is what
 * the package defaults, and that is what the block below tests.
 */
test.describe("on the harness's own (dark) theme", () => {
  for (const status of STATUSES) {
    test(`${status} keeps its message legible`, async ({ mount }) => {
      const component = await mount(<AlertHarness status={status} />);
      const outer = parse(
        await component.evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      const alert = component.locator('[role="alert"], [role="status"]');
      const chip = parse(
        await alert.evaluate((el) => getComputedStyle(el).backgroundColor),
        outer,
      );
      const fg = parse(
        await alert.evaluate((el) => getComputedStyle(el).color),
        chip,
      );
      expect(contrast(fg, chip), `${status} text on its chip`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

for (const { name, surface, text } of SURFACES) {
  test.describe(`the chip, on a ${name} surface`, () => {
    for (const status of STATUSES) {
      test(`${status} is distinguishable from the page`, async ({ mount }) => {
        // A tint indistinguishable from the page is not a container. This is the
        // failure mode of a translucent default, and a contrast test on the TEXT
        // would pass straight over it.
        const component = await mount(
          <AlertHarness status={status} surface={surface} text={text} />,
        );
        const outer = parse(
          await component.evaluate((el) => getComputedStyle(el).backgroundColor),
        );
        const chip = parse(
          await component
            .locator('[role="alert"], [role="status"]')
            .evaluate((el) => getComputedStyle(el).backgroundColor),
          outer,
        );
        expect(chip).not.toEqual(outer);
      });
    }

    for (const status of PACKAGE_DEFAULTED) {
      test(`${status}'s border clears 3:1 against the page`, async ({ mount }) => {
        // WCAG 1.4.11 for a non-text boundary. The border is what makes the
        // alert read as a container, since the fill is deliberately subtle.
        //
        // This is what caught the first attempt: translucent borders at 45%
        // measured 1.72–2.05:1 on a dark surface. A saturated mid-tone hue
        // clears 3:1 at both ends, which is why the defaults are solid.
        const component = await mount(
          <AlertHarness status={status} surface={surface} text={text} />,
        );
        const outer = parse(
          await component.evaluate((el) => getComputedStyle(el).backgroundColor),
        );
        const border = parse(
          await component
            .locator('[role="alert"], [role="status"]')
            .evaluate((el) => getComputedStyle(el).borderTopColor),
          outer,
        );
        expect(contrast(border, outer), `${status} border on ${name}`)
          .toBeGreaterThanOrEqual(3);
      });
    }
  });
}

test.describe("layout", () => {
  test("a long message wraps beside the glyph rather than under it", async ({
    mount,
  }) => {
    // The indicator is a flex item with flex-shrink: 0; the content must take
    // the rest. If the glyph column collapses, text reflows under it and the
    // alert reads as two paragraphs.
    const component = await mount(
      <AlertHarness
        status="error"
        message={"A very long failure message ".repeat(12)}
      />,
    );
    const alert = component.locator('[role="alert"]');
    const glyph = alert.locator('[aria-hidden="true"]');
    const glyphBox = await glyph.boundingBox();
    const contentBox = await alert.locator("div").first().boundingBox();

    expect(contentBox!.x).toBeGreaterThan(glyphBox!.x + glyphBox!.width - 1);
  });

  test("does not overflow its container at the narrowest viewport", async ({
    mount,
    page,
  }) => {
    const component = await mount(
      <AlertHarness status="warning" message={"Unbroken".repeat(20)} />,
    );
    const box = await component.locator('[role="alert"]').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});

import { test, expect } from "@playwright/experimental-ct-react";
import { ListHarness } from "./StyledList.harness";

/**
 * A surface that paints a background must also state its text colour.
 *
 * `listRecipe`'s `solid` variant set `bg: boxBgPrimary` and no `color`, so the
 * rows inherited whatever the page had. On a dark `boxBgPrimary` that is
 * dark-on-dark — the NEH-278 defect class, and completely unreadable.
 *
 * **No existing test could have caught it, including the browser tier**, because
 * every assertion so far asked about the properties a recipe *sets*. This one
 * asks about the property it *fails* to set, which only has an observable value
 * once a real engine has resolved inheritance. It was found by screenshotting
 * the component and looking, which is worth remembering: the tests were all
 * green and the component was illegible.
 *
 * `outline` and `none` are deliberately absent below — they paint no background,
 * so inheriting is correct there and pinning a colour would be the bug.
 */

const PAINTED_VARIANTS = ["solid"] as const;

/**
 * **`matte` moved out of the painted set on purpose (NEH-1266) — read this
 * before moving it back.**
 *
 * It used to be here, and it passed, because it stated `color: "white"`. The
 * comment justifying that literal said the variant sat on "a FIXED dark
 * gradient". It never did: `bgGradient: "linear(to-b, gray.800, gray.900)"` is
 * Chakra v2 syntax, Panda emitted it verbatim as
 * `background-image: linear(to-b, …)`, `linear()` is a CSS *easing* function
 * rather than an `<image>`, and every engine discarded the declaration at
 * parse time.
 *
 * So `matte` painted NO surface and pinned its rows to white over whatever was
 * behind them — white-on-near-white on any light page. This test asserted the
 * white was there, which is the shape this repo already warns about: a passing
 * test can pin a defect in place, because review cannot remove the defect
 * without going red.
 *
 * Both are gone now. `matte` owns no surface, so inheriting is correct by
 * construction — the colour it inherits is the one its host already pairs with
 * the surface underneath, exactly the argument `outline` and `none` are absent
 * under. The assertion below is the positive form of that, so the fact is
 * still covered rather than merely dropped.
 *
 * Giving `matte` a real token surface instead — `boxBgAccent` with `textAccent`
 * is the one `box`-family contract pair no other list variant uses — is a
 * defensible alternative and a visible design change. If that ever lands, this
 * block fails and asks for the variant to be moved back up.
 */
const UNPAINTED_VARIANTS = ["matte"] as const;

test.describe("StyledList — text is paired with its surface", () => {
  for (const variant of UNPAINTED_VARIANTS) {
    test(`${variant} paints no surface, so it inherits rather than pinning a colour`, async ({
      mount,
    }) => {
      const component = await mount(<ListHarness variant={variant} />);

      const { color, background, image } = await component
        .locator("li")
        .first()
        .evaluate((el) => {
          const root = el.parentElement!;
          const rootStyle = getComputedStyle(root);
          return {
            color: getComputedStyle(el).color,
            background: rootStyle.backgroundColor,
            image: rootStyle.backgroundImage,
          };
        });

      // Nothing is painted — not a colour, and not the dead gradient either.
      expect(background).toBe("rgba(0, 0, 0, 0)");
      expect(image).toBe("none");
      // And the row takes the harness page's own black, which is the whole
      // point: on an unpainted surface the host's pairing is the right one.
      expect(color).toBe("rgb(0, 0, 0)");
    });
  }

  for (const variant of PAINTED_VARIANTS) {
    test(`${variant} states a text colour rather than inheriting`, async ({
      mount,
    }) => {
      const component = await mount(<ListHarness variant={variant} />);

      const { color, background } = await component
        .locator("li")
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el);
          // The row is transparent; the surface is painted by the root.
          const root = el.parentElement!;
          return {
            color: s.color,
            background: getComputedStyle(root).backgroundColor,
          };
        });

      // The harness page is black-on-white. An inherited colour therefore comes
      // out as pure black, which is exactly the failure: it means the recipe
      // said nothing and the page decided.
      expect(color).not.toBe("rgb(0, 0, 0)");
      expect(color).not.toBe(background);
    });
  }

  test("the text is legible against the surface it sits on", async ({
    mount,
  }) => {
    // Not a full WCAG ratio — the harness theme is not a product theme, so an
    // exact threshold would pin this suite to one palette. This asserts the
    // thing that actually went wrong: text and surface at the same end of the
    // scale, which is what dark-on-dark and light-on-light both look like.
    const component = await mount(<ListHarness variant="solid" />);

    const luminances = await component
      .locator("li")
      .first()
      .evaluate((el) => {
        const parse = (v: string) =>
          (v.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
        // Rec. 709 relative luminance, close enough to rank light vs dark.
        const lum = (rgb: number[]) =>
          (0.2126 * (rgb[0] ?? 0) +
            0.7152 * (rgb[1] ?? 0) +
            0.0722 * (rgb[2] ?? 0)) /
          255;
        return {
          text: lum(parse(getComputedStyle(el).color)),
          surface: lum(
            parse(getComputedStyle(el.parentElement!).backgroundColor),
          ),
        };
      });

    // Light text on a dark surface, or dark on light — but not both the same.
    expect(Math.abs(luminances.text - luminances.surface)).toBeGreaterThan(0.3);
  });
});

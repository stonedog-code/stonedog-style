import { test, expect } from "@playwright/experimental-ct-react";
import StyledText from "./StyledText";
import { StonedogStyleProvider } from "../config/style-config";

/**
 * Block promotion, in a real browser (NEH-490).
 *
 * These exist because the jsdom tier cannot answer the question that matters.
 * It asserts the style attribute — but jsdom has no layout engine, so it
 * reports `margin-bottom: 8px` on an inline box just as happily as on a block
 * one, while the browser silently discards the former. A jsdom-only guard
 * would have passed against the original defect.
 *
 * "It asserts the style attribute, which is fine as far as it goes" is what
 * this header used to say, and it is worth correcting rather than deleting:
 * for a `var()` value jsdom does not assert it at all. The declaration is
 * rejected against the property grammar and dropped, leaving no attribute to
 * read, so the matcher passes on any expectation (NEH-406). Trusting that
 * sentence is how a font-size assertion stayed green while stating a value
 * that had not been true since the scale moved.
 *
 * The failure being pinned shipped in two products: two paragraphs rendering
 * as one welded run, because a `<span>` ignores vertical margins and JSX drops
 * the whitespace between sibling elements.
 */

test.describe("vertical spacing on StyledText", () => {
  test("a vertical margin actually separates two paragraphs", async ({ mount }) => {
    const component = await mount(
      // A BARE div, deliberately: the defect only appears in ordinary inline
      // flow, so that is what has to be under it.
      //
      // This comment used to justify the bare div by saying "StyledBox lays its
      // children out in a flex column, which blockifies them". That was FALSE
      // and is worth correcting rather than deleting, because believing it is
      // what let the same symptom ship a third time (NEH-1473). Without
      // `noWrap`, StyledBox put children four levels down inside a plain block
      // div, so a caller's flex props never reached them — see
      // StyledBox.ct.tsx. Fixed now, but the bare div is still the right
      // control here: it is the case with no layout at all.
      <div>
        <StyledText marginBottom="4" data-testid="first">
          No dates to show yet
        </StyledText>
        <StyledText data-testid="second">This does not mean nothing is due.</StyledText>
      </div>,
    );

    const first = component.getByTestId("first");
    const second = component.getByTestId("second");

    const firstBox = await first.boundingBox();
    const secondBox = await second.boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    // THE ASSERTION. Welded together they share a line, so the second box
    // starts at the same y and to the right. Separated, it starts below the
    // first — and below it by at least the margin.
    expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height - 1);
    expect(secondBox!.y - (firstBox!.y + firstBox!.height)).toBeGreaterThanOrEqual(4);
  });

  test("without a vertical margin they stay on one line, as inline text should", async ({
    mount,
  }) => {
    const component = await mount(
      <div>
        <StyledText data-testid="a">one </StyledText>
        <StyledText data-testid="b">two</StyledText>
      </div>,
    );

    const a = await component.getByTestId("a").boundingBox();
    const b = await component.getByTestId("b").boundingBox();

    // Inline flow is the DEFAULT and must stay that way — text inside a
    // sentence is the commonest use of this component. If this ever fails, the
    // promotion has become too eager and every inline usage is now a line
    // break the author did not ask for.
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  });

  test("a horizontal margin does not force a line break", async ({ mount }) => {
    const component = await mount(
      <div>
        <StyledText data-testid="a">one</StyledText>
        <StyledText marginLeft="4" data-testid="b">
          two
        </StyledText>
      </div>,
    );

    const a = await component.getByTestId("a").boundingBox();
    const b = await component.getByTestId("b").boundingBox();

    // `margin-left` works on an inline box, so it must not promote. Getting
    // this wrong turns every spaced-out inline label into its own line.
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width);
  });
});

/**
 * The rendered size, in the only tier that can see one (NEH-406).
 *
 * Every `fontSizeMap` entry is a `var(--font-sizes-KEY, <fallback>)` reference.
 * jsdom rejects that against the `font-size` grammar and drops the declaration
 * outright — the element ends up with **no `style` attribute at all** — so a
 * jsdom `toHaveStyle({ fontSize: … })` compares "" with "" and passes for any
 * expected value. One did, for months, naming a size that stopped being true
 * when the scale moved.
 *
 * The harness deliberately does NOT define `--font-sizes-*`, so what these
 * measure is the package's own fallback ramp — the thing a host gets for saying
 * nothing, which is exactly the value a silent default change would move.
 */
test.describe("font size actually rendered", () => {
  const CASES = [
    { profile: "sm", px: 14 },
    { profile: "md", px: 16 },
    { profile: "lg", px: 18 },
    { profile: "xl", px: 20 },
  ] as const;

  for (const { profile, px } of CASES) {
    test(`the ${profile} profile renders at ${px}px`, async ({ mount }) => {
      const component = await mount(
        <StonedogStyleProvider fontSizeProfile={profile}>
          <StyledText>sized</StyledText>
        </StonedogStyleProvider>,
      );
      const size = await component
        .getByText("sized")
        .evaluate((el) => getComputedStyle(el).fontSize);
      expect(size).toBe(`${px}px`);
    });
  }

  /**
   * **INVERTED, deliberately (NEH-1561).** This test used to be titled "an
   * explicit size outranks the profile on the rendered pixels too" and to
   * assert `12px` at the `xl` profile. It was green for the whole time the
   * product was broken, because outranking the profile WAS the defect: a
   * reader who turned their text size all the way up still got 12px, at 461
   * call sites, on a product whose scale is deliberately shifted up for elderly
   * users.
   *
   * `size` is now an offset from `md` applied to the profile, so `xs` at the
   * `xl` profile is two steps down from `xl` — `md`, 16px on the package's own
   * fallback ramp, which is what this harness renders because it defines no
   * `--font-sizes-*` of its own.
   *
   * Restoring the old expectation restores the bug. The broader guard is
   * `font-size-profile.ct.tsx`, which asserts the relationship rather than the
   * constant.
   */
  test("an explicit size is a step RELATIVE to the profile, on the rendered pixels", async ({
    mount,
  }) => {
    // The rule itself is asserted against `resolveFontSizeKey` in the jest
    // tier. This is the other half: that the key it picks is the one that
    // reaches the browser.
    const component = await mount(
      <div>
        <StonedogStyleProvider fontSizeProfile="xl">
          <StyledText size="xs" data-testid="at-xl">
            two steps down from xl
          </StyledText>
        </StonedogStyleProvider>
        <StonedogStyleProvider fontSizeProfile="md">
          <StyledText size="xs" data-testid="at-md">
            two steps down from md
          </StyledText>
        </StonedogStyleProvider>
      </div>,
    );
    const read = async (id: string) =>
      component.getByTestId(id).evaluate((el) => getComputedStyle(el).fontSize);

    // Two steps below `xl` is `md`; two steps below `md` clamps at `xs`.
    expect(await read("at-xl")).toBe("16px");
    // And the md profile is the identity, which is what leaves both Optima
    // products — standard scale, default profile — rendering exactly what they
    // rendered before.
    expect(await read("at-md")).toBe("12px");
  });
});

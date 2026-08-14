import { test, expect } from "@playwright/experimental-ct-react";
import StyledTag from "./StyledTag";

/**
 * The pixel half of `StyledTag` (NEH-430).
 *
 * jsdom has no layout engine — every element reports a zero-sized box — so the
 * unit tier cannot tell a 48px tap target from a 16px one. It happily agrees
 * with both. That is the whole reason this tier exists.
 *
 * The remove control is the case that matters: it is a small glyph inside an
 * already-small label, which is exactly where a hit area silently ends up
 * whatever the padding happens to produce.
 */

test.describe("the remove control's tap target", () => {
  test("meets the 48x48 CSS px floor", async ({ mount }) => {
    // 48, not WCAG 2.5.5 AAA's 44 — the house minimum is deliberately above
    // the standard, because the standard is calibrated for the general
    // population and this library's largest consumer serves an often-elderly,
    // sometimes motor-impaired audience.
    const component = await mount(
      <StyledTag onRemove={() => {}}>Draft</StyledTag>,
    );

    const box = (await component.getByRole("button").boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
  });

  test("does not force the tag itself to 48px tall", async ({ mount }) => {
    // The other half, and the reason the button carries negative block margin.
    // A floor that drags the whole tag to 48px would make a row of tags look
    // like a row of buttons, and the obvious fix — shrinking the button — is
    // the one that reintroduces the sub-48 target.
    const component = await mount(
      <StyledTag onRemove={() => {}}>Draft</StyledTag>,
    );

    const tag = (await component.boundingBox())!;
    expect(tag.height).toBeLessThan(48);
  });
});

test.describe("a plain tag", () => {
  test("has no interactive control at all", async ({ mount }) => {
    const component = await mount(<StyledTag>Draft</StyledTag>);
    await expect(component.getByRole("button")).toHaveCount(0);
  });

  test("does not wrap its label", async ({ mount }) => {
    // `whiteSpace: nowrap` is what keeps a two-word tag from becoming two
    // lines and doubling its height mid-row. Asserted by measuring rather than
    // by reading the declaration back, since a computed `nowrap` that loses to
    // a later rule would still report `nowrap`.
    //
    // Both tags are mounted together, inside a deliberately narrow box: CT
    // allows one mount per test (a second throws "container that already has a
    // React root"), and the narrow parent is what would force a wrap if
    // `nowrap` were not holding.
    const component = await mount(
      <div style={{ width: "90px" }}>
        <span data-testid="one">
          <StyledTag>Draft</StyledTag>
        </span>
        <span data-testid="two">
          <StyledTag>Needs review</StyledTag>
        </span>
      </div>,
    );

    const one = (await component.getByTestId("one").boundingBox())!;
    const two = (await component.getByTestId("two").boundingBox())!;

    // Wider, because the label is longer...
    expect(two.width).toBeGreaterThan(one.width);
    // ...but no taller, which is the actual claim. A wrap would roughly double
    // it, so a 2px tolerance cannot hide one.
    expect(Math.abs(two.height - one.height)).toBeLessThan(2);
    // And genuinely overflowing its parent, so the test is not passing because
    // the label happened to fit.
    expect(two.width).toBeGreaterThan(90);
  });
});

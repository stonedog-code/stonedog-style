import { test, expect } from "@playwright/experimental-ct-react";
import StyledBox from "./StyledBox";
import StyledLabeledValue from "./StyledLabeledValue";
import StyledText from "./StyledText";

/**
 * The adjacent-`StyledText` run-on, planted and caught in a real browser
 * (NEH-1558 item 3).
 *
 * ## Why this spec is NOT a `textContent` assertion
 *
 * NEH-1558 originally asked for a component test asserting that the rendered
 * `textContent` carries a separator. **That is impossible for a box-model fix
 * and must not be copied**, per the issue's own 2026-09-11 correction:
 * `textContent` is `"Average182.7 points"` before the fix and after it —
 * promotion separates the *boxes*, not the characters — which is exactly why a
 * pre-existing `toHaveTextContent("182.7 points")` passed throughout and the
 * defect reached a fourth occurrence.
 *
 * So this file asserts what is genuinely assertable, and only a browser can
 * answer any of it: where the boxes actually land, what `display` they compute
 * to, and whether a real `<dt>`/`<dd>` boundary exists between the label and
 * the value.
 *
 * ## Both directions, in one file
 *
 * | | asserts |
 * | -- | -- |
 * | **the plant** | two bare `StyledText` in a non-flex `StyledBox` really DO weld onto one line. Without this the rest is a green over a fixture that was never broken |
 * | **the control** | `block` on both siblings separates them — NEH-490's promotion still works, so the weld above is the absence of promotion and not something about the fixture |
 * | **the fix** | the same pair through `StyledLabeledValue` has a real `<dt>`/`<dd>` boundary, with no prop passed by the caller at all |
 *
 * The plant is the shape that shipped four times, taken from a real call site:
 * a label above a value inside a `StyledBox`, with **no props on either span**.
 * That is the case `StyledText`'s own block promotion structurally cannot fix,
 * because it is keyed on props and there are none.
 *
 * ## The `StyledBox` parent is load-bearing, and was measured rather than assumed
 *
 * `boxRecipe`'s base is `display: flex`, so a `StyledBox` LOOKS like a flex
 * container — and flex items are blockified, which would separate the two spans
 * and make the plant vacuous. It is not one for your children: with no layout
 * props and no header, footer, panel or scrollbar, `StyledBox` still routes
 * children through `StyledGridPanel`'s plain block `<div>` (see
 * `StyledBox.tsx`). The span count is therefore asserted BEFORE any geometry —
 * a `:scope > span` selector matches nothing here, and a locator that matched
 * nothing would make every measurement below pass over an empty set.
 */

const LABEL = "Average";
const VALUE = "182.7 points";

test.describe("the plant — the run-on is real, and it is a box-model failure", () => {
  test("two bare StyledText siblings in a non-flex StyledBox weld onto one line", async ({
    mount,
  }) => {
    const component = await mount(
      <StyledBox>
        <StyledText data-testid="label">{LABEL}</StyledText>
        <StyledText data-testid="value">{VALUE}</StyledText>
      </StyledBox>,
    );

    const label = component.getByTestId("label");
    const value = component.getByTestId("value");
    // Non-vacuity first: both spans exist and are the elements being measured.
    await expect(label).toHaveCount(1);
    await expect(value).toHaveCount(1);

    const labelBox = (await label.boundingBox())!;
    const valueBox = (await value.boundingBox())!;
    expect(labelBox).not.toBeNull();
    expect(valueBox).not.toBeNull();

    // THE DEFECT, stated positively so it cannot be satisfied by accident: the
    // value shares the label's line and sits to its right. This is what
    // "Average182.7 points" is, geometrically.
    expect(valueBox.y, "the value is on the label's line").toBeLessThan(
      labelBox.y + labelBox.height,
    );
    expect(valueBox.x, "the value starts to the right of the label").toBeGreaterThan(
      labelBox.x,
    );

    // And the cause: an inline box. A block one could not share the line.
    expect(await label.evaluate((el) => getComputedStyle(el).display)).toBe("inline");
    expect(await value.evaluate((el) => getComputedStyle(el).display)).toBe("inline");
  });

  test("the CONTROL — `block` on both siblings separates them, so the weld is the missing promotion", async ({
    mount,
  }) => {
    const component = await mount(
      <StyledBox>
        <StyledText block data-testid="label">
          {LABEL}
        </StyledText>
        <StyledText block data-testid="value">
          {VALUE}
        </StyledText>
      </StyledBox>,
    );

    const labelBox = (await component.getByTestId("label").boundingBox())!;
    const valueBox = (await component.getByTestId("value").boundingBox())!;

    expect(valueBox.y, "the value starts below the label").toBeGreaterThanOrEqual(
      labelBox.y + labelBox.height - 1,
    );
    expect(
      await component.getByTestId("label").evaluate((el) => getComputedStyle(el).display),
    ).toBe("block");
  });
});

test.describe("the fix — StyledLabeledValue, with no prop the caller can forget", () => {
  test("the value is on its own line, and the boundary is a real <dt>/<dd> pair", async ({
    mount,
  }) => {
    const component = await mount(
      <StyledBox>
        <StyledLabeledValue data-testid="pair" label={LABEL} value={VALUE} />
      </StyledBox>,
    );

    const pair = component.getByTestId("pair");
    await expect(pair).toHaveCount(1);
    expect(await pair.evaluate((el) => el.tagName), "the pair's own element").toBe("DL");

    // The SEMANTIC boundary, which is the half `block` cannot supply: two
    // promoted spans are still announced as one string, a term and its
    // definition are not.
    const parts = await pair.evaluate((el) => {
      const dt = el.querySelector("dt");
      const dd = el.querySelector("dd");
      return {
        dts: el.querySelectorAll("dt").length,
        dds: el.querySelectorAll("dd").length,
        dtDisplay: dt ? getComputedStyle(dt).display : "(none)",
        ddDisplay: dd ? getComputedStyle(dd).display : "(none)",
        dtText: (dt?.textContent ?? "").trim(),
        ddText: (dd?.textContent ?? "").trim(),
      };
    });
    expect(parts.dts, "exactly one <dt>").toBe(1);
    expect(parts.dds, "exactly one <dd>").toBe(1);
    expect(parts.dtText).toBe(LABEL);
    expect(parts.ddText).toBe(VALUE);
    // Explicit, because a host reset that restyles description lists must not
    // be able to make either of them inline again.
    expect(parts.dtDisplay).toBe("block");
    expect(parts.ddDisplay).toBe("block");

    // The GEOMETRIC boundary, measured the same way as the plant above.
    const boxes = await pair.evaluate((el) => {
      const dt = el.querySelector("dt")!.getBoundingClientRect();
      const dd = el.querySelector("dd")!.getBoundingClientRect();
      return { dt: { y: dt.y, height: dt.height }, dd: { y: dd.y } };
    });
    expect(boxes.dd.y, "the value starts below the label").toBeGreaterThanOrEqual(
      boxes.dt.y + boxes.dt.height - 1,
    );
  });

  test("`inline` shares a line and still has a real gap — it never welds", async ({
    mount,
  }) => {
    const component = await mount(
      <StyledBox>
        <StyledLabeledValue data-testid="pair" layout="inline" label={LABEL} value={VALUE} />
      </StyledBox>,
    );

    const pair = component.getByTestId("pair");
    await expect(pair).toHaveAttribute("data-layout", "inline");

    const boxes = await pair.evaluate((el) => {
      const dt = el.querySelector("dt")!.getBoundingClientRect();
      const dd = el.querySelector("dd")!.getBoundingClientRect();
      return { dtRight: dt.right, dtY: dt.y, dtHeight: dt.height, ddLeft: dd.left, ddY: dd.y };
    });

    // On one line — that is what this layout is for...
    expect(boxes.ddY, "the value shares the label's line").toBeLessThan(
      boxes.dtY + boxes.dtHeight,
    );
    // ...and separated on it anyway, by a gap the library supplies. The
    // failure this component exists to prevent is characters running together,
    // and that is true in either layout.
    expect(boxes.ddLeft - boxes.dtRight, "the gap between label and value").toBeGreaterThan(
      1,
    );
  });
});

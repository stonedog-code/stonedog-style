import { test, expect } from "@playwright/experimental-ct-react";
import StyledBox from "./StyledBox";
import StyledText from "./StyledText";

/**
 * A caller's layout props must reach the element that PARENTS their children.
 *
 * ## The defect
 *
 * `StyledBox` without `noWrap` wraps children three levels deep:
 *
 * ```
 * StyledBoxRoot        ← the caller's display/flexDirection/alignItems land HERE
 *   └ StyledVStack     ← ...whose only child is this
 *       └ div          ← flex:1, minHeight:0
 *           └ StyledGridPanel
 *               └ div  ← a PLAIN BLOCK div, and the caller's children live here
 * ```
 *
 * So `<StyledBox display="flex" flexDirection="column">` applies a flex
 * container to a root holding exactly ONE child. The caller's children sit in
 * ordinary block flow four levels down, and the props are inert — silently.
 *
 * Two consequences, both shipped:
 *
 * 1. **Adjacent `StyledText` siblings weld into one run.** `StyledText` renders
 *    a `<span>`, JSX strips the whitespace between elements on separate lines,
 *    and nothing blockifies them — so Hopper Vitals rendered `264.2Weight` and
 *    `Sep 6Record another to see a trend.` (NEH-1473). This is the third
 *    product surface to ship the symptom NEH-490 describes; the previous two
 *    were fixed at the call site, which is why it came back.
 * 2. **`alignItems` / `justifyContent` do nothing.** The same card centres its
 *    reading and not its caption, from one `alignItems="center"`.
 *
 * ## Why this was invisible
 *
 * `StyledText.ct.tsx` states in a comment that "StyledBox lays its children out
 * in a flex column, which blockifies them" — and uses a bare `<div>` instead to
 * avoid a vacuous test. That belief is what this file measures, and it is
 * false. The comment is corrected in the same change.
 *
 * jsdom cannot see any of it: every box is 0×0, so a jsdom test agrees that two
 * welded spans are stacked. Real Chromium is the only tier that can answer.
 */

/** Two block-level siblings differ in `y`; two welded inline spans share it. */
async function stacked(
  first: { y: number; height: number },
  second: { y: number },
): Promise<boolean> {
  return second.y > first.y + first.height - 1;
}

test.describe("StyledBox forwards layout props to its children", () => {
  test("a flex column actually stacks two StyledText children", async ({ mount }) => {
    const component = await mount(
      <StyledBox display="flex" flexDirection="column" data-testid="box">
        <StyledText data-testid="value">264.2</StyledText>
        <StyledText data-testid="label">Weight</StyledText>
      </StyledBox>,
    );

    const value = await component.getByTestId("value").boundingBox();
    const label = await component.getByTestId("label").boundingBox();
    expect(value).not.toBeNull();
    expect(label).not.toBeNull();

    // THE ASSERTION. Welded, they share a line and the label sits to the right;
    // stacked, it starts below the value.
    expect(await stacked(value!, label!)).toBe(true);

    // And the rendered text is not one run — the symptom a reader sees.
    //
    // `innerText`, not `textContent`: textContent concatenates text NODES and
    // never inserts a separator, so it reads "264.2Weight" whether the spans
    // are welded on one line or stacked as blocks. Only innerText is
    // layout-aware, which is the whole question here.
    //
    // Read from `component` itself rather than `getByTestId("box")`: the
    // StyledBox IS the mounted root, and a locator searches DESCENDANTS, so
    // that query matches nothing and times out instead of failing.
    const text = await component.innerText();
    expect(text).not.toContain("264.2Weight");
    expect(text).toContain("264.2");
    expect(text).toContain("Weight");
  });

  test("alignItems reaches the children rather than a wrapper", async ({ mount }) => {
    const component = await mount(
      <div style={{ width: 400 }}>
        <StyledBox
          display="flex"
          flexDirection="column"
          alignItems="center"
          data-testid="box"
        >
          <StyledText data-testid="short">Hi</StyledText>
        </StyledBox>
      </div>,
    );

    const box = await component.getByTestId("box").boundingBox();
    const short = await component.getByTestId("short").boundingBox();
    expect(box).not.toBeNull();
    expect(short).not.toBeNull();

    // Centred: equal slack either side. Inert: the span sits hard left.
    const leftGap = short!.x - box!.x;
    const rightGap = box!.x + box!.width - (short!.x + short!.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(4);
    expect(leftGap).toBeGreaterThan(10);
  });

  test("a row direction keeps them on ONE line — the opposite direction", async ({
    mount,
  }) => {
    // The control. If the fix worked by blockifying everything unconditionally,
    // this would fail — and a fix that stacks text the caller asked to sit in a
    // row is a different bug, not a fix.
    const component = await mount(
      <StyledBox display="flex" flexDirection="row" gap="2" data-testid="box">
        <StyledText data-testid="a">Weight</StyledText>
        <StyledText data-testid="b">264.2 lbs</StyledText>
      </StyledBox>,
    );

    const a = await component.getByTestId("a").boundingBox();
    const b = await component.getByTestId("b").boundingBox();
    expect(await stacked(a!, b!)).toBe(false);
    // ...and `gap` separates them, so they are not welded either.
    expect(b!.x - (a!.x + a!.width)).toBeGreaterThan(2);
  });

  test("a plain StyledBox is unchanged — no layout props, no promotion", async ({
    mount,
  }) => {
    // The other control. Callers who pass no layout props must keep ordinary
    // block flow, where two inline spans SHARE a line. That is `StyledText`'s
    // deliberate, separately-tested behaviour and this fix must not alter it.
    const component = await mount(
      <StyledBox data-testid="box">
        <StyledText data-testid="a">Inline</StyledText>
        <StyledText data-testid="b">text</StyledText>
      </StyledBox>,
    );

    const a = await component.getByTestId("a").boundingBox();
    const b = await component.getByTestId("b").boundingBox();
    expect(await stacked(a!, b!)).toBe(false);
  });
});

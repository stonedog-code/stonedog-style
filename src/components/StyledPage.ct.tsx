import { test, expect } from "@playwright/experimental-ct-react";
import StyledPage from "./StyledPage";

/**
 * `StyledPage`'s layout contract, which only a real engine can answer.
 *
 * The shell this is built for is a fixed three-row grid — header, body, footer
 * — where only the body row scrolls. Get it wrong and the symptom is not a
 * broken page but a footer pushed off-screen, which jsdom cannot see at all:
 * every element there reports a zero-sized box, so the unit tier agrees with
 * any arrangement.
 *
 * Each case mounts the page inside a fixed-height box standing in for that body
 * row, because the contract is about what happens INSIDE a bounded parent.
 */

/**
 * Real paragraphs, and NOT a fixed-height empty div.
 *
 * The obvious fixture — `<div style={{ height: 2000 }} />` — does not overflow
 * anything here, and it cost a confused half-hour before it was understood.
 * The content box is a flex column, so that div is a flex ITEM: its
 * `min-height: auto` resolves against its *content*, which is nothing, so flex
 * happily shrinks 2000px down to the 400px available and there is no overflow
 * to scroll. The component was right; the fixture was measuring a case that
 * cannot occur.
 *
 * Text has a real min-content height and cannot be shrunk away, which is both
 * what a page actually contains and the only thing that exercises the
 * contract.
 */
const tallContent = (
  <>
    {Array.from({ length: 120 }, (_, i) => (
      <p key={i}>Paragraph {i} with some real text content in it.</p>
    ))}
  </>
);

test.describe("the scroll contract", () => {
  test("keeps overflow inside itself rather than growing the parent", async ({
    mount,
  }) => {
    // The `min-height: 0` claim. Without it a flex child refuses to shrink
    // below its content height, so 2000px of content makes the page 2000px
    // tall and the overflow escapes the row — in a real shell, pushing the
    // footer off the bottom of the screen.
    const component = await mount(
      <div style={{ height: "400px", display: "flex", flexDirection: "column" }}>
        <StyledPage hideScrollbar={false}>{tallContent}</StyledPage>
      </div>,
    );

    // Asserted as an exact fill, not `<= 400`. The loose form passes at zero
    // height too, which is the other way this can be broken — and a page that
    // collapsed to nothing would have satisfied it happily.
    const root = (await component.getByTestId("styled-page-root").boundingBox())!;
    expect(root.height).toBe(400);

    // And the content genuinely exceeds it, so the case is real rather than
    // the fixture happening to fit.
    const overflowing = await component
      .getByTestId("styled-page-content")
      .evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflowing).toBe(true);
  });

  test("scrolls the content box when hideScrollbar is false", async ({
    mount,
  }) => {
    const component = await mount(
      <div style={{ height: "400px", display: "flex", flexDirection: "column" }}>
        <StyledPage hideScrollbar={false}>{tallContent}</StyledPage>
      </div>,
    );

    const content = component.getByTestId("styled-page-content");
    const scrollable = await content.evaluate(
      (el) => el.scrollHeight > el.clientHeight,
    );
    expect(scrollable).toBe(true);

    await content.evaluate((el) => {
      el.scrollTop = 200;
    });
    expect(await content.evaluate((el) => el.scrollTop)).toBe(200);
  });

  test("does NOT scroll by default, leaving that to an inner element", async ({
    mount,
  }) => {
    // The surprising default, inherited deliberately: the originating app's
    // pages put the scroll on an element inside. Flipping it would give every
    // one of them a second scrollbar.
    const component = await mount(
      <div style={{ height: "400px", display: "flex", flexDirection: "column" }}>
        <StyledPage>{tallContent}</StyledPage>
      </div>,
    );

    const overflow = await component
      .getByTestId("styled-page-content")
      .evaluate((el) => getComputedStyle(el).overflowY);

    expect(overflow).toBe("hidden");
  });

  test("the two modes really do differ", async ({ mount }) => {
    // Asserted as a pair, because `hidden` alone could be the value BOTH modes
    // produce if the prop were ignored — and that bug would leave the test
    // above green.
    //
    // Note what is deliberately NOT used as the discriminator: setting
    // `scrollTop` and reading it back. An `overflow: hidden` box is still
    // PROGRAMMATICALLY scrollable — hidden suppresses the scrollbar and user
    // scrolling, not the property — so that assertion fails against a correct
    // component. It did, on the first run of this spec.
    const component = await mount(
      <div style={{ height: "400px", display: "flex", flexDirection: "column" }}>
        <div data-testid="a" style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <StyledPage>{tallContent}</StyledPage>
        </div>
        <div data-testid="b" style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <StyledPage hideScrollbar={false}>{tallContent}</StyledPage>
        </div>
      </div>,
    );

    const read = (testid: string) =>
      component
        .getByTestId(testid)
        .getByTestId("styled-page-content")
        .evaluate((el) => getComputedStyle(el).overflowY);

    expect(await read("a")).toBe("hidden");
    expect(await read("b")).toBe("auto");
  });
});

test.describe("the actions row", () => {
  test("is content-height, not half the page", async ({ mount }) => {
    // The original set `flex="1" minH={0} height="100%"` on the toolbar, so it
    // competed with the content box for the same space. A toolbar is
    // min-content tall.
    const component = await mount(
      <div style={{ height: "600px", display: "flex", flexDirection: "column" }}>
        <StyledPage includeSave isDirty>
          {tallContent}
        </StyledPage>
      </div>,
    );

    const actions = (await component
      .getByTestId("styled-page-actions")
      .boundingBox())!;
    const content = (await component
      .getByTestId("styled-page-content")
      .boundingBox())!;

    // Comfortably under a third of the page, and the content has the rest.
    expect(actions.height).toBeLessThan(200);
    expect(content.height).toBeGreaterThan(actions.height * 2);
  });

  test("meets the 48px tap-target floor on both buttons", async ({ mount }) => {
    const component = await mount(
      <StyledPage includeSave isDirty>
        content
      </StyledPage>,
    );

    for (const name of ["Save", "Cancel"]) {
      const box = (await component.getByRole("button", { name }).boundingBox())!;
      expect(box.height, `${name} height`).toBeGreaterThanOrEqual(48);
      expect(box.width, `${name} width`).toBeGreaterThanOrEqual(48);
    }
  });
});

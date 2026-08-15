import { test, expect } from "@playwright/experimental-ct-react";
import StyledLink from "./StyledLink";

/**
 * A link inside a sentence must behave like a link inside a sentence.
 *
 * This spec was written to check a suspicion and it failed: `StyledLink`
 * renders through `buttonRecipe`, whose base states `min-height: 48px`,
 * `display: inline-flex` and padding, and the `link` variant overrides none of
 * the three. A link in a paragraph measured **48.375px** tall, forcing the
 * line box open around it.
 *
 * That is the NEH-490 rule one layer along — a component must not render in a
 * shape its commonest use cannot accept. Caught before any consumer adopted
 * it, which is the only reason the default could still be changed freely.
 *
 * Both directions are asserted, because a fix that made everything inline
 * would trade one defect for another: a standalone nav link genuinely needs
 * the 48px target, and the house floor is not negotiable there.
 */
test("an inline link occupies exactly the space a plain anchor would", async ({
  mount,
}) => {
  // Compared against a plain <a> rather than asserted as an absolute height.
  //
  // The first version of this test measured the link's own bounding box and
  // required it under 40px. That is fragile in a way worth recording: an
  // INLINE element that wraps across two lines legitimately reports the height
  // of both line boxes, so the number depends on text metrics and on where the
  // wrap lands. It passed in isolation and failed at 43px in the full suite,
  // which is the classic shape of an assertion measuring the wrong thing.
  //
  // The claim that actually matters is relative and font-independent: a
  // paragraph containing a StyledLink is the same height as the identical
  // paragraph containing a bare anchor. If the control box ever comes back,
  // this diverges immediately.
  const component = await mount(
    <div style={{ width: "400px", fontSize: "16px", lineHeight: "1.5" }}>
      <p data-testid="styled">
        Deadlines are computed from the rules, and you can{" "}
        <StyledLink href="/entities">add the missing details</StyledLink> at any
        time.
      </p>
      <p data-testid="plain">
        Deadlines are computed from the rules, and you can{" "}
        <a href="/entities">add the missing details</a> at any time.
      </p>
    </div>,
  );

  const styled = (await component.getByTestId("styled").boundingBox())!;
  const plain = (await component.getByTestId("plain").boundingBox())!;

  expect(styled.height).toBeCloseTo(plain.height, 0);
});

test("a standalone link still meets the 48px tap target", async ({ mount }) => {
  // The other direction. `standalone` is how a nav item or a card action asks
  // for the control box, and the house floor applies there in full.
  const component = await mount(
    <StyledLink href="/entities" standalone>
      Add an entity
    </StyledLink>,
  );

  // `component` IS the anchor here, and a locator searches DESCENDANTS — so
  // `.getByRole("link")` finds nothing and times out. Same trap the
  // StyledInputBool spec records for its label.
  const box = (await component.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(48);
});

test("both keep the link variant's underline, so only the BOX differs", async ({
  mount,
}) => {
  // The fix overrides three box properties and nothing else — colour, hover
  // and underline stay one definition shared with every other control. If a
  // future change moved the variant instead, this is what would notice.
  const component = await mount(
    <div>
      <span data-testid="a">
        <StyledLink href="/x">inline</StyledLink>
      </span>
      <span data-testid="b">
        <StyledLink href="/y" standalone>
          standalone
        </StyledLink>
      </span>
    </div>,
  );

  const decoration = (testid: string) =>
    component
      .getByTestId(testid)
      .getByRole("link")
      .evaluate((el) => getComputedStyle(el).textDecorationLine);

  expect(await decoration("a")).toBe("underline");
  expect(await decoration("b")).toBe("underline");
});

/**
 * `flow` — the third presentation (NEH-728).
 *
 * These are the two claims that justify its existence, and **neither is
 * assertable in jsdom**: both are questions about what a real layout engine
 * does with a `display` value, and jsdom reports every box as 0×0.
 *
 * The failure they guard against is silent. `text` renders `display: inline`,
 * and on a non-replaced inline box the CSS spec says `width` does not apply and
 * `margin-left: auto` resolves to zero — so a link given a width simply ignores
 * it, and a right-hand icon sits next to the label instead of at the end. No
 * error, no warning; it just looks wrong.
 */
test("a flow link honours a width, where a text link cannot", async ({
  mount,
}) => {
  const component = await mount(
    <div style={{ width: "400px" }}>
      <StyledLink href="/a" presentation="flow" style={{ width: "300px" }}>
        <span data-testid="flow-label">Flow</span>
      </StyledLink>
      <StyledLink href="/b" presentation="text" style={{ width: "300px" }}>
        <span data-testid="text-label">Text</span>
      </StyledLink>
    </div>,
  );

  const links = component.locator("a");
  const flow = (await links.nth(0).boundingBox())!;
  const text = (await links.nth(1).boundingBox())!;

  // The width applies to `flow`...
  expect(flow.width).toBeCloseTo(300, 0);
  // ...and is discarded by `text`, which is correct for an inline box and is
  // exactly why `flow` had to be added rather than reusing `text`.
  expect(text.width).toBeLessThan(300);
});

test("a flow link is a flex container, so margin-left:auto still works", async ({
  mount,
}) => {
  const component = await mount(
    <div style={{ width: "400px" }}>
      <StyledLink
        href="/a"
        presentation="flow"
        style={{ width: "300px" }}
        rightIcon={<span data-testid="icon">→</span>}
      >
        Label
      </StyledLink>
    </div>,
  );

  const link = (await component.locator("a").boundingBox())!;
  const icon = (await component.getByTestId("icon").boundingBox())!;

  // The icon sits in the right-hand half of a 300px link. On an inline box it
  // would sit immediately after the label, near the left.
  expect(icon.x).toBeGreaterThan(link.x + link.width / 2);
});

test("flow does NOT carry the 48px control floor, and control does", async ({
  mount,
}) => {
  const component = await mount(
    <div style={{ width: "400px" }}>
      <StyledLink href="/a" presentation="flow">
        Flow
      </StyledLink>
      <StyledLink href="/b" presentation="control">
        Control
      </StyledLink>
    </div>,
  );

  const links = component.locator("a");
  const flow = (await links.nth(0).boundingBox())!;
  const control = (await links.nth(1).boundingBox())!;

  // The house floor, stated in CLAUDE.md and not negotiable for a tap target.
  expect(control.height).toBeGreaterThanOrEqual(48);
  // `flow` is a layout participant, not a target. If this ever reaches 48 the
  // two modes have collapsed into one and `flow`'s reason for existing is gone.
  expect(flow.height).toBeLessThan(48);
});

test("standalone still means control, so existing consumers are untouched", async ({
  mount,
}) => {
  const component = await mount(
    <div style={{ width: "400px" }}>
      {/*
        The SAME label text in both. An earlier version of this test used
        "Standalone" and "Control", which differ in width for the obvious
        reason and made the comparison meaningless — it failed at all four
        viewports on a correct implementation.
      */}
      <StyledLink href="/a" standalone>
        Same label
      </StyledLink>
      <StyledLink href="/b" presentation="control">
        Same label
      </StyledLink>
    </div>,
  );

  const links = component.locator("a");
  const deprecated = (await links.nth(0).boundingBox())!;
  const explicit = (await links.nth(1).boundingBox())!;

  expect(deprecated.height).toBeCloseTo(explicit.height, 0);
  expect(deprecated.width).toBeCloseTo(explicit.width, 0);
});

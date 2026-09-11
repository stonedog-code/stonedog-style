import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/experimental-ct-react";
import StyledText from "./StyledText";
import StyledHeading from "./StyledHeading";
import StyledLink from "./StyledLink";
import { StonedogStyleProvider } from "../config/style-config";
import type { FontSizeProfile } from "../config/types";

/**
 * **Does the user's font-size setting actually reach text that carries a
 * `size`?** (NEH-1561)
 *
 * That question had never been asked anywhere, in any tier, and the gap is the
 * whole reason this defect shipped. A guard written in the same commit as the
 * codemod that caused it — `hopper-web`'s `text-size-scale.ct.tsx` — asserted
 * that *"the size scale is monotonic and actually distinct"*: that the sizes
 * differ **from each other**. They did. Every one of them was also frozen
 * against the setting, and the guard sailed over it.
 *
 * The distinction is easy to lose and worth stating plainly. *Distinct* is a
 * claim about the sizes; *reached* is a claim about the reader. A scale can be
 * perfectly monotonic and perfectly inert.
 *
 * ## Why this cannot live in the unit tier
 *
 * Two independent reasons, either of which is fatal on its own:
 *
 * - jsdom has no layout engine, so nothing about rendered geometry is
 *   answerable there.
 * - **jsdom's CSS parser rejects `var(--font-sizes-*, …)` against the
 *   `font-size` grammar and drops the declaration outright.** The element ends
 *   up with no `style` attribute at all, so `toHaveStyle({ fontSize: … })`
 *   compares `""` with `""` and passes for *every* expected value. The
 *   regression this file guards was invisible to 7,192 unit tests, and one
 *   jsdom assertion had been stating a size that stopped being true when the
 *   scale moved — green throughout.
 *
 * So it is a real browser or it is nothing. `component-tests / Component Tests
 * (real Chromium)` is a REQUIRED context on `main` (measured 2026-09-10) — not
 * the "reports without blocking" lane an older comment claimed.
 *
 * ## What the rule is now
 *
 * An explicit `size` is an **offset from `md`**, applied to the reader's
 * profile, clamped at both ends of `FONT_SIZE_ORDER`. `size="sm"` means "one
 * step below body text" rather than a fixed pixel value, so the hierarchy a
 * call site asked for survives every profile instead of pinning the reader to
 * whatever the author happened to type.
 *
 * ## Everything below is measured, nothing is a constant
 *
 * The assertions compare rendered pixels **against each other** — this profile
 * against that one, the link against the sentence around it. A pixel constant
 * in a test goes stale the moment a host retunes its `--font-sizes-*` ramp, and
 * a stale constant in a green test is exactly how the original defect survived.
 * The only absolute checks here are that a value parses as a positive number at
 * all, which is what catches a size resolving to nothing.
 */

const PROFILES = ["xs", "sm", "md", "lg", "xl"] as const;
const SIZES = ["xs", "sm", "md", "lg"] as const;

/** Read the computed `font-size` of one element, in px, as a number. */
async function px(locator: {
  evaluate: (fn: (el: Element) => string) => Promise<string>;
}): Promise<number> {
  const value = await locator.evaluate((el) => getComputedStyle(el).fontSize);
  const parsed = Number.parseFloat(value);
  // A `var()` that fails to resolve, or a key that resolves to nothing, comes
  // back as "" or "normal" rather than throwing. Reading NaN as a number and
  // comparing it silently returns false for every operator, so it is asserted
  // here instead of being allowed to become a confusing failure downstream.
  expect(Number.isFinite(parsed), `font-size was "${value}"`).toBe(true);
  expect(parsed).toBeGreaterThan(0);
  return parsed;
}

/**
 * THE ASSERTION THIS DEFECT PROVES WAS MISSING.
 *
 * Direction one: a sized element MOVES when the profile moves.
 */
test.describe("the profile reaches SIZED text", () => {
  for (const size of SIZES) {
    test(`size="${size}" grows from the md profile to the xl profile`, async ({
      mount,
    }) => {
      const component = await mount(
        <div>
          <StonedogStyleProvider fontSizeProfile="md">
            <StyledText size={size} data-testid="at-md">
              body
            </StyledText>
          </StonedogStyleProvider>
          <StonedogStyleProvider fontSizeProfile="xl">
            <StyledText size={size} data-testid="at-xl">
              body
            </StyledText>
          </StonedogStyleProvider>
        </div>,
      );

      const atMd = await px(component.getByTestId("at-md"));
      const atXl = await px(component.getByTestId("at-xl"));

      // Before the fix this was an EQUALITY for every size in this list: an
      // explicit `size` returned itself and the profile was never consulted.
      // 1,394 of 1,661 call sites in HopperGuard rendered this way, 461 of them
      // frozen at 12px on a product whose whole type scale is deliberately
      // shifted up for elderly readers.
      expect(atXl).toBeGreaterThan(atMd);
    });
  }

  test("an UNSIZED element still follows the profile, as it always did", async ({
    mount,
  }) => {
    // The half that was never broken, asserted anyway: a fix that reached sized
    // text by breaking unsized text would be a lateral move, and nothing else
    // here would notice.
    const component = await mount(
      <div>
        <StonedogStyleProvider fontSizeProfile="md">
          <StyledText data-testid="at-md">body</StyledText>
        </StonedogStyleProvider>
        <StonedogStyleProvider fontSizeProfile="xl">
          <StyledText data-testid="at-xl">body</StyledText>
        </StonedogStyleProvider>
      </div>,
    );
    expect(await px(component.getByTestId("at-xl"))).toBeGreaterThan(
      await px(component.getByTestId("at-md")),
    );
  });
});

/**
 * Direction two: the sizes stay distinct FROM EACH OTHER at every profile.
 *
 * This is the claim the original guard made, kept because it is still true and
 * still worth holding — a fix that reached the profile by collapsing the whole
 * ramp onto one value would satisfy every assertion above.
 */
test.describe("the hierarchy survives at every profile", () => {
  for (const profile of PROFILES) {
    test(`xs ≤ sm ≤ md ≤ lg at the ${profile} profile`, async ({ mount }) => {
      const component = await mount(
        <StonedogStyleProvider fontSizeProfile={profile}>
          <div>
            {SIZES.map((size) => (
              <StyledText key={size} size={size} data-testid={`s-${size}`}>
                {size}
              </StyledText>
            ))}
          </div>
        </StonedogStyleProvider>,
      );

      const measured: number[] = [];
      for (const size of SIZES) {
        measured.push(await px(component.getByTestId(`s-${size}`)));
      }

      // Non-decreasing, not strictly increasing, and the difference is the
      // clamp rather than a weakness in the assertion — see the clamp describe
      // below. At the SMALLEST profile there is no room underneath body text,
      // so `xs`, `sm` and `md` all land on the bottom tier together. Demanding
      // strict inequality here would demand that the clamp not exist.
      for (let i = 1; i < measured.length; i += 1) {
        expect(measured[i]!).toBeGreaterThanOrEqual(measured[i - 1]!);
      }

      // …and above the bottom of the scale it IS strict, which is where the
      // "actually distinct" claim has to be made or it is made nowhere.
      if (profile === "md" || profile === "lg" || profile === "xl") {
        for (let i = 1; i < measured.length; i += 1) {
          expect(measured[i]!).toBeGreaterThan(measured[i - 1]!);
        }
      }
    });
  }
});

/**
 * The clamp, at both ends, asserted as intended behaviour rather than tolerated
 * as an edge case.
 */
test.describe("an offset never falls off the scale", () => {
  test("at the SMALLEST profile, a below-body size matches body rather than shrinking past it", async ({
    mount,
  }) => {
    const component = await mount(
      <StonedogStyleProvider fontSizeProfile="xs">
        <div>
          <StyledText data-testid="body">body</StyledText>
          <StyledText size="sm" data-testid="one-down">
            one down
          </StyledText>
          <StyledText size="xs" data-testid="two-down">
            two down
          </StyledText>
        </div>
      </StonedogStyleProvider>,
    );

    const body = await px(component.getByTestId("body"));
    // The reader who has turned their text size all the way down is the reader
    // with the least room to spare. "One step smaller" must not mean "smaller
    // than the smallest tier the host offers" — it means "match the body text".
    expect(await px(component.getByTestId("one-down"))).toBe(body);
    expect(await px(component.getByTestId("two-down"))).toBe(body);
  });

  test("at the LARGEST profile, a size past the top of the ramp still resolves to a real value", async ({
    mount,
  }) => {
    const component = await mount(
      <StonedogStyleProvider fontSizeProfile="xl">
        <div>
          <StyledText size="lg" data-testid="lg">
            lg
          </StyledText>
          <StyledText size="8xl" data-testid="eight">
            8xl
          </StyledText>
          <StyledText size="9xl" data-testid="nine">
            9xl
          </StyledText>
        </div>
      </StonedogStyleProvider>,
    );

    const eight = await px(component.getByTestId("eight"));
    const nine = await px(component.getByTestId("nine"));
    // Both offsets run past the end of FONT_SIZE_ORDER and both stop at the top
    // tier. `px()` has already refused a NaN, which is what an unclamped index
    // produces: FONT_SIZE_ORDER[14] is undefined, fontSizeMap[undefined] is
    // undefined, and the element renders with no font-size at all.
    expect(eight).toBe(nine);
    expect(nine).toBeGreaterThan(await px(component.getByTestId("lg")));
  });
});

/**
 * `fixedSize` is the one thing that must NOT become relative.
 *
 * It exists for a label inside a fixed-height control that would clip if it
 * grew. Making it follow the profile would be the plausible over-application of
 * this fix, and nothing else in this file would fail.
 */
test.describe("fixedSize still pins to md", () => {
  test("a fixedSize element renders identically at every profile", async ({
    mount,
  }) => {
    const component = await mount(
      <div>
        {PROFILES.map((profile) => (
          <StonedogStyleProvider key={profile} fontSizeProfile={profile}>
            <StyledText fixedSize data-testid={`fixed-${profile}`}>
              label
            </StyledText>
          </StonedogStyleProvider>
        ))}
        <StonedogStyleProvider fontSizeProfile="md">
          <StyledText data-testid="body-at-md">body</StyledText>
        </StonedogStyleProvider>
      </div>,
    );

    const bodyAtMd = await px(component.getByTestId("body-at-md"));
    for (const profile of PROFILES) {
      expect(
        await px(component.getByTestId(`fixed-${profile}`)),
        `fixedSize moved at the ${profile} profile`,
      ).toBe(bodyAtMd);
    }
  });

  test("fixedSize with an explicit size stays absolute too", async ({ mount }) => {
    // `fixedSize` supplies the BASE and `size` is still an offset from it, so
    // the pair resolves to the same key it resolved to before this change —
    // `md` minus one step is `sm`. Asserted at two profiles because a base that
    // leaked the profile back in would be invisible at one.
    const component = await mount(
      <div>
        <StonedogStyleProvider fontSizeProfile="xs">
          <StyledText fixedSize size="sm" data-testid="at-xs">
            label
          </StyledText>
        </StonedogStyleProvider>
        <StonedogStyleProvider fontSizeProfile="xl">
          <StyledText fixedSize size="sm" data-testid="at-xl">
            label
          </StyledText>
          <StyledText size="sm" data-testid="relative-at-xl">
            body
          </StyledText>
        </StonedogStyleProvider>
      </div>,
    );

    const atXs = await px(component.getByTestId("at-xs"));
    expect(await px(component.getByTestId("at-xl"))).toBe(atXs);
    // …and it is genuinely pinned rather than accidentally equal: the same
    // `size="sm"` without `fixedSize` at the same profile is larger.
    expect(await px(component.getByTestId("relative-at-xl"))).toBeGreaterThan(atXs);
  });
});

/**
 * A heading reads one tier above body, at every profile — and the offset is
 * applied ONCE.
 *
 * `StyledHeading` used to resolve the profile itself and hand `StyledText` an
 * absolute key. Now that `size` is an offset, doing both would apply the
 * profile twice: an unsized heading at `xl` would have landed on `4xl` instead
 * of `2xl`, and the error would have grown with the setting — worst exactly
 * where this fix is supposed to help most.
 */
test.describe("StyledHeading steps once", () => {
  for (const profile of PROFILES) {
    test(`an unsized heading equals size="lg" body text at the ${profile} profile`, async ({
      mount,
    }) => {
      const component = await mount(
        <StonedogStyleProvider fontSizeProfile={profile}>
          <div>
            <StyledHeading data-testid="heading">Heading</StyledHeading>
            <StyledText size="lg" data-testid="one-up">
              one up
            </StyledText>
            <StyledText data-testid="body">body</StyledText>
          </div>
        </StonedogStyleProvider>,
      );

      const heading = await px(component.getByTestId("heading"));
      // "One step above body" expressed as an equality against the thing that
      // means one step above body, so it holds whatever ramp the host pins.
      expect(heading).toBe(await px(component.getByTestId("one-up")));
      expect(heading).toBeGreaterThan(await px(component.getByTestId("body")));
    });
  }
});

/**
 * `StyledLink` sizes exactly as `StyledText` does — a SECOND, EARLIER
 * regression (NEH-1561).
 *
 * The text defect arrived with the codemod on 2026-09-02. This one is older:
 * `433c7416` (2026-08-16) replaced HopperGuard's local `StyledLink`, which
 * wrapped its children in a bare `<StyledText>` and therefore followed the
 * profile, with this package's — which contained **no font-size logic at all**.
 * The only occurrence of the word "size" in the file was inside a comment. A
 * link fell through to the document's `font-size` and stopped moving in either
 * direction.
 *
 * A link is the worst possible place for this, because it sits *inside a
 * sentence*: when the sentence follows the setting and the link does not, they
 * disagree **mid-line** — a visibly smaller word in running text. This
 * component's own `externalIndicator` doc already makes that argument for the
 * glyph ("a character inherits `currentColor` and the font scale, so it cannot
 * end up a different colour or size from the label beside it") and did not
 * apply it to the link's own text.
 */
test.describe("StyledLink participates in the scale", () => {
  for (const profile of PROFILES) {
    test(`a link in a sentence matches the sentence at the ${profile} profile`, async ({
      mount,
    }) => {
      // The bare wrapper div is not decoration: `mount` returns a locator for
      // the ROOT it rendered, and a locator does not match itself — so putting
      // the sentence at the root makes `getByTestId("sentence")` search only
      // its descendants and time out rather than fail.
      const component = await mount(
        <div>
          <StonedogStyleProvider fontSizeProfile={profile}>
            <StyledText data-testid="sentence">
              This platform is designed to support{" "}
              <StyledLink href="/hipaa" data-testid="link">
                HIPAA compliance
              </StyledLink>
              .
            </StyledText>
          </StonedogStyleProvider>
        </div>,
      );

      // An EQUALITY against the surrounding text, never against a pixel
      // constant: a constant goes stale the moment a host retunes its ramp, and
      // a stale constant in a green test is how the original defect survived.
      expect(await px(component.getByTestId("link"))).toBe(
        await px(component.getByTestId("sentence")),
      );
    });
  }

  for (const presentation of ["text", "flow", "control"] as const) {
    test(`a ${presentation} link moves when the profile moves`, async ({ mount }) => {
      const component = await mount(
        <div>
          <StonedogStyleProvider fontSizeProfile="md">
            <StyledLink href="/x" presentation={presentation} data-testid="at-md">
              HIPAA compliance
            </StyledLink>
          </StonedogStyleProvider>
          <StonedogStyleProvider fontSizeProfile="xl">
            <StyledLink href="/x" presentation={presentation} data-testid="at-xl">
              HIPAA compliance
            </StyledLink>
          </StonedogStyleProvider>
        </div>,
      );

      // All three presentations, because the owner's own report named a `flow`
      // link — a standalone box with no styled text around it to inherit from,
      // which is precisely the case that could never have worked by inheritance.
      expect(await px(component.getByTestId("at-xl"))).toBeGreaterThan(
        await px(component.getByTestId("at-md")),
      );
    });
  }

  test('an explicit size on a link is relative, exactly as on StyledText', async ({
    mount,
  }) => {
    const component = await mount(
      <div>
        <StonedogStyleProvider fontSizeProfile="xl">
          <StyledLink href="/x" size="sm" data-testid="link-xl">
            link
          </StyledLink>
          <StyledText size="sm" data-testid="text-xl">
            text
          </StyledText>
        </StonedogStyleProvider>
        <StonedogStyleProvider fontSizeProfile="md">
          <StyledLink href="/x" size="sm" data-testid="link-md">
            link
          </StyledLink>
        </StonedogStyleProvider>
      </div>,
    );

    // Same prop, same rule, same answer — "a StyledLink should act the same as
    // StyledText but with additional identifiers that it's a clickable link".
    expect(await px(component.getByTestId("link-xl"))).toBe(
      await px(component.getByTestId("text-xl")),
    );
    expect(await px(component.getByTestId("link-xl"))).toBeGreaterThan(
      await px(component.getByTestId("link-md")),
    );
  });

  test("the 48px tap target survives the SMALLEST profile", async ({ mount }) => {
    const component = await mount(
      <div>
        <StonedogStyleProvider fontSizeProfile="xs">
          <StyledLink href="/x" presentation="control" data-testid="control">
            Settings
          </StyledLink>
        </StonedogStyleProvider>
      </div>,
    );
    const box = await component.getByTestId("control").boundingBox();
    expect(box).not.toBeNull();
    // The floor is a MINIMUM BOX, not a font size. Shrinking the text must not
    // shrink the target — WCAG 2.5.5/2.5.8 do not get smaller when a user turns
    // their text down, and a font-size change that ate the floor would be a
    // silent accessibility regression with nothing else asserting it.
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });

  test("a text link does NOT acquire a 48px line box at any profile", async ({
    mount,
  }) => {
    const component = await mount(
      <div style={{ width: "400px" }}>
        {PROFILES.map((profile) => (
          <StonedogStyleProvider key={profile} fontSizeProfile={profile}>
            <div>
              <StyledText block data-testid={`styled-${profile}`}>
                Deadlines are computed from the rules, and you can{" "}
                <StyledLink href="/x">add the missing details</StyledLink> at any
                time.
              </StyledText>
              <StyledText block data-testid={`plain-${profile}`}>
                Deadlines are computed from the rules, and you can{" "}
                <a href="/x">add the missing details</a> at any time.
              </StyledText>
            </div>
          </StonedogStyleProvider>
        ))}
      </div>,
    );

    for (const profile of PROFILES) {
      const styled = await component.getByTestId(`styled-${profile}`).boundingBox();
      const plain = await component.getByTestId(`plain-${profile}`).boundingBox();
      expect(styled).not.toBeNull();
      expect(plain).not.toBeNull();

      /*
       * Compared against a paragraph holding a plain `<a>`, not against a
       * pixel ceiling. `buttonRecipe`'s base states `min-height: 48px`, and a
       * link in a paragraph measured 48.375px before `presentation` existed —
       * it forced the line box open around it.
       *
       * `StyledLink.ct.tsx` records why the absolute form is the wrong
       * assertion, and the first version of THIS test made the same mistake
       * again: an inline element that wraps reports the height of every line
       * box it spans, so any constant depends on text metrics and on where the
       * wrap lands. It failed at 35px against a 28px ceiling for a rendering
       * that was entirely correct.
       *
       * The relative claim is the one that matters and it is font-independent:
       * a paragraph containing a StyledLink is the same height as the identical
       * paragraph containing a bare anchor — at every profile, which is the
       * part this file adds. If the control box ever comes back, or if the
       * link's own font-size drifts from the sentence's, these diverge
       * immediately.
       */
      expect(
        Math.abs(styled!.height - plain!.height),
        `the link changed the line box at the ${profile} profile`,
      ).toBeLessThan(1);
    }
  });
});

/**
 * The rendered-pixel matrix, printed rather than asserted.
 *
 * Not a guard — a record. The numbers a reviewer needs in order to say whether
 * a sizing change did what it claimed are otherwise nowhere, and reconstructing
 * them by hand from a ramp and an offset table is exactly the arithmetic this
 * change exists to stop people doing.
 *
 * Two ramps: the package's own fallbacks (what a host gets for saying nothing)
 * and HopperGuard's elder scale pinned on a wrapper, because that is the
 * consumer the defect was reported against and the one where 12px mattered.
 */
const HOPPER_RAMP = {
  "--font-sizes-xs": "0.75rem",
  "--font-sizes-sm": "1.0625rem",
  "--font-sizes-md": "1.375rem",
  "--font-sizes-lg": "1.6875rem",
  "--font-sizes-xl": "2rem",
  "--font-sizes-2xl": "2.3125rem",
  "--font-sizes-3xl": "2.625rem",
} as unknown as Record<string, string>;

test("MATRIX: rendered px by profile and size", async ({ mount }) => {
  const rows: Array<{ ramp: string; profile: FontSizeProfile } & Record<string, unknown>> =
    [];

  const RAMPS: Array<[string, Record<string, string> | undefined]> = [
    ["package-fallback", undefined],
    ["hopperguard", HOPPER_RAMP],
  ];

  for (const [ramp, ramps] of RAMPS) {
    const component = await mount(
      <div style={ramps}>
        {PROFILES.map((profile) => (
          <StonedogStyleProvider key={profile} fontSizeProfile={profile}>
            <div>
              {SIZES.map((size) => (
                <StyledText key={size} size={size} data-testid={`${profile}-${size}`}>
                  x
                </StyledText>
              ))}
              <StyledText data-testid={`${profile}-unsized`}>x</StyledText>
              <StyledHeading data-testid={`${profile}-heading`}>x</StyledHeading>
              <StyledLink href="/x" data-testid={`${profile}-link`}>
                x
              </StyledLink>
            </div>
          </StonedogStyleProvider>
        ))}
      </div>,
    );

    for (const profile of PROFILES) {
      const row: Record<string, unknown> = { ramp, profile };
      for (const key of [...SIZES, "unsized", "heading", "link"]) {
        row[key] = await px(component.getByTestId(`${profile}-${key}`));
      }
      rows.push(row as never);
    }
    await component.unmount();
  }

  // Written to a file rather than logged: a `list` reporter does not print an
  // attachment and this repo's lint forbids a console call, so a file is the
  // one channel that survives both. The path is announced in the test title so
  // whoever needs the numbers can find them without reading this.
  writeFileSync(
    test.info().outputPath("font-size-matrix.json"),
    JSON.stringify(rows, null, 2),
  );
  await test.info().attach("font-size-matrix", {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });

  expect(rows).toHaveLength(PROFILES.length * 2);
});

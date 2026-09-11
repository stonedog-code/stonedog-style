import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/experimental-ct-react";
import {
  ControlFontSizeHarness,
  FixedSizeControlHarness,
  PinnedVsRelativeTagHarness,
} from "./control-font-size.harness";

/**
 * **Does the reader's font-size setting reach a CONTROL?** (NEH-1561)
 *
 * `font-size-profile.ct.tsx` asks this of text and links. It was never asked of
 * the five components below, and four of them answered no at every profile:
 *
 * | component | before | how it was frozen |
 * |---|---|---|
 * | `StyledButton` | label **already followed** the profile; its BOX sat at **13.3333px** | `buttonRecipe` declared no `font-size`, and a `<button>` inherits none — Chrome's UA sheet supplies 13.3333px |
 * | `StyledIconButton` | **12 / 14 / 16 / 20px**, flat | `buttonIconRecipe` stated an absolute rem per `size` variant |
 * | `StyledTag` | **14px** (this ramp) / **17px** (HopperGuard's), flat | `tagRecipe` named the static token `sm` |
 * | `StyledAlert` | **16px**, flat | no `font-size` anywhere on `root`/`title`/`description`; it inherited the document |
 * | `StyledTable` | **14px**, flat | a hardcoded px literal, which this repo forbids outright |
 *
 * **A static token is not an absence, and that distinction is the whole shape
 * of the fix.** Only `StyledButton` had a hole to fill. The other three had a
 * VALUE to replace, so each needed a decision about which step it should be
 * rather than a line added — and each of those decisions is recorded on the
 * recipe and the prop it belongs to, not here.
 *
 * ## Why the host's `:root` variables cannot be the fix
 *
 * The thirteen `--font-sizes-*` properties are the SCALE, not a step on it: a
 * host writes them once, statically, and the profile works by choosing a
 * different KEY. Making them profile-dependent would silently re-size every
 * component naming a static token and every `rem`-based dimension in the app.
 * So a component that never names a key never sees the setting — which is
 * exactly how four of these five went unnoticed.
 *
 * ## Why this cannot live in the unit tier
 *
 * jsdom has no layout engine, and **its CSS parser rejects
 * `var(--font-sizes-*, …)` against the `font-size` grammar and drops the
 * declaration** — the element ends up with no `style` attribute at all, so
 * `toHaveStyle({ fontSize: … })` compares `""` with `""` and passes for every
 * expectation. That is how the original defect survived 7,192 unit tests.
 *
 * ## Everything here is a RELATION, never a pixel constant
 *
 * A constant goes stale the moment a host retunes its ramp, and a stale
 * constant in a green test is how this shipped. The assertions compare a
 * control against the body text beside it, or against the same control at a
 * different profile. The only absolute is the 48px tap-target floor, which is a
 * WCAG number and does not move.
 */

const PROFILES = ["xs", "sm", "md", "lg", "xl"] as const;
const ICON_SIZES = ["1x", "sm", "md", "lg"] as const;

/**
 * HopperGuard's elder ramp, pinned on a wrapper.
 *
 * The consumer the defect was reported against, and the one where the gap was
 * visible: it pins `--font-sizes-md` to 1.375rem while leaving the DOCUMENT at
 * the browser's 16px, so a component that inherited rather than naming a key
 * rendered 6px smaller than the sentence above it at the default profile and
 * 16px smaller at `xl`.
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

/** Read the computed `font-size` of one element, in px, as a number. */
async function px(locator: {
  evaluate: (fn: (el: Element) => string) => Promise<string>;
}): Promise<number> {
  const value = await locator.evaluate((el) => getComputedStyle(el).fontSize);
  const parsed = Number.parseFloat(value);
  // A `var()` that fails to resolve comes back as "" rather than throwing, and
  // NaN compares false against every operator — a silent pass. Refused here.
  expect(Number.isFinite(parsed), `font-size was "${value}"`).toBe(true);
  expect(parsed).toBeGreaterThan(0);
  return parsed;
}

/**
 * THE ASSERTION THAT WAS MISSING.
 *
 * A control's label reads at the same step as the sentence beside it — at every
 * profile, not at the one the author happened to develop on.
 */
test.describe("a control's label follows the reader's profile", () => {
  for (const profile of PROFILES) {
    test(`button, alert and tag all track body text at the ${profile} profile`, async ({
      mount,
    }) => {
      const component = await mount(
        <div>
          <ControlFontSizeHarness profile={profile} />
        </div>,
      );

      const body = await px(component.getByTestId("body"));
      const oneDown = await px(component.getByTestId("one-down"));

      // The button's LABEL was never the broken half — it goes through
      // StyledText. Asserted anyway: the fix routes `size`/`fixedSize` through
      // the button, and a wiring mistake there would freeze the one part that
      // worked, with nothing else here noticing.
      const button = component.getByTestId("button");
      expect(await px(button.locator("span").first())).toBe(body);
      // …and the button's own BOX now agrees with its label. This is the half
      // that was at 13.3333px, and it is what everything measured in `em`
      // against the button — the icon gap, the spinner — actually rides on.
      expect(await px(button)).toBe(body);

      // One declaration on the alert root; title and description inherit it, so
      // the three can never drift out of proportion.
      const alert = component.getByTestId("alert");
      expect(await px(alert)).toBe(body);
      expect(await px(alert.locator("div > div").first())).toBe(body);
      expect(await px(alert.locator("div > div").nth(1))).toBe(body);

      // A tag is deliberately a step quieter than the sentence — which is what
      // `tagRecipe`'s absolute `sm` token was always trying to say. Compared
      // against the thing that MEANS one step down, never against 14px.
      expect(await px(component.getByTestId("tag"))).toBe(oneDown);

      // A table cell, same relationship — see the note on `PandaTableRoot`.
      expect(await px(component.getByTestId("cell"))).toBe(oneDown);

      // The icon button's `md` is body size; it is the neutral rung of the
      // control-size ladder, exactly as `md` is of the text ramp.
      expect(await px(component.getByTestId("icon-md"))).toBe(body);
    });
  }
});

/**
 * Direction two: each control genuinely MOVES.
 *
 * Equality against body text at every profile would also be satisfied by a
 * system where nothing moves at all, if body text were frozen too. It is not —
 * `font-size-profile.ct.tsx` proves that separately — but the claim is cheap to
 * hold directly and expensive to discover missing.
 */
test.describe("every control grows from the smallest profile to the largest", () => {
  test("xl renders larger than xs for all five", async ({ mount }) => {
    const component = await mount(
      <div>
        <div data-testid="wrap-xs">
          <ControlFontSizeHarness profile="xs" />
        </div>
        <div data-testid="wrap-xl">
          <ControlFontSizeHarness profile="xl" />
        </div>
      </div>,
    );

    const at = (profile: "xs" | "xl", id: string) =>
      component.getByTestId(`wrap-${profile}`).getByTestId(id);

    for (const id of ["button", "icon-md", "tag", "alert", "cell"]) {
      expect(
        await px(at("xl", id)),
        `${id} did not move between the xs and xl profiles`,
      ).toBeGreaterThan(await px(at("xs", id)));
    }
  });
});

/**
 * The 48px floor is a MINIMUM BOX, not a font size — in both directions.
 *
 * This is the constraint most easily broken by a font-size change, and it
 * breaks silently: nothing in the type system or the stylesheet relates the two
 * numbers. `buttonRecipe` and `buttonIconRecipe` state `min-height`/`min-width`
 * on their base, so shrinking the label cannot erode the target and growing it
 * cannot be capped by it.
 */
test.describe("the tap-target floor survives the whole scale", () => {
  test("no control drops below 48px at the SMALLEST profile", async ({ mount }) => {
    const component = await mount(
      <div>
        <ControlFontSizeHarness profile="xs" />
      </div>,
    );

    for (const id of ["button", ...ICON_SIZES.map((s) => `icon-${s}`)]) {
      const box = await component.getByTestId(id).boundingBox();
      expect(box, `${id} had no box`).not.toBeNull();
      expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(48);
      expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(48);
    }

    // The remove control inside a tag is the one most likely to lose its floor:
    // the tag around it is deliberately SMALL and a step below body text.
    const remove = await component.getByTestId("tag").locator("button").boundingBox();
    expect(remove).not.toBeNull();
    expect(remove!.height).toBeGreaterThanOrEqual(48);
    expect(remove!.width).toBeGreaterThanOrEqual(48);
  });

  test("a control GROWS past the floor at the largest profile rather than clipping", async ({
    mount,
  }) => {
    const component = await mount(
      <div style={HOPPER_RAMP}>
        <ControlFontSizeHarness profile="xl" />
      </div>,
    );

    const button = component.getByTestId("button");
    const box = await button.boundingBox();
    const label = await px(button.locator("span").first());
    expect(box).not.toBeNull();
    // A floor that also acted as a ceiling would crop the label of the reader
    // who turned the setting up — the reader the setting exists for. Stated as
    // "taller than the text it holds", which is font-independent.
    expect(box!.height).toBeGreaterThan(label);
    expect(box!.height).toBeGreaterThan(48);
  });
});

/**
 * `fixedSize` is the one thing that must NOT become relative.
 *
 * It exists for a label inside a control whose height genuinely cannot grow.
 * Making it follow the profile is the plausible over-application of this fix,
 * and nothing else in this file would fail.
 */
test.describe("fixedSize still pins to md on every control", () => {
  test("a fixedSize control renders identically at every profile", async ({ mount }) => {
    const component = await mount(
      <div style={HOPPER_RAMP}>
        {PROFILES.map((profile) => (
          <div key={profile} data-testid={`fixed-${profile}`}>
            <FixedSizeControlHarness profile={profile} />
          </div>
        ))}
      </div>,
    );

    const first = component.getByTestId("fixed-xs");
    const reference: Record<string, number> = {};
    for (const id of ["button", "icon", "tag", "alert", "cell"]) {
      reference[id] = await px(first.getByTestId(id));
    }

    for (const profile of PROFILES) {
      const scope = component.getByTestId(`fixed-${profile}`);
      for (const id of ["button", "icon", "tag", "alert", "cell"]) {
        expect(
          await px(scope.getByTestId(id)),
          `${id} moved at the ${profile} profile despite fixedSize`,
        ).toBe(reference[id]);
      }
    }
  });

  test("fixedSize is genuinely pinned, not accidentally equal", async ({ mount }) => {
    // The same control WITHOUT `fixedSize` at the same profile must be larger,
    // or the test above would pass over a system where nothing moves at all.
    const component = await mount(
      <div style={HOPPER_RAMP}>
        <PinnedVsRelativeTagHarness profile="xl" />
      </div>,
    );

    expect(await px(component.getByTestId("relative"))).toBeGreaterThan(
      await px(component.getByTestId("pinned")),
    );
  });
});

/**
 * The clamp, at both ends, asserted as intended behaviour.
 *
 * A tag and a table cell are a step BELOW body text, so they are the two that
 * can fall off the bottom of the ramp — and the reader at the smallest profile
 * is the one with the least room to spare.
 */
test.describe("an offset never falls off the scale", () => {
  test("at the SMALLEST profile a below-body control matches body rather than shrinking past it", async ({
    mount,
  }) => {
    const component = await mount(
      <div>
        <ControlFontSizeHarness profile="xs" />
      </div>,
    );

    const body = await px(component.getByTestId("body"));
    expect(await px(component.getByTestId("tag"))).toBe(body);
    expect(await px(component.getByTestId("cell"))).toBe(body);
    // `icon-1x` is two steps down, so it clamps to the same place.
    expect(await px(component.getByTestId("icon-1x"))).toBe(body);
  });

  test("at the LARGEST profile an above-body control still resolves to a real value", async ({
    mount,
  }) => {
    const component = await mount(
      <div style={HOPPER_RAMP}>
        <ControlFontSizeHarness profile="xl" />
      </div>,
    );
    // `icon-lg` is two steps UP from `xl`. Unclamped that indexes past the end
    // of FONT_SIZE_ORDER, `fontSizeMap[undefined]` is undefined, and the glyph
    // renders with no font-size at all — which `px()` refuses as NaN.
    expect(await px(component.getByTestId("icon-lg"))).toBeGreaterThan(
      await px(component.getByTestId("body")),
    );
  });
});

/**
 * The rendered-pixel matrix, printed rather than asserted.
 *
 * Not a guard — a record, in the shape `font-size-profile.ct.tsx` established.
 * Two ramps: the package's own fallbacks (what both Optima products run, since
 * each sets `body { font-size: var(--font-sizes-md) }` over a 1rem `md`) and
 * HopperGuard's elder scale.
 */
test("MATRIX: rendered px by profile, for every control", async ({ mount }) => {
  const rows: Record<string, unknown>[] = [];
  const RAMPS: Array<[string, Record<string, string> | undefined]> = [
    ["package-fallback", undefined],
    ["hopperguard", HOPPER_RAMP],
  ];

  for (const [ramp, vars] of RAMPS) {
    const component = await mount(
      <div style={vars}>
        {PROFILES.map((profile) => (
          <div key={profile} data-testid={`wrap-${profile}`}>
            <ControlFontSizeHarness profile={profile} />
          </div>
        ))}
      </div>,
    );

    for (const profile of PROFILES) {
      const scope = component.getByTestId(`wrap-${profile}`);
      const row: Record<string, unknown> = { ramp, profile };
      row.body = await px(scope.getByTestId("body"));
      row.buttonBox = await px(scope.getByTestId("button"));
      row.buttonLabel = await px(scope.getByTestId("button").locator("span").first());
      row.buttonHeight = (await scope.getByTestId("button").boundingBox())?.height;
      for (const size of ICON_SIZES) {
        row[`icon_${size}`] = await px(scope.getByTestId(`icon-${size}`));
      }
      row.tag = await px(scope.getByTestId("tag"));
      row.alert = await px(scope.getByTestId("alert"));
      row.tableCell = await px(scope.getByTestId("cell"));
      rows.push(row);
    }
    await component.unmount();
  }

  // A file, not a console call: this repo's lint forbids the latter and a `list`
  // reporter does not print an attachment.
  writeFileSync(
    test.info().outputPath("control-font-size-matrix.json"),
    JSON.stringify(rows, null, 2),
  );
  await test.info().attach("control-font-size-matrix", {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });

  expect(rows).toHaveLength(PROFILES.length * 2);
});

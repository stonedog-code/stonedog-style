import { render, screen } from "@testing-library/react";
import StyledText from "../StyledText";
import StyledHeading from "../StyledHeading";
import {
  fontSizeMap,
  getFontSizeValue,
  resolveFontSizeKey,
  stepUpFontSize,
} from "../../config/font-size";

describe("StyledText", () => {
  it("renders its children", () => {
    render(<StyledText>hello</StyledText>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  /**
   * The size rule, asserted on the rule rather than on a rendered `font-size`.
   *
   * These three used to render a `StyledText` and call
   * `toHaveStyle({ fontSize: fontSizeMap.xl })`. **That could not fail**
   * (NEH-406): every `fontSizeMap` entry is a `var(--font-sizes-*, …)`
   * reference, jsdom rejects it against the `font-size` grammar and drops the
   * declaration, so the element carries no `style` attribute at all and the
   * matcher compared "" with "". Swapping `xl` for `xs` left them green.
   *
   * So the claim is split. Which step wins is a pure function, and belongs
   * here where it can genuinely be checked; what that step *measures* is a
   * browser question and lives in `StyledText.ct.tsx`.
   */
  it("sizes text from the app-wide profile", () => {
    expect(resolveFontSizeKey({ profile: "xl" })).toBe("xl");
  });

  /**
   * **This assertion is INVERTED, deliberately (NEH-1561).** It used to read
   * `expect(resolveFontSizeKey({ size: "xs", profile: "xl" })).toBe("xs")`
   * under the title "lets an explicit size win over the profile", and it was
   * green the whole time the product was broken — because winning over the
   * profile was the defect.
   *
   * A host defines `--font-sizes-*` once at `:root` with static values, so the
   * user's setting works only by choosing a different KEY. An explicit `size`
   * chose the key itself, and the setting stopped reaching the element: 1,394
   * of 1,661 call sites in an eldercare product, 461 of them frozen at 12px,
   * unmoved by a reader turning their text size all the way up.
   *
   * So `size` is now an OFFSET from `md` applied to the profile. `xs` is two
   * steps below body, and two steps below `xl` is `md`.
   *
   * Written out because the next reader's instinct will be that this flipped
   * by mistake. It did not — restoring the old expectation restores the bug,
   * and `font-size-profile.ct.tsx` will fail in a real browser if anyone does.
   */
  it("reads an explicit size as a step relative to the profile", () => {
    expect(resolveFontSizeKey({ size: "xs", profile: "xl" })).toBe("md");
    expect(resolveFontSizeKey({ size: "sm", profile: "xl" })).toBe("lg");
    expect(resolveFontSizeKey({ size: "lg", profile: "xl" })).toBe("2xl");
  });

  it("is the IDENTITY at the md profile, so a standard-scale host is untouched", () => {
    // The single most important property of the NEH-1561 change, and the reason
    // it could be made in a shared package with three consumers at all: the
    // offset is read from `md` and applied to the profile, so at `md` the two
    // cancel. Both Optima products run a standard scale at the default profile
    // and render exactly what they rendered before.
    for (const key of ["xs", "sm", "md", "lg", "xl", "2xl", "9xl"]) {
      expect(resolveFontSizeKey({ size: key, profile: "md" })).toBe(key);
      expect(resolveFontSizeKey({ size: key })).toBe(key);
    }
  });

  it("clamps at both ends rather than running off the scale", () => {
    // Bottom: the reader with their text size all the way down has the least
    // room to spare, so "a step smaller" resolves to the body size instead of
    // below the smallest tier the host offers.
    expect(resolveFontSizeKey({ size: "xs", profile: "xs" })).toBe("xs");
    expect(resolveFontSizeKey({ size: "sm", profile: "xs" })).toBe("xs");
    // Top: an offset past `9xl` stops there. Unclamped this is
    // FONT_SIZE_ORDER[14] — undefined — which renders as no font-size at all.
    expect(resolveFontSizeKey({ size: "9xl", profile: "xl" })).toBe("9xl");
    expect(resolveFontSizeKey({ size: "8xl", profile: "xl" })).toBe("9xl");
  });

  it("passes an unrecognised key through rather than guessing", () => {
    // A host may legitimately extend the ramp. Turning an unknown key into
    // `undefined` would be worse than passing it through.
    expect(resolveFontSizeKey({ size: "nonsense", profile: "xl" })).toBe("nonsense");
  });

  it("pins text to md when fixedSize is set", () => {
    // Used where a label must not grow with the profile — e.g. text inside a
    // fixed-height control that would otherwise clip.
    expect(resolveFontSizeKey({ fixedSize: true, profile: "xl" })).toBe("md");
    // ...and an explicit size still resolves against that pin rather than
    // against the profile, or `fixedSize` would be a trap on any call site that
    // also states a size. `fixedSize` supplies the BASE and `size` is an offset
    // from it, so this answer is unchanged by NEH-1561 — `md` minus one step is
    // still `sm`, at every profile.
    expect(resolveFontSizeKey({ size: "sm", fixedSize: true, profile: "xl" })).toBe("sm");
    expect(resolveFontSizeKey({ size: "sm", fixedSize: true, profile: "xs" })).toBe("sm");
  });

  it("falls back to md when the host names no profile", () => {
    expect(resolveFontSizeKey({})).toBe("md");
  });

  it("truncates with ellipsis when asked", () => {
    render(<StyledText ellipsis>long</StyledText>);
    expect(screen.getByText("long")).toHaveStyle({
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      overflow: "hidden",
    });
  });

  it("renders as another element when `as` is given", () => {
    render(<StyledText as="label">labelled</StyledText>);
    expect(screen.getByText("labelled").tagName).toBe("LABEL");
  });
});

describe("StyledHeading", () => {
  // Same split as above, and for the same reason — a rendered `font-size` is
  // unassertable here. The heading rule is "one step above whatever the text
  // around it is at", so it is `stepUpFontSize` composed with the same
  // precedence, and both halves are checkable directly.
  it("renders one tier above the current profile, so hierarchy survives every font size", () => {
    // The composition the component performs, written the way it now performs
    // it: `StyledHeading` hands down the OFFSET (`stepUpFontSize` of the
    // neutral origin, or of the caller's own relative size) and `StyledText`
    // applies the profile once. Composing the other way round — resolving the
    // profile here and stepping the absolute result — is the double
    // application this change had to avoid, and at `xl` it lands on `4xl`.
    expect(resolveFontSizeKey({ size: stepUpFontSize("md"), profile: "md" })).toBe("lg");
    expect(resolveFontSizeKey({ size: stepUpFontSize("md"), profile: "xl" })).toBe("2xl");
    // An explicit heading size keeps its relative meaning and still steps once.
    expect(resolveFontSizeKey({ size: stepUpFontSize("2xl"), profile: "md" })).toBe("3xl");
  });

  it("steps the offset ONCE, never once per layer", () => {
    // The regression guard for the composition above. `4xl` is what a heading
    // at the xl profile resolves to if both layers apply the profile — the
    // error grows with the setting, so it is worst exactly where an elder-scale
    // product needs this to be right.
    expect(resolveFontSizeKey({ size: stepUpFontSize("md"), profile: "xl" })).not.toBe(
      "4xl",
    );
  });

  it("clamps at the top of the scale rather than running off the end", () => {
    expect(stepUpFontSize("9xl")).toBe("9xl");
  });

  it("defaults to an h1", () => {
    render(<StyledHeading>heading</StyledHeading>);
    expect(screen.getByText("heading").tagName).toBe("H1");
  });

  it("renders the requested heading level", () => {
    render(<StyledHeading as="h3">sub</StyledHeading>);
    expect(screen.getByText("sub").tagName).toBe("H3");
  });
});

describe("the font-size scale", () => {
  it("is expressed in rem, never px, so it honours the browser's own setting", () => {
    // The accessibility affordance users with low vision actually reach for is
    // the browser font size; a px scale silently ignores it.
    for (const value of Object.values(fontSizeMap)) {
      expect(value).toMatch(/rem\)$/);
      expect(value).not.toMatch(/\dpx/);
    }
  });

  it("increases monotonically", () => {
    const sizes = Object.keys(fontSizeMap).map((k) =>
      parseFloat(getFontSizeValue(k)),
    );
    // Pairwise, so each element is read once and narrowed. Indexing twice per
    // iteration under noUncheckedIndexedAccess needs two assertions, and an
    // assertion in a test is a place a real regression can hide.
    for (let i = 1; i < sizes.length; i += 1) {
      const previous = sizes[i - 1];
      const current = sizes[i];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      expect(current as number).toBeGreaterThan(previous as number);
    }
  });

  it("reports unknown for a size it does not define", () => {
    expect(getFontSizeValue("gigantic")).toBe("unknown");
  });
});

/**
 * Block promotion (NEH-490).
 *
 * These assert the STYLE ATTRIBUTE, which is all jsdom can honestly answer —
 * it has no layout engine, so "does the margin actually move anything" is a
 * question only `StyledText.ct.tsx` can settle in a real browser. Both tiers
 * are here on purpose; neither replaces the other.
 */
describe("block promotion", () => {
  it("is inline by default", () => {
    render(<StyledText>plain</StyledText>);
    expect(screen.getByText("plain")).not.toHaveStyle({ display: "block" });
  });

  it.each([
    ["marginBottom", { marginBottom: "4" }],
    ["marginTop", { marginTop: "4" }],
    ["paddingBlock", { paddingBlock: "4" }],
    ["mb", { mb: "4" }],
    ["the explicit block prop", { block: true }],
  ])("promotes to a block box for %s", (_label, props) => {
    render(<StyledText {...(props as object)}>promoted</StyledText>);
    expect(screen.getByText("promoted")).toHaveStyle({ display: "block" });
  });

  /**
   * Horizontal spacing must NOT promote. It works on an inline box, and inline
   * text mid-sentence is the commonest use of this component — promoting here
   * would break working layout to fix an unrelated problem.
   */
  it.each([
    ["marginLeft", { marginLeft: "4" }],
    ["marginInline", { marginInline: "4" }],
    ["mx", { mx: "4" }],
  ])("does NOT promote for %s", (_label, props) => {
    render(<StyledText {...(props as object)}>inline</StyledText>);
    expect(screen.getByText("inline")).not.toHaveStyle({ display: "block" });
  });

  it("lets an explicit display from the caller win", () => {
    render(
      <StyledText marginBottom="4" style={{ display: "inline-flex" }}>
        explicit
      </StyledText>,
    );
    expect(screen.getByText("explicit")).toHaveStyle({ display: "inline-flex" });
  });

  it("does not leak the block prop onto the DOM node", () => {
    render(<StyledText block>clean</StyledText>);
    expect(screen.getByText("clean")).not.toHaveAttribute("block");
  });
});

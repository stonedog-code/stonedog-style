import { render, screen } from "@testing-library/react";
import StyledText from "../StyledText";
import StyledHeading from "../StyledHeading";
import {
  fontSizeMap,
  getFontSizeValue,
  resolveFontSizeKey,
  stepUpFontSize,
} from "../../config/font-size";
import type { FontSizeKey } from "../../config/types";

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

  it("lets an explicit size win over the profile", () => {
    expect(resolveFontSizeKey({ size: "xs", profile: "xl" })).toBe("xs");
  });

  it("pins text to md when fixedSize is set", () => {
    // Used where a label must not grow with the profile — e.g. text inside a
    // fixed-height control that would otherwise clip.
    expect(resolveFontSizeKey({ fixedSize: true, profile: "xl" })).toBe("md");
    // ...and an explicit size still outranks the pin, or `fixedSize` would be
    // a trap on any call site that also states a size.
    expect(resolveFontSizeKey({ size: "sm", fixedSize: true, profile: "xl" })).toBe("sm");
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
    expect(stepUpFontSize(resolveFontSizeKey({ profile: "md" }) as FontSizeKey)).toBe("lg");
    expect(stepUpFontSize(resolveFontSizeKey({ profile: "xl" }) as FontSizeKey)).toBe("2xl");
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

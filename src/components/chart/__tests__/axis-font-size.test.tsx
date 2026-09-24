import React from "react";
import { renderHook } from "@testing-library/react";
import { CHART_AXIS_FONT_SIZE, useChartAxisFontSize } from "../chart-palette";
import { StonedogStyleProvider } from "../../../config/style-config";
import {
  fontSizePx,
  resolveFontSizeKey,
  type FontSizeScale,
} from "../../../config/font-size";
import type { FontSizeProfile } from "../../../config/types";

/**
 * The axis ticks follow the reader's font-size profile, and never shrink
 * (NEH-1645).
 *
 * ## Why this is a jest test and not a `.ct.tsx`, against the usual rule
 *
 * The house split is: *which* value a component picks is a pure function and
 * belongs here; what it *renders as* is a browser question. This hook is
 * unusually the first half all the way down — it returns a plain **number** of
 * px, deliberately, because the charting library hands it to an SVG `<text>`
 * as a presentation attribute, where a `var()` would be discarded silently.
 *
 * So there is no `var()` to resolve and nothing for a real engine to add: the
 * number this returns IS the rendered size. That is exactly the case NEH-406
 * carves out, and it is why asserting it here is not the vacuous
 * `toHaveStyle({ fontSize: "var(…)" })` that rule exists to ban.
 */

const at = (profile: FontSizeProfile, fontSizeScale?: FontSizeScale): number =>
  renderHook(() => useChartAxisFontSize(), {
    wrapper: ({ children }) => (
      <StonedogStyleProvider fontSizeProfile={profile} fontSizeScale={fontSizeScale}>
        {children}
      </StonedogStyleProvider>
    ),
  }).result.current;

const PROFILES: FontSizeProfile[] = ["xs", "sm", "md", "lg", "xl"];

/**
 * A host ramp that DIFFERS from the package's — HopperGuard's, read from its
 * `globals.css` rather than invented, because that is the host the defect was
 * measured on (NEH-1677). `md` is 1.375rem here against the package's 1rem, so
 * every step past `xs` resolves to a different number than the fallback does.
 *
 * This is the case the suite could not previously express: every relation
 * below held over a ramp that was too small, because the hook had no host to
 * compare against.
 */
const HOST_RAMP: FontSizeScale = {
  rootPx: 16,
  ramp: {
    xs: "0.75rem",
    sm: "1.0625rem",
    md: "1.375rem",
    lg: "1.6875rem",
    xl: "2rem",
    "2xl": "2.3125rem",
    "3xl": "2.625rem",
    "4xl": "2.9375rem",
    "5xl": "3.25rem",
    "6xl": "3.5625rem",
    "7xl": "3.875rem",
    "8xl": "4.1875rem",
    "9xl": "4.5rem",
  },
};

describe("chart axis tick size", () => {
  it("is byte-identical at the default profile, so no consumer moves unasked", () => {
    /*
     * The ordering rule this package states for every default change: a
     * consumer on the default profile must render unchanged, and only the
     * non-default profiles the setting exists for may move. `sm` resolves to
     * `0.875rem` at the `md` profile, which is the 14 the literal used to be.
     */
    expect(at("md")).toBe(CHART_AXIS_FONT_SIZE);
  });

  it("grows for a reader who asked for larger text", () => {
    // The whole defect: body copy grew and the axis numbers beside it did not.
    expect(at("lg")).toBeGreaterThan(at("md"));
    expect(at("xl")).toBeGreaterThan(at("lg"));
  });

  it("never falls below the considered floor, at any profile", () => {
    /*
     * 14px is not a default that happened — `CHART_AXIS_FONT_SIZE`'s docblock
     * argues it up from a 12px reference because this audience is seniors and
     * adults with cognitive disabilities. A reader who sets SMALLER text must
     * not be taken below a floor that was chosen for legibility, so the
     * profile may only ever make the ticks bigger.
     */
    const measured = PROFILES.map((p) => at(p));
    expect(Math.min(...measured)).toBeGreaterThanOrEqual(CHART_AXIS_FONT_SIZE);
  });

  it("is a number, because an SVG presentation attribute cannot resolve a var()", () => {
    /*
     * The one property that makes the whole approach work. If this ever
     * becomes a string, the ticks silently fall back to the UA default — the
     * same invisible failure the literal had, wearing the fix's clothes.
     */
    for (const profile of PROFILES) {
      expect(typeof at(profile)).toBe("number");
      expect(Number.isFinite(at(profile))).toBe(true);
    }
  });
});

describe("chart axis tick size on a host that names its own ramp (NEH-1677)", () => {
  it("returns the HOST's value for the resolved key, not the package's", () => {
    /*
     * The whole issue. At `xl` the axis is `sm`-relative-to-`xl`, which is the
     * `lg` key; the package's `lg` is 1.125rem → 18px, the host's is
     * 1.6875rem → 27px. The old hook returned 18 beside this host's 32px body
     * text. Asserted against the ramp entry through `fontSizePx` rather than a
     * remembered literal, so the expectation cannot drift from its own input.
     */
    for (const profile of PROFILES) {
      const key = resolveFontSizeKey({ size: "sm", profile });
      const hostPx = fontSizePx(key, HOST_RAMP) as number;
      expect(hostPx).toBeGreaterThan(0);
      expect(at(profile, HOST_RAMP)).toBe(Math.max(CHART_AXIS_FONT_SIZE, Math.round(hostPx)));
    }
    // And the literal numbers, so a reader of this file sees the table the
    // issue measured rather than re-deriving it: 12 floored to 14, then the
    // host's sm / md / lg tiers at 16px per rem.
    expect(PROFILES.map((p) => at(p, HOST_RAMP))).toEqual([14, 14, 17, 22, 27]);
  });

  it("differs from the package ramp wherever the host's tier differs", () => {
    /*
     * The assertion that makes the test above non-vacuous: if the hook ignored
     * the scale, the host column would equal the package column and the block
     * above would still be checking `at() === at()`. `xs` and `sm` legitimately
     * agree — both resolve to the `xs` key, 12px, floored to 14 on either ramp.
     */
    const packageColumn = PROFILES.map((p) => at(p));
    const hostColumn = PROFILES.map((p) => at(p, HOST_RAMP));
    expect(packageColumn).toEqual([14, 14, 14, 16, 18]);
    expect(hostColumn).not.toEqual(packageColumn);
    for (const profile of ["md", "lg", "xl"] as const) {
      expect(at(profile, HOST_RAMP)).toBeGreaterThan(at(profile));
    }
  });

  it("keeps the floor on the host ramp too", () => {
    expect(Math.min(...PROFILES.map((p) => at(p, HOST_RAMP)))).toBeGreaterThanOrEqual(
      CHART_AXIS_FONT_SIZE,
    );
  });

  it("is byte-identical to the old literal at md when the host names nothing", () => {
    // `Math.round(0.875 * 16)` — the arithmetic the hook did before a host
    // could supply a ramp. A host that sets nothing must not move.
    expect(at("md")).toBe(14);
    expect(at("md")).toBe(CHART_AXIS_FONT_SIZE);
  });
});

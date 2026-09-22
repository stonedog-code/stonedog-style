import React from "react";
import { renderHook } from "@testing-library/react";
import { CHART_AXIS_FONT_SIZE, useChartAxisFontSize } from "../chart-palette";
import { StonedogStyleProvider } from "../../../config/style-config";
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

const at = (profile: FontSizeProfile): number =>
  renderHook(() => useChartAxisFontSize(), {
    wrapper: ({ children }) => (
      <StonedogStyleProvider fontSizeProfile={profile}>{children}</StonedogStyleProvider>
    ),
  }).result.current;

const PROFILES: FontSizeProfile[] = ["xs", "sm", "md", "lg", "xl"];

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

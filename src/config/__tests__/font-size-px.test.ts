import {
  DEFAULT_FONT_SIZE_SCALE,
  fontSizePx,
  getFontSizeValue,
  ROOT_FONT_SIZE_PX,
  type FontSizeScale,
} from "../font-size";
import { FONT_SIZE_KEYS } from "../types";

/**
 * `fontSizePx` — a size key as a number, against the host's ramp (NEH-1677).
 *
 * Pure arithmetic over two objects, so it belongs in jest: there is no
 * `var()` to resolve and nothing a browser would add. What it renders AS is
 * `useChartAxisFontSize`'s business and is asserted beside that hook.
 */
describe("fontSizePx", () => {
  it("converts every package fallback at 16px per rem when no scale is given", () => {
    // Byte-identical to the arithmetic the chart hook did before a host could
    // name its ramp: parseFloat(fallback) * 16. All thirteen, counted.
    let checked = 0;
    for (const key of FONT_SIZE_KEYS) {
      const rem = Number.parseFloat(getFontSizeValue(key));
      expect(fontSizePx(key)).toBe(rem * ROOT_FONT_SIZE_PX);
      checked += 1;
    }
    expect(checked).toBe(13);
    expect(fontSizePx("md")).toBe(16);
    expect(fontSizePx("sm")).toBe(14);
  });

  it("reads the host's rem entry against the host's root size", () => {
    const scale: FontSizeScale = { rootPx: 16, ramp: { md: "1.375rem" } };
    expect(fontSizePx("md", scale)).toBe(22);
    // A different root moves the answer — the whole reason rootPx is a field.
    expect(fontSizePx("md", { ...scale, rootPx: 20 })).toBe(27.5);
  });

  it("reads a px string as is and a number as px, ignoring rootPx for both", () => {
    const scale: FontSizeScale = { rootPx: 10, ramp: { md: "22px", lg: 27 } };
    expect(fontSizePx("md", scale)).toBe(22);
    expect(fontSizePx("lg", scale)).toBe(27);
  });

  it("falls through to the package fallback for a key the host did not name", () => {
    const scale: FontSizeScale = { rootPx: 16, ramp: { md: "1.375rem" } };
    // `sm` is not in the host's ramp, so it reads `0.875rem` at 16.
    expect(fontSizePx("sm", scale)).toBe(14);
  });

  it("returns undefined rather than guessing for anything it cannot convert", () => {
    expect(fontSizePx("nope")).toBeUndefined();
    expect(fontSizePx("md", { rootPx: 16, ramp: { md: "1.5em" } })).toBeUndefined();
    expect(fontSizePx("md", { rootPx: 16, ramp: { md: "large" } })).toBeUndefined();
    expect(fontSizePx("md", { rootPx: 16, ramp: { md: Number.NaN } })).toBeUndefined();
  });

  it("ships an EMPTY default ramp, so the thirteen fallbacks live in one place", () => {
    // A copy of `fontSizeMap`'s fallbacks here would be a second scale that
    // drifts — the shape `lib/fontSizeMap.ts` in the originating app removed.
    expect(DEFAULT_FONT_SIZE_SCALE.ramp).toEqual({});
    expect(DEFAULT_FONT_SIZE_SCALE.rootPx).toBe(16);
  });
});

/**
 * The visually-hidden style must not take itself out of flow.
 *
 * This looks like a style preference and is not: `position: absolute` is what
 * every sr-only recipe uses, and it is what let a table's gap labels push the
 * whole PAGE 156px sideways through two `overflow: hidden` ancestors and a
 * scrolling box. See the docblock on `sr-only.ts` for the measurement.
 *
 * jsdom cannot reproduce that — it has no layout engine — so what is guarded
 * here is the property that caused it, and the browser tier
 * (`StyledChart.ct.tsx`) asserts the outcome.
 */

import { SR_ONLY } from "../sr-only";

describe("SR_ONLY", () => {
  it("is not positioned, so it cannot escape an ancestor's clip", () => {
    expect(SR_ONLY.position).toBeUndefined();
  });

  it("still occupies no space and shows nothing", () => {
    expect(SR_ONLY.width).toBe(1);
    expect(SR_ONLY.height).toBe(1);
    expect(SR_ONLY.margin).toBe(-1);
    expect(SR_ONLY.overflow).toBe("hidden");
    expect(SR_ONLY.clipPath).toBe("inset(50%)");
    // Without this a long label wraps inside its 1px box before being
    // clipped, which some engines then report as a taller line box.
    expect(SR_ONLY.whiteSpace).toBe("nowrap");
  });

  it("does not use display:none, which would hide it from screen readers too", () => {
    // The failure in the other direction, and the one that makes the whole
    // thing pointless while still passing every layout assertion.
    expect(SR_ONLY.display).not.toBe("none");
  });
});

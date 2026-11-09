import { isTransparent } from "./fixtures/colour";

describe("isTransparent — the component tier's one reading of 'nothing painted'", () => {
  it.each([
    "rgba(0, 0, 0, 0)",
    "rgb(0 0 0 / 0)",
    "oklch(0 0 0 / 0)",
    "oklch(0 0 0 / 0%)",
    "color(srgb 0 0 0 / 0)",
    "hsla(0, 0%, 0%, 0)",
    "transparent",
  ])("reads %s as transparent", (value) => {
    expect(isTransparent(value)).toBe(true);
  });

  // The planted failures: a real paint, a half-opaque paint, an empty read.
  it.each([
    "rgb(239, 239, 239)",
    "rgba(0, 0, 0, 0.5)",
    "oklch(0.5 0.1 200 / 0.5)",
    "color-mix(in oklab, rgb(0 0 0) 50%, transparent)",
    "",
    "none",
  ])("does not read %s as transparent", (value) => {
    expect(isTransparent(value)).toBe(false);
  });
});

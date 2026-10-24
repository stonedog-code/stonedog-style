import { readFileSync } from "fs";
import { join } from "path";
import { SYSTEM_THEME_SURFACES, type BoxVar } from "./fixtures/system-theme-surfaces";

/**
 * The four glass variants NEH-2068 left for measurement — `dl-list`, `form`,
 * `stack`, `input-radio` — paint no surface of their own and pin no text
 * colour, so the text inside sits on the surface its container paired it with
 * (NEH-2075).
 *
 * ## What was wrong
 *
 * Each painted `rgba(255, 255, 255, 0.1)` behind a `blur(10px)` backdrop and
 * stated `color: textPrimary`. Measured in a real browser
 * (`glass-recipes.contrast.ct.tsx`) across the 18 SYSTEM theme/modes of the
 * largest consumer, identically on all four:
 *
 * - **on a glass tile** (opaque `boxBgPrimary`, NEH-1952) the 10% white took
 *   `textPrimary` to 3.78:1 (Autumn Magic light, Scandinavian Farm light),
 *   3.79:1 (Midnight dark) and 3.95:1 (Scandinavian Farm dark) — NEH-2068's
 *   defect at twice the alpha;
 * - **on the page** (`boxBgMain`) the pinned `textPrimary` is the partner of a
 *   surface the page is not: 1.04:1 on Autumn Magic light and Scandinavian
 *   Farm light (near-white on near-white), 1.18:1 on Ocean Breeze dark and Zen
 *   dark.
 *
 * This file's arithmetic reproduces both sets from the theme data alone.
 *
 * ## What this checks, and over what
 *
 * Read from the generated stylesheet, not the recipe source, because that is
 * what ships. For each variant: nothing painted, no backdrop blur, no `color`
 * of its own; and then the two placements scored across all 18 theme/modes —
 * `textPrimary` on the tile, `textMain` on the page, each over whatever the
 * variant now paints (nothing). A paint this file cannot read fails rather
 * than passes.
 */

const styles = readFileSync(
  join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
  "utf8",
);

const AA = 4.5;

type Rgb = [number, number, number];

/** Split a selector list on top-level commas only (`:is(a, b)` stays whole). */
function splitSelectorList(selectorList: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of selectorList) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

/** Every declaration a selector receives, across Panda's grouped rules. */
function declarationsFor(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const rawSelector = m[1]!.trim();
    if (rawSelector.startsWith("@")) continue;
    if (!splitSelectorList(rawSelector).includes(selector)) continue;
    for (const decl of m[2]!.split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      out[decl.slice(0, idx).trim().toLowerCase()] = decl.slice(idx + 1).trim();
    }
  }
  return out;
}

/**
 * The paint a rule lays over what is behind it, as `{ rgb, alpha }`, or
 * `"none"` when it paints nothing. Anything else is `null` — unreadable, which
 * the caller scores as a failure.
 */
function paintOf(decls: Record<string, string>): { rgb: Rgb; alpha: number } | "none" | null {
  if (decls["--mix-background"]) return null;
  const bg = decls["background-color"] ?? decls["background"];
  if (bg === undefined || bg === "transparent" || bg === "none") return "none";
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i.exec(bg.trim());
  if (!m) return null;
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

function rgb(hex: string): Rgb {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function ratio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => Math.round(c * alpha + bg[i]! * (1 - alpha))) as Rgb;
}

/**
 * The two places a consumer puts one of these, as (surface, ink) pairs. With
 * the variant painting nothing and pinning nothing, the ink is whatever the
 * container pairs with its own surface.
 */
const PLACEMENTS: ReadonlyArray<{ name: string; surface: BoxVar; ink: BoxVar }> = [
  { name: "tile", surface: "--hopper-box-primary-bg", ink: "--hopper-box-primary-text" },
  { name: "page", surface: "--hopper-box-main-bg", ink: "--hopper-box-main-text" },
];

/** Score one placement across every theme/mode for a given variant paint and ink. */
function score(
  paint: ReturnType<typeof paintOf>,
  placement: (typeof PLACEMENTS)[number],
  ink: BoxVar,
): { examined: number; failures: string[] } {
  if (paint === null) return { examined: 0, failures: ["variant paint is unreadable"] };
  const failures: string[] = [];
  let examined = 0;
  for (const tm of SYSTEM_THEME_SURFACES) {
    examined++;
    const under = rgb(tm.vars[placement.surface]);
    const surface = paint === "none" ? under : composite(paint.rgb, paint.alpha, under);
    const r = ratio(rgb(tm.vars[ink]), surface);
    // A fixture value that is not hex parses to NaN, and `NaN < AA` is false —
    // so an unparseable theme must fail here rather than pass silently.
    if (!Number.isFinite(r)) failures.push(`${tm.theme} ${tm.mode}: unparseable`);
    else if (r < AA) failures.push(`${tm.theme} ${tm.mode}: ${r.toFixed(2)}:1`);
  }
  return { examined, failures };
}

/** The variant's rule, by the className each recipe emits. */
const GLASS_SELECTORS = [
  ".dl-list--variant_glass",
  ".form--variant_glass",
  ".stack--variant_glass",
  ".input-radio__item--variant_glass",
] as const;

describe("the four remaining glass variants paint no surface and pin no ink (NEH-2075)", () => {
  it("inspected a real stylesheet and the full fixture, not an empty read", () => {
    expect(styles.length).toBeGreaterThan(10_000);
    expect(SYSTEM_THEME_SURFACES.length).toBe(18);
    expect(GLASS_SELECTORS.length).toBe(4);
  });

  describe.each(GLASS_SELECTORS)("%s", (selector) => {
    const decls = declarationsFor(styles, selector);

    it("still exists in the stylesheet: its border survived the change", () => {
      // The rule was read, and the one thing the variant still paints — its
      // 1px border — is there. An absent rule would make every "no paint"
      // assertion below pass over nothing.
      expect(decls["border"]).toBeDefined();
    });

    it("paints no background, so the text sits on its container's own surface", () => {
      expect(paintOf(decls)).toBe("none");
    });

    it("carries no backdrop blur — with nothing tinted, it would only blur an unpaired surface", () => {
      expect(decls["backdrop-filter"]).toBeUndefined();
      expect(decls["-webkit-backdrop-filter"]).toBeUndefined();
    });

    it("pins no text colour, so the container's ink is the one that renders", () => {
      expect(decls["color"]).toBeUndefined();
    });

    it.each(PLACEMENTS)(
      "clears AA in all 18 theme/modes on the $name, in that placement's own ink",
      (placement) => {
        const { examined, failures } = score(paintOf(decls), placement, placement.ink);
        expect(failures).toEqual([]);
        expect(examined).toBe(18);
      },
    );
  });

  describe("shows the fixture can fail: the pre-fix rule reproduces what the browser measured", () => {
    // The other direction, so a forgiving fixture cannot make the checks above
    // pass vacuously. The old rule, as every one of the four emitted it.
    const old = paintOf({ background: "rgba(255, 255, 255, 0.1)" });
    const pinnedInk: BoxVar = "--hopper-box-primary-text";

    const expectMeasured = (found: string[], measured: Record<string, number>) => {
      const got = Object.fromEntries(
        found.map((f) => {
          const [name, value] = f.split(": ");
          return [name!, Number.parseFloat(value!)];
        }),
      );
      // The same theme/modes the browser measured, and no others. The ratios
      // agree with the browser's to within 0.05: a canvas composites in 8-bit
      // with its own rounding, so the last digit is not this arithmetic's.
      expect(Object.keys(got).sort()).toEqual(Object.keys(measured).sort());
      for (const [name, value] of Object.entries(measured)) {
        expect(Math.abs(got[name]! - value)).toBeLessThan(0.05);
      }
    };

    it("on a glass tile: 10% white under textPrimary fails the measured four", () => {
      expect(old).not.toBe("none");
      const { examined, failures } = score(old, PLACEMENTS[0]!, pinnedInk);
      expect(examined).toBe(18);
      expectMeasured(failures, {
        "Autumn Magic light": 3.78,
        "Midnight dark": 3.79,
        "Scandinavian Farm light": 3.78,
        "Scandinavian Farm dark": 3.95,
      });
    });

    it("on the page: the pinned textPrimary over 10% white fails the measured four", () => {
      const { examined, failures } = score(old, PLACEMENTS[1]!, pinnedInk);
      expect(examined).toBe(18);
      expectMeasured(failures, {
        "Autumn Magic light": 1.04,
        "Scandinavian Farm light": 1.04,
        "Ocean Breeze dark": 1.18,
        "Zen dark": 1.18,
      });
    });

    it("on the page, even with the tint gone, a pinned textPrimary still fails — the ink was a defect of its own", () => {
      // This is why removing the background alone would not have been enough.
      const { failures } = score("none", PLACEMENTS[1]!, pinnedInk);
      expect(failures).not.toEqual([]);
    });
  });

  it("a checked radio item lays no wash over its variant's surface", () => {
    // The base recipe used to paint a literal `rgba(0, 123, 255, 0.2)` on
    // `[data-checked]`, over every variant, with no paired ink — on a glass
    // tile the checked glass item measured 4.23:1 (Zen dark) while its
    // unchecked neighbour passed. The rule still exists (the border colour
    // survived), and it paints nothing.
    const checked = declarationsFor(styles, ".input-radio__item[data-checked]");
    expect(checked["border-color"]).toBeDefined();
    expect(paintOf(checked)).toBe("none");
  });

  it("a fixture colour that is not hex fails rather than scoring NaN as a pass", () => {
    expect(Number.isFinite(ratio(rgb("var(--x)"), rgb("#000000")))).toBe(false);
  });

  it("an unreadable paint is a failure, never a pass", () => {
    expect(score(paintOf({ background: "var(--colors-something)" }), PLACEMENTS[0]!, "--hopper-box-primary-text").failures).not.toEqual([]);
  });
});

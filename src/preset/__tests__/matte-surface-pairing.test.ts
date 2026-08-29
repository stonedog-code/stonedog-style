import { readFileSync } from "fs";
import { join } from "path";

/**
 * `matte` paints an accent surface, so it takes the accent surface's text
 * token (NEH-881).
 *
 * ## The issue's stated cause does not exist
 *
 * NEH-881 was filed against a "FIXED dark gradient": `matte` was said to paint
 * `gray.800`→`gray.900` over its accent fill in every theme, leaving a themed
 * `textPrimary` glyph dark-on-dark at roughly 1.1:1 in a light theme. The fix
 * it proposed was a deliberate literal `color: "white"`, matching what `box`
 * and `input-bool` had already done.
 *
 * **That gradient never painted.** `bgGradient: "linear(to-b, …)"` is Chakra
 * v2 syntax. Panda has no `bgGradient` utility and no `linear()` shorthand, so
 * it passed the value through verbatim and emitted
 *
 *     background-image: linear(to-b, gray.800, gray.900);
 *
 * which is not valid CSS — `linear()` is an easing function, not an `<image>`
 * — and every engine discards the declaration at parse time. Confirmed in
 * Chromium against this stylesheet: the element reads back
 * `background-image: none`. The `background` shorthand emitted one line above
 * it had already reset `background-image` regardless.
 *
 * So the surface under `matte` has always been plain `buttonBgAccent`, and the
 * defect is the ordinary NEH-796 / NEH-877 mispairing: `textPrimary` is the
 * contract's partner for `boxBgPrimary`, not for an accent fill.
 *
 * Had the proposed fix been applied, `color: "white"` would have pinned the
 * WORST of the measured pairings — white on accent is the failing case in all
 * eight of them — in place, under a comment explaining that it was deliberate.
 *
 * ## Why the NEH-877 guard could not see it
 *
 * `variant-contrast-pairing.test.ts` reads `background-image` before
 * `background`. While the invalid gradient was emitted, the sweep took
 * `linear(to-b, gray.800, gray.900)` as this variant's surface — a value the
 * token contract says nothing about — and skipped the variant entirely. A dead
 * declaration was hiding a live one. Deleting it is therefore load-bearing
 * rather than tidying: it is what puts `matte` back under the guard that
 * already covers its five siblings.
 */

const styles = readFileSync(
  join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
  "utf8",
);

/** The two recipes are the same control in two shapes and carried one defect. */
const MATTE_SELECTORS = [".iconButton--variant_matte", ".button--variant_matte"] as const;

/**
 * Variants that already paint `buttonBgAccent` correctly, asserted so the fix
 * is shown not to have moved them. NEH-877 set these; nothing here should.
 */
const ALREADY_CORRECT_SELECTORS = [
  ".iconButton--variant_solid",
  ".iconButton--variant_outline",
  ".iconButton--variant_glass",
] as const;

const ACCENT_BG = "var(--colors-button-bg-accent)";
const ACCENT_TEXT = "var(--colors-button-text-accent)";

interface Declarations {
  [prop: string]: string;
}

/**
 * Split a selector list on its TOP-LEVEL commas only.
 *
 * A bare `split(",")` tears `:is(:hover, [data-hover])` in half, and the two
 * halves match nothing — so a pseudo-state rule silently contributes no
 * declarations and every assertion about it reads `undefined`. That looks like
 * "the recipe does not set this", which is exactly the wrong conclusion, and it
 * is how a check ends up green over a set it never assembled.
 */
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

/**
 * Every declaration a selector receives, accumulated across the comma-separated
 * rules Panda groups it into. Later rules win, as in the cascade.
 */
function declarationsFor(css: string, selector: string): Declarations {
  const out: Declarations = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const rawSelector = m[1]!.trim();
    if (rawSelector.startsWith("@")) continue;
    const matches = splitSelectorList(rawSelector).includes(selector);
    if (!matches) continue;
    for (const decl of m[2]!.split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      out[decl.slice(0, idx).trim().toLowerCase()] = decl.slice(idx + 1).trim();
    }
  }
  return out;
}

/**
 * The painted surface, in the order a browser resolves it.
 *
 * `background` is a shorthand and resets `background-image`, so a later
 * `background-image` only wins if it is VALID. `INVALID_IMAGE` is the one this
 * package emitted; anything matching it is discarded by the engine and must be
 * discarded here too, or this helper repeats the mistake the guard is for.
 */
const INVALID_IMAGE = /^linear\(/i;

function paintedSurface(decls: Declarations): string | null {
  const image = decls["background-image"];
  if (image && !INVALID_IMAGE.test(image)) return image;
  return decls["background-color"] ?? decls["background"] ?? null;
}

/**
 * The nine SYSTEM themes of the consuming application, in both modes — the
 * `buttonAccent` background and the two candidate text tokens, exported colour
 * data only. Eighteen theme/mode pairs, which is the input set every count
 * below is over.
 *
 * `textPrimary` is the `boxPrimary` group's text slot; `buttonTextAccent` is
 * the `buttonAccent` group's own. Both are read at the same mode as the
 * surface, because a token's light and dark values are independent.
 *
 * **This fixture is a snapshot, and a host adding a tenth theme will not
 * appear in it.** That is a real limit and it is bounded on purpose: this
 * package knows no colours and cannot reach a host's theme store, so the
 * alternative is not a live fixture but no arithmetic at all.
 *
 * What carries the guarantee for themes not listed here is the assertion that
 * `matte` paints `buttonBgAccent` and states `buttonTextAccent` — the token
 * contract, which is theme-independent and holds for every theme a host will
 * ever define. This table's job is narrower: to show, in numbers, that the
 * contract pairing is the one that clears AA and the previous pairing is the
 * one that did not. A stale row weakens the illustration; it cannot weaken the
 * contract.
 */
interface ThemeMode {
  theme: string;
  mode: "light" | "dark";
  buttonBgAccent: string;
  textPrimary: string;
  buttonTextAccent: string;
}

const THEME_MODES: ThemeMode[] = [
  { theme: "Autumn Magic", mode: "light", buttonBgAccent: "#F43F5E", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Autumn Magic", mode: "dark", buttonBgAccent: "#F43F5E", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Bright", mode: "light", buttonBgAccent: "#fef4cd", textPrimary: "#17191c", buttonTextAccent: "#000000" },
  { theme: "Bright", mode: "dark", buttonBgAccent: "#A3A3A3", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Cozy Fireplace", mode: "light", buttonBgAccent: "#F43F5E", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Cozy Fireplace", mode: "dark", buttonBgAccent: "#F59E0B", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Midnight", mode: "light", buttonBgAccent: "#009688", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Midnight", mode: "dark", buttonBgAccent: "#3B82F6", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Ocean Breeze", mode: "light", buttonBgAccent: "#0EA5E9", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Ocean Breeze", mode: "dark", buttonBgAccent: "#0EA5E9", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Pastel Rainbow", mode: "light", buttonBgAccent: "#EC4899", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Pastel Rainbow", mode: "dark", buttonBgAccent: "#F59E0B", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Sapphire", mode: "light", buttonBgAccent: "#8B5CF6", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Sapphire", mode: "dark", buttonBgAccent: "#5A77A8", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Scandinavian Farm", mode: "light", buttonBgAccent: "#22C55E", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Scandinavian Farm", mode: "dark", buttonBgAccent: "#10B981", textPrimary: "#FFF", buttonTextAccent: "#000000" },
  { theme: "Zen", mode: "light", buttonBgAccent: "#009688", textPrimary: "#000", buttonTextAccent: "#000000" },
  { theme: "Zen", mode: "dark", buttonBgAccent: "#14B8A6", textPrimary: "#FFF", buttonTextAccent: "#000000" },
];

const AA = 4.5;

function relativeLuminance(hex: string): number {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `var(--colors-button-text-accent)` -> `buttonTextAccent`. */
function tokenOf(cssVar: string | undefined): keyof ThemeMode | null {
  const m = /^var\(--colors-([a-z0-9-]+)\)$/i.exec((cssVar ?? "").trim());
  if (!m) return null;
  const camel = m[1]!.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  // Only the two tokens this fixture carries values for. Anything else is a
  // colour the fixture cannot score, and scoring it as a pass would be the
  // empty-set green this project keeps re-learning.
  if (camel === "textPrimary" || camel === "buttonTextAccent") return camel;
  return null;
}

describe("matte paints buttonBgAccent, so it states buttonTextAccent (NEH-881)", () => {
  it("inspected a real stylesheet rather than passing on an empty read", () => {
    expect(styles.length).toBeGreaterThan(10_000);
    expect(THEME_MODES.length).toBe(18);
    // Nine themes, both modes each — not eighteen rows of one theme.
    expect(new Set(THEME_MODES.map((t) => t.theme)).size).toBe(9);
    expect(THEME_MODES.filter((t) => t.mode === "dark").length).toBe(9);
    for (const selector of [...MATTE_SELECTORS, ...ALREADY_CORRECT_SELECTORS]) {
      expect(Object.keys(declarationsFor(styles, selector)).length).toBeGreaterThan(0);
    }
  });

  it("emits no invalid `linear()` background-image on either matte variant", () => {
    // The dead declaration NEH-881 mistook for the defect. It is removed
    // because while it was emitted the NEH-877 sweep read it as this variant's
    // surface and skipped the variant — not because an inert declaration is
    // untidy.
    const offenders = MATTE_SELECTORS.filter((selector) => {
      const image = declarationsFor(styles, selector)["background-image"];
      return Boolean(image && INVALID_IMAGE.test(image));
    });
    expect(offenders).toEqual([]);
  });

  it("paints buttonBgAccent and states buttonTextAccent on both matte variants", () => {
    const actual = MATTE_SELECTORS.map((selector) => {
      const decls = declarationsFor(styles, selector);
      return { selector, surface: paintedSurface(decls), color: decls["color"] ?? null };
    });
    expect(actual).toEqual(
      MATTE_SELECTORS.map((selector) => ({
        selector,
        surface: ACCENT_BG,
        color: ACCENT_TEXT,
      })),
    );
  });

  it("clears WCAG AA on all 18 theme/mode pairs with the colour it states", () => {
    // The arithmetic runs against the token the RECIPE names, not against a
    // constant — so this fails on pre-fix code (8 of 18, all dark mode, worst
    // 2.15:1) and passes after. A version asserting a fixed colour would pass
    // either way and prove nothing.
    const failures: string[] = [];
    let examined = 0;

    for (const selector of MATTE_SELECTORS) {
      const decls = declarationsFor(styles, selector);
      const token = tokenOf(decls["color"]);
      // Not scoreable is a FAILURE, not a skip. A recipe that moved to a
      // literal or an unmapped token would otherwise silently leave the
      // input set empty and this check would report green over nothing.
      if (!token) {
        failures.push(`${selector} states ${decls["color"] ?? "no colour"} — not scoreable`);
        continue;
      }
      for (const tm of THEME_MODES) {
        examined++;
        const ratio = contrastRatio(tm.buttonBgAccent, tm[token] as string);
        if (ratio < AA) {
          failures.push(
            `${selector} ${tm.theme} ${tm.mode}: ${tm[token]} on ${tm.buttonBgAccent} = ${ratio.toFixed(2)}:1`,
          );
        }
      }
    }

    // The input-set size, stated. "0 failures over 36" and "0 over 0" read the
    // same and are different facts.
    expect(examined).toBe(MATTE_SELECTORS.length * THEME_MODES.length);
    expect(failures).toEqual([]);
  });

  it("shows the fixture is capable of failing — textPrimary fails 8 of 18", () => {
    // The other direction. Without this the check above could pass because the
    // fixture is too forgiving to fail anything, which is the same green-over-
    // nothing in a different costume. These are the measured pre-fix numbers.
    const belowAA = THEME_MODES.filter(
      (tm) => contrastRatio(tm.buttonBgAccent, tm.textPrimary) < AA,
    );
    expect(belowAA.length).toBe(8);
    expect(belowAA.every((tm) => tm.mode === "dark")).toBe(true);
    // The worst pairing, named, so a fixture edit that flattens the spread is
    // visible rather than silently making the guard toothless.
    const worst = Math.min(
      ...THEME_MODES.map((tm) => contrastRatio(tm.buttonBgAccent, tm.textPrimary)),
    );
    expect(worst).toBeCloseTo(2.15, 2);
  });

  it("leaves the variants NEH-877 already corrected untouched", () => {
    // The fix must not repaint anything that was already right. All three
    // paint the same accent surface and already state its partner.
    for (const selector of ALREADY_CORRECT_SELECTORS) {
      const decls = declarationsFor(styles, selector);
      expect([selector, paintedSurface(decls), decls["color"]]).toEqual([
        selector,
        ACCENT_BG,
        ACCENT_TEXT,
      ]);
    }
  });

  it("leaves iconButton `ghost` alone, because its surface is a blend", () => {
    // NEH-881's reclassification also named `ghost` as carrying this defect.
    // It does not, and changing it would be a regression: the base paints
    // `buttonBgAccent/50`, which Panda emits as a `color-mix` with transparent
    // — a translucent surface, confirmed in Chromium as
    // `color(srgb … / 0.5)`. Over the host's own `boxBgMain` in each mode,
    // `textPrimary` clears AA on all 18 pairs (worst 5.03:1) while
    // `buttonTextAccent` would fall below it on 9 of them (worst 2.62:1).
    //
    // A single colour cannot clear AA on both a light and a dark ground; the
    // luminance windows do not overlap. `ghost`'s base sits on a blend that
    // follows the page, so it correctly follows the page's text colour, and
    // its `_hover` — which takes the fill to full opacity, a real contract
    // surface — already states `buttonTextAccent`. That split is the right
    // answer and the recipe already has it.
    const base = declarationsFor(styles, ".iconButton--variant_ghost");
    expect(base["color"]).toBe("var(--colors-text-primary)");
    expect(base["background"]).toContain("--mix-background");

    const hover = declarationsFor(styles, ".iconButton--variant_ghost:is(:hover, [data-hover])");
    expect(hover["background"]).toBe(ACCENT_BG);
    expect(hover["color"]).toBe(ACCENT_TEXT);
  });
});

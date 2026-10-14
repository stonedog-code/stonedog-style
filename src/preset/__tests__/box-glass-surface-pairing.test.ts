import { readFileSync } from "fs";
import { join } from "path";
import { TEXT_BACKGROUND_PAIRS } from "../semantic-variables";
import { SYSTEM_THEME_SURFACES, type BoxVar } from "./fixtures/system-theme-surfaces";

/**
 * `box glass` paints an opaque contract surface and the text that surface is
 * paired with (NEH-1952).
 *
 * ## What was wrong
 *
 * `glass` painted `boxBgSecondary/60` — Panda emits that as a `color-mix` with
 * `transparent`, so 40% of whatever sits behind the tile shows through — and
 * stated `textPrimary`, the contract's partner for `boxBgPrimary`. Two defects
 * in one rule:
 *
 *   1. the stated text was the partner of a DIFFERENT surface, and
 *   2. the surface was not a surface at all but a blend with the page, so the
 *      ratio was a function of the host's layout rather than of the theme.
 *
 * Measured in the consuming app's Overview, every SYSTEM theme in both modes:
 * tile subtitles at 2.41:1 and Zen-dark tile titles at 2.51:1. This file's
 * arithmetic reproduces both numbers from the theme data alone (2.41 and 2.52)
 * by compositing the 60% secondary surface over `boxBgMain`, which is how the
 * page behind a tile is painted there.
 *
 * ## Why `boxBgPrimary`, not an opaque `boxBgSecondary`
 *
 * The text inside a glass tile is mostly NOT painted by the box. `StyledText`
 * and `StyledHeading` render through `textRecipe`, whose base states
 * `textPrimary`. So whatever surface `glass` paints, the titles and body copy
 * inside it are `textPrimary` unless every call site overrides them. Measured
 * against the fixture: `textPrimary` on an opaque `boxBgSecondary` fails 10 of
 * 18 theme/modes (worst 2.15:1), while on `boxBgPrimary` it clears AA on all
 * 18. Painting the surface `textPrimary` is paired with is the one choice that
 * makes the DEFAULT text inside the tile correct, rather than one that needs
 * every consumer to repaint its headings.
 *
 * The cost, stated: a consumer that explicitly paints `textSecondary` inside a
 * glass tile (a "quieter" subtitle) is now mispaired, because that token is
 * the partner of `boxBgSecondary`. That is the misuse NEH-519 records — the
 * text tokens are a SURFACE axis, not an emphasis one — and it fails 8 of 18
 * here (worst 1.00:1). Such a call site should drop the override.
 *
 * ## What this checks, and over what
 *
 * Read from the generated stylesheet, not from the recipe source: the
 * stylesheet is what ships, and `/60` only becomes a `color-mix` there.
 */

const styles = readFileSync(
  join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
  "utf8",
);

const AA = 4.5;

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

const kebab = (token: string) => token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cssVar = (token: string) => `var(--colors-${kebab(token)})`;

/** `var(--colors-box-bg-primary)` -> the fixture property that holds it. */
const FIXTURE_VAR: Record<string, BoxVar> = {
  [cssVar("boxBgMain")]: "--hopper-box-main-bg",
  [cssVar("boxBgPrimary")]: "--hopper-box-primary-bg",
  [cssVar("boxBgSecondary")]: "--hopper-box-secondary-bg",
  [cssVar("textMain")]: "--hopper-box-main-text",
  [cssVar("textPrimary")]: "--hopper-box-primary-text",
  [cssVar("textSecondary")]: "--hopper-box-secondary-text",
};

/**
 * The surface a rule paints, as `{ token, alpha }`.
 *
 * Panda writes `bg: "x/60"` as
 *   --mix-background: color-mix(in srgb, var(--colors-x) 60%, transparent);
 *   background: var(--mix-background, var(--colors-x));
 * so a `--mix-background` declaration is what decides the alpha. Anything this
 * cannot read returns null, and the caller treats that as a failure — an
 * unreadable surface scored as a pass is the empty-set green.
 */
function surfaceOf(decls: Record<string, string>): { token: string; alpha: number } | null {
  const mix = decls["--mix-background"];
  if (mix) {
    const m = /color-mix\(in srgb,\s*(var\(--colors-[a-z0-9-]+\))\s+(\d+(?:\.\d+)?)%,\s*transparent\)/i.exec(mix);
    return m ? { token: m[1]!, alpha: Number(m[2]) / 100 } : null;
  }
  const bg = decls["background-color"] ?? decls["background"];
  if (!bg) return null;
  const plain = /^(var\(--colors-[a-z0-9-]+\))$/i.exec(bg.trim());
  return plain ? { token: plain[1]!, alpha: 1 } : null;
}

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` at `alpha` over an opaque `bg` — what the eye actually sees. */
function composite(
  fg: [number, number, number],
  alpha: number,
  bg: [number, number, number],
): [number, number, number] {
  return fg.map((c, i) => Math.round(c * alpha + bg[i]! * (1 - alpha))) as [number, number, number];
}

const GLASS = ".box--variant_glass";
const glass = declarationsFor(styles, GLASS);
/** What `StyledText` / `StyledHeading` paint inside the tile by default. */
const textBase = declarationsFor(styles, ".text");

/**
 * Score one text token on the glass surface across every theme/mode, with the
 * page behind a translucent tile taken to be `boxBgMain`.
 */
function score(
  textToken: string | undefined,
  surface: { token: string; alpha: number } | null,
): { examined: number; failures: string[]; worst: number } {
  const failures: string[] = [];
  let examined = 0;
  let worst = Infinity;
  const textVar = textToken ? FIXTURE_VAR[textToken.trim()] : undefined;
  const surfaceVar = surface ? FIXTURE_VAR[surface.token] : undefined;
  if (!textVar || !surface || !surfaceVar) {
    return {
      examined,
      failures: [`not scoreable: text ${textToken ?? "none"} on ${surface?.token ?? "no surface"}`],
      worst,
    };
  }
  for (const tm of SYSTEM_THEME_SURFACES) {
    examined++;
    const page = rgb(tm.vars["--hopper-box-main-bg"]);
    const painted = composite(rgb(tm.vars[surfaceVar]), surface.alpha, page);
    const r = ratio(rgb(tm.vars[textVar]), painted);
    worst = Math.min(worst, r);
    if (r < AA) failures.push(`${tm.theme} ${tm.mode}: ${r.toFixed(2)}:1`);
  }
  return { examined, failures, worst };
}

describe("box glass paints an opaque surface with its paired text (NEH-1952)", () => {
  it("inspected a real stylesheet and the full fixture, not an empty read", () => {
    expect(styles.length).toBeGreaterThan(10_000);
    expect(Object.keys(glass).length).toBeGreaterThan(5);
    expect(textBase["color"]).toBeDefined();
    expect(SYSTEM_THEME_SURFACES.length).toBe(18);
    expect(new Set(SYSTEM_THEME_SURFACES.map((t) => t.theme)).size).toBe(9);
    expect(SYSTEM_THEME_SURFACES.filter((t) => t.mode === "dark").length).toBe(9);
  });

  it("paints an OPAQUE surface, so the ratio is the theme's and not the page's", () => {
    const surface = surfaceOf(glass);
    expect(surface).not.toBeNull();
    expect(surface!.alpha).toBe(1);
    expect(glass["--mix-background"]).toBeUndefined();
  });

  it("states the text token the contract pairs with that surface", () => {
    const surface = surfaceOf(glass);
    const paired = Object.entries(TEXT_BACKGROUND_PAIRS).find(
      ([, bg]) => cssVar(bg) === surface?.token,
    );
    expect(paired).toBeDefined();
    expect(glass["color"]).toBe(cssVar(paired![0]));
  });

  it("clears AA on all 18 theme/modes for the colour the box states", () => {
    const { examined, failures } = score(glass["color"], surfaceOf(glass));
    expect(failures).toEqual([]);
    expect(examined).toBe(18);
  });

  it("clears AA on all 18 for the colour StyledText/StyledHeading paint inside it", () => {
    // The tile's title and kind are a StyledHeading; they never inherit the
    // box's colour because `textRecipe` states its own. This is the half the
    // box's own `color` cannot fix, and the reason the surface is primary.
    const { examined, failures } = score(textBase["color"], surfaceOf(glass));
    expect(failures).toEqual([]);
    expect(examined).toBe(18);
  });

  it("shows the fixture can fail: the pre-fix rule scores below AA", () => {
    // The other direction, so a forgiving fixture cannot make the checks above
    // pass vacuously. The old rule, as emitted before this change.
    const old = { token: cssVar("boxBgSecondary"), alpha: 0.6 };
    const title = score(cssVar("textPrimary"), old);
    const subtitle = score(cssVar("textSecondary"), old);
    expect(title.examined).toBe(18);
    // The measured Overview numbers, reproduced from theme data alone.
    expect(subtitle.worst).toBeCloseTo(2.41, 2);
    expect(title.failures).toContain("Zen dark: 2.52:1");
    expect(title.failures.length + subtitle.failures.length).toBeGreaterThan(10);
  });

  it("shows an opaque SECONDARY surface would not have been enough", () => {
    // The alternative fix, scored, so the choice of surface is evidence and not
    // taste: textRecipe's default text on an opaque boxBgSecondary.
    const alt = score(cssVar("textPrimary"), { token: cssVar("boxBgSecondary"), alpha: 1 });
    expect(alt.failures.length).toBe(10);
    expect(alt.worst).toBeCloseTo(2.15, 2);
  });

  it("records the cost: textSecondary on the new surface is a mispairing", () => {
    // The consumer-side half of this change, measured so the docblock above is
    // a number and not a guess. A call site painting `textSecondary` inside a
    // glass tile must drop it.
    const misuse = score(cssVar("textSecondary"), surfaceOf(glass));
    expect(misuse.examined).toBe(18);
    expect(misuse.failures.length).toBe(8);
    expect(misuse.worst).toBeCloseTo(1.0, 2);
  });
});

import { readFileSync } from "fs";
import { join } from "path";
import { SYSTEM_THEME_SURFACES, type BoxVar } from "./fixtures/system-theme-surfaces";

/**
 * `list glass` paints no surface of its own, so its rows sit on the surface
 * their container paired them with (NEH-2068).
 *
 * ## What was wrong
 *
 * The glass list root painted `rgba(255, 255, 255, 0.05)` behind a
 * `blur(10px)` backdrop. In practice a glass list sits inside a glass tile,
 * which paints opaque `boxBgPrimary` with `textPrimary` (NEH-1952), and its
 * rows are `textPrimary` too. So the rows composited onto `boxBgPrimary`
 * lightened 5% — a blend no theme validates `textPrimary` against. Measured in
 * a consumer's real browser: 4.16:1 (Midnight dark), 4.17:1 (Autumn Magic and
 * Scandinavian Farm light) and 4.36:1 (Scandinavian Farm dark). This file's
 * arithmetic reproduces those four from the theme data alone.
 *
 * Same class as NEH-1952 (`box glass`) and NEH-1266 (the box's sheen).
 *
 * ## What this checks, and over what
 *
 * Read from the generated stylesheet, not the recipe source, because that is
 * what ships. The rows are scored on whatever the root paints, composited over
 * the glass tile's `boxBgPrimary`, across the 18 SYSTEM theme/modes of the
 * largest consumer. A paint this file cannot read fails rather than passes.
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

/** The glass tile the list sits in: opaque `boxBgPrimary` (NEH-1952). */
const TILE: BoxVar = "--hopper-box-primary-bg";
/** What the rows are painted in: the tile's partner text. */
const ROW_TEXT: BoxVar = "--hopper-box-primary-text";

/** Score the rows across every theme/mode for a given root paint. */
function score(paint: ReturnType<typeof paintOf>): { examined: number; failures: string[] } {
  if (paint === null) return { examined: 0, failures: ["root paint is unreadable"] };
  const failures: string[] = [];
  let examined = 0;
  for (const tm of SYSTEM_THEME_SURFACES) {
    examined++;
    const tile = rgb(tm.vars[TILE]);
    const surface = paint === "none" ? tile : composite(paint.rgb, paint.alpha, tile);
    const r = ratio(rgb(tm.vars[ROW_TEXT]), surface);
    // A fixture value that is not hex parses to NaN, and `NaN < AA` is false —
    // so an unparseable theme must fail here rather than pass silently.
    if (!Number.isFinite(r)) failures.push(`${tm.theme} ${tm.mode}: unparseable`);
    else if (r < AA) failures.push(`${tm.theme} ${tm.mode}: ${r.toFixed(2)}:1`);
  }
  return { examined, failures };
}

const ROOT = ".list__root--variant_glass";
const root = declarationsFor(styles, ROOT);

describe("list glass paints no surface of its own (NEH-2068)", () => {
  it("inspected a real stylesheet and the full fixture, not an empty read", () => {
    expect(styles.length).toBeGreaterThan(10_000);
    // The rule exists and was read: it still carries its border and radius.
    expect(root["border"]).toBeDefined();
    expect(root["border-radius"]).toBeDefined();
    expect(SYSTEM_THEME_SURFACES.length).toBe(18);
  });

  it("paints no background, so the rows sit on the tile's own surface", () => {
    expect(paintOf(root)).toBe("none");
  });

  it("carries no backdrop blur — with nothing tinted, it would only blur an unpaired page", () => {
    expect(root["backdrop-filter"]).toBeUndefined();
    expect(root["-webkit-backdrop-filter"]).toBeUndefined();
  });

  it("rows in textPrimary clear AA on the glass tile in all 18 theme/modes", () => {
    const { examined, failures } = score(paintOf(root));
    expect(failures).toEqual([]);
    expect(examined).toBe(18);
  });

  it("shows the fixture can fail: the pre-fix 5% white reproduces the measured four", () => {
    // The other direction, so a forgiving fixture cannot make the checks above
    // pass vacuously. The old rule, as emitted before this change.
    const old = paintOf({ background: "rgba(255, 255, 255, 0.05)" });
    expect(old).not.toBe("none");
    const { examined, failures } = score(old);
    expect(examined).toBe(18);
    // The same four the consumer measured, and no others. The ratios agree
    // with the browser's to within 0.05: a canvas composites in 8-bit with its
    // own rounding, so the last digit is not this arithmetic's to match.
    const measured: Record<string, number> = {
      "Autumn Magic light": 4.17,
      "Midnight dark": 4.16,
      "Scandinavian Farm light": 4.17,
      "Scandinavian Farm dark": 4.36,
    };
    const found = Object.fromEntries(
      failures.map((f) => {
        const [name, value] = f.split(": ");
        return [name!, Number.parseFloat(value!)];
      }),
    );
    expect(Object.keys(found).sort()).toEqual(Object.keys(measured).sort());
    for (const [name, value] of Object.entries(measured)) {
      expect(Math.abs(found[name]! - value)).toBeLessThan(0.05);
    }
  });

  it("a fixture colour that is not hex fails rather than scoring NaN as a pass", () => {
    expect(Number.isFinite(ratio(rgb("var(--x)"), rgb("#000000")))).toBe(false);
  });

  it("an unreadable paint is a failure, never a pass", () => {
    expect(score(paintOf({ background: "var(--colors-something)" })).failures).not.toEqual([]);
  });
});

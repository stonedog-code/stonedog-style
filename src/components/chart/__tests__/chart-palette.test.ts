/**
 * The palette names variables and never holds a colour.
 *
 * Two claims are worth a test rather than a docblock: that the two-namespace
 * fallback chain is emitted in the right ORDER (a reversed chain would make
 * the originating app's `--hopper-` names win over a consumer's own, silently),
 * and that no file in this subtree contains a literal colour.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import {
  CHART_SERIES_DASH,
  CHART_SERIES_HATCH,
  CHART_SERIES_SLOTS,
  CHART_VAR_NAMESPACES,
  chartSeriesDash,
  chartSeriesHatch,
  chartSeriesVar,
  chartVar,
} from "../chart-palette";

const CHART_DIR = join(__dirname, "..");

function chartSources(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(CHART_DIR)) {
    if (entry === "__tests__") continue;
    const full = join(CHART_DIR, entry);
    if (statSync(full).isDirectory()) continue;
    if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe("the fallback chain", () => {
  it("puts the package's own namespace first and the host's second", () => {
    // Order is the whole point. `var(--hopper-x, var(--stonedog-x))` would
    // look identical in a diff and mean the opposite: a consumer that defined
    // the stonedog names would never see them used.
    expect(chartVar("grid")).toBe(
      "var(--stonedog-chart-grid, var(--hopper-chart-grid))",
    );
  });

  it("names both namespaces, so the chain cannot silently shorten", () => {
    expect(CHART_VAR_NAMESPACES).toEqual(["stonedog", "hopper"]);
    for (const ns of CHART_VAR_NAMESPACES) {
      expect(chartVar("surface")).toContain(`--${ns}-chart-surface`);
    }
  });

  it("ends with a bare var(), never a literal colour fallback", () => {
    // A hex at the end of the chain would make this file own a colour, and
    // would turn "the host never defined the palette" from a visible fault
    // into a silent one.
    expect(chartVar("series-1")).toMatch(/^var\([^)]*, var\(--hopper-chart-series-1\)\)$/);
  });
});

describe("slots", () => {
  it("is 1-based and wraps rather than throwing", () => {
    expect(chartSeriesVar(1)).toContain("--stonedog-chart-series-1");
    expect(chartSeriesVar(CHART_SERIES_SLOTS)).toContain(
      `--stonedog-chart-series-${CHART_SERIES_SLOTS}`,
    );
    expect(chartSeriesVar(CHART_SERIES_SLOTS + 1)).toBe(chartSeriesVar(1));
    expect(chartSeriesVar(0)).toBe(chartSeriesVar(CHART_SERIES_SLOTS));
  });

  it("gives slot 1 a solid line and every other slot a distinct dash", () => {
    expect(chartSeriesDash(1)).toBeUndefined();
    const dashes = CHART_SERIES_DASH.slice(1);
    expect(new Set(dashes).size).toBe(dashes.length);
    expect(dashes).toHaveLength(CHART_SERIES_SLOTS - 1);
  });

  it("gives a multi-series bar chart a repeating cycle of textures", () => {
    expect(chartSeriesHatch(0)).toBeNull();
    expect(chartSeriesHatch(1)).toBe("diagonal");
    expect(chartSeriesHatch(CHART_SERIES_HATCH.length)).toBe(
      chartSeriesHatch(0),
    );
  });
});

describe("no literal colours anywhere in the chart subtree", () => {
  const files = chartSources();
  const HEX = /#[0-9a-fA-F]{3,8}\b/;

  it("has files to check", () => {
    // Without this the filter below could report clean over an empty set,
    // which is the same output as a healthy tree and a different fact.
    expect(files.length).toBeGreaterThan(8);
  });

  it("finds no hex literal in any of them", () => {
    const offenders = files.filter((f) => HEX.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.slice(CHART_DIR.length + 1))).toEqual([]);
  });

  it("would find one if it were there", () => {
    // The self-check. A pattern that stopped matching would leave the
    // assertion above passing over an empty search.
    expect(HEX.test('const c = "#ff0000";')).toBe(true);
  });
});

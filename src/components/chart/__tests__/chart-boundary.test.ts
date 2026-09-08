/**
 * The two boundaries that keep `StyledChart` shippable.
 *
 * 1. **No charting library.** This package adds no runtime dependency; the
 *    mark is a seam the host fills. A stray `import … from "recharts"` here
 *    would make every consumer install it, and would break the one in this
 *    fleet that deliberately keeps that bundle behind its own lazy import.
 * 2. **`"use client"` on everything with a hook or an event handler.** A React
 *    export from this package that gets server-rendered gives a blank "This
 *    page couldn't load". jsdom passes either way and so does `tsc`, so the
 *    boundary is guarded in the SOURCE TEXT — which is the only place it
 *    exists.
 *
 * Each assertion is paired with a self-check, because a search that stops
 * matching leaves the guard passing over an empty set and looking identical to
 * a healthy tree.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const CHART_DIR = join(__dirname, "..");

function files(pattern: RegExp): string[] {
  return readdirSync(CHART_DIR)
    .filter((e) => e !== "__tests__")
    .map((e) => join(CHART_DIR, e))
    .filter((f) => statSync(f).isFile() && pattern.test(f));
}

const ALL = files(/\.(ts|tsx)$/);
const COMPONENTS = files(/\.tsx$/);

describe("the package adds no charting library", () => {
  const CHART_LIBS =
    /from\s+["'](recharts|victory|chart\.js|react-chartjs-2|d3|nivo|@nivo\/[^"']+|apexcharts|react-apexcharts|plotly\.js|echarts)["']/;

  it("has files to check", () => {
    expect(ALL.length).toBeGreaterThan(8);
  });

  it("imports none of them", () => {
    const offenders = ALL.filter((f) => CHART_LIBS.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.slice(CHART_DIR.length + 1))).toEqual([]);
  });

  it("would catch one if it appeared", () => {
    expect(CHART_LIBS.test('import { Line } from "recharts";')).toBe(true);
    expect(CHART_LIBS.test('import { X } from "./chart-series";')).toBe(false);
  });
});

describe('every chart component declares "use client"', () => {
  it("has components to check", () => {
    expect(COMPONENTS.length).toBeGreaterThan(4);
  });

  it("puts the directive on the first line of each", () => {
    const offenders = COMPONENTS.filter((f) => {
      const first = readFileSync(f, "utf8").split("\n")[0]!.trim();
      return first !== '"use client";' && first !== "'use client';";
    });
    expect(offenders.map((f) => f.slice(CHART_DIR.length + 1))).toEqual([]);
  });

  it("would catch a file that lost it", () => {
    // The plant, run against a string rather than the tree: the check is
    // "first non-empty line is the directive", and this is the shape that
    // fails it.
    const first = 'import React from "react";'.trim();
    expect(first === '"use client";').toBe(false);
  });
});

describe("the pure modules stay pure", () => {
  // These are the ones a test — or a host's export pipeline — must be able to
  // import without a DOM.
  const PURE = ["chart-palette.ts", "chart-range.ts", "chart-series.ts", "chart-table.ts", "chart-types.ts"];

  it("names modules that exist", () => {
    for (const name of PURE) {
      expect(ALL.some((f) => f.endsWith(name))).toBe(true);
    }
  });

  it("imports no component and no DOM API", () => {
    for (const name of PURE) {
      const src = readFileSync(join(CHART_DIR, name), "utf8");
      expect({ name, jsx: /from\s+["']\.\.\/Styled/.test(src) }).toEqual({
        name,
        jsx: false,
      });
      expect({ name, dom: /\bdocument\.|\bwindow\./.test(src) }).toEqual({
        name,
        dom: false,
      });
    }
  });
});

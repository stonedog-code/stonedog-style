import { readFileSync } from "fs";
import { join } from "path";
import {
  emphasisTokenNames,
  requiredCssCustomProperties,
} from "../semantic-variables";

/**
 * The README's starter theme really is complete, and its counts are really the
 * counts.
 *
 * This exists because both had already drifted. `textSuccess` was added to the
 * contract and **not** to the starter theme, while the prose above it went on
 * saying "all 44, nothing elided" — so the block a new consumer is invited to
 * copy was missing a property, and the number told them it was not.
 *
 * That is the worst possible place for this defect. A missing custom property
 * renders as *nothing* — no build error, no console warning — and the README is
 * the one artefact whose entire job is to stop that happening. Someone
 * following it exactly would have shipped invisible success text and had no way
 * to tell.
 *
 * Prose cannot be kept in step by review; it drifts silently because nothing
 * reads it. This reads it.
 */

const README = readFileSync(join(__dirname, "..", "..", "..", "README.md"), "utf8");

/** The `:root { … }` block the README presents as a complete starter theme. */
function starterTheme(): string {
  const match = README.match(/A complete starter theme[\s\S]*?```css\n([\s\S]*?)```/);
  return match?.[1] ?? "";
}

describe("the README's starter theme", () => {
  it("was found at all", () => {
    // Without this, every assertion below runs against "" and passes while
    // inspecting nothing — the failure mode this whole file is about.
    expect(starterTheme().length).toBeGreaterThan(500);
    expect(starterTheme()).toContain(":root {");
  });

  it("defines every property a host is required to define", () => {
    const theme = starterTheme();
    const missing = requiredCssCustomProperties().filter(
      (property) => !theme.includes(`${property}:`),
    );
    // Named, not counted. "1 missing" sends someone diffing two lists by hand,
    // which is exactly the work that produced the omission.
    expect(missing).toEqual([]);
  });

  it("does not invent properties the contract does not name", () => {
    // The other direction. A stale property in the starter theme is harmless to
    // render but teaches a newcomer a key that does nothing, and it is evidence
    // the block was hand-edited away from the source of truth.
    const declared = [...starterTheme().matchAll(/(--hopper-[a-z0-9-]+)\s*:/g)].map(
      (m) => m[1]!,
    );
    const known = new Set(requiredCssCustomProperties());
    // The emphasis tiers are legitimately optional, so a theme MAY define them.
    for (const suffix of ["text-muted-text", "text-subtle-text"]) {
      known.add(`--hopper-${suffix}`);
    }
    expect(declared.filter((p) => !known.has(p))).toEqual([]);
  });

  it("states the true number of required properties, everywhere it states one", () => {
    // The count appears in five places in the README. All five have to move
    // together, and the day one of them did not is why this test exists.
    const count = requiredCssCustomProperties().length;
    const claims = [...README.matchAll(/\b(\d{2})\b(?=[^\n]*propert|[^\n]*of them|[^\n]*matches|[^\n]*nothing elided)/g)]
      .map((m) => Number(m[1]));
    expect(claims.length).toBeGreaterThan(2);
    for (const claim of claims) {
      expect(claim).toBe(count);
    }
  });

  it("tells a reader the emphasis tiers are NOT required", () => {
    // The one thing a reader could get actively wrong from the section above:
    // seeing two more colour tokens and assuming they must define them too.
    expect(README).toContain("Two colour tokens you do NOT have to define");
    for (const token of emphasisTokenNames()) {
      expect(README).toContain(token);
    }
  });
});

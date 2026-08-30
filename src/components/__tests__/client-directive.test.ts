import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// `__dirname`, not `import.meta.url`: this package's jest runs the suite as
// CommonJS, where `import.meta` is a syntax error rather than an empty object —
// so the wrong one fails the whole file before a single assertion runs.
const componentsDir = resolve(__dirname, "..");

/**
 * Every component that uses a React hook must declare `"use client"`.
 *
 * ## Why this is a source assertion and not a render test
 *
 * A jsdom render imports the module directly, so there is no RSC boundary to
 * cross and the component behaves identically with or without the directive.
 * Every existing test in this directory passes either way. That is exactly how
 * NEH-1290 shipped: `StyledHeading` called `useFontSizeProfile()` with no
 * directive, was fully covered by green component tests, and threw on the first
 * render inside a consumer's Server Component —
 *
 *     Attempted to call useFontSizeProfile() from the server but
 *     useFontSizeProfile is on the client.
 *
 * Next renders that as a blank "This page couldn't load" page naming nothing,
 * so the consumer sees a dead route with no trail back to this package. Every
 * PRD and how-to page on stonedogcode.com was unreachable that way.
 *
 * The directive is a property of the SOURCE TEXT — it is what a bundler's RSC
 * pass keys on — so the source text is the only honest thing to assert.
 *
 * ## Why "uses a hook" and not "is a component"
 *
 * A component with no hooks and no handlers is legitimately server-renderable,
 * and forcing a directive onto it would push work to the client for nothing.
 * The rule tracks the actual constraint: a hook cannot run on the server.
 *
 * ## The count is part of the assertion
 *
 * A guard that inspects an empty set passes and reports nothing. If the glob
 * ever goes dead — the directory moves, the extension changes — this must fail
 * rather than congratulate itself, so the size of the input set is asserted
 * before its contents.
 */

/** `useState`, `useMemo`, `useFontSizeProfile`, … — any `useX(` call. */
const HOOK_CALL = /\buse[A-Z]\w*\s*\(/;

/** The directive counts only when it LEADS the module. */
function firstStatement(source: string): string | undefined {
  return source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
}

describe("components that use hooks", () => {
  // The SHIPPED components only. `*.harness.tsx` and `*.ct.tsx` are Playwright
  // component-test scaffolding, negated out of `files` in package.json (NEH-370)
  // and mounted by the test runner rather than by a consumer — so no harness
  // ever crosses an RSC boundary and requiring a directive on one would be a
  // rule with no failure behind it. Seven of them use hooks and legitimately
  // declare nothing.
  const files = readdirSync(componentsDir)
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => !name.endsWith(".harness.tsx") && !name.endsWith(".ct.tsx"))
    .sort();

  const usingHooks = files.filter((name) => {
    const source = readFileSync(join(componentsDir, name), "utf8");
    // Strip block comments so the prose ABOVE a directive — which routinely
    // names the hook it is explaining — cannot be mistaken for a call. Without
    // this, StyledHeading's own docblock would match.
    return HOOK_CALL.test(source.replace(/\/\*[\s\S]*?\*\//g, ""));
  });

  it("finds components to check", () => {
    // Non-vacuity, both halves. A dead glob and a regex that stopped matching
    // are different failures and both render as a silently passing suite.
    expect(files.length).toBeGreaterThan(10);
    expect(usingHooks.length).toBeGreaterThan(3);
    // The component this guard was written for.
    expect(usingHooks).toContain("StyledHeading.tsx");
  });

  it.each(usingHooks)('%s declares "use client" as its first statement', (name) => {
    const source = readFileSync(join(componentsDir, name), "utf8");
    expect(firstStatement(source)).toMatch(/^["']use client["'];?$/);
  });
});

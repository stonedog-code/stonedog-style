/**
 * Is a computed colour fully transparent?
 *
 * Chromium serialises a computed colour in whatever space it was declared in,
 * and the `transparent` TOKEN changed space between Panda majors: preset-panda
 * 1.x defined it as `rgb(0 0 0 / 0)`, which reads back `rgba(0, 0, 0, 0)`;
 * 2.x defines it as `oklch(0 0 0 / 0)`, which reads back exactly like that. A
 * literal `transparent` keyword, and the initial value an undefined token
 * collapses to, still read back as `rgba(0, 0, 0, 0)`. Every component test
 * that asks "is anything painted here" asks about the alpha, not the spelling,
 * so they ask through this (NEH-2155).
 *
 * Deliberately strict about what it accepts: an unparseable string is NOT
 * transparent, so a test asserting "nothing painted" cannot pass on an empty
 * read, and one asserting "something painted" cannot pass on garbage either —
 * `colour.test.ts` plants both.
 */
export function isTransparent(value: string): boolean {
  const v = value.trim();
  if (v === "transparent") return true;
  // rgb()/rgba()/hsl()/hsla()/oklch()/oklab()/lab()/lch()/color(): the alpha is
  // the number after the last "/" in modern syntax, or the fourth comma-separated
  // argument in legacy rgba()/hsla() syntax.
  const m = /^[a-z]+\((.*)\)$/i.exec(v);
  if (!m) return false;
  const inner = m[1]!;
  const slash = inner.lastIndexOf("/");
  const alpha = slash >= 0 ? inner.slice(slash + 1) : (inner.split(",")[3] ?? "1");
  const a = alpha.trim();
  const n = a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a);
  return Number.isFinite(n) && n === 0;
}

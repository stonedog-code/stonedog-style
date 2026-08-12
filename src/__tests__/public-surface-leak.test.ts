import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

/**
 * No internal tracker id appears in what a stranger downloads or reads.
 *
 * **This repository is public and the package is on npm.** An id publishes the
 * tracker's key format, a rough issue count, and — where it sits beside a
 * shipped defect — that a named internal ticket was behind it. Little on its
 * own; free reconnaissance in aggregate, and unprofessional in a package whose
 * whole purpose is to be evaluated by outsiders deciding whether to depend on
 * it.
 *
 * ## The three surfaces, in order of how far each one travels
 *
 * | Surface | Reaches |
 * |---|---|
 * | `README.md` | **the npm package page** — the first thing anyone reads |
 * | `package.json` | **every consumer's `node_modules`**, in the tarball |
 * | `scripts/*.sh` | anyone browsing the repository |
 *
 * The issue that prompted this (NEH-555) named only the publish script. The
 * other two are covered because its own reasoning applies to them more
 * forcefully, not less: a script comment has to be sought out, while the README
 * is the package's front page and `package.json` is downloaded by every install.
 *
 * ## Comments are deliberately NOT exempt here
 *
 * That is the opposite of the app-side leak rule, which strips comments before
 * scanning precisely so a code comment can *name* the thing it explains. The
 * difference is audience, not secrecy: in an application a comment is read by
 * someone with repository access, and here "someone with repository access" is
 * everyone. There is no inside.
 *
 * ## What must survive
 *
 * The **reasoning**, in full. The comment on why `npm ci` rather than
 * `npm install`, and the one about a checkout one commit behind publishing a
 * tarball missing the very thing it was published for, are the most valuable
 * lines in the script — and they read *better* without the ids, because a
 * stranger cannot look one up anyway. A date and a filename are not internal
 * identifiers, so a concrete "it did, on 2026-08-04, without TitleLogo.tsx"
 * stays exactly as it is: that example is what makes the warning land.
 *
 * The obvious wrong fix is deleting the sentence instead of the identifier, so
 * this file pins the sentences too.
 *
 * ## Source files are NOT scanned, and that is a decision
 *
 * `src/**` comments still cite issues, and deliberately: that is where the
 * reasoning belongs, it is what the house rule protects rather than forbids,
 * and a guard that banned them everywhere would make its own rationale
 * unwriteable. The line drawn here is *published surface*, not *public repo*.
 */

const ROOT = join(__dirname, "..", "..");

/**
 * The shapes an internal reference takes.
 *
 * The tracker URL matters as much as the bare key — it leaks the workspace name
 * too, and it is what someone pastes when a bare id feels too terse.
 */
const INTERNAL_REFERENCE: { name: string; pattern: RegExp }[] = [
  { name: "a tracker issue id", pattern: /\bNEH-\d+\b/ },
  { name: "a tracker URL", pattern: /linear\.app\/[^\s)"']+/ },
  { name: "a tracker branch name", pattern: /\bjessestone\/[a-z0-9-]+/ },
];

/** Every file that reaches a stranger, as repo-relative paths. */
function publishedSurface(): string[] {
  const files = ["README.md", "package.json"];
  const scripts = join(ROOT, "scripts");
  if (existsSync(scripts)) {
    for (const entry of readdirSync(scripts)) {
      if (entry.endsWith(".sh")) files.push(`scripts/${entry}`);
    }
  }
  return files;
}

const surface = publishedSurface();

describe("the published surface carries no internal identifiers", () => {
  it("finds no tracker id, tracker URL or branch name", () => {
    const offenders: string[] = [];
    for (const relative of surface) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      source.split("\n").forEach((line, i) => {
        for (const { name, pattern } of INTERNAL_REFERENCE) {
          const found = pattern.exec(line);
          if (found) offenders.push(`${relative}:${i + 1} — ${name}: ${found[0]}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("actually read the surface, rather than passing on an empty list", () => {
    // A guard whose input silently became empty passes forever while checking
    // nothing — the same failure class it exists to catch. Both halves matter:
    // the list must include the scripts it discovered, and every file must have
    // real content.
    expect(surface).toContain("README.md");
    expect(surface).toContain("package.json");
    expect(surface.some((f) => f.startsWith("scripts/"))).toBe(true);
    for (const relative of surface) {
      expect(readFileSync(join(ROOT, relative), "utf8").length).toBeGreaterThan(200);
    }
  });

  it("keeps the reasoning the ids were embedded in", () => {
    const publish = readFileSync(join(ROOT, "scripts", "publish-package.sh"), "utf8");
    expect(publish).toContain("`npm ci` rather than `npm install`");
    expect(publish).toMatch(/lockfile and manifest disagree/);
    // The dated example, which reads as a real incident precisely because it is
    // concrete. A date is not an internal identifier.
    expect(publish).toMatch(/2026-08-07/);
  });

  it("recognises an offender when it sees one", () => {
    // The matcher, checked both ways. The offending string is built by
    // concatenation so this file does not plant the very text the first
    // assertion scans for — it is outside the scanned surface, but a guard
    // defeatable by its own fixture is not worth writing.
    const id = INTERNAL_REFERENCE[0]!.pattern;
    expect(`fixed under NEH${"-"}123`).toMatch(id);
    expect("fixed on 2026-08-04, without TitleLogo.tsx").not.toMatch(id);
    expect(`see https://linear.app/nehsa/issue/x`).toMatch(
      INTERNAL_REFERENCE[1]!.pattern,
    );
  });
});

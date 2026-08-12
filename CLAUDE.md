# @stonedogcode/style — a portable Panda CSS design system

**Repo tier.** Machine-wide conventions (branching, PR rules, the Linear
protocol, Node/nvm) live in `~/.claude/CLAUDE.md` and apply here as written.
This file covers only what is true inside this repo.

**This repo is public and Apache-2.0.** Every commit is visible to the world,
permanently. Never commit a credential, a customer name, a screenshot of real
data, or anything under a licence that is not compatible with Apache-2.0 — see
"What may never land here".

## Published on npm

`npm install @stonedogcode/style` — under the npm account `stonedogcode`. Before
it was published the only way to consume it was a git submodule, and most
consumers still do that today.

**The name is scoped as of NEH-482.** It shipped unscoped as `stonedog-style`
through `0.8.1`; that name stays on the registry, deprecated, pointing at the
scoped one. **Do not un-scope it again** — `@stonedogcode/auth` and
`@stonedogcode/howto` were briefly renamed the other way on 2026-08-07 and
reverted the same day, and all five shared packages now scope.

Consuming the scoped name means the Panda `include` glob moves with it, and
that failure is silent — see the upgrade note in the README.

**Prefer the published package for a consumer that only uses this library.**
Keep a submodule only while co-developing it alongside an app in the same stream
of work (HopperGuard is doing exactly that under NEH-167). Publishing is manual
and 2FA-gated, so npm `latest` can lag `main` — that lag is the reason a
submodule is still right *while changing the package*, and the reason it is
wrong once you are merely consuming it.

Releasing: bump the version, land it, then from a clean `main` checkout run
`npm run gate` and `npm publish --access public` (needs a 2FA OTP, or a
granular token with bypass-2FA). A published version can never be reused.

`stonedog-theme` is where colours come from, and this package deliberately knows
none. **They version independently** — style was 0.10.1 and theme 0.3.0 on
2026-08-08, and they have not moved together for a long time.

This entry used to say they ship "at the same version". That was wrong and worth
correcting rather than deleting, because it is the kind of claim someone leans on
when deciding whether a theme bump is *needed* alongside a style bump. It is
not: bump theme when the theme changes. The coupling that does exist is the
token contract — style names a token, theme defines the custom property behind
it — and a mismatch there shows up as an invisible element, not as a version
number.

## What this is

One themeable component library, shared by applications that are owned by
different companies and licensed differently. It is two things in one package:

| Entry point | What it is | Who imports it |
|---|---|---|
| `@stonedogcode/style/preset` | A **Panda CSS preset** — colour tokens, breakpoints, and 22 recipes | the consumer's `panda.config.ts`, at build time in Node |
| `@stonedogcode/style` | The **React components** built on those recipes | application code |

They are separate entry points on purpose: the config runs in Node during the
build, and dragging the whole component tree (and React with it) into that
context buys nothing.

Extracted from HopperGuard's `apps/web/src/app/components/Styled/`. That app
remains the largest consumer and the de-facto reference for how a component
should behave.

### Renamed from `hopper-style` — migration in progress (NEH-251)

The package is `@stonedogcode/style`. Every `hopper*` public symbol still exists as a
**deprecated alias** re-exported alongside the new name:

| Old | New |
|---|---|
| `hopperStylePreset` | `stonedogStylePreset` |
| `HopperStylePresetOptions` | `StonedogStylePresetOptions` |
| `hopperStyleRecipes` | `stonedogStyleRecipes` |
| `HopperStyleProvider` | `StonedogStyleProvider` |
| `HopperStyleProviderProps` | `StonedogStyleProviderProps` |

The aliases exist so each consumer can bump its submodule pointer on its own
schedule instead of every repo moving in one lockstep sweep — that is what makes
NEH-251 shippable as ordered PRs. **They are a migration seam with an end date.**
Delete them once HopperGuard, optima-filings and optima-cloud-saas have all
landed their consumer PRs; new code must never reach for one.

**`DEFAULT_CSS_VAR_PREFIX` is deliberately still `"hopper"`.** Renaming it
re-points all 44 custom properties, and HopperGuard's theme data — stored in its
database and edited through its theme editor — keys off `--hopper-*`. Flipping
it would blank every colour in that app with no build error. That is a data
migration, not a rename, and it is not part of NEH-251.

## The one idea everything else follows from

**No component in this package knows a single colour.**

Every colour is a Panda token whose *value* is a bare CSS custom property —
`boxBgPrimary` resolves to `var(--hopper-box-primary-bg)`, and nothing more.
The host application sets those properties at runtime, from wherever it keeps
themes. That indirection is the entire reason one component library can wear two
products' branding.

Consequences that bite if you forget them:

- **A token with no matching custom property renders as nothing.** There is no
  fallback colour, by design — an invisible element is a louder bug than a
  slightly-wrong shade, and it shows up in development rather than in
  production. `requiredCssCustomProperties()` exists so a host can assert it has
  defined them all.
- **Token names are public API.** Host theme data keys off them. Adding one is
  backwards-compatible; renaming or removing one silently breaks whatever was
  painting it, because CSS has no import errors.
- **Never write a literal colour in a component or a recipe.** Not `#fff`, not
  `rgba(...)`, not `"black"`. It will look right in one theme and wrong in every
  other, and it will ignore dark mode and high-contrast entirely. (The existing
  recipes have a few of these, inherited — see "Known inherited defects".)

## Layout

```
src/
  preset/
    index.ts               the definePreset() factory — the build-time entry point
    semantic-variables.ts  the token contract: token name → CSS custom property
    recipes/               22 Panda recipes; the visual definition of everything
  config/
    style-config.tsx       StonedogStyleProvider / useStyleConfig / useResolvedVariant
    logger.ts              the injectable logger (no-op by default)
    font-size.ts           the rem-based type scale
    density.ts             the five-step density ladder + its spacing metrics
    types.ts               variant + font-size + icon-size vocabularies
  components/              the React components
  index.ts                 the public API
panda.config.ts            the package's OWN config, so it can test itself
```

`config/` is the seam that made this package portable at all. Keep it small:
**every field added to `StyleConfig` is a field a new host must supply before it
can render a single button.**

### Changing a default is silent, and that is the whole hazard

Both of these are what a host gets for saying nothing, so changing one resizes
every consumer that has not opted out — with no build error, no failing test,
and nothing visible until someone looks at the pixels.

| Default | Value | Status |
|---|---|---|
| `fontSizeProfile: "md"` | **1rem** (16px) | conventional web scale, as of NEH-251 |
| `iconSize: "2x"` | 32px | **still HopperGuard's elder size** |

**The font scale moved; the icon default has not.** The order that made the
font change safe is the order any future one has to follow:

1. every host that needs the old value **names it explicitly** and that lands
   and is verified first — HopperGuard pinned all thirteen `--font-sizes-*`
   tiers in its `globals.css`;
2. *only then* does the package default change.

Done the other way round, the first release silently shrinks a product built
for an often-elderly, sometimes cognitively-impaired audience.

`iconSize` is still `"2x"` because step 1 has not happened for it: ~150
HopperGuard call sites rely on that default and the app does not set
`iconSize` on its provider. **Pin it there before touching this.**

Both halves are host-tunable already:

- **Font size** via the `--font-sizes-*` custom properties, since every
  `fontSizeMap` entry is `var(--font-sizes-KEY, <fallback>)`.
- **Icon size** via `iconSize` on `StyleConfig` / `StonedogStyleProvider`
  (NEH-200). `StyledIcon` resolves caller → app-wide → `2x`, the same precedence
  shape as `useResolvedVariant` and for the same reason: when each call site
  picks its own default, an app quietly grows several scales at once.

`IconSize` therefore lives in `config/types.ts` rather than beside `StyledIcon` —
`StyleConfig` names it, and having config import the component that imports
config would be a cycle. `StyledIcon` re-exports the type so the older import
path keeps working.

### The consumers

**All four are live consumers**, and all four sat at 0.10.1 as of 2026-08-08.

| Repo | On disk | Consumes via | Visibility | `densityBase` | Notes |
|---|---|---|---|---|---|
| HopperGuard (`hopper-web`) | `~/src/elderlink/hopperguard` | **submodule** `packages/stonedog-style` | private | `spacious` | elder audience; pins its own `--font-sizes-*` |
| `optima-filings` | `~/src/stonedogcode/optima/optima-filings` | **submodule** `packages/stonedog-style` | public, AGPLv3 | `compact` | `cssVarPrefix: "optima"` |
| `optima-cloud-saas` | `~/src/stonedogcode/optima/optima-cloud-saas` | **npm** | private | `compact` | `cssVarPrefix: "optima"`; the only npm consumer |
| RozCards | `~/src/stonedogcode/card-sorter/rozcards` | **submodule** `packages/stonedog-style` | private | `standard` | |

**RozCards was recorded here as "not yet a consumer — Tailwind v4 today
(NEH-255)" until 2026-08-08, and it had not been true for some time.** It has
the submodule, a `panda.config.ts` that imports the preset and globs the
package's source, and live import sites. That error was the harmful direction:
it told anyone doing a cross-consumer sweep that RozCards could be skipped, and
**skipping a Panda consumer fails silently** — components render with class
names that have no CSS behind them, with no build error and no console warning.

The lesson generalises to this whole table: it describes four other
repositories, so it goes stale without anything here changing. Check it against
the repos before trusting it for a sweep — `git -C <repo> ls-tree origin/main
packages/stonedog-style` answers the pin question in one line, and
**`origin/main`, not a local checkout** (a stale working tree is what made this
row wrong in both directions on the same day).

A change that suits one must not regress the others, which is what the
default-pinning tests are guarding.

**The `@maximus/*` rename is done.** This paragraph used to say the npm scope
inside the Optima repos was "still `@maximus/*`, sequenced behind trademark
clearance". That stopped being true on 2026-08-04, and a CLAUDE.md is loaded as
instructions — so a stale one is worse than an absent one. Verified against the
repos rather than against the issue that reported it:

| Repo | Workspace scope |
|---|---|
| `optima-filings` | `@optima-compliance/*` |
| `optima-cloud-saas` | `@optima-cloud/*` |

Note `optima-filings` is **`@optima-compliance`**, not the bare `@optima` the
tracker recorded — which is the point of reading `packages/*/package.json`
instead of the ticket. Nothing here depends on either scope; this table exists so
the next person does not re-derive it, and so the wrong answer stops being
written down.

## How a consumer wires this up

Four steps. Steps 2 and 3 are the ones that get missed.

**1. Add the preset to `panda.config.ts`:**

```ts
import { defineConfig } from "@pandacss/dev";
import { stonedogStylePreset } from "@stonedogcode/style/preset";

export default defineConfig({
  // Listing `presets` REPLACES Panda's defaults — it does not add to them.
  // Omit the two base presets and the recipes lose every token they lean on
  // (`gray.*`, `radii.xl`, the spacing scale), and Panda drops those
  // declarations SILENTLY: no build error, no console error, just wrong pixels.
  presets: [
    "@pandacss/preset-base",
    "@pandacss/preset-panda",
    stonedogStylePreset(),          // or stonedogStylePreset({ cssVarPrefix: "acme" })
  ],
  include: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@stonedogcode/style/src/**/*.tsx",  // ← step 2
  ],
  outdir: "styled-system",
  jsxFramework: "react",
});
```

**2. Add this package's source to `include`** (above). Panda finds styles by
statically parsing source files. A package it never parses contributes no CSS,
and its components render with class names that have no rules behind them.

The glob must point wherever the package **actually lives**, which differs by
how it was installed — `./node_modules/@stonedogcode/style/src/**/*.tsx` from npm,
`./packages/stonedog-style/src/**/*.tsx` as a submodule. Moving a consumer from
one to the other means moving this line, and forgetting is silent: no build
error, no console warning, just unstyled components.

**3. Transpile the package.** It ships TypeScript source, not a bundle. In
Next.js: `transpilePackages: ["@stonedogcode/style"]`.

**4. Define the custom properties and mount the provider:**

```tsx
<StonedogStyleProvider fontSizeProfile={profile} variant={variant}>
  <App />
</StonedogStyleProvider>
```

The provider is optional — omitting it yields readable defaults — but the custom
properties are not.

### Why source and not a `dist/`

Because Panda extracts styles statically at the consumer's build. A pre-bundled
`dist/` would emit class names that the consumer's `panda cssgen` never saw and
therefore never wrote CSS for. Shipping source is the standard arrangement for a
Panda component library, and it is why steps 2 and 3 exist at all.

**Source, but not the tests (NEH-370).** `files` negates `__tests__/`,
`*.ct.tsx` and `*.harness.tsx` — 57 of 130 entries, and 0.6.0 was the last
version to carry them. Nothing exported resolves into any of them, so they were
only ever weight a consumer's Panda run had to be told to skip, and **an
`exclude` that is subtly wrong is silent** — the same failure class as an
`include` glob matching nothing. Fewer shipped files is fewer globs that can be
quietly wrong.

Two things follow for anyone changing `files`:

- **Assert the listing, never the array.** `src/__tests__/published-package.test.ts`
  runs `npm pack --dry-run` and checks what npm actually resolved. A test
  reading `files` back would agree with a negation npm ignored, and the file
  listing is the only place the real contents ever appear.
- **A consumer's `exclude` for these paths is only dead if it points at
  `node_modules`.** Every submodule consumer — HopperGuard, optima-filings,
  RozCards — globs `packages/stonedog-style/src/**`, which is a full checkout
  and still has the tests. Those excludes stay. Only optima-cloud-saas installs
  from npm.

## Adding or changing a component

1. **Check it belongs here.** The test is: *would a completely different product
   want this, unchanged?* A generic disclosure widget, yes. Anything that knows
   about facilities, care teams, compliance rules, or a specific API, no — that
   belongs in the app. When unsure, leave it in the app; moving it in later is
   easy, and pulling a leaked concept back out is not.
2. **No new runtime dependencies** without a deliberate decision. The dependency
   list is currently `csstype`, and React as a peer. Every addition is a
   constraint imposed on every consumer.
3. **Colours come from tokens**, spacing from the scale, text through
   `StyledText`. Never a hardcoded `px` font size — the scale is rem-based so it
   honours the browser's own font setting, which is the affordance users with
   low vision actually reach for.
4. **Resolve variants with `useResolvedVariant`**, never by reading a variant
   prop directly. It applies the house precedence (caller → app-wide → `solid`)
   and coerces values the recipes have no case for. Skipping it is how a form
   ends up with three controls that each ignore the theme differently.
5. **Write the test.** See below — this package can test things the app it came
   from cannot.
6. **Export it from `src/index.ts`.** Named export; add a default export in the
   component's own module too, matching the existing pattern.

## Testing — two tiers, two failure modes

| | `npm test` (jest + jsdom) | `npm run test:ct` (Playwright) |
|---|---|---|
| **Answers** | props, wiring, ARIA, callbacks, variant resolution | computed styles, layout, overflow, tap targets |
| **Speed** | ~1s, run on every save | ~5s, run before pushing |
| **In the gate?** | yes | no — see below |

**jsdom has no layout engine.** Every element reports a zero-sized box, so it
will agree that a 400px panel fits a 375px screen. Anything about *pixels* is
unanswerable there, which is why the second tier exists — and why neither
replaces the other.

`npm run gate` runs codegen → typecheck → lint → jest, and is the merge bar.
Component tests are a separate command because they need a browser download; run
them for anything touching layout, sizing or a recipe.

### Component tests run at four viewports

`playwright-ct.config.ts` defines them as projects, so every `*.ct.tsx` runs four
times. They are boundaries where layout breaks, not popular phones:

- **iphone-se** 375×667 — narrowest screen still in real use, and the one this
  audience is most likely to hold. Overflow shows up here first.
- **tablet** 768×1024 — exactly the `md` breakpoint, so it catches an off-by-one
  a neighbouring width would hide.
- **laptop** 1280×800 — the `xl` breakpoint and the commonest desktop size.
- **desktop-wide** 1920×1080 — where max-width and centering bugs appear.

### The harness supplies a reset, and that is a real requirement

`playwright/` holds the mount entry point, a **reset** and a **theme**. All three
matter, and the second two are requirements this package places on every host:

- **`theme.css`** — all 44 custom properties. A token with no property renders
  invisible, and an invisible box still has a bounding box, so a layout
  assertion would pass. A jest test asserts this file stays complete.
- **`reset.css`** — `box-sizing: border-box`. Without it padding **adds** to
  width, so `<StyledBox p="4" width="100%">` overflows its parent by 32px. That
  is not hypothetical: the component tests caught exactly this on their first
  run, at all four viewports.

**Note the inconsistency:** HopperGuard declares an `@layer reset` in
`globals.css` and never populates it, so it runs on `content-box` — the
components were tuned there under different box behaviour than a consumer with a
conventional reset gets. Documented in the README as a setup requirement.

### Two harness details that exist only to make the above work

- **`outExtension: "js"` in `panda.config.ts`.** TypeScript will downlevel a
  `.js` file to CommonJS for Jest but *never* a `.mjs` one — the extension forces
  ESM output whatever `module` says. Panda's default is `.mjs`, and with it every
  component test dies on `Unexpected token 'export'`, leaving mocking as the only
  way out — precisely the compromise this package exists to avoid.
- **`test/` is in the tsconfig `include`.** Solely so
  `@testing-library/jest-dom`'s module augmentation loads and `tsc` knows about
  `toBeInTheDocument`. Drop it and the suite runs green while the typecheck fails
  on every matcher.

**Tests here run against the REAL generated `styled-system`.** The application
this was extracted from mocks `styled-system/*` wholesale in Jest, which means
no unit test there can assert anything a recipe produces — documented as a hard
constraint in its PRD-0013. Here the actual generated output is transformed and
loaded, so recipe behaviour *is* testable. Use that: assert that two variants
produce different classes, that a token resolves, that `staticCss` covers what
runtime switching needs.

## What may never land here

- **Any icon artwork at all.** Not Font Awesome Pro (per-seat licence, and
  HopperGuard's vendored subset contains actual Pro path data), and not a
  permissive set either — picking one would impose it on every consumer and add
  a dependency none of them asked for. `StyledIcon` renders whatever node it is
  handed, and `createIcon` / `createIconFromComponent` make building a set a
  line each. HopperGuard's licensed set lives in a private `hopper-icons`
  package; the README shows how anyone else brings their own.
- **Anything AGPL or copyleft.** One consumer is a proprietary SaaS. An AGPL
  dependency here would compromise its licence position, and unlike a bug that
  cannot be fixed after the fact.
- **A dependency on a private package.** `hopper-logger` was exactly this, at 195
  import sites, and was the single largest reason the library could not be
  shared. Route logging through `config/logger.ts`; if you need something else
  from the host, add a seam, not an import.
- **Application concepts.** No auth, no data fetching, no routing, no
  `next/*` imports. A component that fetches is a feature, not a primitive.

## Token compliance — the defect class this package keeps catching

Three separate bugs found during extraction shared one root cause: **a recipe
naming a CSS custom property directly instead of going through a token.** They
are fixed here (NEH-165, NEH-166, NEH-171) and guarded by a regression test that
greps the generated stylesheet, so the class cannot come back quietly.

Worth understanding rather than just obeying, because the failure mode is
uniquely nasty — none of the three produced a build error, a console warning, or
anything a type-checker could see:

- **`bg: "buttonBgHover"`** — a token that was never defined. Panda passes an
  unknown token through as a literal, so the stylesheet said
  `background: buttonBgHover`, which is not a valid CSS value, so the browser
  discarded it. The outline variant's hover background had **never rendered** in
  production. Now `buttonBgAccentHover`, matching that variant's base state.
- **`color: "var(--text-primary)"`**, 16 occurrences — a property in a namespace
  the token contract does not use, and which nothing defines. Those controls
  silently opted out of theming *and* of contrast validation. Now `textPrimary`.
- **`var(--hopper-box-accent-bg)` in a gradient, `var(--hopper-widget-base-height)`
  as a max-height** — correct inside HopperGuard, but they hardcode the default
  namespace, so they ignore `cssVarPrefix` entirely. Now token references; the
  max-height became a real `sizes` token, `widgetBaseHeight`.

**The rule: never write `var(--…)` in a recipe or component for anything the
host supplies.** Add a token instead — colours in `COLOR_TOKENS`, host-provided
layout values in `SIZE_TOKENS` — and reference it by name. The token layer is
the only thing that re-points under a custom prefix, so bypassing it is exactly
what breaks the second consumer while looking fine to the first.

A fourth turned up in `StyledSidebar` (NEH-223), and it is the one worth
remembering because it hid inside a *component* rather than a recipe:

- **`color="fg.muted"`** on the item descriptions — Chakra vocabulary, not this
  package's, so Panda emitted the literal `color: fg.muted` and the browser
  dropped it. Those descriptions had never rendered muted.
- **`style={{ background: "var(--colors-box-bg-accent)" }}`** for the selected
  row. An inline style bypasses the token layer *and* never reaches the
  stylesheet, so no grep could find it. Both are now Panda style props holding
  ternaries — `background={isSelected ? "boxBgAccent" : "transparent"}` — which
  the extractor reads both branches of.

**The guard is now general, not per-instance.** `token-contract.test.ts` scans
every colour declaration in the generated stylesheet and fails on any value that
is neither a `var(…)` reference nor real CSS. It carried a `KNOWN_DEAD`
allowlist of nine pre-existing offenders; **that allowlist is gone as of
NEH-301** — all nine are fixed and the assertion is now simply "none, ever".
Do not reintroduce it. An allowlist is how this defect class became normal
enough to survive an extraction in the first place, and the entire value of the
guard is that there is no way to make it pass except by making the declaration
render.

**A second guard walks gradient colour stops**, because the first one cannot
see them: a value containing `gradient` reads as real CSS to a
declaration-level regex. Five gradients were dead behind that gap — three with
*quoted* token names (a CSS string is never a colour, so the whole gradient was
invalid and those `aurora` variants had no background at all) and two with bare
token names. Inside an arbitrary value only `{colors.X}` substitutes; a bare
`boxBgAccent` does not.

Still outstanding, inherited and **not** fixed: literal `gray.*`, `rgba(...)`,
and `color: "black"` / `backgroundColor: "white"` in `recipes/input-text.ts`.
These misread under dark and high-contrast themes. Fixing them changes rendering
in a visible way, so it wants its own PR and a real look at the result. Note
`box.ts` and `input-bool.ts` now carry a deliberate `color: "white"` on `matte`:
that variant's surface is a *fixed* `gray.800`→`gray.900` gradient, so themed
text on it renders dark-on-dark in a light theme. The literal is correct until
the surface and the text move together, which is what that cleanup has to do.

### A `var()` value is unassertable in jsdom (NEH-406)

`toHaveStyle({ fontSize: "var(--font-sizes-xl, 1.25rem)" })` **cannot fail.**
jsdom validates a declaration against the property's grammar, a `var()`
reference is not a `<length>`, so the declaration is dropped and the element
ends up with **no `style` attribute at all**. The matcher then compares `""`
with the `""` it gets from parsing the expectation, and passes — for every
possible expected value.

That is not a hypothetical: `StyledSpinner`'s spec named `2rem` while the scale
said `1.25rem`, and stayed green from the commit that moved the scale until it
was found. Its neighbours in `StyledText.test.tsx` looked more careful because
they asserted against `fontSizeMap.xl` rather than a literal — but every entry
in that map *is* a `var()` reference, so they were equally vacuous.

**Split the claim across the two tiers.** *Which* value the component picks is
usually a pure function and belongs in jest — `resolveFontSizeKey` was extracted
out of `StyledText` for exactly this. What that value *renders as* is a browser
question and belongs in a `.ct.tsx`, where a real engine resolves the property.

`src/__tests__/no-vacuous-style-assertions.test.ts` enforces it: no
`toHaveStyle` expectation may contain `var(`, or name a `fontSizeMap` entry.

The general lesson, which is the same one the section below teaches one layer
down: **a green test that cannot fail is worse than no test**, because it is
counted as coverage. The only way to know is to break the thing under test and
check that the test notices.

### A recipe can only style what the element lets it (NEH-234)

`inputBoolRecipe`'s slot is a native `<input type="checkbox">` at
`appearance: auto`, and Chromium **computes `background-color` and `border-*`
on it while painting neither** — the UA draws the widget. Two separate attempts
at that issue produced correct-looking CSS that changed nothing on screen.

The trap is that `getComputedStyle` reports the discarded values happily, so a
test asserting on them passes while the user sees no difference. One did
exactly that for months. **For anything drawn by the UA, assert only on
properties verified to paint** — for a checkbox that is `accent-color`,
`box-shadow` and `outline` — and check a screenshot before believing a variant
reaches anyone.

## Type comes from the theme, shape stays here (NEH-289)

`fontFamily` and `fontWeight` tokens read `--<prefix>-font-family-*` and
`--<prefix>-font-weight-*`, which `stonedog-theme` emits. Before this they were
emitted and inert: nothing in this package read them, so a themed typeface
stopped at the theme package's edge.

Two things about them are deliberate and easy to undo by accident:

- **They carry a fallback and are NOT in `requiredCssCustomProperties()`.**
  That is the opposite of the colours, on purpose. An undefined colour paints
  an invisible element — a loud, early bug. An undefined font falls back to the
  browser's face and the page stays readable, so requiring them would break
  every existing host (none define them) for no safety gain. It would also move
  the `required === colours` identity the contract test pins on both sides.
- **The weight tokens reuse Panda's own names** (`normal`/`medium`/`semibold`/
  `bold`), which is what lets the `fontWeight: "bold"` already written across
  seven recipes read the theme without a call site moving. The union is closed;
  a step outside it is a `stonedog-theme` change first.

Native form controls do **not** inherit the page font, so `button`,
`icon-button` and the shared `input-surface` state `fontFamily` explicitly.
Without that a themed typeface reaches the page and stops at every control on
it. This package still owns SHAPE — the size scale, line height and density are
untouched; family and weight are BRAND and only pass through.

## A component must not accept a prop it cannot honour (NEH-490)

`StyledText` renders a `<span>`, and CSS **ignores vertical margins on inline
boxes**. So `marginBottom="1"` emitted the rule, put the class in the DOM,
reported `margin-bottom: 8px` from `getComputedStyle`, and moved nothing —
while JSX stripped the whitespace between siblings, welding two paragraphs into
one run. It shipped that way in both Optima and HopperGuard.

**It worked in some places, which is what made it invisible.** Flex items are
blockified, so the same component inside a `StyledStack` behaves perfectly and
inside a `StyledBox` does not. Whoever adds the prop sees it work in whatever
they tested.

A vertical spacing prop now promotes the box to `display: block` (and `block`
is available for the case with no spacing prop to imply it). This cannot break
anything that worked: on an inline box those declarations were already
discarded, so nothing could depend on their effect. Horizontal margins
deliberately do **not** promote — they work inline, and mid-sentence text is
the commonest use of this component.

The general rule, which outlives this bug: **if a prop cannot take effect on
the element a component renders, the component is wrong, not the call site.**
Silently accepting it means every consumer writes correct-looking code that
does nothing, and the failure surfaces as a copy bug months later.

Note which tier caught it. jsdom asserts the style attribute and would have
passed against the original defect just as happily; `StyledText.ct.tsx`
measures two bounding boxes in a real browser. That test was verified by
disabling the promotion and watching 4 of 12 fail — a layout guard nobody has
seen fail is not yet a guard.

## Accessibility is a floor, not a feature

The originating product serves an often-elderly, sometimes cognitively-impaired
audience, and the components carry that: WCAG 2.2 AA is the minimum and AAA the
aim. Concretely — **≥48×48 CSS px touch targets** on anything clickable (above
WCAG 2.5.5 AAA's 44, and stated as a `min-height` in the recipes rather than
left to emerge from padding, so no density or font-scale change can erode it); never
colour as the only signal; every interactive element reachable and operable by
keyboard, not just by pointer; correct roles and accessible names, and exactly
one of each (a duplicated name is its own bug). `StyledTooltip` is worth reading
before writing anything that reveals content on hover: it opens on focus as well
as hover, moves `aria-describedby` onto whatever actually receives focus, and
declines to invent a name when an ancestor already provides one. All three are
there because the naive version was shipped first and was wrong.

**Touch is handled (0.9.0).** A hover trigger on a device that cannot hover is
not degraded, it is *unreachable* — there is no hover event, and tapping the
control activates it rather than explaining it. `StyledTooltip` therefore asks
`(hover: none)` and falls back to its explicit press-to-open control there.

`(hover: none)`, not `(pointer: coarse)`: they are different questions and only
the first is ours. A stylus is coarse and hovers perfectly well; what matters is
whether the primary input can hover at all.

It defaults to **assuming hover** on the server and the first client render, so
a touch device gains the control on mount rather than every desktop rendering
one and then removing it — a flicker on the majority case to fix the minority
one. The blast radius is exactly the cases that were broken: click mode is
unaffected, and a hover-capable device is unaffected.

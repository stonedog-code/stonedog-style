# @stonedogcode/style

A themeable [Panda CSS](https://panda-css.com) design system: a preset of design
tokens and recipes, plus the React components built on them.

Every colour in the system is a token that resolves to a bare CSS custom
property — `boxBgPrimary` is `var(--hopper-box-primary-bg)` and nothing more.
Your application defines those properties, from wherever you keep themes, and
the whole component set re-skins at runtime. No component here knows a colour.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

## Status

Early. The preset is complete (22 recipes, 43 colour tokens); the component set
is being extracted incrementally and currently covers the layout and typography
primitives. See [CLAUDE.md](./CLAUDE.md) for the architecture and the
contribution rules.

## Install

**Not published to npm.** Consume it from git — either a plain dependency, or a
submodule if you want to develop against it:

```bash
# Option A — git dependency, pinned to a commit
npm install "git+https://github.com/stonedog-code/stonedog-style.git#<sha>"

# Option B — submodule + file: dependency (use this in a monorepo)
git submodule add git@github.com:stonedog-code/stonedog-style.git packages/stonedog-style
#   then in the consuming app's package.json:
#   "@stonedogcode/style": "file:../../packages/stonedog-style"
```

Pin to a commit rather than tracking a branch: this package ships source that
your build parses, so an unpinned bump changes your CSS without changing your
lockfile in any way you'd notice.

Peer dependencies: `react` ≥18, `react-dom` ≥18, `@pandacss/dev` ≥1.9.

## Setup

Four steps. **All four are required** — miss step 3 or 4 and the app renders,
but invisibly or unstyled, with no error anywhere to tell you why.

**1 — add the preset to your `panda.config.ts`:**

```ts
import { defineConfig } from "@pandacss/dev";
import { stonedogStylePreset } from "@stonedogcode/style/preset";

export default defineConfig({
  // Listing `presets` REPLACES Panda's defaults rather than adding to them,
  // so the two base presets must be named explicitly. Without them the recipes
  // lose the tokens they build on, and Panda drops those styles silently.
  presets: [
    "@pandacss/preset-base",
    "@pandacss/preset-panda",
    stonedogStylePreset(),
  ],
  include: [
    "./src/**/*.{ts,tsx}",
    // Panda finds styles by parsing source. A package it never parses
    // contributes no CSS, and its components render unstyled.
    "./node_modules/@stonedogcode/style/src/**/*.tsx",
  ],
  outdir: "styled-system",
  jsxFramework: "react",
});
```

**2 — transpile the package.** It ships TypeScript source, not a bundle,
because Panda extracts styles statically at *your* build. In Next.js:

```js
// next.config.js
module.exports = { transpilePackages: ["@stonedogcode/style"] };
```

**3 — define the custom properties. This is the step that bites.** Every colour
token reads one, and **a token whose property is undefined renders as nothing** —
no fallback, no warning, no error. An app that skips this compiles, builds,
serves, and shows you a blank page.

There are **45** of them. Get the list at runtime rather than copying one — a
number in prose goes stale the day a token is added, and this one already had:

```ts
import { requiredCssCustomProperties } from "@stonedogcode/style/preset";

requiredCssCustomProperties();           // --hopper-* (default)
requiredCssCustomProperties("optima");   // --optima-*, if you set cssVarPrefix
```

### Two colour tokens you do NOT have to define

`textMuted` and `textSubtle` are the **emphasis** axis — how important a piece
of text is, on whatever surface it sits. They are the one exception to the
no-fallback rule above, and they are not in `requiredCssCustomProperties()`.

They can have a default because *"like the surrounding text, but quieter"* has a
correct answer on every theme, which *"what colour is this surface?"* does not:

```css
color-mix(in srgb, currentColor 78%, transparent)   /* textMuted  */
color-mix(in srgb, currentColor 64%, transparent)   /* textSubtle */
```

`currentColor` inside a `color` declaration resolves to the **inherited** value,
so both follow whatever text they sit among — light theme, dark theme, or a
palette this package has never seen. Both clear WCAG AA against the surfaces
they pair with, measured in a browser rather than chosen by eye.

Define `--<prefix>-text-muted-text` / `--<prefix>-text-subtle-text` only if you
want a different step.

**Do not reach for `textSecondary` when you mean "muted".** That is the *surface*
axis — it means "text on the secondary surface" — and using it for emphasis
collapses two levels onto one colour.

A complete starter theme — all 45, nothing elided. Dark, and every text/surface
pair clears WCAG AA (measured: worst 5.17:1, ten of thirteen pairs at AAA), so
it is a legitimate starting point rather than a placeholder. Replace the values;
keep every key.

```css
:root {
  /* Surfaces */
  --hopper-box-main-bg: #0f172a;
  --hopper-box-primary-bg: #1e293b;
  --hopper-box-secondary-bg: #334155;
  --hopper-box-accent-bg: #0b1220;
  --hopper-box-info-bg: #1e3a5f;

  /* Text on those surfaces */
  --hopper-box-main-text: #f8fafc;
  --hopper-box-primary-text: #f8fafc;
  --hopper-box-secondary-text: #f1f5f9;
  --hopper-box-accent-text: #e2e8f0;

  /* Text that carries meaning on its own */
  --hopper-text-pop-text: #38bdf8;
  --hopper-text-error-text: #f87171;
  --hopper-text-warning-text: #fbbf24;
  --hopper-text-success-text: #4ade80;

  /* Borders */
  --hopper-box-primary-border: #475569;
  --hopper-box-secondary-border: #64748b;
  --hopper-box-accent-border: #334155;

  /* Shadows */
  --hopper-shadow-primary-bg: rgb(0 0 0 / 0.4);
  --hopper-shadow-secondary-bg: rgb(0 0 0 / 0.3);
  --hopper-shadow-accent-bg: rgb(0 0 0 / 0.5);

  /* Buttons */
  --hopper-button-primary-bg: #2563eb;
  --hopper-button-secondary-bg: #475569;
  --hopper-button-accent-bg: #1e293b;
  --hopper-button-primary-hover-bg: #1d4ed8;
  --hopper-button-secondary-hover-bg: #334155;
  --hopper-button-accent-hover-bg: #334155;
  --hopper-button-primary-text: #ffffff;
  --hopper-button-secondary-text: #f8fafc;
  --hopper-button-accent-text: #f8fafc;
  --hopper-button-primary-hover-text: #ffffff;
  --hopper-button-secondary-hover-text: #ffffff;
  --hopper-button-accent-hover-text: #ffffff;
  --hopper-button-plain-bg: transparent;
  --hopper-button-plain-text: #f8fafc;

  /* Icons */
  --hopper-icon-primary-bg: #94a3b8;
  --hopper-icon-secondary-bg: #64748b;
  --hopper-icon-accent-bg: #cbd5e1;
  --hopper-icon-primary-hover-bg: #cbd5e1;
  --hopper-icon-secondary-hover-bg: #94a3b8;
  --hopper-icon-accent-hover-bg: #e2e8f0;

  /* Arrows / carets */
  --hopper-arrow-primary-bg: #94a3b8;
  --hopper-arrow-secondary-bg: #64748b;
  --hopper-arrow-accent-bg: #cbd5e1;
  --hopper-arrow-primary-border: #475569;
  --hopper-arrow-secondary-border: #64748b;
  --hopper-arrow-accent-border: #334155;
}
```

Guard it with a test rather than trusting a checklist — the failure is invisible,
so nothing else will tell you:

```ts
it("defines every property the design system reads", () => {
  const css = readFileSync("src/theme.css", "utf8");
  for (const prop of requiredCssCustomProperties()) {
    expect(css).toContain(`${prop}:`);
  }
});
```

One optional extra, not in that list because it has a working fallback:
`--hopper-widget-base-height` (default `240px`) caps dropdown menus.

**4 — mount the provider** (optional; omitting it gives readable defaults):

```tsx
import { StonedogStyleProvider } from "@stonedogcode/style";

<StonedogStyleProvider fontSizeProfile="md" variant="solid">
  <App />
</StonedogStyleProvider>;
```

### Check it actually worked

Three greps against your generated stylesheet, in order. Each isolates one of
the three ways this goes wrong silently:

```bash
npx panda cssgen --outfile styled-system/styles.css

# 1. Did the preset load? Expect ~45 matches, not 0.
grep -c 'var(--hopper-' styled-system/styles.css

# 2. Did Panda parse the package's source? Expect ~240 classes, not ~0.
#    A low number means your `include` glob is wrong (step 1).
grep -oE '\.[a-zA-Z][a-zA-Z0-9_-]+' styled-system/styles.css | sort -u | wc -l

# 3. Did you keep the base presets? Expect all six breakpoints.
grep 'BreakpointToken =' styled-system/tokens/tokens.d.ts
# -> "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
#    Only "3xl" means you dropped @pandacss/preset-base and preset-panda.
```

If all three pass and the UI is still blank, you are missing step 3.

## Use

```tsx
import { StyledBox, StyledHeading, StyledText, StyledVStack } from "@stonedogcode/style";

export function Panel() {
  return (
    <StyledBox p="4" header={<StyledHeading>Overview</StyledHeading>}>
      <StyledVStack gap="3">
        <StyledText>Colours come from the host's theme.</StyledText>
        <StyledText tooltip="Shown on hover and on keyboard focus">
          Hover me
        </StyledText>
      </StyledVStack>
    </StyledBox>
  );
}
```

## Theming

**Three settings** drive the system app-wide, all supplied by your app through
the provider:

- `fontSizeProfile` — `xs | sm | md | lg | xl`. The scale is rem-based, so it
  compounds with the browser's own font-size setting rather than overriding it.
  `StyledHeading` renders one tier above whatever body text is set to, so the
  hierarchy survives every profile.
- `variant` — `solid | outline | aurora | glass | matte`. Any call site may
  override it; `useResolvedVariant` applies the precedence (caller → app-wide →
  `solid`) and coerces anything the recipes have no case for.
- `iconSize` — the default box for every `StyledIcon` that is not given an
  explicit `size`. Defaults to `2x` (32px), which is large: this library came
  out of an application built for an often-elderly audience. A conventional web
  app wants `md` (20px).

### Retuning the scale for your audience

The defaults lean large on purpose, and both halves are host-tunable without
forking anything:

```tsx
<StonedogStyleProvider fontSizeProfile="md" iconSize="md" variant="solid">
```

```css
/* Every fontSizeMap entry is var(--font-sizes-KEY, <large fallback>),
   so defining the properties replaces the scale wholesale. */
:root {
  --font-sizes-sm: 0.875rem;
  --font-sizes-md: 1rem;
  --font-sizes-lg: 1.125rem;
}
```

**Set the icon size once, at the provider.** Naming a `size` at each call site
works, but it opts that icon out of ever being retuned — which is how an
application ends up with three icon scales and no single place to fix them.
Because an icon set built with `createIcon` names no size of its own, setting
`iconSize` retunes the entire set at once.

**Your own namespace.** If `--hopper-*` does not suit, rename the whole
namespace at build time:

```ts
stonedogStylePreset({ cssVarPrefix: "acme" }); // → var(--acme-box-primary-bg)
```

The rename is total — every token re-points, and no `--hopper-*` reference
survives anywhere in the generated CSS. Choose it **before** you write a theme,
because it changes all 45 property names you have to define.

## Adopting it in a new app — a worked example

Verified end to end against a clean project. Substitute your own prefix and
paths; nothing else here is optional.

```bash
# 1. Take the dependency (see Install — it is not on npm)
npm install "git+https://github.com/stonedog-code/stonedog-style.git#<sha>"
npm install -D @pandacss/dev @types/react @types/react-dom
```

`@types/react-dom` is not optional: the tooltip portals through `react-dom`,
and without the types your build fails on our source, not yours.

```ts
// 2. panda.config.ts — all four points below matter
import { defineConfig } from "@pandacss/dev";
import { stonedogStylePreset } from "@stonedogcode/style/preset";

export default defineConfig({
  preflight: false,
  presets: [
    "@pandacss/preset-base",   // (a) REQUIRED — presets replaces, not merges
    "@pandacss/preset-panda",  // (b) REQUIRED — gray.*, radii, spacing
    stonedogStylePreset({ cssVarPrefix: "acme" }),
  ],
  include: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@stonedogcode/style/src/**/*.tsx",  // (c) REQUIRED
  ],
  exclude: ["./node_modules/@stonedogcode/style/src/**/__tests__/**/*"],  // (d)
  outdir: "styled-system",
  jsxFramework: "react",
});
```

> **Upgrading from `stonedog-style`?** The package moved to the
> `@stonedogcode` scope at `0.8.1`, and npm installs a scoped package one
> directory deeper — `node_modules/@stonedogcode/style/`, not
> `node_modules/stonedog-style/`. **So the `include` glob above changes, and
> getting it wrong is silent.** A glob that matches nothing produces no build
> error: components still render, with class names that have no CSS behind
> them. Only a component using an inline `styled(…, { base: … })` shows it,
> because everything else takes its CSS from the preset recipes, which Panda
> emits from config *without reading source*.
>
> Two things do **not** move. A `packages/stonedog-style/**` glob names a
> *submodule checkout directory*, which is unaffected by the package's name —
> changing it is its own silent breakage. And the `transpilePackages` entry in
> `next.config` **does** move, because that one names the package.
>
> Assert it rather than eyeballing it — this is the only failure here with no
> other symptom:
>
> ```ts
> // panda.test.ts
> import { globSync } from "tinyglobby";
> it("every stonedog glob resolves to real files", () => {
>   for (const g of config.include.filter((p) => p.includes("stonedogcode"))) {
>     expect(globSync(g).length).toBeGreaterThan(0);
>   }
> });
> ```

```jsonc
// 3. tsconfig.json — so the generated `styled-system/*` imports resolve
{
  "compilerOptions": {
    // NOT `baseUrl`. TypeScript 6 removed it, and a project on a current
    // toolchain fails immediately with TS5102. This form does the same job
    // and works on both.
    "paths": { "*": ["./*"] },
    "jsx": "react-jsx",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*", "styled-system/**/*.ts"]
}
```

```tsx
// 4. Your root — theme first, then the provider
import "./theme.css";                 // the 45 properties, from step 3 above
import { StonedogStyleProvider } from "@stonedogcode/style";

export function Root({ children }) {
  return (
    <StonedogStyleProvider fontSizeProfile="md" variant="solid">
      {children}
    </StonedogStyleProvider>
  );
}
```

```bash
# 5. Generate, then run the three checks under "Check it actually worked"
npx panda codegen && npx panda cssgen --outfile styled-system/styles.css
```

**What each mistake looks like**, since none of them raise an error:

| Symptom | Cause |
|---|---|
| Page renders, everything invisible or unstyled colours | Step 3 — properties undefined |
| Components render but have no styling at all | `include` missing the package (c) |
| Some styles apply, spacing and radii look wrong | Dropped a base preset (a/b) |
| `md`/`lg` responsive props rejected by the type-checker | Dropped a base preset (a/b) |
| `Cannot find module 'styled-system/jsx'` | No `paths` mapping, or codegen not run |
| `TS5102: Option 'baseUrl' has been removed` | TypeScript 6+; use `paths` (step 3) |
| `Could not find a declaration file for 'react-dom'` | Missing `@types/react-dom` (step 1) |
| Works in dev, breaks in a Next.js build | Missing `transpilePackages` |

Every row is a failure this walkthrough actually hit on a clean project, not a
list of things that might go wrong.

## Logging

Silent by default — a component that renders a few hundred times a second must
not decide your console should fill up. Opt in at startup:

```ts
import { setStyleLogger } from "@stonedogcode/style";
setStyleLogger(myLogger); // trace / debug / info / warn / error
```

## Icons — bring your own

**This package ships no icons, and that is the point.** `StyledIcon` is a
sizing-and-colouring wrapper that renders *whatever node you hand it*, so you
choose the icon set and nothing about it leaks into the library. Lucide,
Heroicons, Font Awesome, Material Symbols, your designer's SVGs — all equally
supported, and you can mix them.

```tsx
import { StyledIcon } from "@stonedogcode/style";
import { Home } from "lucide-react";

<StyledIcon icon={<Home />} size="lg" />;
```

### Building an icon set

An icon set is a few hundred near-identical wrappers, and hand-writing them is
how a set drifts — one forgets to forward `size`, another hardcodes a colour.
`createIcon` makes each one a line and forces them to agree:

```tsx
// icons.tsx — your own module, in your own repo
import { createIcon, createIconFromComponent } from "@stonedogcode/style";
import { Home, Trash2 } from "lucide-react";

export const StyledHome  = createIcon("StyledHome", <Home />);
export const StyledTrash = createIconFromComponent("StyledTrash", Trash2);
```

Use `createIconFromComponent` when the set exports one component per glyph
(Lucide, Heroicons, react-icons). It renders them at `width`/`height` 100% so
they fill the box `size` establishes — most sets default to 24px and would
otherwise ignore `size` entirely. Use `createIcon` when you have a node already.

### Sizing

`size` accepts `xs`, `sm`, `1x`, `md`, `lg`, `2x`, `xl`, `3x` … `10x` and sets a
square box in CSS px (`md` → 20, `lg` → 24, `2x` → 32). It always wins over a
height or width in a spread `style` prop, so sizing stays predictable.

Omit it and the app-wide `iconSize` from the provider applies — `2x` unless your
app says otherwise. Prefer omitting it: see "Retuning the scale for your
audience" above.

### Colouring

Two mechanisms, because icon libraries disagree about how they take a colour:

| Your icon set draws with… | What to do |
|---|---|
| `currentColor` — Lucide, Heroicons, Feather, Material Symbols, most SVGs | Nothing. `color` is set on the wrapper and inherits. |
| its own CSS variables — e.g. Font Awesome duotone | Map the published `--icon-*` properties, once. |

`StyledIcon` publishes `--icon-primary-color`, `--icon-secondary-color` and
`--icon-secondary-opacity` under **neutral names** so no icon library is baked
into this package. A set that wants different names needs one CSS rule:

```css
/* Font Awesome adapter — one rule, in your app */
.icon svg {
  --fa-primary-color:     var(--icon-primary-color);
  --fa-secondary-color:   var(--icon-secondary-color);
  --fa-secondary-opacity: var(--icon-secondary-opacity, 0.4);
}
```

Colours default to the theme tokens (`textMain`, `iconBgPrimary`), so an icon
with no explicit colour follows the host's theme and colour mode automatically.
Pass `color` / `secondaryColor` to override per call site.

### Accessibility

`title` is the whole interface, and the default is the one you want more often:

```tsx
<StyledIcon icon={<Trash2 />} />                  {/* decorative: aria-hidden */}
<StyledIcon icon={<Trash2 />} title="Delete" />   {/* meaningful: role="img" + name */}
```

Give `title` **only** when the icon carries meaning no adjacent text already
conveys — an icon-only button, for instance. An icon sitting next to its own
label must stay untitled, or screen readers announce the name twice.

### Why it works this way

The components were extracted from an app built on a per-seat commercial icon
set whose artwork cannot be redistributed under this licence. Rather than pick a
replacement and impose it on everyone, the artwork was cut out entirely. Your
licensed set can live in a private package while the components that lay it out
stay open — which is exactly the arrangement the original app now uses.

## Navigation — `StyledSidebar`

A rail of tools, built for readers who navigate by reading words rather than by
decoding glyphs. Every item is **an icon *and* the tool's name** — there is no
icon-only rendering, not even collapsed. Full reasoning in
[PRD-0001](docs/prd/PRD-0001-styled-sidebar.md).

```tsx
import { StyledSidebar, type SidebarItem } from "@stonedogcode/style";

const tools: SidebarItem[] = [
  { id: "calendar", icon: <StyledCalendar />, label: "Calendar",
    description: "Events & appointments", help: "Shows what is coming up." },
  { id: "notes", icon: <StyledNotes />, label: "Notes" },
];

<StyledSidebar
  items={tools}                       // already ordered, already filtered
  selectedId={selected}
  onSelect={setSelected}
  overflow="scroll"                   // or "paging"
  emptyState="No tools match that search."
  heading="TOOLS"
  aria-label="Care Tools"
/>;
```

| Prop | Meaning |
|---|---|
| `items` | `SidebarItem[]` — `{ id, icon?, label, description?, help? }`. **Rendered exactly as given.** |
| `selectedId` / `onSelect` | Controlled selection. `onSelect(id)` reports a choice; navigation is yours. |
| `overflow` | `"scroll"` (default, uses `StyledScrollbar`) or `"paging"` (previous/next + "Page 2 of 4"). |
| `itemsPerPage` | Paging only; default 8. |
| `collapsed` / `onCollapsedChange` | Controlled collapse. Omit the handler and no collapse control renders. |
| `emptyState` | Rendered inside a live region when `items` is empty. |
| `heading` | e.g. `"TOOLS"`. |
| `aria-label` | Names the `navigation` landmark. Defaults to `"Tools"`. |

### Ordering, filtering and the search box are **yours**, not the component's

This is the load-bearing part of the API, so it is stated plainly: **`items`
arrive already ordered and already filtered. `StyledSidebar` does not sort, does
not filter, and owns no search field.**

- **Ordering** is a user preference the host stores and applies.
- **Filtering is policy** — name only or description too, fuzzy or exact,
  accent-insensitive or not. Different products want different answers, and
  baking one in would impose it on every future consumer.
- **A search input built here could not dictate.** Speech-to-text lives in the
  host's own text input, behind its own engine selection and feature flag. This
  package cannot import that and must not depend on any host. Leaving the field
  outside is precisely what makes dictated search work.

Three behaviours exist to make that seam seamless, and a host gets them free:

- **Selection survives filtering.** A `selectedId` no longer present in `items`
  stays selected — the reader is searching, not navigating away.
- **Paging resets when `items` changes**, so a narrowed list never strands
  anyone on an empty page 3.
- **An empty `items` renders `emptyState` in a live region**, so a screen-reader
  user learns the filter matched nothing instead of meeting a blank panel.

### What it guarantees

- **Tap targets:** 60px minimum on a tool row, 48px on the pager, collapse and
  help controls — stated as `min-height`, so no density or font-scale change
  erodes them.
- **Help opens on click, never hover** (via `StyledTooltip`'s `trigger="click"`,
  which renders its own visible, focusable help control). Escape closes it and
  returns focus. **Nothing anywhere in this component changes state on hover.**
- **Selection is never colour alone** — border, background *and* label weight,
  plus `aria-current` for assistive technology.
- **Long names wrap** rather than spilling out of the rail.
- **No drag interaction at all** (WCAG 2.2 SC 2.5.7). A host that builds
  reordering must provide a non-drag path.

Scroll mode needs a height to scroll inside: `StyledScrollbar` is
`flex: 1; min-height: 0; overflow: auto`, so give the sidebar's container a
height (`display: flex; flex-direction: column; height: …`). Unconstrained, the
rail simply grows — which is correct, and is not a bug.

## Adopting a component as it is migrated

Components move out of HopperGuard into this package one at a time.
Each lands as its own release, so consumers adopt on their own schedule rather
than waiting for a big-bang switch.

### Find out what is available

```bash
git -C packages/stonedog-style log --oneline main   # what has landed
```

Every migration commit is `feat: migrate StyledX`. The commit body is the real
changelog: it says what the component does, **what was deliberately left
behind**, and any prop that was dropped. Read it before adopting — a migration
is rarely a pure move, because dead props and accessibility gaps get fixed on
the way through.

### HopperGuard

The app already consumes this package, so adopting a component is a pointer bump
plus a decision about the local file.

```bash
git -C packages/stonedog-style checkout main && git -C packages/stonedog-style pull
```

Then, for `apps/web/src/app/components/Styled/StyledX.tsx`:

**If the migrated component is a drop-in**, replace the file with a re-export.
Call sites stay untouched:

```tsx
export { StyledX as default, StyledX } from "@stonedogcode/style";
export type { StyledXProps } from "@stonedogcode/style";
```

**If the app needs behaviour the shared one deliberately does not have**, keep a
real wrapper that delegates. `StyledSpinner` is the worked example: the shared
one has no `spinLogo`, because a brand mark is not a primitive, so the app keeps
a component that renders its logo and falls through to the shared spinner
otherwise. That is not a shim — it is an app-level extension, and it should not
pretend to be one.

Then two PRs, in this order — the submodule pointer must be on `main` before the
app can resolve it:

1. **hopperguard** — bump the `packages/stonedog-style` gitlink.
2. **hopper-web** — swap the local file.
3. **hopperguard** — bump the `apps/web` gitlink.

### optima-filings / optima-cloud-saas

Nothing to unpick — these have no local copy to replace. Take the dependency
(see Install), then import:

```tsx
import { StyledSpinner } from "@stonedogcode/style";
```

`optima-filings` is public and AGPLv3 and ships a public Docker image, so it
uses a **permissive icon set** (Lucide) through the icon seam rather than the
private Font Awesome package. Everything else is shared. Both Optima repos run
their own `--optima-*` namespace via `cssVarPrefix`.

### Verify — the three checks that actually catch things

Learned the hard way; each one corresponds to a real bug that reached `main`.

1. **Type-check on a real `npm install`.** Not a symlinked `node_modules` from
   another checkout — a stale copy there resolves to the wrong package and hides
   dependency-graph breakage entirely. The unit tier cannot substitute: a missing
   export is a *type* error, and jest does not type-check.
2. **Look at it at 375px.** Layout regressions surface on the narrowest screen
   first, and jsdom has no layout engine, so no unit test will tell you.
3. **Read the migration commit for dropped props.** A prop removed upstream is
   a type error at the call site — good. A prop that was *always* silently
   ignored (`thickness`, `speed`, `color`, `emptyColor`, `logoSize` on the
   spinner) is not, and its removal is a no-op you can adopt safely.

### If the component changed shape

Migrations fix things on the way through, so behaviour is occasionally
intentionally different. When it is, the commit says so explicitly. Two patterns
so far:

- **A prop was dropped because it never worked.** Adopt freely; nothing rendered
  differently.
- **An accessibility gap was closed.** `StyledSpinner` gained `role="status"`, so
  screen readers now announce it. Nothing visual changes, but a test asserting
  the old silence will fail, and it should.

## Development

```bash
npm install       # also runs panda codegen
npm run gate      # codegen → typecheck → lint → tests. The merge bar.
npm test
```

`styled-system/` is generated and gitignored; regenerate with
`npm run panda:build`.

Tests run against the **real** generated `styled-system` rather than a mock, so
recipe output is assertable — see CLAUDE.md for why that took some doing.

### Design documents

Components with enough behaviour to argue about get a PRD under `docs/prd/`,
written before the component. They record what a component must do and — more
usefully — what it deliberately does not, so the next person does not re-open a
settled question.

| PRD | Component | Status |
|---|---|---|
| [PRD-0001](docs/prd/PRD-0001-styled-sidebar.md) | `StyledSidebar` | Shipped |

## License

[Apache-2.0](./LICENSE). See [NOTICE](./NOTICE) for attribution.

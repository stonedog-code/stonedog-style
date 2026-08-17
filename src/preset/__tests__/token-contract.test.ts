import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_CSS_VAR_PREFIX,
  TEXT_BACKGROUND_PAIRS,
  colorTokenNames,
  createSemanticColors,
  emphasisTokenNames,
  statusSurfaceTokenNames,
  defaultedColorTokenNames,
  createSemanticFontWeights,
  createSemanticFonts,
  fontTokenNames,
  fontWeightTokenNames,
  getBackgroundForText,
  requiredCssCustomProperties,
} from "../semantic-variables";
import { Z_LAYERS, zIndexTokenNames } from "../z-layers";
import { stonedogStylePreset, stonedogStyleRecipes } from "../index";

describe("the colour token contract", () => {
  it("maps every surface and meaning token to a bare custom property", () => {
    const colors = createSemanticColors();
    const defaulted = new Set(defaultedColorTokenNames());
    for (const [token, def] of Object.entries(colors)) {
      if (defaulted.has(token)) continue; // asserted separately below
      expect(def.value).toMatch(
        new RegExp(`^var\\(--${DEFAULT_CSS_VAR_PREFIX}-[a-z0-9-]+\\)$`),
      );
      // No literal colour may sneak in — a hardcoded value would be invisible
      // to the host's theme and would not change with the color mode.
      expect(def.value).not.toMatch(/#|rgb|hsl/i);
      expect(token).not.toMatch(/\s/);
    }
  });

  /**
   * The emphasis tiers are the ONE exception to fallback-free colour, and the
   * exception is narrow enough to enumerate (NEH-519).
   *
   * It is allowed because "like the surrounding text, but quieter" has a
   * correct answer on every theme, which "what colour is this surface?" does
   * not. The fallback must therefore stay RELATIVE — a literal here would be
   * the very defect the fallback-free rule exists to prevent, wearing the
   * exception as cover.
   */
  it("gives the emphasis tiers a relative fallback, and only them", () => {
    const colors = createSemanticColors();
    const emphasis = emphasisTokenNames();
    expect(emphasis.length).toBeGreaterThan(0);

    for (const token of emphasis) {
      const value = colors[token]!.value;
      expect(value).toMatch(
        new RegExp(`^var\\(--${DEFAULT_CSS_VAR_PREFIX}-[a-z0-9-]+, .+\\)$`),
      );
      // Relative to the inherited colour, never a literal. `currentColor`
      // inside a `color` declaration resolves to the INHERITED value, which is
      // what lets one default work on a light theme and a dark one.
      expect(value).toContain("currentColor");
      expect(value).not.toMatch(/#[0-9a-f]{3}|rgb\(|hsl\(/i);
    }

    // ...and nothing outside the two declared groups grew a fallback by
    // accident. A defaulted SURFACE token would render a plausible wrong colour
    // instead of an obviously missing one, which is precisely the trade the
    // contract refuses.
    const withFallback = Object.entries(colors)
      .filter(([, def]) => /^var\([^,]+,/.test(def.value))
      .map(([token]) => token);
    expect(withFallback.sort()).toEqual([...defaultedColorTokenNames()].sort());
  });

  /**
   * The status chips are the SECOND defaulted group, and their default obeys a
   * different rule from the emphasis tiers (NEH-421).
   *
   * Emphasis is relative to the inherited colour and may name none of its own.
   * Status is the opposite: **the hue is the meaning** — red has to stay red —
   * so a literal is correct here and nowhere else. What must stay relative is
   * the LIGHTNESS of the fill, or a chip picked against a light theme becomes a
   * glaring slab on a dark one.
   *
   * So: fills translucent, borders solid. The borders were translucent in the
   * first attempt and measured 1.72-2.05:1 against the page, failing WCAG
   * 1.4.11; `StyledAlert.ct.tsx` is what caught it and is what pins it now.
   */
  it("gives the status chips a fixed hue with a relative lightness", () => {
    const colors = createSemanticColors();
    const status = statusSurfaceTokenNames();
    expect(status.length).toBeGreaterThan(0);

    for (const token of status) {
      const value = colors[token]!.value;
      expect(value).toMatch(
        new RegExp(`^var\\(--${DEFAULT_CSS_VAR_PREFIX}-[a-z0-9-]+, .+\\)$`),
      );
      // A hue, stated. Unlike every other colour in this file, and unlike the
      // emphasis tiers, which may not name one at all.
      expect(value).toMatch(/#[0-9a-f]{6}/i);
      expect(value).not.toContain("currentColor");
    }

    // The fills follow the page; the borders do not need to. Split explicitly,
    // because "they all use color-mix" would have passed the version that
    // failed contrast.
    for (const token of status.filter((t) => t.startsWith("box"))) {
      expect(colors[token]!.value).toContain("transparent");
    }
    for (const token of status.filter((t) => t.startsWith("border"))) {
      expect(colors[token]!.value).not.toContain("transparent");
    }
  });

  it("re-namespaces every property when a consumer picks its own prefix", () => {
    const colors = createSemanticColors("optima");
    const values = Object.values(colors).map((d) => d.value);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v.startsWith("var(--optima-"))).toBe(true);
    expect(values.some((v) => v.includes("--hopper-"))).toBe(false);
  });

  it("names one required custom property per FALLBACK-FREE token", () => {
    // The identity used to be `required === every colour token`. NEH-519 moved
    // it, deliberately and for the first time: the emphasis tiers are colour
    // tokens that carry a default, so requiring them would fail every existing
    // host for no safety gain — the same argument that keeps the font tokens
    // out (NEH-277).
    //
    // Stated as an equation rather than a number, so it keeps meaning something
    // as tokens are added on either side. What it still guarantees is the thing
    // that matters: a host defining everything `required` names can render
    // every token that would otherwise paint nothing.
    expect(requiredCssCustomProperties()).toHaveLength(
      colorTokenNames().length - defaultedColorTokenNames().length,
    );
    expect(requiredCssCustomProperties("optima")).toContain(
      "--optima-box-primary-bg",
    );
  });

  it("requires no defaulted property of a host", () => {
    // Named explicitly, because the arithmetic above would also be satisfied by
    // requiring an emphasis tier and dropping a surface token.
    const required = requiredCssCustomProperties();
    for (const suffix of [
      "text-muted-text",
      "text-subtle-text",
      "box-success-bg",
      "box-warning-bg",
      "box-error-bg",
      "box-success-border",
      "box-warning-border",
      "box-error-border",
    ]) {
      expect(required).not.toContain(`--hopper-${suffix}`);
    }
  });

  it("emits no duplicate custom properties", () => {
    // Two tokens pointing at one property is almost always a copy-paste slip,
    // and it is invisible until a theme change moves only one of them.
    const props = requiredCssCustomProperties();
    expect(new Set(props).size).toBe(props.length);
  });
});

describe("recipes honour the configurable prefix", () => {
  const recipeSource = readFileSync(
    join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
    "utf8",
  );

  it("never hardcodes the default namespace anywhere a token would do", () => {
    // A literal `var(--hopper-…)` inside a recipe or component bypasses the
    // token layer entirely, so it paints NOTHING for a consumer that chose a
    // different prefix — silently, with no build error. Every such reference
    // must arrive via `--colors-*`, which the token layer re-points.
    //
    // The token DEFINITIONS are the one legitimate place the default namespace
    // appears — `--colors-x: var(--hopper-y)`, `--sizes-x: var(--hopper-y)` —
    // because that layer is precisely what re-points under a custom prefix.
    // Anything else (a `background:`, a `max-height:`) has bypassed it.
    const isTokenDefinition = /^\s*--[a-z]+-[a-z0-9-]+:\s*var\(--hopper-/;
    const offenders = recipeSource
      .split("\n")
      .filter((line) => line.includes("var(--hopper-"))
      .filter((line) => !isTokenDefinition.test(line));

    expect(offenders).toEqual([]);
  });

  it("resolves the outline hover background to a real token", () => {
    // Regression guard for a defect carried in from the extraction: both
    // button recipes named a `buttonBgHover` token that does not exist, so
    // Panda emitted `background: buttonBgHover` — not a valid CSS value, and
    // therefore dropped by the browser. That hover state never rendered.
    expect(recipeSource).not.toContain("background: buttonBgHover");
    expect(recipeSource).toContain("--colors-button-bg-accent-hover");
  });

  it("routes every colour through the token layer, not raw properties", () => {
    // Same defect class: `color: var(--text-primary)` referenced a property in
    // a namespace nothing defines, so those controls silently opted out of
    // theming AND of contrast validation.
    expect(recipeSource).not.toContain("var(--text-primary)");
  });

  /**
   * The general form of the `bg: "buttonBgHover"` bug, rather than one more
   * named instance of it.
   *
   * Panda passes an unknown token through as a literal, so a typo or a token
   * borrowed from another design system's vocabulary emits something like
   * `color: fg.muted` — not a valid CSS value, silently discarded by the
   * browser, invisible to the type-checker and to every behaviour test. Three
   * of these have now been found by hand, one of them (`fg.muted`, on
   * StyledSidebar's item descriptions) as recently as NEH-223. Grepping the
   * generated stylesheet is the only thing that sees them at all.
   *
   * The allowlist this carried is GONE as of NEH-301 — all nine pre-existing
   * offenders are fixed, so the assertion is now simply "none, ever". Do not
   * reintroduce it: an allowlist is how this defect class became normal enough
   * to survive an extraction, and the whole value of the guard is that there is
   * no way to make it pass except by making the declaration render.
   */
  it("never emits a colour value that is neither a token reference nor real CSS", () => {
    const COLOUR_PROPERTY =
      /^\s*(color|background|background-color|border-color|border-[a-z]+-color|fill|stroke|outline-color|scrollbar-color|caret-color|text-decoration-color|accent-color|column-rule-color)\s*:\s*([^;]+);/;
    // Everything a browser can actually paint from. A token reference is the
    // first case; the rest are literals, which the package bans separately but
    // which at least render.
    const REAL_CSS =
      /var\(|#|rgb|hsl|oklch|lab\(|gradient|^(transparent|currentColor|inherit|initial|unset|revert|none|auto|black|white|purple)$/i;

    const offenders = new Set<string>();
    for (const line of recipeSource.split("\n")) {
      const match = COLOUR_PROPERTY.exec(line);
      if (!match) continue;
      const [, property, rawValue] = match;
      const value = rawValue!.trim();
      if (REAL_CSS.test(value)) continue;
      offenders.add(`${property}: ${value}`);
    }

    expect([...offenders].sort()).toEqual([]);
  });

  /**
   * The same defect, one property along — a LAYER name (NEH-830).
   *
   * `drawerRecipe` said `zIndex: "modal"` and no `zIndex` token scale existed,
   * here or in either base Panda preset. So Panda emitted the literal
   *
   *     .drawer { position: fixed; z-index: modal; }
   *
   * which is not a valid `z-index` value, so the browser dropped it and that
   * panel had no z-index at all. Exactly `bg: "buttonBgHover"`, one property
   * along, and equally invisible: the class is in the DOM, the type-checker is
   * happy, and every behaviour test passes because none of them can see a
   * stacking order.
   *
   * Written against the generated stylesheet rather than the recipe source for
   * the same reason the colour guard is: a token that fails to resolve looks
   * *identical* to one that resolves, right up until the CSS is emitted.
   */
  it("never emits a z-index that is neither a token reference nor a real value", () => {
    const Z_INDEX = /^\s*z-index\s*:\s*([^;]+);/;
    // What a browser will actually accept: an integer, `auto`, a global
    // keyword, or a custom property that resolves to one of those.
    const REAL_CSS = /^(var\(.+\)|-?\d+|auto|inherit|initial|unset|revert)$/;

    const offenders = new Set<string>();
    for (const line of recipeSource.split("\n")) {
      const match = Z_INDEX.exec(line);
      if (!match) continue;
      const value = match[1]!.trim();
      if (REAL_CSS.test(value)) continue;
      offenders.add(value);
    }

    // Before the fix this read `["modal"]`.
    expect([...offenders].sort()).toEqual([]);
  });

  /**
   * The same defect, one nesting level down — inside a gradient (NEH-301).
   *
   * The declaration-level guard above cannot see these: a value containing
   * `gradient` is real CSS as far as a regex is concerned, so
   * `linear-gradient(to right, "textPrimary", "secondary")` sails straight
   * past it. Three recipes shipped exactly that — a *quoted* token name, which
   * is a CSS string and never a colour, so the whole gradient was invalid and
   * every one of those `aurora` variants fell back to no background at all.
   * Two more named tokens unquoted (`linear-gradient(to right, boxBgAccent,
   * boxBgSecondary)`), which is equally dead: Panda only substitutes a token
   * inside an arbitrary value when it is written as `{colors.boxBgAccent}`.
   *
   * So the colour STOPS at a bare `var(...)` or a literal. Anything else
   * between the commas is a token name that did not resolve.
   */
  it("never leaves an unresolved token inside a gradient", () => {
    const offenders = new Set<string>();
    for (const line of recipeSource.split("\n")) {
      if (!/gradient\(/.test(line)) continue;
      // The colour stops of a gradient, minus the direction/position syntax.
      const args = line.slice(line.indexOf("gradient(") + "gradient(".length);
      for (const raw of args.split(",")) {
        const arg = raw.trim().replace(/\)+;?$/, "").trim();
        if (!arg) continue;
        // Direction/interpolation/position syntax, and real colour values.
        if (/^(to |from |at |in |\d|-?\d*\.?\d+(%|px|deg|rad|turn|rem)?$|circle|ellipsis|ellipse|closest|farthest|var\(|#|rgb|hsl|oklch|lab\(|transparent$|currentColor$|black$|white$)/i.test(arg)) continue;
        offenders.add(arg);
      }
    }
    expect([...offenders].sort()).toEqual([]);
  });
});

/**
 * The host's typeface (NEH-289).
 *
 * `stonedog-theme` had been resolving fonts into custom properties that nothing
 * here read, so a themed typeface was emitted and inert. These pin both halves
 * of the wiring AND the constraint that makes it safe to ship: fonts carry a
 * fallback and are NOT required, which is the opposite of how colours work.
 */
describe("the font contract", () => {
  const recipeSource = readFileSync(
    join(__dirname, "..", "..", "..", "styled-system", "styles.css"),
    "utf8",
  );

  it("resolves every font token to a host property with a fallback", () => {
    for (const def of Object.values(createSemanticFonts())) {
      expect(def.value).toMatch(
        new RegExp(`^var\\(--${DEFAULT_CSS_VAR_PREFIX}-font-family-[a-z-]+, .+\\)$`),
      );
    }
    for (const def of Object.values(createSemanticFontWeights())) {
      expect(def.value).toMatch(
        new RegExp(`^var\\(--${DEFAULT_CSS_VAR_PREFIX}-font-weight-[a-z-]+, \\d+\\)$`),
      );
    }
  });

  it("re-namespaces the font properties under a consumer's prefix", () => {
    // The defect class NEH-165/166/171 were: a recipe writing
    // `var(--hopper-font-…)` directly would ignore `cssVarPrefix` silently.
    const values = [
      ...Object.values(createSemanticFonts("optima")),
      ...Object.values(createSemanticFontWeights("optima")),
    ].map((d) => d.value);
    expect(values.every((v) => v.startsWith("var(--optima-"))).toBe(true);
    expect(values.some((v) => v.includes("--hopper-"))).toBe(false);
  });

  it("never makes a font property REQUIRED of a host", () => {
    // The identity `required === colours` is load-bearing and may only move
    // deliberately (NEH-277). No host defines the font properties today, so
    // requiring them would break every one of them for no safety gain: an
    // undefined font falls back to the browser's face and the page stays
    // readable, where an undefined colour paints nothing.
    const required = requiredCssCustomProperties();
    expect(required).toHaveLength(
      colorTokenNames().length - defaultedColorTokenNames().length,
    );
    expect(required.some((p) => p.includes("font-"))).toBe(false);
  });

  it("names the weight steps the recipes already use", () => {
    // Same names as Panda's built-in fontWeights tokens on purpose: it is what
    // lets `fontWeight: "bold"`, written across seven recipes, start reading
    // the theme without a call site moving. The union is closed — a step
    // outside it is a stonedog-theme change first.
    expect(fontWeightTokenNames().sort()).toEqual([
      "bold",
      "medium",
      "normal",
      "semibold",
    ]);
    expect(fontTokenNames().sort()).toEqual(["body", "heading", "mono"]);
  });

  it("actually reaches the stylesheet", () => {
    // The whole point of the issue: the properties resolved but no recipe read
    // them, so nothing downstream of the theme ever changed. Font-family had
    // ZERO occurrences in the generated CSS before this.
    // A token DEFINITION proves nothing — the whole defect was properties that
    // resolved and were never read. These assert the USE: a rule that actually
    // sets font-family from the token.
    expect(recipeSource).toMatch(/font-family:\s*var\(--fonts-body\)/);
    // StyledHeading asks for the heading face as a style prop, and Panda only
    // reads source text: if that literal is ever computed instead of written,
    // this rule silently stops being generated.
    expect(recipeSource).toMatch(/font-family:\s*var\(--fonts-heading\)/);
    // And the weights now carry the host property rather than a bare number.
    expect(recipeSource).toContain("--font-weights-bold: var(--hopper-font-weight-bold, 700)");
  });
});

describe("contrast pairings", () => {
  it("pairs text tokens only with tokens that exist", () => {
    // A contrast checker fed a token name nothing defines silently passes.
    const known = new Set(colorTokenNames());
    for (const [text, background] of Object.entries(TEXT_BACKGROUND_PAIRS)) {
      expect(known.has(text)).toBe(true);
      expect(known.has(background)).toBe(true);
    }
  });

  it("resolves the surface a text token is read against", () => {
    expect(getBackgroundForText("textPrimary")).toBe("boxBgPrimary");
    // The pairing is not derivable from the name — plain button text sits on
    // the plain button, not on any box surface.
    expect(getBackgroundForText("buttonTextPlain")).toBe("buttonBgPlain");
    expect(getBackgroundForText("nonsense")).toBeUndefined();
  });
});

describe("the preset", () => {
  it("force-generates every variant of every recipe", () => {
    // The style variant is chosen by the user at runtime, so Panda's static
    // extractor never sees the concrete value. Without staticCss, switching
    // variants yields class names with no CSS behind them.
    const preset = stonedogStylePreset();
    const staticRecipes = preset.staticCss?.recipes ?? {};
    expect(Object.keys(staticRecipes).sort()).toEqual(
      Object.keys(stonedogStyleRecipes).sort(),
    );
    expect(Object.values(staticRecipes).every((v) => Array.isArray(v) && v[0] === "*")).toBe(true);
  });

  it("force-generates the flexbox alignment utilities", () => {
    // NEH-288. StyledHStack/StyledVStack rename `align`/`justify` to
    // `alignItems`/`justifyContent` at runtime, so the extractor — which only
    // reads source text — never sees the value it has to generate a rule for.
    // Without this the component emits `ai_baseline` and nothing defines it.
    const preset = stonedogStylePreset();
    const cssEntries = preset.staticCss?.css ?? [];
    const properties = cssEntries.flatMap((entry) =>
      Object.entries((entry as { properties?: Record<string, string[]> }).properties ?? {}),
    );
    const byName = Object.fromEntries(properties);

    expect(byName.alignItems).toEqual(expect.arrayContaining(["baseline", "stretch", "flex-start", "flex-end"]));
    expect(byName.justifyContent).toEqual(
      expect.arrayContaining(["space-between", "flex-start", "flex-end", "center"]),
    );
  });

  it("does not impose application-level decisions on its consumers", () => {
    // A preset that restyles `body` or forces a preflight is hard to adopt;
    // those belong to the app. Regression guard on the adoption story.
    const preset = stonedogStylePreset() as unknown as Record<string, unknown>;
    expect(preset.globalCss).toBeUndefined();
    expect(preset.preflight).toBeUndefined();
    expect(preset.include).toBeUndefined();
    expect(preset.outdir).toBeUndefined();
  });

  it("carries a zIndex scale a host can override", () => {
    // The whole mechanism of NEH-830: names here, numbers at the host. If
    // these tokens stop reaching `theme.extend.tokens`, every `zIndex: "<name>"`
    // in this package silently becomes an invalid literal again — and a host's
    // override has nothing to override.
    const preset = stonedogStylePreset();
    const zIndex = preset.theme?.extend?.tokens?.zIndex as
      | Record<string, { value: number }>
      | undefined;
    expect(zIndex?.modal).toBeDefined();
    expect(Object.keys(zIndex ?? {}).sort()).toEqual(
      [...zIndexTokenNames()].sort(),
    );
  });

  it("orders the layers so a dialog's own controls can open on top of it", () => {
    // The ORDER is the contract; the numbers are the host's. Menus, toasts,
    // tooltips and modals all have to be able to open ON a dialog, so each is
    // above it. Raising the dialog to "win" a stacking argument is the change
    // that looks right and hides every popup opened inside one.
    const values = zIndexTokenNames().map((name) => Z_LAYERS[name]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);

    for (const above of ["menu", "popover", "overlay", "toast", "modal", "tooltip"] as const) {
      expect(Z_LAYERS[above]).toBeGreaterThan(Z_LAYERS.dialog);
    }
    expect(Z_LAYERS.hide).toBeLessThan(Z_LAYERS.base);
  });

  it("threads the prefix option through to the generated tokens", () => {
    const preset = stonedogStylePreset({ cssVarPrefix: "optima" });
    const colors = preset.theme?.extend?.tokens?.colors as
      | Record<string, { value: string }>
      | undefined;
    // Asserting the token EXISTS before reading it: `colors?.x.value` would
    // throw rather than fail helpfully if the prefix option stopped threading
    // through and the token vanished.
    expect(colors?.boxBgPrimary).toBeDefined();
    expect(colors?.boxBgPrimary?.value).toBe("var(--optima-box-primary-bg)");
  });
});

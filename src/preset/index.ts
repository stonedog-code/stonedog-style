import { definePreset } from "@pandacss/dev";

import { arrowRecipe } from "./recipes/arrows";
import { boxRecipe } from "./recipes/box";
import { buttonRecipe } from "./recipes/button";
import { buttonIconRecipe } from "./recipes/icon-button";
import { dlRecipe } from "./recipes/dl-list";
import { drawerRecipe } from "./recipes/drawer";
import { formRecipe } from "./recipes/form";
import { iconRecipe } from "./recipes/icon";
import { inputBoolRecipe } from "./recipes/input-bool";
import {
  inputDropdownContentRecipe,
  inputDropdownItemRecipe,
  inputDropdownRecipe,
} from "./recipes/input-dropdown";
import { alertRecipe } from "./recipes/alert";
import { inputRadioRootRecipe } from "./recipes/input-radio";
import { inputTextRecipe } from "./recipes/input-text";
import { listRecipe } from "./recipes/list";
import { menuRecipe } from "./recipes/menu";
import {
  separatorHorizontalRecipe,
  separatorVerticalRecipe,
} from "./recipes/separator";
import { stackRecipe } from "./recipes/stack";
import { stripedRecipe } from "./recipes/striped";
import { tagRecipe } from "./recipes/tag";
import { textRecipe } from "./recipes/text";
import { toastRecipe } from "./recipes/toast";
import { tooltipRecipe } from "./recipes/tooltip";

import {
  DEFAULT_CSS_VAR_PREFIX,
  createSemanticColors,
  createSemanticFontWeights,
  createSemanticFonts,
  createSemanticSizes,
} from "./semantic-variables";
import { createZIndexTokens } from "./z-layers";

export interface StonedogStylePresetOptions {
  /**
   * Namespace for the CSS custom properties the colour tokens read.
   *
   * `"hopper"` yields `var(--hopper-box-primary-bg)`; `"optima"` yields
   * `var(--optima-box-primary-bg)`. Only change this if the host application
   * emits its theme under a different namespace — the value must match whatever
   * writes those properties at runtime, and a mismatch renders every colour as
   * nothing at all (see semantic-variables.ts).
   *
   * @default "hopper"
   */
  cssVarPrefix?: string;
}

/**
 * Every recipe, keyed by the name it is exported under in `styled-system/recipes`.
 *
 * Six of these (`alertRecipe`, `listRecipe`, `menuRecipe`, `inputBoolRecipe`,
 * `inputRadioRootRecipe`, `toastRecipe`) are slot recipes declared with
 * `defineSlotRecipe`.
 * Panda accepts them here rather than under `slotRecipes` and generates them
 * correctly — verified against HopperGuard's own generated output. Moving them
 * to `slotRecipes` would be more "correct" by the docs and would change the
 * generated surface, so it is deliberately not done during extraction.
 */
const recipes = {
  alertRecipe,
  arrowRecipe,
  boxRecipe,
  buttonRecipe,
  buttonIconRecipe,
  dlRecipe,
  drawerRecipe,
  formRecipe,
  iconRecipe,
  inputBoolRecipe,
  inputDropdownRecipe,
  inputDropdownContentRecipe,
  inputDropdownItemRecipe,
  inputRadioRootRecipe,
  inputTextRecipe,
  listRecipe,
  menuRecipe,
  separatorHorizontalRecipe,
  separatorVerticalRecipe,
  stackRecipe,
  stripedRecipe,
  tagRecipe,
  textRecipe,
  toastRecipe,
  tooltipRecipe,
};

/**
 * Force every variant of every recipe into the stylesheet.
 *
 * The style variant (`solid | outline | aurora | glass | matte`) is chosen by
 * the *user* at runtime, not by the code, so Panda's static extractor has no way
 * to know which classes will be needed — it only ever sees `variant={variant}`.
 * Without this, switching variants at runtime yields elements with class names
 * that have no corresponding CSS, which fails as an unstyled component rather
 * than as an error.
 */
const staticCssRecipes = Object.fromEntries(
  Object.keys(recipes).map((name) => [name, ["*"]]),
) as Record<keyof typeof recipes, ["*"]>;

/**
 * Force the flexbox alignment utilities into the stylesheet (NEH-288).
 *
 * Same reasoning as the recipes above, one layer down. `StyledHStack` and
 * `StyledVStack` accept `align`/`justify` as aliases and rename them to
 * `alignItems`/`justifyContent` at runtime. Panda's extractor only reads source
 * text: it sees `align="baseline"`, finds no utility by that name, and generates
 * nothing — yet the component emits `ai_baseline`. Same for any value the caller
 * computes rather than writes as a literal.
 *
 * That is this package's recurring failure mode: a class name with no rule
 * behind it, which produces no build error, no console warning, and renders as
 * silently-wrong layout. Fourteen declarations is a cheap price for closing it.
 */
const staticCssAlignment = [
  {
    properties: {
      alignItems: ["flex-start", "flex-end", "center", "baseline", "stretch", "start", "end"],
      justifyContent: [
        "flex-start",
        "flex-end",
        "center",
        "space-between",
        "space-around",
        "space-evenly",
        "start",
        "end",
      ],
    },
  },
];

/**
 * The @stonedogcode/style Panda preset: colour tokens, breakpoints, keyframes, and
 * the 23 recipes the component library is built on.
 *
 * Deliberately does NOT set `globalCss`, `preflight`, `include`, or `outdir` —
 * those are application decisions, and a preset that quietly restyles `body` is
 * a preset that is hard to adopt. The consuming app owns them. See CLAUDE.md.
 */
export function stonedogStylePreset(options: StonedogStylePresetOptions = {}) {
  const { cssVarPrefix = DEFAULT_CSS_VAR_PREFIX } = options;

  return definePreset({
    name: "@stonedogcode/style",
    theme: {
      extend: {
        /**
         * The full responsive scale, declared here rather than only the one
         * value that differs from Panda's default.
         *
         * The originating app declared only `3xl` and inherited `sm`–`2xl` from
         * `@pandacss/preset-panda`. That works right up until a consumer passes
         * a `presets` array — which **replaces** Panda's defaults rather than
         * adding to them — at which point `md` silently stops being a valid
         * breakpoint and every responsive prop in the library becomes a type
         * error, or worse, a dropped style. Restating all six makes the preset
         * self-sufficient for the values its components actually reference.
         *
         * The base presets are still required for tokens and utilities — see
         * the consumer wiring in CLAUDE.md.
         */
        breakpoints: {
          sm: "640px",
          md: "768px",
          lg: "1024px",
          xl: "1280px",
          "2xl": "1536px",
          "3xl": "1600px",
        },
        tokens: {
          colors: createSemanticColors(cssVarPrefix),
          sizes: createSemanticSizes(cssVarPrefix),
          /**
           * The host's typeface (NEH-289). `fontWeights` deliberately reuses
           * Panda's own token names, so the `fontWeight: "bold"` already
           * written across seven recipes starts reading the theme without a
           * call site moving. Both carry fallbacks — see semantic-variables.
           */
          fonts: createSemanticFonts(cssVarPrefix),
          fontWeights: createSemanticFontWeights(cssVarPrefix),
          /**
           * Named stacking layers (NEH-830). Neither this preset nor either
           * base Panda preset defined any, so `drawerRecipe`'s `zIndex:
           * "modal"` resolved to nothing and was emitted as the literal
           * `z-index: modal` — invalid CSS the browser discards, leaving that
           * panel with no z-index at all.
           *
           * Unlike the colour tokens these carry no custom property: a layer
           * is not a brand decision and there is nothing for a theme to
           * restyle. A HOST overrides the numbers in its own config; see
           * z-layers.ts for why the names live here and the values do not.
           */
          zIndex: createZIndexTokens(),
        },
        keyframes: {
          spin: {
            "0%": { transform: "rotate(0deg)" },
            "100%": { transform: "rotate(360deg)" },
          },
          // The disabled strike-through on StyledInputToggle. A keyframe rather
          // than a transition because it plays once on appearance, and there is
          // no "before" state to transition from.
          stonedogStrikeIn: {
            "0%": { transform: "scaleX(0)" },
            "100%": { transform: "scaleX(1)" },
          },
          /**
           * One confetti particle's flight — `StyledConfetti`'s zero-dependency
           * default (NEH-430).
           *
           * The three `--sd-confetti-*` properties are set inline, per
           * particle, so one keyframe serves a whole burst travelling in every
           * direction. A keyframe cannot randomise, and a hundred generated
           * keyframes would be a hundred rules in every consumer's stylesheet.
           *
           * **These are NOT the theme namespace and must not be confused with
           * it.** CLAUDE.md's rule — never write `var(--…)` for anything the
           * HOST supplies — is about `--<prefix>-*` properties that a theme
           * defines and `cssVarPrefix` re-points. These are component-internal,
           * written and read in the same breath by the same component, and
           * named `--sd-confetti-*` precisely so they cannot collide with a
           * host's namespace. The particle's COLOUR still comes from a token.
           */
          stonedogConfettiBurst: {
            "0%": {
              transform: "translate3d(0, 0, 0) rotate(0deg)",
              opacity: "1",
            },
            "100%": {
              transform:
                "translate3d(var(--sd-confetti-dx, 0), var(--sd-confetti-dy, 0), 0) rotate(var(--sd-confetti-rot, 0deg))",
              opacity: "0",
            },
          },
        },
        recipes,
      },
    },
    staticCss: {
      recipes: staticCssRecipes,
      css: staticCssAlignment,
    },
  });
}

export {
  DEFAULT_CSS_VAR_PREFIX,
  TEXT_BACKGROUND_PAIRS,
  colorTokenNames,
  createSemanticColors,
  createSemanticFontWeights,
  createSemanticFonts,
  createSemanticSizes,
  fontTokenNames,
  fontWeightTokenNames,
  getBackgroundForText,
  requiredCssCustomProperties,
} from "./semantic-variables";

export {
  Z_LAYERS,
  createZIndexTokens,
  zIndexTokenNames,
  type ZLayerName,
} from "./z-layers";

export { recipes as stonedogStyleRecipes };

/* ------------------------------------------------------------------------- *
 * Deprecated `hopper*` aliases — NEH-251.
 *
 * The package renamed hopper-style → @stonedogcode/style. These re-exports exist so
 * each consumer can bump its submodule pointer on its own schedule instead of
 * every repo having to move in one lockstep sweep, which is what would make an
 * ordered set of PRs impossible.
 *
 * They are a migration seam with an end date, not a compatibility promise.
 * Remove them once HopperGuard, optima-filings and optima-cloud-saas have all
 * landed their consumer PRs.
 * ------------------------------------------------------------------------- */

/** @deprecated Renamed to `stonedogStylePreset`. Removed once every consumer has migrated (NEH-251). */
export const hopperStylePreset = stonedogStylePreset;

/** @deprecated Renamed to `StonedogStylePresetOptions`. Removed once every consumer has migrated (NEH-251). */
export type HopperStylePresetOptions = StonedogStylePresetOptions;

/** @deprecated Renamed to `stonedogStyleRecipes`. Removed once every consumer has migrated (NEH-251). */
export { recipes as hopperStyleRecipes };

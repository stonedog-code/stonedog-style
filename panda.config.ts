import { defineConfig } from "@pandacss/dev";
import { stonedogStylePreset } from "./src/preset";

/**
 * The package's OWN Panda config.
 *
 * This exists so the library can typecheck and test itself: every component
 * imports from `styled-system/*`, which does not exist until `panda codegen`
 * runs. It is NOT what consumers use — they build their own `styled-system`
 * from their own config, and merely add `stonedogStylePreset` to `presets` and
 * our source to `include`. See CLAUDE.md, "How a consumer wires this up".
 *
 * Keep this config as close to a bare consumer's as possible. Anything special
 * added here is a divergence between what we test and what consumers get.
 */
export default defineConfig({
  preflight: false,
  /**
   * The base presets are listed EXPLICITLY, and consumers must do the same.
   *
   * Supplying a `presets` array replaces Panda's defaults instead of adding to
   * them. Omit these two and the recipes lose every token they lean on —
   * `gray.*`, `radii.xl`, the spacing scale — and Panda drops those
   * declarations silently, with no error at build time and no error in the
   * browser. It just renders wrong.
   *
   * Since Panda 2 this is not only our rule but Panda's: v1 added
   * `@pandacss/preset-base` on its own when `presets` was set, v2 adds
   * nothing, and both base presets are explicit devDependencies here for
   * that reason (NEH-2155).
   */
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda", stonedogStylePreset()],
  include: ["./src/**/*.{ts,tsx}"],
  exclude: ["./src/**/__tests__/**/*"],
  outdir: "styled-system",
  jsxFramework: "react",
  /**
   * Emit `.js` rather than Panda's default `.mjs`.
   *
   * Purely so the library can test itself. Both are ESM; the difference is that
   * TypeScript will downlevel a `.js` file to CommonJS for Jest but *never* a
   * `.mjs` one — the extension forces ESM output whatever `module` says. Without
   * this, every component test dies on `Unexpected token 'export'`, and the only
   * remaining option is to mock `styled-system` wholesale, which is precisely
   * the compromise this package exists to avoid (see jest.config.cjs).
   *
   * Consumers are unaffected: they generate their own styled-system from their
   * own config and can leave this at the default.
   */
  outExtension: "js",
});

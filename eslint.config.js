import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Flat config, migrated from `.eslintrc.cjs`.
 *
 * ## This package stays on eslint 9, and INSTALLING IT WARNS. That is expected
 *
 *     npm warn deprecated eslint@9.39.5: This version is no longer supported.
 *
 * That warning cannot be cleared here, and the reason is worth stating so
 * nobody spends an afternoon on it. Measured against the registry rather than
 * assumed:
 *
 *   - 9.39.5 is the HIGHEST eslint 9 that exists (58 of them) and it carries
 *     the `maintenance` dist-tag. So there is no non-deprecated eslint 9 to
 *     move to — the warning is a statement about the major, not the patch.
 *   - eslint 10 is `latest`, and `@typescript-eslint/*` and
 *     `eslint-plugin-react-hooks@7` both already accept it.
 *   - `eslint-plugin-react` does NOT. Its latest, 7.37.5, declares
 *     `eslint: ^3 || … || ^9.7`, and npm refuses the install outright:
 *
 *         npm error ERESOLVE unable to resolve dependency tree
 *         npm error peer eslint@"… || ^9.7" from eslint-plugin-react@7.37.5
 *
 *     Its `next` tag is 7.8.0-rc.0 — OLDER than latest, peer `^3 || ^4` — so
 *     there is no prerelease to reach for either.
 *
 * Two ways out were considered and both rejected. `--legacy-peer-deps` gives
 * what npm's own message calls "an incorrect (and potentially broken)
 * dependency resolution", which is not a thing to do to the package that
 * decides what every consumer's CSS looks like. Dropping `eslint-plugin-react`
 * would reach eslint 10 today, but this is a React component library and that
 * plugin is what catches a missing `key` on a list — trading a real guard for
 * a quieter install is the wrong direction. `eslint-plugin-react-hooks` does
 * not cover it; it is hooks rules only.
 *
 * So: flat config now, eslint 10 the day the plugin supports it. This is the
 * half that has to happen either way, and doing it now means the version bump
 * is then a one-line change rather than a migration under time pressure.
 *
 * ## `env` has no flat-config equivalent
 *
 * The old config declared `env: { browser: true, es2022: true, node: true,
 * jest: true }`. The `globals` package carries those same sets, and it is used
 * rather than a hand-written list: eslint reported 55 distinct undefined
 * globals here — `getComputedStyle`, `HTMLDListElement`, `MutationObserver`
 * and so on — and a hand-maintained list of those is wrong the first time
 * somebody uses the fifty-sixth.
 *
 * ## Core rules that TypeScript supersedes are turned off BY THE PLUGIN
 *
 * `js.configs.recommended` includes `no-undef` and `no-redeclare`, and both are
 * wrong here — not noisy, wrong:
 *
 *   - `no-undef` flags `React.RefObject<…>` in eight tests. That is a
 *     TYPE-ONLY reference to a global namespace, which never exists at runtime
 *     and so is not something a linter can see.
 *   - `no-redeclare` flags `useResolvedVariant` twice in `style-config.tsx`.
 *     Those are TypeScript OVERLOAD SIGNATURES, which are the correct way to
 *     write that function.
 *
 * Both are silenced by `flat/eslint-recommended`, which is typescript-eslint's
 * own list of the 23 core rules the compiler already enforces better. Using
 * their list rather than naming the two rules we happen to have tripped over
 * means the next such false positive is already handled — and it is a list
 * somebody else maintains against each new TypeScript release.
 */
export default [
  {
    // From the old `ignorePatterns`. `styled-system/` is generated Panda
    // output — linting it reports thousands of problems in code nobody wrote.
    //
    // `playwright/` is NEW to this list, for a reason worth recording: the old
    // lint script passed `--ext ts,tsx`, which flat config drops, so the file
    // set silently widened to take in the `.js` of the component-test runner's
    // build CACHE — 239 problems in generated code. Dropping `--ext` is not a
    // cosmetic part of this migration.
    ignores: [
      "styled-system/**",
      "playwright/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...tsPlugin.configs["flat/eslint-recommended"].rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The new JSX transform means React need not be in scope.
      "react/react-in-jsx-scope": "off",
      // Panda style props are spread through generic prop bags in several
      // primitives; prop-types is meaningless in a TypeScript codebase.
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/__tests__/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];

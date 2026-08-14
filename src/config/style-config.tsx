"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { DensityProfile, FontSizeProfile, IconSize, ThemeVariant } from "./types";
import { resolveDensityStep, type DensityBase, type DensityStep } from "./density";
import { THEME_VARIANTS } from "./types";
import { IntentIconProvider, type IntentIcons } from "./intent-icons";
import { DefaultLinkComponent, type LinkComponent } from "./link-component";

/**
 * Everything this component library needs to know about the host application.
 *
 * The components were extracted from an app where they read a 461-line Zustand
 * store holding auth, widgets, notes, services and config together. Depending on
 * that store is what made them unshareable, so the seam was drawn at the
 * narrowest possible place: **these two settings are all the styling actually
 * needs.** Anything a component wants beyond them belongs in a prop.
 *
 * Keeping this interface small is a load-bearing constraint, not tidiness. Every
 * field added here is a field a second host must supply before it can render a
 * single button.
 */
export interface StyleConfig {
  /**
   * The user's app-wide text size. Drives `StyledText`, and through it nearly
   * all visible text.
   */
  fontSizeProfile: FontSizeProfile;

  /**
   * The user's app-wide appearance. A component may override it per call site;
   * see `useResolvedVariant` for the precedence rule.
   */
  variant: ThemeVariant;

  /**
   * The **user's** density preference, relative to the app's baseline.
   *
   * Not cosmetic: at `compact` the intent buttons drop their text label and
   * show only their icon, so this changes what a control *says*, not just its
   * padding. That is why it lives here rather than being left to CSS.
   */
  density: DensityProfile;

  /**
   * The **application's** density baseline — the rung `density: "normal"` means.
   *
   * HopperGuard runs `spacious`, both Optima products `compact`, RozCards
   * `standard`. See `config/density.ts`: this and `density` are a position and
   * an offset on one scale, not two competing axes.
   *
   * Defaults to `standard`, whose spacing (8px) is exactly the fallback the
   * recipes have always used — so a host that says nothing sees no change.
   */
  densityBase: DensityBase;

  /**
   * The app-wide default icon size, used by any `StyledIcon` that is not given
   * an explicit `size`.
   *
   * This exists because the alternative is naming a size at every call site,
   * which is how an application ends up with three icon scales and no way to
   * retune any of them. Font size is already host-tunable — every `fontSizeMap`
   * entry is a `var(--font-sizes-*)` reference the host can define — and this is
   * the equivalent seam for icons.
   *
   * The default stays `"2x"`: HopperGuard serves an often-elderly, sometimes
   * cognitively-impaired audience and runs deliberately large, and ~150 of its
   * call sites rely on that default. A host wanting a conventional web scale
   * (a business tool for a general audience) sets `"md"`.
   */
  iconSize: IconSize;

  /**
   * What `StyledLink` renders for an in-app destination (NEH-430).
   *
   * This is a seam, not a dependency. `StyledLink` used to import `next/link`
   * directly, which is why it could not live in this package at all — CLAUDE.md
   * names `next/*` as forbidden, and three products with three framework
   * choices cannot be made to share one.
   *
   * The default is a plain `<a>`: a real, working, accessible link, not a
   * placeholder. A host passes its router's component to gain client-side
   * navigation and prefetching, and gains nothing else — so an unconfigured
   * host is not broken, merely un-optimised.
   *
   * Note this is the only field here whose value is a *component*. It sits on
   * `StyleConfig` rather than being a `StyledLink` prop because the choice is
   * app-wide by nature: passing it per call site is how ~40 links end up with
   * two navigation behaviours and no way to retune either.
   */
  linkComponent: LinkComponent;
}

/**
 * What a host that supplies nothing gets.
 *
 * Both values are deliberately the middle/safest option rather than the
 * smallest or the flashiest: an unconfigured app should be readable and plain,
 * so that forgetting the provider degrades to "looks unstyled" rather than
 * "unreadable at 0.75rem".
 */
export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  fontSizeProfile: "md",
  variant: "solid",
  density: "normal",
  // `standard` + `normal` resolves to 8px, which is the fallback baked into
  // every recipe. An unconfigured host renders exactly as it did before the
  // ladder existed.
  densityBase: "standard",
  // Not the middle of the scale, unlike the two above: this one is pinned to
  // what the originating application already renders. Changing it would be an
  // invisible, app-wide visual change to every existing consumer.
  iconSize: "2x",
  // A plain anchor. Unlike `iconSize` above this is genuinely the safe middle:
  // it navigates correctly everywhere, and a host overriding it is opting into
  // an improvement rather than repairing a default.
  linkComponent: DefaultLinkComponent,
};

const StyleConfigContext = createContext<StyleConfig>(DEFAULT_STYLE_CONFIG);

/**
 * Every setting optional, and explicitly accepting `undefined`.
 *
 * `Partial<StyleConfig>` alone is not enough under
 * `exactOptionalPropertyTypes`: it makes each key optional but still refuses an
 * explicit `undefined`. Hosts routinely pass one — `variant={user?.variant}` —
 * and rejecting that would push a conditional spread into every call site for
 * no benefit, since the provider already treats absent and undefined the same.
 */
type OptionalStyleConfig = {
  [K in keyof StyleConfig]?: StyleConfig[K] | undefined;
};

export interface StonedogStyleProviderProps extends OptionalStyleConfig {
  children: React.ReactNode;
  /**
   * Which icon to draw for each intent — see `config/intent-icons.tsx`.
   *
   * This is how one `StyledDeleteButton` serves a Font Awesome product and a
   * Lucide one. Optional: an unregistered intent simply renders no icon.
   */
  icons?: IntentIcons | undefined;
}

/**
 * Supplies the styling settings to everything beneath it.
 *
 * Wrap the app once, near the root, and feed it from wherever the host keeps
 * user preferences. HopperGuard renders it inside its existing config provider
 * and passes the two values through from the Zustand store; a host with no such
 * store can pass literals, or omit the provider entirely and take the defaults.
 *
 * ```tsx
 * <StonedogStyleProvider fontSizeProfile={profile} variant={variant}>
 *   <App />
 * </StonedogStyleProvider>
 * ```
 *
 * Props are merged over the defaults individually, so a host that only cares
 * about font size does not have to name a variant it has no opinion on.
 */
export function StonedogStyleProvider({
  children,
  fontSizeProfile,
  variant,
  iconSize,
  density,
  densityBase,
  linkComponent,
  icons,
}: StonedogStyleProviderProps) {
  const value = useMemo<StyleConfig>(
    () => ({
      fontSizeProfile:
        fontSizeProfile ?? DEFAULT_STYLE_CONFIG.fontSizeProfile,
      variant: variant ?? DEFAULT_STYLE_CONFIG.variant,
      iconSize: iconSize ?? DEFAULT_STYLE_CONFIG.iconSize,
      density: density ?? DEFAULT_STYLE_CONFIG.density,
      densityBase: densityBase ?? DEFAULT_STYLE_CONFIG.densityBase,
      linkComponent: linkComponent ?? DEFAULT_STYLE_CONFIG.linkComponent,
    }),
    [fontSizeProfile, variant, iconSize, density, densityBase, linkComponent],
  );

  return (
    <StyleConfigContext.Provider value={value}>
      {/*
        The icon registry rides along with the style config so a host wires up
        one provider, not two — and so the intent buttons cannot end up inside
        a styled tree with no icons registered.
      */}
      <IntentIconProvider icons={icons ?? {}}>{children}</IntentIconProvider>
    </StyleConfigContext.Provider>
  );
}

/**
 * @deprecated Renamed to `StonedogStyleProvider` (NEH-251).
 *
 * Kept so each consumer can bump its submodule pointer on its own schedule
 * rather than every repo moving in one lockstep sweep. Removed once HopperGuard,
 * optima-filings and optima-cloud-saas have all landed their consumer PRs.
 */
export const HopperStyleProvider = StonedogStyleProvider;

/** @deprecated Renamed to `StonedogStyleProviderProps` (NEH-251). */
export type HopperStyleProviderProps = StonedogStyleProviderProps;

/** The current styling settings. Safe outside a provider — returns defaults. */
export function useStyleConfig(): StyleConfig {
  return useContext(StyleConfigContext);
}

/** The user's app-wide font-size profile. */
export function useFontSizeProfile(): FontSizeProfile {
  return useStyleConfig().fontSizeProfile;
}

/** The app-wide default icon size. `StyledIcon` uses it when given no `size`. */
export function useIconSize(): IconSize {
  return useStyleConfig().iconSize;
}

/**
 * The host's link implementation, or a plain `<a>` if it supplied none.
 *
 * Exported so an application component outside this package can render a link
 * the same way `StyledLink` does, without reaching for the router directly and
 * re-creating the coupling the seam removed.
 */
export function useLinkComponent(): LinkComponent {
  return useStyleConfig().linkComponent;
}

/**
 * Resolve a control's appearance: **the caller's, else the user's app-wide
 * setting, else `solid`.**
 *
 * This is three lines, which is exactly why it is shared. In the originating
 * codebase each control picked its own default — a checkbox hard-coded `solid`,
 * a wheel picker defaulted to `outline`, a phone field to `solid` — each
 * plausible alone, and together they produced a form whose checkbox, phone
 * field and wheel ignored the theme every other control followed.
 *
 * The narrowing matters as much as the fallback: a caller may pass a variant the
 * theme recipes have no case for (`ghost`, `link`, or a value read from storage
 * written by an older release). Coercing to `solid` renders a plain control;
 * passing it through renders an *unstyled* one, because a recipe silently emits
 * nothing for a variant it does not define.
 *
 * ## Pass `allowed` when your recipe defines more than the theme five
 *
 * The default list is the five appearances a user can select app-wide, and for
 * most controls that is the right gate. But some recipes define extras that are
 * reachable per-call-site and not offerable globally — `inputBoolRecipe` has
 * `ghost` and `none`. Narrowing those to `solid` is silent: the control renders,
 * it just quietly ignores what the call site asked for.
 *
 * That is not hypothetical. Migrating `StyledInputBool` into this package with
 * the default list dropped `variant="ghost"` on the floor, and nothing failed
 * except one test in the consuming app that happened to assert it.
 *
 * `allowed` must contain `"solid"`, since that is the fallback.
 */
export function useResolvedVariant(variant?: string): ThemeVariant;
export function useResolvedVariant<T extends string>(
  variant: string | undefined,
  allowed: readonly T[],
): T;
export function useResolvedVariant(
  variant?: string,
  allowed: readonly string[] = THEME_VARIANTS,
): string {
  const globalVariant = useStyleConfig().variant;
  const candidate = variant ?? globalVariant;
  return allowed.includes(candidate) ? candidate : "solid";
}

/**
 * The user's density preference, as they chose it.
 *
 * Relative to the app's baseline, so it answers "did the user ask for tighter?"
 * rather than "how much padding is there?". `useDensityStep` answers the
 * second. `compact` is what makes intent buttons icon-only.
 */
export function useDensity(): DensityProfile {
  return useStyleConfig().density;
}

/**
 * Where the app's baseline and the user's preference actually land.
 *
 * This is the value that maps to real spacing — feed it to
 * `densityCustomProperties` to get the properties the recipes read.
 */
export function useDensityStep(): DensityStep {
  const { densityBase, density } = useStyleConfig();
  return resolveDensityStep(densityBase, density);
}

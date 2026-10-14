/**
 * The consuming application's nine SYSTEM themes, both modes — the six
 * `box` surface/text properties only (NEH-1952).
 *
 * Values are what that host's theme endpoint served for each theme against its
 * development database on 2026-10-07, copied from its own component-test
 * fixture rather than re-derived, so the two suites score the same numbers.
 * Colour data only.
 *
 * **A snapshot, bounded on purpose.** This package knows no colours and cannot
 * reach a host's theme store, so the alternative to a fixture is no arithmetic
 * at all. What carries the guarantee for themes not listed here is the token
 * contract — a surface painted with the text token `TEXT_BACKGROUND_PAIRS`
 * names for it — which holds for every theme a host validates. This table
 * shows, in numbers, that the contract pairing clears AA and the previous
 * translucent pairing did not.
 */
export type BoxVar =
  | "--hopper-box-main-bg"
  | "--hopper-box-main-text"
  | "--hopper-box-primary-bg"
  | "--hopper-box-primary-text"
  | "--hopper-box-secondary-bg"
  | "--hopper-box-secondary-text";

export interface SystemThemeMode {
  theme: string;
  mode: "light" | "dark";
  vars: Record<BoxVar, string>;
}

export const SYSTEM_THEME_SURFACES: readonly SystemThemeMode[] = [
  { theme: "Autumn Magic", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#78716C", "--hopper-box-primary-text": "#fafafa", "--hopper-box-secondary-bg": "#795548", "--hopper-box-secondary-text": "#ffffff" } },
  { theme: "Autumn Magic", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#795548", "--hopper-box-primary-text": "#FFF", "--hopper-box-secondary-bg": "#F59E0B", "--hopper-box-secondary-text": "#222" } },
  { theme: "Bright", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#9f5a39", "--hopper-box-primary-bg": "#FFFFFF", "--hopper-box-primary-text": "#17191c", "--hopper-box-secondary-bg": "#c8a104", "--hopper-box-secondary-text": "#2e3138" } },
  { theme: "Bright", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#000000", "--hopper-box-primary-text": "#FFF", "--hopper-box-secondary-bg": "#737373", "--hopper-box-secondary-text": "#ffffff" } },
  { theme: "Cozy Fireplace", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#9B7A67", "--hopper-box-primary-text": "#000", "--hopper-box-secondary-bg": "#78716C", "--hopper-box-secondary-text": "#ffffff" } },
  { theme: "Cozy Fireplace", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#795548", "--hopper-box-primary-text": "#FFF", "--hopper-box-secondary-bg": "#A3A3A3", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Midnight", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#5A77A8", "--hopper-box-primary-text": "#000", "--hopper-box-secondary-bg": "#737373", "--hopper-box-secondary-text": "#ffffff" } },
  { theme: "Midnight", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#5A77A8", "--hopper-box-primary-text": "#FFF", "--hopper-box-secondary-bg": "#A3A3A3", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Ocean Breeze", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#009688", "--hopper-box-primary-text": "#000", "--hopper-box-secondary-bg": "#737373", "--hopper-box-secondary-text": "#ffffff" } },
  { theme: "Ocean Breeze", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#14B8A6", "--hopper-box-primary-text": "#373737", "--hopper-box-secondary-bg": "#A3A3A3", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Pastel Rainbow", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#FFFFFF", "--hopper-box-primary-text": "#000", "--hopper-box-secondary-bg": "#7D79F3", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Pastel Rainbow", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#000000", "--hopper-box-primary-text": "#FFF", "--hopper-box-secondary-bg": "#7D79F3", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Sapphire", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#FFFFFF", "--hopper-box-primary-text": "#000", "--hopper-box-secondary-bg": "#3B82F6", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Sapphire", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#000000", "--hopper-box-primary-text": "#FFF", "--hopper-box-secondary-bg": "#0EA5E9", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Scandinavian Farm", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#78716C", "--hopper-box-primary-text": "#fafafa", "--hopper-box-secondary-bg": "#737373", "--hopper-box-secondary-text": "#ffffff" } },
  { theme: "Scandinavian Farm", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#78716C", "--hopper-box-primary-text": "#FFF", "--hopper-box-secondary-bg": "#A3A3A3", "--hopper-box-secondary-text": "#000000" } },
  { theme: "Zen", mode: "light", vars: { "--hopper-box-main-bg": "#f5f5f5", "--hopper-box-main-text": "#222222", "--hopper-box-primary-bg": "#22C55E", "--hopper-box-primary-text": "#000", "--hopper-box-secondary-bg": "#737373", "--hopper-box-secondary-text": "#ffffff" } },
  { theme: "Zen", mode: "dark", vars: { "--hopper-box-main-bg": "#3e2723", "--hopper-box-main-text": "#999999", "--hopper-box-primary-bg": "#10B981", "--hopper-box-primary-text": "#373737", "--hopper-box-secondary-bg": "#A3A3A3", "--hopper-box-secondary-text": "#000000" } },
];

/**
 * @stonedogcode/style — public API.
 *
 * Components are exported both as named exports and, individually, as default
 * exports from their own module. Prefer the named export; the default exports
 * exist because the originating codebase used them at ~1,400 call sites and
 * changing that was not worth bundling into the extraction.
 *
 * The Panda preset is NOT re-exported here. It is imported by the consumer's
 * `panda.config.ts`, which runs in Node at build time, and pulling the whole
 * component tree (and React with it) into that context is a needless cost —
 * hence the separate `@stonedogcode/style/preset` entry point.
 */

// ---------------------------------------------------------------------------
// Configuration seam — what a host application must wire up.
// ---------------------------------------------------------------------------
export {
  StonedogStyleProvider,
  useStyleConfig,
  useFontSizeProfile,
  useIconSize,
  useLinkComponent,
  useResolvedVariant,
  DEFAULT_STYLE_CONFIG,
} from "./config/style-config";
export type {
  StyleConfig,
  StonedogStyleProviderProps,
} from "./config/style-config";

/** The link seam — see `config/link-component.tsx` and NEH-430. */
export { DefaultLinkComponent } from "./config/link-component";
export type { LinkComponent, LinkComponentProps } from "./config/link-component";

/**
 * Deprecated `Hopper*` aliases — NEH-251. See `config/style-config.tsx`.
 * Removed once every consumer has landed its rename PR.
 */
export { HopperStyleProvider } from "./config/style-config";
export type { HopperStyleProviderProps } from "./config/style-config";

export { setStyleLogger } from "./config/logger";
export type { StyleLogger } from "./config/logger";

export {
  fontSizeMap,
  getFontSizeLabel,
  getFontSizeValue,
  stepUpFontSize,
  FONT_SIZE_ORDER,
} from "./config/font-size";

export {
  THEME_VARIANTS,
  STYLE_VARIANTS,
  TEXT_VARIANTS,
  ALL_VARIANTS,
  FONT_SIZE_PROFILES,
  FONT_SIZE_KEYS,
  ICON_SIZES,
  isThemeVariant,
  isFontSizeProfile,
  isIconSize,
} from "./config/types";
export type {
  ThemeVariant,
  StyleVariant,
  AllowedVariant,
  AllowedTextVariant,
  FontSizeProfile,
  FontSizeKey,
  IconSize,
} from "./config/types";

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------
export { default as StyledBox, StyledBox as Box } from "./components/StyledBox";
export type { StyledBoxProps } from "./components/StyledBox";

export { default as StyledFlex } from "./components/StyledFlex";
export type { StyledFlexProps } from "./components/StyledFlex";

export { default as StyledGrid } from "./components/StyledGrid";
export type { StyledGridProps } from "./components/StyledGrid";

export { default as StyledGridItem } from "./components/StyledGridItem";
export type { StyledGridItemProps } from "./components/StyledGridItem";

export { default as StyledSimpleGrid } from "./components/StyledSimpleGrid";

export { default as StyledStack } from "./components/StyledStack";
export type { StyledStackProps } from "./components/StyledStack";

export { default as StyledHStack } from "./components/StyledHStack";
export type { StyledHStackProps } from "./components/StyledHStack";

export { default as StyledVStack } from "./components/StyledVStack";
export type { StyledVStackProps } from "./components/StyledVStack";

export { default as StyledScrollbar } from "./components/StyledScrollbar";
export { default as StyledSidebar, StyledSidebar as Sidebar } from "./components/StyledSidebar";
export type { StyledSidebarProps, SidebarItem } from "./components/StyledSidebar";
export { default as StyledCollapsible } from "./components/StyledCollapsible";
export type { StyledCollapsibleProps } from "./components/StyledCollapsible";

export { default as StyledFooter, StyledFooter as Footer } from "./components/StyledFooter";
export type {
  StyledFooterProps,
  StyledFooterVersion,
  StyledFooterStatusBadge,
} from "./components/StyledFooter";
export type { StyledScrollbarProps } from "./components/StyledScrollbar";

// ---------------------------------------------------------------------------
// Typography & dividers
// ---------------------------------------------------------------------------
export { default as StyledText } from "./components/StyledText";
export type { StyledTextProps } from "./components/StyledText";

export { default as StyledHeading } from "./components/StyledHeading";

export { default as StyledSeparator } from "./components/StyledSeparator";
export type { StyledSeparatorProps } from "./components/StyledSeparator";

export { default as StyledHrRule } from "./components/StyledHrRule";
export type { StyledHrRuleProps } from "./components/StyledHrRule";

export {
  default as TitleLogo,
  TITLE_LOGO_METRICS,
  TITLE_LOGO_SIZES,
  isTitleLogoSize,
} from "./components/TitleLogo";
export type { TitleLogoProps, TitleLogoSize } from "./components/TitleLogo";

// ---------------------------------------------------------------------------
// Icons — the seam, not the artwork. See the README.
// ---------------------------------------------------------------------------
export { default as StyledIcon } from "./components/StyledIcon";
// `IconSize` is exported above, from `config/types` — it is a config-level
// vocabulary now that `StyleConfig` names it. `StyledIcon` still re-exports it
// so the older import path keeps working for consumers.
export type { StyledIconProps } from "./components/StyledIcon";
export { createIcon, createIconFromComponent } from "./components/create-icon";

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------
export * from "./components/intent-buttons";
export { createIntentButton } from "./components/create-intent-button";
export type { IntentButtonProps, IntentButtonSpec } from "./components/create-intent-button";

export {
  IntentIconProvider,
  useIntentIcon,
  useIntentIcons,
  missingIntentIcons,
  ICON_INTENTS,
} from "./config/intent-icons";
export type { IconIntent, IntentIcons } from "./config/intent-icons";

export { useDensity, useDensityStep } from "./config/style-config";
export { DENSITY_PROFILES, isDensityProfile } from "./config/types";
export type { DensityProfile } from "./config/types";
export {
  DENSITY_STEPS,
  DENSITY_BASES,
  DENSITY_METRICS,
  densityCustomProperties,
  isDensityBase,
  isDensityStep,
  resolveDensityStep,
} from "./config/density";
export type { DensityBase, DensityStep } from "./config/density";

export { default as StyledButton } from "./components/StyledButton";
export type { StyledButtonProps } from "./components/StyledButton";

export { default as StyledIconButton } from "./components/StyledIconButton";
export type { StyledIconButtonProps, IconButtonSize } from "./components/StyledIconButton";

export { default as StyledSpinner } from "./components/StyledSpinner";
export type { StyledSpinnerProps } from "./components/StyledSpinner";

export { default as StyledTooltip } from "./components/StyledTooltip";
// Exported so a host can make the same decision for its own controls. A product
// that renders its own hover-revealed affordance has the identical problem, and
// re-deriving "can this device hover" per app is how two answers appear.
export { useCanHover } from "./config/can-hover";
export type { StyledTooltipProps } from "./components/StyledTooltip";

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------
export { default as StyledFormLabel } from "./components/StyledFormLabel";
export type { StyledFormLabelProps } from "./components/StyledFormLabel";

// ---------------------------------------------------------------------------
// Components that were blocked on a runtime dependency until NEH-430 gave each
// a seam with a working default. None of them adds a dependency; the host
// supplies the framework-specific half, or takes the default and loses nothing
// that stops it working.
// ---------------------------------------------------------------------------
export { default as StyledLink, StyledLink as Link } from "./components/StyledLink";
export type { StyledLinkProps } from "./components/StyledLink";

export { default as StyledTag, StyledTag as Tag } from "./components/StyledTag";
export type { StyledTagProps } from "./components/StyledTag";

export {
  default as StyledFieldErrors,
  StyledFieldErrors as FieldErrors,
} from "./components/StyledFieldErrors";
export type {
  StyledFieldErrorsProps,
  FieldError,
} from "./components/StyledFieldErrors";

export { default as StyledInputBool } from "./components/StyledInputBool";
export type { StyledInputBoolProps, InputBoolVariant } from "./components/StyledInputBool";
export { INPUT_BOOL_VARIANTS } from "./components/StyledInputBool";

export { default as StyledInputSlider } from "./components/StyledInputSlider";
export type { StyledInputSliderProps } from "./components/StyledInputSlider";

// ---------------------------------------------------------------------------
// Text inputs — dictation is supplied by the host, never implemented here
// ---------------------------------------------------------------------------
export type { Dictation } from "./components/dictation";

export { default as StyledInputText } from "./components/StyledInputText";
export type { StyledInputTextProps, InputTextVariant } from "./components/StyledInputText";
export { INPUT_TEXT_VARIANTS } from "./components/StyledInputText";

export { default as StyledInputTextArea } from "./components/StyledInputTextArea";
export type { StyledInputTextAreaProps } from "./components/StyledInputTextArea";
export { default as DictationPrompt } from "./components/DictationPrompt";

// ---------------------------------------------------------------------------
// Select + search
// ---------------------------------------------------------------------------
export { default as StyledInputSelect } from "./components/StyledInputSelect";
export type {
  StyledInputSelectProps,
  SelectOption,
  SelectVariant,
} from "./components/StyledInputSelect";
export { SELECT_VARIANTS } from "./components/StyledInputSelect";

export { default as StyledSearch } from "./components/StyledSearch";
export type { StyledSearchProps } from "./components/StyledSearch";

export { default as StyledInputToggle } from "./components/StyledInputToggle";
export type { StyledInputToggleProps } from "./components/StyledInputToggle";

export { default as StyledAlert } from "./components/StyledAlert";
export type { StyledAlertProps, AlertStatus } from "./components/StyledAlert";

export { default as StyledInputRadio } from "./components/StyledInputRadio";
export type { StyledInputRadioProps, RadioItem, RadioVariant } from "./components/StyledInputRadio";
export { RADIO_VARIANTS } from "./components/StyledInputRadio";

export { default as StyledFieldset } from "./components/StyledFieldset";
export type { StyledFieldsetProps, FieldsetVariant } from "./components/StyledFieldset";
export { FIELDSET_VARIANTS } from "./components/StyledFieldset";

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------
export { default as StyledList } from "./components/StyledList";
export type {
  StyledListRootProps,
  StyledListItemProps,
  ListVariant,
} from "./components/StyledList";
export { LIST_VARIANTS } from "./components/StyledList";

export { default as StyledDefinitionList } from "./components/StyledDefinitionList";
export type {
  StyledDefinitionListProps,
  DlVariant,
} from "./components/StyledDefinitionList";
export { DL_VARIANTS } from "./components/StyledDefinitionList";

export { default as StyledSparkLine } from "./components/StyledSparkLine";
export type { StyledSparkLineProps } from "./components/StyledSparkLine";

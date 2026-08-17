/**
 * The stacking-order vocabulary: names for the layers a UI actually has.
 *
 * ## The bug this exists to fix
 *
 * `drawerRecipe` has said `zIndex: "modal"` since it was extracted, and there
 * has never been a `zIndex` token scale for `"modal"` to resolve against —
 * neither here nor in either base Panda preset. Panda passes an unknown token
 * through as a **literal**, so the generated stylesheet said
 *
 *     .drawer { position: fixed; z-index: modal; }
 *
 * `modal` is not a valid `z-index` value, so the browser discards the whole
 * declaration. **The drawer panel has never had a z-index at all.** No build
 * error, no console warning, no type error — the class is in the DOM and the
 * rule behind it is one line shorter than it looks.
 *
 * This is precisely the defect class CLAUDE.md records under "Token
 * compliance", one property along from `bg: "buttonBgHover"`. The colour half
 * is guarded by `token-contract.test.ts`; the z-index half is now guarded
 * beside it.
 *
 * ## This package owns the NAMES. The host owns the NUMBERS
 *
 * A z-index ladder is an application concern — it encodes which of *that
 * product's* surfaces may cover which, and no two products agree. So the
 * values below are conventional defaults chosen to be sane for a fresh
 * consumer, and a host is expected to override them:
 *
 * ```ts
 * // the host's panda.config.ts
 * theme: { extend: { tokens: { zIndex: { modal: { value: 99999 } } } } }
 * ```
 *
 * Overriding a value keeps the name, and the name is the part that makes the
 * order reviewable. A literal at a call site expresses nothing; `zIndex:
 * "menu"` says what the element *is*, and a reader can check it against this
 * table without opening a second file.
 *
 * ## The ladder
 *
 * Ascending, and the ORDER is the contract — not the numbers:
 *
 *     hide      behind its own box (decorative pseudo-elements)
 *     base      the ordinary flow
 *     raised    lifted within its own stacking context
 *     docked    a bar or rail pinned inside a region
 *     sticky    a sticky header inside a scroll region
 *     banner    page-level chrome above sticky content
 *     surface   a page surface that fills the viewport
 *     dialog    a modal dialog and its scrim
 *     menu      menus, drawer scrims, docked panels — the floating band's floor
 *     popover   a popover that has to clear an open menu
 *     overlay   a full-viewport cover: a splash, a loading shade
 *     toast     toasts, pickers, transient chrome
 *     modal     a drawer or modal panel that must clear everything but a tip
 *     tooltip   the top of the application
 *
 * **A dialog sits LOW on purpose.** Menus, toasts, tooltips and dropdowns all
 * have to be able to open *on* a dialog, so every one of them is above it.
 * Raising the dialog to "win" is the change that looks right and breaks every
 * control opened inside one.
 */

/**
 * The layer names, in ascending order, with this package's default values.
 *
 * Exported as plain numbers as well as tokens because a **portalled** element
 * usually sets its z-index from an inline `style`, and an inline style cannot
 * name a Panda token. Both readings have to come from one place or they drift.
 */
export const Z_LAYERS = {
  hide: -1,
  base: 0,
  raised: 1,
  docked: 10,
  sticky: 20,
  banner: 50,
  surface: 100,
  dialog: 200,
  menu: 300,
  popover: 400,
  overlay: 500,
  toast: 600,
  modal: 700,
  tooltip: 800,
} as const;

export type ZLayerName = keyof typeof Z_LAYERS;

/** Every layer name. Useful to a consumer's guard test. */
export function zIndexTokenNames(): ZLayerName[] {
  return Object.keys(Z_LAYERS) as ZLayerName[];
}

/** The scale in the shape Panda's `theme.extend.tokens.zIndex` wants. */
export function createZIndexTokens(): Record<string, { value: number }> {
  return Object.fromEntries(
    Object.entries(Z_LAYERS).map(([token, value]) => [token, { value }]),
  );
}

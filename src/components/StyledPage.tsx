"use client";

import React from "react";
import { css, cx } from "styled-system/css";

export interface StyledPageProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  children?: React.ReactNode;
  /** Heading for the page. Rendered as an `<h1>` unless `titleAs` says otherwise. */
  title?: React.ReactNode;
  /**
   * Which heading level the title takes.
   *
   * `h1` by default, because a page's title is the page's heading. A host
   * rendering `StyledPage` inside another heading structure passes `h2`/`h3` —
   * skipped or duplicated levels are a real navigation problem for screen
   * reader users, and the component cannot see its own surroundings.
   */
  titleAs?: "h1" | "h2" | "h3";
  /** Show a Save action. */
  includeSave?: boolean;
  onSave?: (() => void) | undefined;
  /**
   * What Cancel does.
   *
   * Defaults to going back one entry in session history — see the note on
   * `goBack` below for why that needs no router.
   */
  onCancel?: (() => void) | undefined;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  /**
   * Whether there are unsaved changes.
   *
   * Gates both actions: Cancel appears only when there is something to
   * discard, and Save is disabled until there is something to save.
   */
  isDirty?: boolean;
  /**
   * Whether the page's own content area scrolls.
   *
   * Defaults to `true` — meaning the content box is `overflow: hidden` and an
   * element INSIDE it is expected to own the scroll. This is the surprising
   * default and it is inherited deliberately: it is what the originating app's
   * pages are built against, and flipping it would give every one of them a
   * second scrollbar. Pass `false` to let the page scroll as one unit.
   */
  hideScrollbar?: boolean;
  /** Optional icon nodes for the actions. This package ships no artwork. */
  saveIcon?: React.ReactNode;
  cancelIcon?: React.ReactNode;
}

/**
 * Go back one entry in session history.
 *
 * **This is why `StyledPage` needs no routing seam**, and it is worth stating
 * plainly because the issue that scheduled this work (NEH-430) assumed
 * otherwise — it proposed passing the current path in, or a `useRouter`-shaped
 * seam defaulting to `window.location`.
 *
 * Reading the component it replaces, the only thing it ever asked the router
 * for was `router.back()`, as the default `onCancel`. And a router's `back()`
 * *is* session history — Next's app-router `back()` and react-router's
 * `navigate(-1)` both end up here. So this is not a degraded fallback standing
 * in for the real thing; it is the same operation, reached directly.
 *
 * The corollary matters more than the saving: `StyleConfig` gains no field.
 * Every field there is one a new host must understand before it can render a
 * button, and adding one for an operation the platform already provides would
 * have been a seam that bought nothing.
 */
function goBack(): void {
  // Guarded for SSR: this is only ever called from a click handler, so in
  // practice `window` is there — but a host rendering an action on the server
  // and hydrating should not crash on a missing global.
  if (typeof window !== "undefined") window.history.back();
}

/**
 * The shared look of the two actions.
 *
 * Deliberately not `StyledButton`: these need to be buttons at the 48px floor
 * and nothing else, and routing them through the button recipe would make the
 * page's toolbar change appearance with the app-wide variant, which is not a
 * decision a page shell should be making for its host.
 */
const actionClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "2",
  // The house floor, stated rather than left to emerge from padding.
  minHeight: "48px",
  minWidth: "48px",
  paddingInline: "3",
  borderRadius: "md",
  backgroundColor: "buttonBgPrimary",
  color: "buttonTextPrimary",
  cursor: "pointer",
  _disabled: {
    cursor: "not-allowed",
    opacity: 0.6,
  },
});

/**
 * The standard wrapper for a page rendered into an application's body region.
 *
 * ```tsx
 * <StyledPage title="Settings" hideScrollbar={false}>
 *   …
 * </StyledPage>
 * ```
 *
 * ## The layout contract, which is the load-bearing part
 *
 * The shell this is designed for is a fixed three-row grid — header, body,
 * footer — where only the body row may scroll. `StyledPage` fills that row
 * (`flex: 1; min-height: 0; overflow: hidden`) and renders a content box that
 * fills what is left.
 *
 * `min-height: 0` is the non-obvious half and must not be "tidied" away: a flex
 * child refuses to shrink below its content height without it, so the overflow
 * escapes the row and pushes the footer off-screen instead of scrolling.
 *
 * ## Two things deliberately different from the component this replaces
 *
 * **The actions row no longer claims `flex: 1`.** The original set
 * `flex="1" minH={0} height="100%"` on it, which asks a toolbar to fill the
 * page — so it competed with the content box for the same space. A toolbar is
 * `min-content` tall.
 *
 * **It paints through tokens.** The original set
 * `backgroundColor: "var(--hopper-box-main-bg)"` inline, which hardcodes the
 * default custom-property namespace and so ignores `cssVarPrefix` entirely —
 * the exact defect class documented in CLAUDE.md. Under a host using another
 * prefix it painted nothing at all.
 */
export const StyledPage = React.forwardRef<HTMLDivElement, StyledPageProps>(
  function StyledPage(
    {
      children,
      title,
      titleAs: TitleTag = "h1",
      includeSave,
      onSave,
      onCancel,
      saveDisabled,
      cancelDisabled,
      saveLabel = "Save",
      cancelLabel = "Cancel",
      isDirty = false,
      hideScrollbar = true,
      saveIcon,
      cancelIcon,
      className,
      ...rest
    },
    ref,
  ) {
    const showActions = includeSave === true;

    return (
      <div
        ref={ref}
        data-testid="styled-page-root"
        className={cx(
          css({
            display: "flex",
            flexDirection: "column",
            flex: "1",
            width: "100%",
            // BOTH `flex: 1` and `height: 100%`, and the second is not
            // redundant (NEH-802).
            //
            // `flex: 1` covers the common case — the page is a flex item in a
            // column, and takes the space the column offers. That is what the
            // app shell does, so it is easy to conclude this is the only case
            // and drop the height. It was dropped, and it broke a production
            // dashboard.
            //
            // `flex: 1` is INERT inside a block-level parent. HopperGuard's
            // `/dashboard` nests one page inside another through plain
            // `display: block` wrappers, and there the page's height came
            // entirely from `height: 100%`. Without it the inner page fell
            // back to CONTENT height — 138px, of which a widget header took
            // ~128, leaving its `1fr` body 10px of padding and the grid zero.
            // The header rendered; every tile was clipped to nothing.
            //
            // The failure is silent in the worst way: nothing errors, nothing
            // is unstyled, and the page looks deliberately empty. Only a
            // computed-height walk up the DOM shows it, which is why no unit
            // test or type-check can stand in for the assertion below.
            height: "100%",
            // See the contract note above: without this the overflow escapes
            // the row rather than scrolling inside it.
            minHeight: "0",
            overflow: "hidden",
            backgroundColor: "boxBgMain",
            // `textMain`, not `textPrimary`. These tokens are a SURFACE axis:
            // `textPrimary` means "text on the PRIMARY surface" and pairing it
            // with `boxBgMain` is the mistake TEXT_BACKGROUND_PAIRS exists to
            // prevent — it would render a colour never contrast-checked against
            // this background. The original's raw properties were
            // `box-main-bg` / `box-main-text`, which is this pair.
            color: "textMain",
          }),
          className,
        )}
        {...rest}
      >
        {title !== undefined && title !== null && (
          <TitleTag
            data-testid="styled-page-title"
            className={css({
              // min-content by construction: a heading is not a flex item that
              // should grow. Stated as flexShrink/flexGrow rather than left
              // implicit because the surrounding column makes `flex: 1` the
              // thing a reader expects to see.
              flexGrow: 0,
              flexShrink: 0,
              fontSize: "xl",
              fontWeight: "bold",
            })}
          >
            {title}
          </TitleTag>
        )}

        {showActions && (
          <div
            data-testid="styled-page-actions"
            className={css({
              display: "flex",
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "2",
              // A toolbar is min-content tall. The original asked for flex:1
              // and height:100%, which made it compete with the content.
              flexGrow: 0,
              flexShrink: 0,
            })}
          >
            {/*
              Cancel appears only when there is something to discard. Rendering
              a disabled Cancel on a pristine page is a control that can never
              do anything, and "discard nothing" is not an action.
            */}
            {isDirty && (
              <button
                type="button"
                onClick={onCancel ?? goBack}
                disabled={cancelDisabled}
                className={actionClass}
              >
                {cancelIcon}
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              // Disabled until there is something to save. `saveDisabled` is
              // the host's own veto and is independent of dirtiness.
              disabled={saveDisabled === true || !isDirty}
              className={actionClass}
            >
              {saveIcon}
              {saveLabel}
            </button>
          </div>
        )}

        <div
          data-testid="styled-page-content"
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            flex: "1",
            minHeight: "0",
          })}
          style={{ overflow: hideScrollbar ? "hidden" : "auto" }}
        >
          {children}
        </div>
      </div>
    );
  },
);

export default StyledPage;

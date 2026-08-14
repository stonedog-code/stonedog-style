"use client";

import React from "react";
import { buttonRecipe } from "styled-system/recipes";
import { css, cx } from "styled-system/css";
import { useLinkComponent, useResolvedVariant } from "../config/style-config";
import { ALL_VARIANTS } from "../config/types";

/**
 * The variants a link may take.
 *
 * `link` is included and is the default, which is why this list is passed to
 * `useResolvedVariant` explicitly rather than letting it fall back to
 * `THEME_VARIANTS`. Without it, `variant="link"` — the value nearly every call
 * site wants — narrows to `solid` and every link renders as a filled button.
 * That is the exact silent narrowing documented on `useResolvedVariant`.
 */
const LINK_VARIANTS = ALL_VARIANTS;

export interface StyledLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Where the link goes. */
  href: string;
  children: React.ReactNode;
  /**
   * Marks the destination as outside this application.
   *
   * Two things follow, and both matter: the link renders through a plain `<a>`
   * rather than the host's router (a client-side router cannot navigate to
   * another origin, and handing it one is how a "link that does nothing" bug
   * starts), and it gains a visible external indicator.
   */
  isExternal?: boolean;
  /** Open in a new browsing context. */
  newWindow?: boolean;
  /**
   * Renders the link inert.
   *
   * There is no `disabled` attribute for an anchor, so this removes `href` —
   * which is what actually stops activation and takes the element out of the
   * tab order — and states `aria-disabled` for assistive technology. Setting
   * only `aria-disabled` would leave a fully working link that merely claims
   * not to be.
   */
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /**
   * The external-destination indicator.
   *
   * Defaults to a text glyph, for the reason `StyledAlert` uses one: this
   * package ships no artwork, and a character inherits `currentColor` and the
   * font scale, so it cannot end up a different colour or size from the label
   * beside it. Pass a node to substitute an icon, or `null` for none.
   */
  externalIndicator?: React.ReactNode;
  variant?: string;
  /**
   * Render as a standalone control with a 48x48 tap target, rather than as
   * text inside a sentence.
   *
   * **The default is inline, and that is deliberate rather than a shortcut.**
   * `buttonRecipe`'s base states `min-height: 48px`, `display: inline-flex`
   * and padding — correct for a control, and wrong for a link in a paragraph,
   * where it forces a 48px line box and breaks the text flow. Measured at
   * 48.375px before this prop existed.
   *
   * Inline is also what the standard expects: WCAG 2.5.5 and 2.5.8 both carve
   * out targets that are "in a sentence or block of text", so a text link at
   * text height is conformant. The floor applies to the standalone case, and
   * `standalone` is how a nav item, a card action or a button-shaped link asks
   * for it.
   */
  standalone?: boolean;
}

/** The default external-destination glyph — "↗", north-east arrow. */
const EXTERNAL_GLYPH = "↗";

/**
 * A link.
 *
 * ```tsx
 * <StyledLink href="/settings">Settings</StyledLink>
 * <StyledLink href="https://example.com" isExternal newWindow>Docs</StyledLink>
 * ```
 *
 * In-app destinations render through the host's `linkComponent` (a plain `<a>`
 * unless configured); external ones always render a plain `<a>`.
 */
export const StyledLink = React.forwardRef<HTMLAnchorElement, StyledLinkProps>(
  function StyledLink(
    {
      href,
      children,
      isExternal,
      newWindow,
      disabled,
      leftIcon,
      rightIcon,
      externalIndicator,
      variant,
      standalone = false,
      className,
      ...rest
    },
    ref,
  ) {
    const HostLink = useLinkComponent();
    const resolved = useResolvedVariant(variant ?? "link", LINK_VARIANTS);
    // The variant still comes from `buttonRecipe`, so colour, underline and
    // hover stay one definition shared with every other control. Only the BOX
    // is overridden, and only when inline — the three properties that make a
    // control a control are exactly the three that break a sentence.
    const classes = cx(
      buttonRecipe({ variant: resolved }),
      standalone
        ? undefined
        : css({
            display: "inline",
            minHeight: "0",
            minWidth: "0",
            padding: "0",
          }),
      className,
    );

    const indicator =
      externalIndicator === undefined ? EXTERNAL_GLYPH : externalIndicator;

    const content = (
      <>
        {leftIcon !== undefined && leftIcon !== null && (
          <span aria-hidden="true">{leftIcon}</span>
        )}
        <span>{children}</span>
        {rightIcon !== undefined && rightIcon !== null && (
          <span aria-hidden="true">{rightIcon}</span>
        )}
        {isExternal && indicator !== null && (
          // `aria-hidden` because the accessible name already carries the
          // destination, and because "opens in a new window" is conveyed by the
          // visible glyph for sighted users and by nothing useful when read
          // aloud as "north east arrow".
          <span aria-hidden="true">{indicator}</span>
        )}
      </>
    );

    // Shared by both branches. `href` is omitted entirely when disabled rather
    // than set to "#": "#" is a live link to the top of the page, so it stays
    // focusable and activating it scrolls — a disabled control that does
    // something is worse than one that looks enabled.
    const common = {
      ...(disabled ? {} : { href }),
      "aria-disabled": disabled ? true : undefined,
      className: classes,
      ...(newWindow
        ? {
            target: "_blank",
            // Both, and not only for security. `noopener` severs
            // `window.opener` (tabnabbing); `noreferrer` also suppresses the
            // Referer header. They are separate protections and older engines
            // implement only one.
            rel: "noopener noreferrer",
          }
        : {}),
      ...rest,
    };

    // An external destination never goes through the host's router: a
    // client-side router cannot navigate off-origin, and several will
    // intercept the click and do nothing at all.
    if (isExternal || disabled) {
      return (
        <a ref={ref} {...common}>
          {content}
        </a>
      );
    }

    return (
      <HostLink ref={ref} href={href} {...common}>
        {content}
      </HostLink>
    );
  },
);

export default StyledLink;

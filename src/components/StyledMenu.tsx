"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { styled } from "styled-system/jsx";
import { css, cx } from "styled-system/css";
import { menuRecipe } from "styled-system/recipes";
import { useLinkComponent, useResolvedFontSize } from "../config/style-config";
import type { AllowedVariant } from "../config/types";
import StyledButton from "./StyledButton";
import StyledText from "./StyledText";
import StyledLabeledValue from "./StyledLabeledValue";

/**
 * A menu button: a trigger that opens a short list of actions or destinations
 * — an account menu, an organisation switcher.
 *
 * ```tsx
 * <StyledMenu
 *   label="Acme Ltd"
 *   aria-label="Switch organisation, current: Acme Ltd"
 *   items={[{ id: "acme", label: "Acme Ltd" }, { id: "beta", label: "Beta LLC" }]}
 *   currentId="acme"
 *   onSelect={switchTo}
 * />
 * ```
 *
 * ## The WAI-ARIA menu-button pattern, all of it (NEH-1816)
 *
 * The hand-rolled dropdowns this replaces each got some of it, and a menu that
 * gets most of it is a menu a keyboard reader cannot use:
 *
 * - the trigger carries `aria-haspopup="menu"`, `aria-expanded` and
 *   `aria-controls`; a press (Enter, Space, click) or ↓ opens the menu with
 *   focus on the current item, or the first; ↑ opens it on the last;
 * - inside, ↓/↑ move and wrap, Home/End jump, a printable character jumps to
 *   the next item starting with it, and items take a roving `tabindex` so the
 *   menu is one stop, not N;
 * - Escape closes it and **returns focus to the trigger**; Tab closes it and
 *   lets focus go where Tab was taking it;
 * - it closes when focus leaves it (`focusout`) and on a pointer press
 *   outside it — not only the latter, which is all a pointer-only close covers.
 *
 * ## "Current" is announced, never `disabled`
 *
 * The pattern this replaces marked the current account `disabled`. That takes
 * it out of the tab order, greys it below contrast, and tells assistive
 * technology "unavailable" when the true statement is "you are here". So the
 * current item stays an ordinary, focusable item and says so:
 *
 * | `selection` | role | state |
 * |---|---|---|
 * | `"checked"` (default) | `menuitemradio` | `aria-checked` on exactly the current item — a switcher choosing one of N |
 * | `"current"` | `menuitem` | `aria-current="true"` on the current item — a list of places, one of which is here |
 *
 * Both draw a visible check mark and a bold label, so the state is never
 * colour alone.
 *
 * ## Locked: one option is a value, not a menu
 *
 * A switcher for someone with access to exactly one organisation is a control
 * that opens a list containing what it already says. `locked` renders the
 * value as a labelled static `<dl>` (`StyledLabeledValue`) instead: no trigger,
 * no tab stop, nothing to operate — and the label says what the value is.
 * Explicit rather than inferred from `items.length`, because a one-item ACTION
 * menu ("Sign out") must stay operable.
 *
 * ## Size
 *
 * Every item clears the house 48px floor through `menuRecipe`, which states it
 * as a `min-height` — so no density or font-scale change can erode it, and a
 * long label grows the item rather than clipping. The trigger is a
 * `StyledButton`, which carries the same floor. Item text follows the reader's
 * font-size profile as an inline style, because a `<button>` inherits no font
 * size and a runtime value in a Panda prop yields a class with no rule.
 */

export interface StyledMenuItem {
  id: string;
  label: string;
  /** One line beneath the label. */
  description?: string;
  /**
   * Makes the item a link (`<a role="menuitem">` through the host's
   * `linkComponent`). The link navigates; `onSelect` is still told about an
   * ordinary click.
   */
  href?: string;
  /**
   * Genuinely unavailable — announced with `aria-disabled` and skipped by
   * activation, but still focusable so a keyboard reader can learn it exists.
   * Never use this for the current item; see `currentId`.
   */
  disabled?: boolean;
}

interface StyledMenuBaseProps {
  /** The trigger's visible text — the current value, or what the menu is ("Account"). */
  label: React.ReactNode;
  items: ReadonlyArray<StyledMenuItem>;
  /** The item that is current. Marked, never disabled — see above. */
  currentId?: string | undefined;
  /** How "current" is expressed. Default `"checked"`. */
  selection?: "checked" | "current";
  /** Called with the item's id when an item is activated. */
  onSelect?: ((id: string) => void) | undefined;
  /** Which edge of the trigger the menu lines up with. Default `"start"`. */
  align?: "start" | "end";
  /** The trigger's appearance. Follows the app-wide variant when omitted. */
  variant?: AllowedVariant | undefined;
  /**
   * The trigger's accessible name, when its visible `label` alone does not say
   * what it does — "Switch organisation, current: Acme Ltd". It should START
   * with the visible text where it can (WCAG 2.5.3, label in name).
   */
  "aria-label"?: string | undefined;
  /** Prefix for `data-testid`s: `${testId}-trigger`, `${testId}-menu`, `${testId}-item-${id}`. */
  "data-testid"?: string | undefined;
}

export type StyledMenuProps = StyledMenuBaseProps &
  (
    | { locked?: false | undefined; lockedLabel?: string | undefined }
    | {
        /** Render the current value as static text — see "Locked" above. */
        locked: true;
        /** What the value is — "Organisation". Required: a value without a label is just text. */
        lockedLabel: string;
      }
  );

const MenuRoot = styled("div", {
  base: { position: "relative", display: "inline-block" },
});

const MenuPanel = styled("div", {
  base: {
    position: "absolute",
    top: "100%",
    marginTop: "1",
    zIndex: "menu",
    display: "flex",
    flexDirection: "column",
    gap: "1",
    padding: "1",
    minWidth: "100%",
    // Never wider than the screen it opens on, whatever the labels say.
    width: "max-content",
    maxWidth: "min(24rem, calc(100vw - 2rem))",
    backgroundColor: "boxBgPrimary",
    color: "textPrimary",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "borderBgPrimary",
    borderRadius: "md",
    boxShadow: "lg",
    // `display: flex` above would otherwise beat the UA's `[hidden]` rule and
    // paint a menu that claims to be closed.
    "&[hidden]": { display: "none" },
  },
  variants: {
    align: {
      start: { left: "0" },
      end: { right: "0" },
    },
  },
});

/**
 * The item's own layer over `menuRecipe().item`.
 *
 * Utilities outrank recipes, so anything stated here wins over the recipe —
 * which is why the hover pairing is restated alongside the transparent
 * background: a bare `bg: transparent` utility would silently cancel the
 * recipe's hover surface. Focus paints the same pair as hover, because for a
 * keyboard reader focus IS the pointer.
 */
const menuItemClass = css({
  backgroundColor: "transparent",
  color: "inherit",
  border: "none",
  textAlign: "start",
  textDecoration: "none",
  fontFamily: "inherit",
  _hover: { backgroundColor: "boxBgAccent", color: "textAccent" },
  _focus: { backgroundColor: "boxBgAccent", color: "textAccent" },
  _focusVisible: {
    outline: "3px solid",
    outlineColor: "buttonBgAccent",
    outlineOffset: "-3px",
  },
  "&[aria-disabled=true]": { cursor: "not-allowed", opacity: 0.6 },
});

/** Fixed-width so every label starts at the same x whether or not it is checked. */
const CHECK_SLOT_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: "1.25em",
  flexShrink: 0,
  textAlign: "center",
};

const LabelColumn = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
});

function isModifiedClick(event: React.MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

type FocusTarget = "current" | "first" | "last";

export function StyledMenu(props: StyledMenuProps) {
  const {
    label,
    items,
    currentId,
    selection = "checked",
    onSelect,
    align = "start",
    variant,
    "aria-label": ariaLabel,
    "data-testid": testId = "styled-menu",
  } = props;

  const HostLink = useLinkComponent();
  const fontSize = useResolvedFontSize({});
  const reactId = useId();
  const triggerId = `${reactId}-trigger`;
  const menuId = `${reactId}-menu`;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const pendingFocus = useRef<FocusTarget | null>(null);

  const focusItem = useCallback((index: number) => {
    itemRefs.current[index]?.focus();
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = (target: FocusTarget) => {
    pendingFocus.current = target;
    setOpen(true);
  };

  // Focus moves once the panel is visible: a `hidden` element cannot take it.
  useEffect(() => {
    if (!open || pendingFocus.current === null) return;
    const target = pendingFocus.current;
    pendingFocus.current = null;
    const currentIndex = items.findIndex((item) => item.id === currentId);
    if (target === "last") focusItem(items.length - 1);
    else if (target === "current" && currentIndex >= 0) focusItem(currentIndex);
    else focusItem(0);
  }, [open, items, currentId, focusItem]);

  // A pointer press outside closes it. Focus does not move — the press is
  // already taking it wherever the reader pointed.
  useEffect(() => {
    if (!open) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    doc.addEventListener("pointerdown", onPointerDown);
    return () => doc.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (props.locked) {
    const current = items.find((item) => item.id === currentId);
    return (
      <StyledLabeledValue
        label={props.lockedLabel}
        value={current?.label ?? label}
        layout="inline"
        data-testid={`${testId}-locked`}
      />
    );
  }

  const activate = (item: StyledMenuItem) => {
    if (item.disabled) return;
    onSelect?.(item.id);
    close(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Enter and Space are left to the button's own click, which opens the
    // menu below. Handling them here as well would open on keydown and then
    // toggle shut again on Space's keyup click.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu("current");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu("last");
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
    }
  };

  const onItemKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const last = items.length - 1;
    let target: number | null = null;
    if (event.key === "ArrowDown") target = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp") target = index === 0 ? last : index - 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    } else if (event.key === " " && event.currentTarget.tagName === "A") {
      // A link activates on Enter only; a menu item activates on Space too.
      event.preventDefault();
      event.currentTarget.click();
      return;
    } else if (event.key === "Tab") {
      // Close without stealing focus back: Tab is taking it somewhere.
      setOpen(false);
      return;
    } else if (
      event.key.length === 1 &&
      event.key !== " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      // Type-ahead: the next item, after this one, whose label starts with it.
      const char = event.key.toLocaleLowerCase();
      for (let step = 1; step <= items.length; step += 1) {
        const candidate = (index + step) % items.length;
        if (items[candidate]?.label.toLocaleLowerCase().startsWith(char)) {
          target = candidate;
          break;
        }
      }
      if (target === null) return;
    }
    if (target === null) return;
    event.preventDefault();
    focusItem(target);
  };

  const itemClass = cx(menuRecipe().item, menuItemClass);
  const itemRole = selection === "checked" ? "menuitemradio" : "menuitem";

  return (
    <MenuRoot
      ref={rootRef}
      data-testid={testId}
      onBlur={(event: React.FocusEvent<HTMLDivElement>) => {
        // `focusout`: close when focus lands outside the whole widget, not
        // when it moves between the trigger and an item.
        const next = event.relatedTarget as Node | null;
        if (open && (!next || !rootRef.current?.contains(next))) setOpen(false);
      }}
    >
      <StyledButton
        ref={triggerRef}
        id={triggerId}
        type="button"
        {...(variant !== undefined ? { variant } : {})}
        {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={`${testId}-trigger`}
        onClick={() => (open ? close(false) : openMenu("current"))}
        onKeyDown={onTriggerKeyDown}
        rightIcon={<span aria-hidden="true">▾</span>}
      >
        {label}
      </StyledButton>
      <MenuPanel
        id={menuId}
        role="menu"
        aria-labelledby={triggerId}
        align={align}
        hidden={!open}
        data-testid={`${testId}-menu`}
      >
        {items.map((item, index) => {
          const isCurrent = item.id === currentId;
          const stateProps =
            selection === "checked"
              ? { "aria-checked": isCurrent }
              : { "aria-current": isCurrent ? ("true" as const) : undefined };
          const shared = {
            role: itemRole,
            tabIndex: -1,
            className: itemClass,
            style: { fontSize },
            "aria-disabled": item.disabled ? true : undefined,
            "data-testid": `${testId}-item-${item.id}`,
            "data-current": isCurrent ? "true" : undefined,
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>) =>
              onItemKeyDown(event, index),
            ...stateProps,
          };
          const content = (
            <>
              <span aria-hidden="true" style={CHECK_SLOT_STYLE}>
                {isCurrent ? "✓" : ""}
              </span>
              <LabelColumn>
                <StyledText color="inherit" fontWeight={isCurrent ? "bold" : "normal"}>
                  {item.label}
                </StyledText>
                {item.description && (
                  <StyledText size="sm" color="textMuted">
                    {item.description}
                  </StyledText>
                )}
              </LabelColumn>
            </>
          );

          if (item.href !== undefined && !item.disabled) {
            return (
              <HostLink
                key={item.id}
                ref={(el: HTMLAnchorElement | null) => {
                  itemRefs.current[index] = el;
                }}
                href={item.href}
                {...shared}
                onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
                  if (!isModifiedClick(event)) onSelect?.(item.id);
                  setOpen(false);
                }}
              >
                {content}
              </HostLink>
            );
          }

          return (
            <button
              key={item.id}
              ref={(el: HTMLButtonElement | null) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              {...shared}
              onClick={() => activate(item)}
            >
              {content}
            </button>
          );
        })}
      </MenuPanel>
    </MenuRoot>
  );
}

StyledMenu.displayName = "StyledMenu";

export default StyledMenu;

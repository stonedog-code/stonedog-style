"use client";

import React from "react";
import { styled } from "styled-system/jsx";
import { useResolvedFontSize } from "../config/style-config";
import type { FontSizeKey } from "../config/types";
import StyledText from "./StyledText";

/**
 * Visible tabs, implementing the WAI-ARIA Authoring Practices "Tabs with
 * automatic activation" pattern.
 *
 * ```tsx
 * const [section, setSection] = React.useState("passkeys");
 *
 * <StyledTabs.List
 *   tabs={[
 *     { value: "passkeys", label: "Passkeys" },
 *     { value: "sessions", label: "Sessions" },
 *   ]}
 *   value={section}
 *   onValueChange={setSection}
 *   ariaLabel="Security sections"
 *   idPrefix="security"
 * />
 * <StyledTabs.Panel idPrefix="security" value={section}>
 *   …only the active panel is rendered…
 * </StyledTabs.Panel>
 * ```
 *
 * ## The contract — a declared role is a promise
 *
 * - **The list is ONE tab stop.** Roving `tabindex`: only the selected tab is
 *   `0`. A tablist that puts every tab in the tab order makes a reader Tab past
 *   n−1 things to reach the content, which is the whole reason the pattern
 *   exists.
 * - **Left/Right move AND select, wrapping at both ends.** Home/End go to the
 *   ends. Up/Down deliberately do nothing: the list is horizontal. It *wraps*
 *   onto a second row on a narrow screen, but reading order stays
 *   left-to-right, so binding the vertical keys would promise an ordering the
 *   list does not have.
 * - **Each tab is a real `<button>`**, so Enter and Space work with no handler
 *   of ours, and they activate on key-*up* the way the platform does — the case
 *   hand-rolled key handling reliably gets wrong.
 * - **`aria-selected` on exactly one tab.** That tab's `aria-controls` names
 *   its panel and `StyledTabs.Panel` points back with `aria-labelledby`.
 * - **`aria-controls` is on the SELECTED tab only**, and that is not an
 *   omission. Only the active panel is mounted, so on any other tab the
 *   attribute would reference an id that is not in the document — which axe
 *   reports as `aria-valid-attr-value`, and which a screen reader has no way to
 *   follow.
 * - **Active state is never carried by colour alone.** The selected tab has a
 *   4px underline and bold text as well as a different surface (WCAG 1.4.1).
 *
 * ## Two things fixed on the way into this package
 *
 * It was composed inside an application first, because publishing this package
 * needs a 2FA one-time password and could not be sequenced into that release.
 * Nothing in it was ever that product's, and two defects came with it:
 *
 * **It painted a surface without naming the text colour that reads against
 * it.** Both the hover and the selected states set `boxBgSecondary` and left
 * the label at `color: inherit`, so the label kept whatever colour the
 * surrounding surface implied — legible on the one page it was built for and
 * unverifiable anywhere else. `textSecondary` is `boxBgSecondary`'s declared
 * partner in this package's own token contract, so the pair is now stated
 * rather than assumed.
 *
 * **The tap target was 44px, not this package's 48px floor.** 44 is WCAG 2.5.5
 * AAA; 48 is the house minimum, stated as a `min-height`/`min-width` so no
 * density or font-scale change can erode it. A tab is a primary navigation
 * control and had no business sitting at the lower number.
 *
 * ## Font size: the label follows the reader, and so does the box
 *
 * `useResolvedFontSize` resolves the reader's profile and returns a
 * `var(--font-sizes-*, …)` reference, applied as an **inline style**. Two
 * separate reasons, and both are load-bearing in this package:
 *
 * 1. **Panda extracts styles by statically parsing source at the consumer's
 *    build**, so a style prop whose value is only known at runtime yields a
 *    class name with no rule behind it and nothing errors. An inline value
 *    cannot fail that way.
 * 2. **A `<button>` inherits no font size from the page.** Left alone it sits
 *    at the user agent's 13.3333px at every profile — and everything measured
 *    in `em` against it rides on that number. `StyledButton` carries the same
 *    two lines for the same two reasons.
 *
 * The label is a `StyledText` given the identical `size`/`fixedSize`, so the
 * box and the label can never disagree about which step won.
 */

export interface StyledTabItem {
  value: string;
  label: string;
}

/** The id of the tab button for `value`. */
export function tabElementId(idPrefix: string, value: string): string {
  return `${idPrefix}-${value}`;
}

/** The id of the panel that `value`'s tab controls. */
export function tabPanelElementId(idPrefix: string, value: string): string {
  return `${idPrefix}-${value}-panel`;
}

const TabList = styled("div", {
  base: {
    display: "flex",
    // Wrap rather than scroll. At 320px three labels do not fit on one row, and
    // a horizontally scrolling tablist is a WCAG 1.4.10 reflow failure — the
    // tabs past the fold are simply not discoverable.
    flexWrap: "wrap",
    gap: "2",
    width: "100%",
    borderBottom: "1px solid",
    borderColor: "borderBgAccent",
  },
});

const TabButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // The house tap-target floor, stated rather than left to emerge from
    // padding: a density or font-scale change must not be able to erode it.
    minHeight: "48px",
    minWidth: "48px",
    paddingInline: "3",
    paddingBlock: "2",
    border: "none",
    borderBottomWidth: "4px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    borderTopRadius: "md",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontWeight: "normal",
    // Both painted states name the text colour belonging to the surface, from
    // the contract's own pairs. A surface with no stated partner inherits the
    // page's, which is only legible by luck.
    _hover: { backgroundColor: "boxBgSecondary", color: "textSecondary" },
    _focusVisible: {
      outline: "3px solid",
      outlineColor: "buttonBgAccent",
      outlineOffset: "2px",
    },
  },
  variants: {
    selected: {
      true: {
        borderBottomColor: "buttonBgAccent",
        backgroundColor: "boxBgSecondary",
        color: "textSecondary",
        fontWeight: "bold",
      },
      false: {},
    },
  },
});

export interface StyledTabListProps {
  tabs: ReadonlyArray<StyledTabItem>;
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name for the list, e.g. "Security sections". Required. */
  ariaLabel: string;
  /**
   * Prefix for every tab and panel id. A tab's id is `${idPrefix}-${value}`,
   * which doubles as its `data-testid`; its panel's is that plus `-panel`.
   * Both are available as `tabElementId` / `tabPanelElementId`.
   */
  idPrefix: string;
  /**
   * Which step of the text scale the labels read at — relative to the reader's
   * profile, exactly as on `StyledText`. `size="sm"` is "one step below body
   * text", not a fixed 14px.
   */
  size?: FontSizeKey;
  /** Pin the labels to the `md` step instead of following the profile. */
  fixedSize?: boolean;
  id?: string;
  ["data-testid"]?: string;
}

export function StyledTabList({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  idPrefix,
  size,
  fixedSize,
  id,
  ...props
}: StyledTabListProps) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const fontSize = useResolvedFontSize({ size, fixedSize });

  const selectIndex = (index: number) => {
    const next = tabs[index];
    if (!next) return;
    onValueChange(next.value);
    // Selection and focus move together — that is what "automatic activation"
    // means, and without the focus move the roving tabindex leaves the reader
    // on a tab that is no longer the tab stop.
    refs.current[index]?.focus();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const last = tabs.length - 1;
    let target: number | null = null;
    if (event.key === "ArrowRight") target = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") target = index === 0 ? last : index - 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    if (target === null) return;
    // Only for the keys we handled: Tab, Enter and Space must keep their
    // platform behaviour.
    event.preventDefault();
    selectIndex(target);
  };

  return (
    <TabList
      role="tablist"
      aria-label={ariaLabel}
      id={id}
      data-testid={props["data-testid"]}
    >
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        const tabId = tabElementId(idPrefix, tab.value);
        return (
          <TabButton
            key={tab.value}
            ref={(el: HTMLButtonElement | null) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={tabId}
            data-testid={tabId}
            aria-selected={selected}
            aria-controls={
              selected ? tabPanelElementId(idPrefix, tab.value) : undefined
            }
            tabIndex={selected ? 0 : -1}
            selected={selected}
            style={{ fontSize }}
            onClick={() => onValueChange(tab.value)}
            onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>) =>
              handleKeyDown(event, index)
            }
          >
            <StyledText size={size} fixedSize={fixedSize}>
              {tab.label}
            </StyledText>
          </TabButton>
        );
      })}
    </TabList>
  );
}

StyledTabList.displayName = "StyledTabList";

export interface StyledTabPanelProps {
  idPrefix: string;
  value: string;
  children: React.ReactNode;
  ["data-testid"]?: string;
}

/**
 * The region a tab controls. **Render only the active one** — see the note on
 * `aria-controls` above.
 *
 * `tabIndex={0}` because a panel's first content is often text rather than a
 * control: without it, Tab leaves the tablist and jumps past everything the
 * panel says to the first focusable thing inside it.
 *
 * A plain `<div>` with an inline width, and it establishes **no font size** of
 * its own — it is a labelled region, not a text container, so text inside it
 * inherits from whatever the host puts there. A consumer scanning for prose
 * that does not follow the reader's profile can therefore treat this as
 * transparent and keep walking to the next ancestor.
 */
export function StyledTabPanel({
  idPrefix,
  value,
  children,
  ...props
}: StyledTabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={tabPanelElementId(idPrefix, value)}
      aria-labelledby={tabElementId(idPrefix, value)}
      tabIndex={0}
      data-testid={props["data-testid"]}
      style={{ width: "100%" }}
    >
      {children}
    </div>
  );
}

StyledTabPanel.displayName = "StyledTabPanel";

const StyledTabs = { List: StyledTabList, Panel: StyledTabPanel };

export default StyledTabs;
export { StyledTabs };

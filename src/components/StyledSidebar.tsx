"use client";

import React, { useEffect, useRef, useState } from "react";
import { styled } from "styled-system/jsx";
import { cva } from "styled-system/css";
import { useLinkComponent } from "../config/style-config";
import type { LinkComponentProps } from "../config/link-component";
import StyledBox from "./StyledBox";
import StyledText from "./StyledText";
import StyledVStack from "./StyledVStack";
import StyledHStack from "./StyledHStack";
import StyledFlex from "./StyledFlex";
import StyledScrollbar from "./StyledScrollbar";
import StyledTooltip from "./StyledTooltip";

/**
 * Tool navigation for applications whose readers are often elderly and
 * sometimes cognitively impaired. See `docs/prd/PRD-0001-styled-sidebar.md`
 * for the reasoning behind each of these choices — this file implements it.
 *
 * The short version of the contract:
 *
 *   **This component renders what it is given.** It does not sort, does not
 *   filter, and owns no search field. `items` arrive already ordered and
 *   already filtered, so ordering is a host preference and search is a host
 *   concern — which is also what lets a host supply a dictation-capable input
 *   this package could never depend on.
 *
 * Every item is an icon *and* a name; there is no icon-only rendering, not
 * even collapsed. Help opens on click, never hover. Nothing anywhere in here
 * changes state on hover.
 *
 * **`iconOnlyWhenCollapsed` is the one documented exception** (PRD §20a), and
 * it is opt-in for exactly that reason. A host that sets it accepts an
 * icon-only rail — the thing §20 rejects — in exchange for the horizontal
 * space. The mitigations that make it defensible are not optional and are
 * enforced below: the button keeps the tool's name as its accessible name, so
 * nothing is lost to assistive technology, and the name and description are
 * reachable as a tooltip. Read `collapsedTooltipTrigger` before assuming a
 * touch reader can see either.
 */

/**
 * Minimum interactive size, stated as a `minHeight` on the element's own base
 * rather than left to emerge from padding — so no density step, font profile
 * or zoom level can erode it (PRD §A4).
 *
 * Two floors, not one. 48 is the hard minimum the whole package holds itself
 * to; the PRD asks for 60 "where layout allows", and a full-width item row is
 * exactly where it allows. The narrow rail controls (pager, collapse) sit in a
 * strip beside the list, where 60 would crowd the tools themselves, so they
 * keep the 48 floor.
 */
const ITEM_MIN_TARGET = "60px";
const CONTROL_MIN_TARGET = "48px";

export interface SidebarItem {
  id: string;
  /** Supplied by the host — this package ships no icons. */
  icon?: React.ReactNode;
  /** The tool's name. Always rendered. */
  label: string;
  /** One line, rendered beneath the name. */
  description?: string;
  /** Revealed by the item's help control, on click. */
  help?: React.ReactNode;
  /**
   * Where this tool lives. With it, the item renders as a real link — an `<a>`
   * through the host's `linkComponent` (a plain anchor unless the host
   * configured its router's link on `StonedogStyleProvider`) — carrying
   * `aria-current="page"` when selected. Without it, the item is a `<button>`
   * exactly as before.
   *
   * A navigation landmark full of buttons announces "button" for every
   * destination, cannot be middle-clicked or opened in a new tab, and forces
   * the host to `router.push` from `onSelect`. A link does none of that.
   * `onSelect` is still called for an ordinary click, as a notification — the
   * browser (or the host's router link) does the navigating, so a host must
   * not navigate again from it.
   */
  href?: string;
}

export interface StyledSidebarProps {
  /** Already ordered and already filtered by the host. */
  items: SidebarItem[];
  selectedId?: string;
  /**
   * Reports a choice. For a `<button>` item this is the only thing a press
   * does; for an `href` item it is a notification of an ordinary
   * (unmodified, primary-button) click, and the link itself navigates.
   *
   * Optional only so a sidebar made entirely of `href` items need not pass a
   * no-op. A button item with no `onSelect` does nothing when pressed.
   */
  onSelect?: (id: string) => void;
  /** How to handle more items than fit. Default `"scroll"`. */
  overflow?: "scroll" | "paging";
  /** Items per page when `overflow="paging"`. */
  itemsPerPage?: number;
  /** Controlled. Omit to let the component own the state via `defaultCollapsed`. */
  collapsed?: boolean;
  /**
   * Initial collapsed state when uncontrolled. Default `false`.
   *
   * Separate from `collapsed` so a host can say "start collapsed" without
   * taking on the state itself. Supplying `collapsed` wins.
   */
  defaultCollapsed?: boolean;
  onCollapsedChange?: (next: boolean) => void;
  /**
   * Render collapsed items as an icon-only rail, with the name and description
   * moved into a tooltip. Default `false`.
   *
   * **This is the PRD §20a exception and it is off by default deliberately.**
   * §20 rejects an icon-only rail because it reinstates the guess-the-glyph
   * problem the component exists to remove. A host opting in is trading that
   * away for horizontal space, which is a decision only a host can make — the
   * package will not make it for them, and the two other consumers of this
   * component must not inherit it silently.
   *
   * The name is *never* actually lost: collapsed buttons carry it as their
   * accessible name, so a screen reader announces the tool regardless.
   *
   * **On its own this recovers NO horizontal space, and that surprises people.**
   * The sidebar fills whatever width its container gives it; it does not narrow
   * itself, because layout is the host's to own. A host that sets this flag and
   * leaves its rail at its old width has traded away the visible names for
   * nothing — with no build error and nothing to notice. **Narrow the container
   * when collapsed; that is the other half of the bargain.** A component test
   * pins the part this component does owe: it must survive being narrowed.
   */
  iconOnlyWhenCollapsed?: boolean;
  /**
   * How the collapsed item's name/description tooltip opens. Default `"hover"`.
   *
   * `"click"` renders an explicit control instead, and is what a host should
   * pass when its reader has asked for help-on-press — HopperGuard drives this
   * from its `accessibility.clickForTooltips` setting.
   *
   * **It is also the only mode a touch reader can use.** `StyledTooltip` has no
   * touch trigger (hover and focus only), so on a tablet the hover mode reveals
   * nothing: tapping an icon-only item activates it rather than explaining it.
   * A host shipping `iconOnlyWhenCollapsed` to touch devices wants `"click"`.
   */
  collapsedTooltipTrigger?: "hover" | "click";
  /** Rendered when `items` is empty — e.g. "No tools match that search." */
  emptyState?: React.ReactNode;
  /** e.g. "TOOLS". */
  heading?: React.ReactNode;
  /** Names the navigation landmark. */
  "aria-label"?: string;
}

/**
 * The row's box, shared by the `<button>` and the `<a>` forms.
 *
 * A `cva` rather than an inline `styled()` config so both elements take the
 * identical, statically-extracted base: two literal copies would drift, and a
 * variable spread into one of them would not be extracted at all.
 */
const sidebarItem = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "3",
    // `flex: 1` + `minWidth: 0`, not `width: 100%`. The row also holds the help
    // control, and a child that insists on the full width pushes that control
    // off the edge — which at 375px is the whole reason the help exists.
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: ITEM_MIN_TARGET,
    px: "3",
    py: "2",
    textAlign: "left",
    borderRadius: "md",
    // The width is constant across states, so selecting an item cannot change
    // its size and shuffle everything below it. Only the colour moves — and
    // colour is never the only signal (see the label's weight below).
    borderWidth: "2px",
    borderStyle: "solid",
    cursor: "pointer",
  },
});

const ItemButton = styled("button", sidebarItem);

/**
 * The host's link component, as a target `styled()` can wrap.
 *
 * Read through the hook at render rather than captured at module scope, so a
 * host's `linkComponent` on `StonedogStyleProvider` is what renders — the same
 * seam `StyledLink` uses, and deliberately not a per-sidebar prop: the choice
 * of router is app-wide, and per-call-site is how one app ends up with two
 * navigation behaviours.
 */
const SidebarHostLink = React.forwardRef<HTMLAnchorElement, LinkComponentProps>(
  function SidebarHostLink(props, ref) {
    const HostLink = useLinkComponent();
    return <HostLink ref={ref} {...props} />;
  },
);

const ItemLink = styled(SidebarHostLink, sidebarItem);

/** A click the browser would turn into "open elsewhere", which is not a selection. */
function isModifiedClick(event: React.MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * The label column.
 *
 * A plain styled span rather than `StyledVStack`, purely so these two
 * declarations are statically extractable: `minWidth: 0` is what lets a long
 * tool name wrap instead of overflowing the rail (a flex child's default
 * `min-width: auto` refuses to shrink below its longest word), and
 * `overflowWrap` handles the single word longer than the rail (PRD §A3).
 */
const ItemLabels = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
});

/** Keeps a host's icon from being squashed by a long label. */
const ItemIcon = styled("span", {
  base: { display: "inline-flex", flexShrink: 0 },
});

/** Keeps the help control at its full size when the label is long. */
const HelpSlot = styled("span", {
  base: { display: "inline-flex", flexShrink: 0 },
});

const PagerButton = styled("button", {
  base: {
    minWidth: CONTROL_MIN_TARGET,
    minHeight: CONTROL_MIN_TARGET,
    px: "3",
    borderRadius: "md",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "borderBgPrimary",
    color: "textPrimary",
    cursor: "pointer",
    _disabled: { opacity: 0.5, cursor: "not-allowed" },
  },
});

const CollapseButton = styled("button", {
  base: {
    minWidth: CONTROL_MIN_TARGET,
    minHeight: CONTROL_MIN_TARGET,
    px: "2",
    borderRadius: "md",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "borderBgPrimary",
    color: "textPrimary",
    cursor: "pointer",
  },
});

const StyledSidebar: React.FC<StyledSidebarProps> = ({
  items,
  selectedId,
  onSelect,
  overflow = "scroll",
  itemsPerPage = 8,
  collapsed,
  defaultCollapsed,
  onCollapsedChange,
  iconOnlyWhenCollapsed = false,
  collapsedTooltipTrigger = "hover",
  emptyState,
  heading,
  "aria-label": ariaLabel = "Tools",
}) => {
  const [page, setPage] = useState(0);

  // Controlled when `collapsed` is supplied, uncontrolled otherwise. The
  // internal state moves either way — see the toggle below.
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed ?? false);
  const isCollapsed = collapsed !== undefined ? collapsed : uncontrolledCollapsed;

  // Whether this sidebar can collapse AT ALL, which is a different question
  // from whether it currently is.
  //
  // `defaultCollapsed` is read undefined-vs-absent rather than defaulted to
  // `false`, because those two mean different things here: a host that says
  // nothing must keep the sidebar it already has. Treating "uncontrolled" as
  // "collapsible" would grow a collapse control on optima-filings and
  // optima-cloud-saas, neither of which asked for one and neither of which
  // would see a build error — the silent-default hazard CLAUDE.md describes.
  const canCollapse = onCollapsedChange !== undefined || defaultCollapsed !== undefined;

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    if (collapsed === undefined) setUncontrolledCollapsed(next);
    onCollapsedChange?.(next);
  };

  // The rail is icon-only only when BOTH are true. Keeping this one derived
  // value rather than testing the pair at each site is what stops a later edit
  // dropping the icon while leaving the label suppressed, which would render an
  // item with nothing in it at all.
  const iconOnly = isCollapsed && iconOnlyWhenCollapsed;

  // Paging resets whenever the item set changes. Without this a host that
  // narrows `items` (a search) leaves the reader on a page that no longer
  // exists — the single most likely bug in this component (PRD §D16).
  const itemsKey = items.map((i) => i.id).join("|");
  const lastKey = useRef(itemsKey);
  useEffect(() => {
    if (lastKey.current !== itemsKey) {
      lastKey.current = itemsKey;
      setPage(0);
    }
  }, [itemsKey]);

  const paging = overflow === "paging";
  const pageCount = paging ? Math.max(1, Math.ceil(items.length / itemsPerPage)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = paging
    ? items.slice(safePage * itemsPerPage, safePage * itemsPerPage + itemsPerPage)
    : items;

  const list = (
    <StyledVStack gap={1} alignItems="stretch" role="list" data-testid="sidebar-items">
      {visible.map((item) => {
        const isSelected = item.id === selectedId;

        // The row's contents, identical in both forms.
        const content = (
          <>
              {item.icon !== undefined && item.icon !== null && <ItemIcon>{item.icon}</ItemIcon>}
              {/* The labels are dropped entirely only under the §20a opt-in.
                  Plain `collapsed` still renders the name and drops just the
                  description, which is what §20 asks for and remains the
                  default for every host that says nothing. */}
              {!iconOnly && (
                <ItemLabels>
                  <StyledText
                    // Weight, not just colour. Selection must survive greyscale,
                    // a high-contrast theme and colour blindness (PRD §C10) —
                    // and `aria-current` carries it to assistive technology.
                    fontWeight={isSelected ? "bold" : "normal"}
                    color={isSelected ? "textAccent" : "textPrimary"}
                  >
                    {item.label}
                  </StyledText>
                  {!isCollapsed && item.description && (
                    // `size`, not `fontSize`: StyledText writes its resolved size
                    // into an inline `style`, which beats any class a `fontSize`
                    // prop would generate. The prop looked right and did nothing.
                    <StyledText size="sm" color={isSelected ? "textAccent" : "textSecondary"}>
                      {item.description}
                    </StyledText>
                  )}
                </ItemLabels>
              )}
          </>
        );

        const button =
          item.href !== undefined ? (
            <ItemLink
              href={item.href}
              onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
                // A notification, not a navigation: the link navigates. A
                // modified or middle click opens the tool elsewhere, which is
                // not choosing it here.
                if (!isModifiedClick(event)) onSelect?.(item.id);
              }}
              // `page`, the token for "the current page in a set of
              // navigation links" — what a destination link in a navigation
              // landmark is. The button form keeps `true`.
              aria-current={isSelected ? "page" : undefined}
              // An anchor carries the UA link colour and underline; a button
              // carries neither. The label states its own colour, so the row
              // inherits — the icon then takes the surrounding text colour
              // rather than the browser's link blue.
              color="inherit"
              textDecoration="none"
              // Everything below mirrors the button form exactly — read the
              // reasoning there. Repeated as literals rather than spread from
              // an object, because Panda extracts style props only from JSX it
              // can read, and a spread is invisible to it.
              aria-label={iconOnly ? item.label : undefined}
              data-testid={`sidebar-item-${item.id}`}
              data-icon-only={iconOnly ? "true" : undefined}
              data-selected={isSelected ? "true" : undefined}
              borderColor={isSelected ? "borderBgAccent" : "transparent"}
              background={isSelected ? "boxBgAccent" : "transparent"}
              minWidth={iconOnly ? CONTROL_MIN_TARGET : 0}
              justifyContent={iconOnly ? "center" : "flex-start"}
              px={iconOnly ? "1" : "3"}
            >
              {content}
            </ItemLink>
          ) : (
            <ItemButton
              type="button"
              onClick={() => onSelect?.(item.id)}
              // Selection is announced, not just drawn.
              aria-current={isSelected ? "true" : undefined}
              // The name survives the icon-only rail. Without this the button's
              // accessible name is whatever the host's icon happens to expose —
              // usually nothing — so a screen reader announces "button" and the
              // rail becomes unusable rather than merely terse. This is the
              // mitigation that makes PRD §20a defensible; it is not optional.
              aria-label={iconOnly ? item.label : undefined}
              data-testid={`sidebar-item-${item.id}`}
              data-icon-only={iconOnly ? "true" : undefined}
              data-selected={isSelected ? "true" : undefined}
              // Tokens, as ternaries on Panda style props — never an inline
              // `style={{ background: "var(--colors-…)" }}`. A literal custom
              // property in a component bypasses the token layer, which is the
              // only thing that re-points under a consumer's `cssVarPrefix`,
              // and it also never reaches the stylesheet so nothing can grep
              // for it. This is the package's oldest defect class (CLAUDE.md,
              // "Token compliance").
              borderColor={isSelected ? "borderBgAccent" : "transparent"}
              background={isSelected ? "boxBgAccent" : "transparent"}
              // Icon-only: centre the glyph and hold the target size.
              //
              // `minWidth: 0` on the base is what lets a long label wrap
              // instead of overflowing — correct when there IS a label, and
              // exactly wrong without one, because the button then shrinks to
              // the glyph and the tap target quietly falls under the floor.
              // The horizontal padding goes too: at a 72px rail, 12px either
              // side is a fifth of the width spent on nothing.
              minWidth={iconOnly ? CONTROL_MIN_TARGET : 0}
              justifyContent={iconOnly ? "center" : "flex-start"}
              px={iconOnly ? "1" : "3"}
            >
              {content}
            </ItemButton>
          );

        return (
          <StyledHStack key={item.id} gap={1} alignItems="center" role="listitem">
            {iconOnly ? (
              // The name and description are what the rail just took away, so
              // this tooltip is not decoration — it is the only place a sighted
              // reader can recover them without expanding.
              //
              // `tooltip` carries both, and the description is omitted rather
              // than rendered empty when the host did not supply one: a panel
              // containing a name the button already announces is worse than no
              // panel, because it teaches the reader that pressing help wastes
              // their time.
              <StyledTooltip
                tooltip={
                  item.description ? (
                    <>
                      <StyledText fontWeight="bold">{item.label}</StyledText>
                      <StyledText size="sm">{item.description}</StyledText>
                    </>
                  ) : (
                    <StyledText fontWeight="bold">{item.label}</StyledText>
                  )
                }
                trigger={collapsedTooltipTrigger}
                helpLabel={`What does ${item.label} do?`}
                // `sidebar-tooltip-`, NOT `sidebar-item-tooltip-`: the latter
                // prefix-matches the `/^sidebar-item-/` selector the component
                // tests already use to enumerate rows, silently doubling the
                // count. A testid that shadows another is a trap for whoever
                // writes the next query.
                data-testid={`sidebar-tooltip-${item.id}`}
              >
                {button}
              </StyledTooltip>
            ) : (
              button
            )}

            {item.help && (
              // trigger="click" — a drifting pointer must not spawn this, nor
              // dismiss one being read. Unconditionally click even when the
              // name/description tooltip above is on hover: this one is the
              // longer explanation, and it is the one a reader dwells on.
              <HelpSlot>
                <StyledTooltip tooltip={item.help} trigger="click" helpLabel={`What does ${item.label} do?`}>
                  <span />
                </StyledTooltip>
              </HelpSlot>
            )}
          </StyledHStack>
        );
      })}
    </StyledVStack>
  );

  return (
    // `role="navigation"` rather than `as="nav"`: StyledBox accepts an `as`
    // prop, but it does not survive Panda's styled factory here, so `as="nav"`
    // rendered a plain div and the landmark silently never existed — an
    // aria-label on an unroled div names nothing. Caught by a rendering test
    // in the consuming app, which is exactly the kind of gap a behaviour test
    // sails past.
    <StyledBox
      role="navigation"
      aria-label={ariaLabel}
      data-testid="styled-sidebar"
      borderRightWidth="1px"
      borderColor="borderBgPrimary"
      // Tighter when icon-only. The arithmetic is the whole reason this exists:
      // a 48px target + a ~15px scroll gutter + 2x8px of padding needs 79px,
      // which does not fit the 72px rail the opt-in is for. At 2x4px it needs
      // 71px and does. A host still has to give the rail enough width — this
      // just stops the component spending a fifth of it on its own margins.
      p={iconOnly ? 1 : 2}
      // `height: 100%` + `minHeight: 0` is what makes scroll mode work at all.
      // StyledScrollbar is `flex: 1; min-height: 0; overflow: auto`, which can
      // only produce a scrollbar inside a column whose height is constrained.
      // Against an auto-height parent `height: 100%` computes to auto, so this
      // costs a host that does not constrain the sidebar nothing.
      height="100%"
      minHeight="0"
      noWrap
    >
      <StyledVStack gap={2} alignItems="stretch" height="100%" minHeight="0">
        {/*
          Stacked when icon-only, side-by-side otherwise.

          Reported from production: at a 72px rail the heading and a 48px
          control cannot share a row, so the control was laid out past the
          rail's right edge and clipped — it measured 118px in a 72px rail.
          `space-between` does not shrink a child below its min-width; it
          overflows, silently and off-screen.

          Only under the icon-only opt-in, because a 280px rail has room for the
          row and stacking there would cost vertical space for nothing.
        */}
        <StyledFlex
          flexDirection={iconOnly ? "column" : "row"}
          justifyContent={iconOnly ? "flex-start" : "space-between"}
          alignItems={iconOnly ? "stretch" : "center"}
          gap={iconOnly ? 1 : 0}
        >
          {heading && (
            <StyledText fontWeight="bold" size={iconOnly ? "sm" : undefined}>
              {heading}
            </StyledText>
          )}
          {/* Gating on `onCollapsedChange` alone would leave a host that only
              set `defaultCollapsed` with a permanently collapsed rail and no way
              out of it — see `canCollapse` for why it is not simply
              "uncontrolled". */}
          {canCollapse && (
            <CollapseButton
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!isCollapsed}
              // The name says what pressing it will do, not what state it is in.
              // Under the icon-only opt-in it will reveal the names themselves,
              // not merely the descriptions, so it says so — a reader who cannot
              // identify the glyphs is precisely the one reaching for this.
              aria-label={
                iconOnlyWhenCollapsed
                  ? isCollapsed
                    ? "Show tool names"
                    : "Hide tool names"
                  : isCollapsed
                    ? "Show tool descriptions"
                    : "Hide tool descriptions"
              }
              data-testid="sidebar-collapse"
            >
              {isCollapsed ? "»" : "«"}
            </CollapseButton>
          )}
        </StyledFlex>

        {items.length === 0 ? (
          // A live region: someone filtering with a screen reader has to learn
          // that nothing matched (PRD §F22).
          <StyledBox role="status" data-testid="sidebar-empty">
            {emptyState}
          </StyledBox>
        ) : paging ? (
          <>
            {list}
            {pageCount > 1 && (
              <StyledHStack gap={2} alignItems="center" justifyContent="space-between">
                <PagerButton
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Previous page of tools"
                  data-testid="sidebar-prev"
                >
                  ‹
                </PagerButton>
                {/* Position is stated, not implied by a row of dots. */}
                <StyledText size="sm" data-testid="sidebar-page-status">
                  Page {safePage + 1} of {pageCount}
                </StyledText>
                <PagerButton
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  aria-label="Next page of tools"
                  data-testid="sidebar-next"
                >
                  ›
                </PagerButton>
              </StyledHStack>
            )}
          </>
        ) : (
          <StyledScrollbar
            data-testid="sidebar-scroll"
            // Reserve the scrollbar's width even before it appears, so content
            // is never laid out underneath it and then clipped.
            //
            // This is the reported production defect. `StyledScrollbar` is
            // `scrollbar-width: thick` with 0.5rem of padding, which is not
            // enough clearance on a narrow rail — a desktop scrollbar is
            // ~15-17px. `stable` takes the gutter out of the content box up
            // front, so the layout is the same whether or not the list happens
            // to overflow. Without it a rail is correct until one more tool is
            // added, which is the worst kind of correct.
            //
            // NOT reproducible in this repo's own component tests: headless
            // Chromium uses OVERLAY scrollbars, which occupy zero width, so the
            // clipping cannot occur here at all. The guard asserts the reserved
            // gutter rather than the symptom.
            //
            // INLINE STYLE, not a Panda prop, and both halves of that matter.
            // Panda has no `scrollbar-gutter` utility, so the prop emitted a
            // class (`scr-bar-g_stable`) with no rule behind it — this
            // package's oldest defect class, and it computed as `auto`. Adding
            // a utility to THIS package's Panda config would not help either:
            // every consumer generates its own CSS from its own config, so the
            // rule would exist here and nowhere a consumer could use it. An
            // inline style is the only form that reaches all three products.
            style={{ scrollbarGutter: "stable" }}
          >
            {list}
          </StyledScrollbar>
        )}
      </StyledVStack>
    </StyledBox>
  );
};

export default StyledSidebar;
export { StyledSidebar };

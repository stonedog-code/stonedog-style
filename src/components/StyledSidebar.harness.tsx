import React from "react";
import StyledSidebar, { type SidebarItem } from "./StyledSidebar";
import { densityCustomProperties, type DensityStep } from "../config/density";

/**
 * Mount targets for `StyledSidebar.ct.tsx`.
 *
 * Playwright CT mounts by importing the module a component is declared in, so
 * anything defined inside the spec file fails with "Component X cannot be
 * mounted". Every one of these also needs real state (selection, collapse) or a
 * real height constraint, neither of which survives serialisation as a prop.
 */

const icon = (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" />
  </svg>
);

const TOOLS: SidebarItem[] = [
  {
    id: "calendar",
    icon,
    label: "Calendar",
    description: "Events & appointments",
    help: "Shows what is coming up this week.",
  },
  { id: "notes", icon, label: "Notes", description: "Reminders & messages" },
  { id: "tasks", icon, label: "Tasks", description: "Daily to-do items" },
  { id: "sites", icon, label: "Sites", description: "Saved links & pages" },
];

/** Thirty tools, to exercise both overflow modes at their real size. */
const MANY: SidebarItem[] = Array.from({ length: 30 }, (_, i) => ({
  id: `tool-${i}`,
  icon,
  label: `Tool number ${i + 1}`,
  description: "What this tool is for",
}));

/** A sidebar in a narrow rail, which is how a host actually places one. */
function Rail({
  children,
  height,
  width = "260px",
}: {
  children: React.ReactNode;
  height?: string;
  width?: string;
}) {
  return (
    <div
      data-testid="rail"
      style={{ width, display: "flex", flexDirection: "column", ...(height ? { height } : {}) }}
    >
      {children}
    </div>
  );
}

/** Four tools, selection held here so a keypress can be seen to move it. */
export function SidebarBasic() {
  const [selectedId, setSelectedId] = React.useState("calendar");
  return (
    <Rail>
      <StyledSidebar items={TOOLS} selectedId={selectedId} onSelect={setSelectedId} heading="TOOLS" />
    </Rail>
  );
}

/**
 * Thirty tools in a rail the host has constrained to 400px.
 *
 * This is the only arrangement in which scroll mode can produce a scrollbar at
 * all — `StyledScrollbar` is `flex: 1; min-height: 0; overflow: auto`, which
 * needs a column of known height above it. An unconstrained host gets a rail
 * that simply grows, which is correct and is not what this fixture is for.
 */
export function SidebarScrolling() {
  const [selectedId, setSelectedId] = React.useState("tool-0");
  return (
    <Rail height="400px">
      <StyledSidebar items={MANY} selectedId={selectedId} onSelect={setSelectedId} heading="TOOLS" />
    </Rail>
  );
}

/** Paging, with a collapse control, so both rail controls are on screen. */
export function SidebarPaging() {
  const [selectedId, setSelectedId] = React.useState("tool-0");
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <Rail>
      <StyledSidebar
        items={MANY}
        selectedId={selectedId}
        onSelect={setSelectedId}
        overflow="paging"
        itemsPerPage={4}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        heading="TOOLS"
      />
    </Rail>
  );
}

/** Names longer than the rail, and one unbroken word longer still (PRD §A3). */
export function SidebarLongLabels() {
  return (
    <Rail>
      <StyledSidebar
        items={[
          {
            id: "long",
            icon,
            label: "Medication reminders and refill scheduling",
            description: "Everything about the medicines taken this month",
            help: "Explains the medication schedule.",
          },
          { id: "unbroken", icon, label: "Elektroenzephalographiegeraetehersteller" },
        ]}
        selectedId="long"
        onSelect={() => {}}
        heading="TOOLS"
      />
    </Rail>
  );
}

/**
 * The §20a icon-only rail, uncontrolled and starting collapsed.
 *
 * Its own harness rather than a prop on `SidebarBasic`, because the interesting
 * assertions are about the rail's *width* and about the tap target surviving
 * the loss of the label — neither of which the shared fixture is arranged for.
 */
export function SidebarIconOnly() {
  const [selectedId, setSelectedId] = React.useState("calendar");
  // 72px, because the COMPONENT does not narrow itself — it fills whatever the
  // host gives it. `iconOnlyWhenCollapsed` alone recovers no horizontal space
  // at all; narrowing the container is the host's half of the bargain, and this
  // harness exists partly to make that obvious to the next reader.
  return (
    <Rail width="72px">
      <StyledSidebar
        items={TOOLS}
        selectedId={selectedId}
        onSelect={setSelectedId}
        heading="TOOLS"
        defaultCollapsed
        iconOnlyWhenCollapsed
      />
    </Rail>
  );
}

/**
 * The reported production case: an icon-only rail with enough tools to scroll.
 *
 * The distinction from `SidebarIconOnly` is the whole bug. Four tools do not
 * overflow, so no scrollbar exists and nothing is clipped — which is why the
 * first round of §20a tests passed while production was visibly broken.
 * HopperGuard shows ~24 tools. A scrollbar appears, takes width out of the
 * content box, and the icons underneath it are cut off.
 */
export function SidebarIconOnlyScrolling() {
  const [selectedId, setSelectedId] = React.useState("tool-0");
  return (
    <Rail width="72px" height="400px">
      <StyledSidebar
        items={MANY}
        selectedId={selectedId}
        onSelect={setSelectedId}
        heading="Care Tools"
        defaultCollapsed
        iconOnlyWhenCollapsed
      />
    </Rail>
  );
}

/**
 * The icon-only rail at a chosen density rung, with enough tools to scroll.
 *
 * Density is written as the two custom properties the recipes fold into their
 * own padding, which is the seam a host uses — so this exercises the real
 * mechanism rather than a prop that only this test knows about.
 *
 * Parameterised because the report was "on each density", and the rungs differ
 * by 12px of padding between `tight` and `airy`. A rail that fits at one rung
 * and not another is the failure worth catching, and only one of the five would
 * be exercised by a fixed harness.
 */
export function SidebarIconOnlyAtDensity({ step }: { step: DensityStep }) {
  const [selectedId, setSelectedId] = React.useState("tool-0");
  return (
    <div style={{ ...densityCustomProperties(step), display: "flex" } as React.CSSProperties}>
      <Rail width="72px" height="400px">
        <StyledSidebar
          items={MANY}
          selectedId={selectedId}
          onSelect={setSelectedId}
          heading="Care Tools"
          defaultCollapsed
          iconOnlyWhenCollapsed
        />
      </Rail>
    </div>
  );
}

/**
 * The same four tools as links (`href`). Fragment destinations, so following
 * one in a component test changes the hash rather than unloading the harness.
 */
const LINKED_TOOLS: SidebarItem[] = TOOLS.map((tool) => ({ ...tool, href: `#${tool.id}` }));

export function SidebarLinks() {
  const [selectedId, setSelectedId] = React.useState("calendar");
  return (
    <Rail>
      <div style={{ color: "rgb(1, 2, 3)" }} data-testid="link-colour-context">
        <StyledSidebar items={LINKED_TOOLS} selectedId={selectedId} onSelect={setSelectedId} heading="TOOLS" />
      </div>
    </Rail>
  );
}

/** Links on the §20a icon-only rail. */
export function SidebarLinksIconOnly() {
  return (
    <Rail width="72px">
      <StyledSidebar
        items={LINKED_TOOLS}
        selectedId="calendar"
        defaultCollapsed
        iconOnlyWhenCollapsed
      />
    </Rail>
  );
}

"use client";

/**
 * Harness for `StyledTooltip.ct.tsx` (NEH-818).
 *
 * Reproduces the arrangement that strands a hover tooltip: the trigger lives
 * inside one portalled dialog, and pressing it opens a SECOND portalled dialog
 * beside it without closing the first. A press that beats the tooltip's open
 * delay then leaves a live, click-eating tooltip on the page for the lifetime
 * of the document.
 *
 * The dialogs are bare `createPortal` divs on purpose. This package owns no
 * dialog, and the defect needs nothing from one beyond the two properties every
 * dialog has: it renders outside the trigger's DOM subtree, and it paints over
 * the trigger. Anything richer would put a second library's behaviour inside
 * the reproduction.
 *
 * Lives in its own module because the component tier mounts into a separate
 * browser bundle — a component declared in a spec file cannot be mounted, and
 * mounted JSX cannot close over the spec's scope.
 */

import React from "react";
import { createPortal } from "react-dom";
import StyledTooltip from "./StyledTooltip";

function Dialog({
  open,
  testid,
  children,
}: {
  open: boolean;
  testid: string;
  children: React.ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      data-testid={testid}
      style={{
        position: "fixed",
        inset: "10% 5%",
        background: "#fff",
        border: "1px solid #333",
        padding: "12px",
        display: "flex",
        // The overlays are ordered so the second dialog paints above the first,
        // as a stacked dialog does. Both sit BELOW the tooltip's own z-index of
        // 200000, which is the whole reason a stranded tooltip is reachable by
        // a click meant for the dialog.
        zIndex: testid === "form-dialog" ? 1000 : 900,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface TooltipOrphanProps {
  /**
   * Unmount the trigger when the second dialog opens.
   *
   * NEH-818's description blames the orphaned tooltip on exactly this, so the
   * harness can produce it — but it is NOT the mechanism, and the spec pins
   * that it closes cleanly, because React tears the portal down with the
   * component. Naming the case that already worked is what stops the next
   * person writing the fix the issue asked for.
   */
  unmountTriggerOnPress?: boolean;
}

export default function TooltipOrphan({ unmountTriggerOnPress = false }: TooltipOrphanProps) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [landedOn, setLandedOn] = React.useState("nothing");

  return (
    <div>
      <Dialog open testid="picker-dialog">
        {!(unmountTriggerOnPress && formOpen) && (
          <StyledTooltip tooltip="Track a medication and set reminders." placement="right">
            <button
              type="button"
              data-testid="quicklaunch"
              style={{ width: "120px", height: "100px" }}
              onClick={() => setFormOpen(true)}
            >
              Add Medicine
            </button>
          </StyledTooltip>
        )}
      </Dialog>

      <Dialog open={formOpen} testid="form-dialog">
        {/*
          Fills the dialog body, so that wherever the stranded tooltip lands
          over the dialog there is a real control underneath it. A fixed-height
          control lets the two boxes miss each other by a few pixels, and the
          click then lands — reporting the bug fixed for a reason that has
          nothing to do with the bug.
        */}
        <button
          type="button"
          data-testid="form-control"
          style={{ width: "100%", height: "100%" }}
          onClick={() => setLandedOn("form")}
        >
          Mg
        </button>
      </Dialog>

      <output data-testid="landed-on" style={{ position: "fixed", bottom: 0, left: 0 }}>
        {landedOn}
      </output>
    </div>
  );
}

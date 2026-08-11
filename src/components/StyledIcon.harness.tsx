import React from "react";

/**
 * Test stories for `StyledIcon.ct.tsx` (NEH-562).
 *
 * Playwright's component runner cannot mount a component declared inside the
 * test file — it bundles the stories separately — so anything the test renders
 * beyond a DOM element lives here.
 */

/**
 * A glyph that behaves the way `@fortawesome/fontawesome-svg-core`'s stylesheet
 * makes a real one behave: an inline-block box sized in `em`, dropped below the
 * baseline. These are the computed values of `.svg-inline--fa`, stated inline
 * so the test does not depend on a stylesheet this package must never ship —
 * it carries no icon artwork, by licence and by design.
 */
export const FaLikeGlyph: React.FC = () => (
  <svg
    data-testid="glyph"
    viewBox="0 0 512 512"
    style={{
      display: "inline-block",
      height: "1em",
      width: "1em",
      verticalAlign: "-0.125em",
    }}
  >
    <rect x="224" y="32" width="64" height="448" />
    <rect x="32" y="224" width="448" height="64" />
  </svg>
);

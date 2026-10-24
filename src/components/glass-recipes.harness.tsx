import React from "react";
import { boxRecipe, stackRecipe } from "styled-system/recipes";
import StyledDefinitionList from "./StyledDefinitionList";
import StyledFieldset from "./StyledFieldset";
import StyledInputRadio from "./StyledInputRadio";
import StyledText from "./StyledText";

/**
 * Mount targets for `glass-recipes.contrast.ct.tsx` (NEH-2075).
 *
 * The four glass variants NEH-2068 left for measurement — `dl-list`, `form`,
 * `stack` and `input-radio` — each reduced to what paints text, in the two
 * places a consumer puts them:
 *
 * - **`tile`** — inside a glass tile (`boxRecipe({ variant: "glass" })`, opaque
 *   `boxBgPrimary` with `textPrimary` since 0.39.0), which is where a glass
 *   surface sits in the largest consumer's dashboard.
 * - **`page`** — directly on the page, painted `boxBgMain` with `textMain`,
 *   which is where a form or a radio group sits in a settings screen.
 *
 * Inside each surface two pieces of text: a `StyledText`, which states
 * `textPrimary` itself, and a bare span that inherits whatever the surface
 * computes. `t-text` and `t-bare` are the ids the spec measures.
 *
 * `stack` has no component in this package that applies `stackRecipe`; it is
 * applied directly, as a consumer's `styled-system/recipes` import would.
 *
 * Lives here, not in the spec, because Playwright CT cannot mount a component
 * declared inside the spec module.
 */

/**
 * Only the component is exported. Playwright CT rewrites a spec's imports
 * into component registrations, and a value import from a harness module
 * ("Identifier … has already been declared") breaks that transform — so the
 * recipe and placement vocabularies live in the spec and arrive as props.
 */
export type GlassRecipe = "dl-list" | "form" | "stack" | "input-radio";
export type Placement = "tile" | "page";

function GlassSurface({ recipe }: { recipe: GlassRecipe }) {
  switch (recipe) {
    case "dl-list":
      return (
        <StyledDefinitionList.Root variant="glass" data-testid="surface">
          <StyledDefinitionList.Term>
            <StyledText data-testid="t-text">Pharmacy</StyledText>
          </StyledDefinitionList.Term>
          <StyledDefinitionList.Definition>
            <span data-testid="t-bare">Open until six</span>
          </StyledDefinitionList.Definition>
        </StyledDefinitionList.Root>
      );
    case "form":
      return (
        <StyledFieldset variant="glass" data-testid="surface">
          <StyledFieldset.Legend>
            <StyledText data-testid="t-text">Reminders</StyledText>
          </StyledFieldset.Legend>
          <StyledFieldset.Content>
            <span data-testid="t-bare">Send a text an hour before</span>
          </StyledFieldset.Content>
        </StyledFieldset>
      );
    case "stack":
      return (
        <div className={stackRecipe({ variant: "glass", direction: "column" })} data-testid="surface">
          <StyledText data-testid="t-text">Pick up prescriptions</StyledText>
          <span data-testid="t-bare">Call the pharmacy</span>
        </div>
      );
    case "input-radio":
      return (
        <StyledInputRadio
          name="cycle"
          label="Billing cycle"
          value="monthly"
          variant="glass"
          data-testid="surface"
          items={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
          renderItem={(item) =>
            item.value === "monthly" ? (
              <StyledText data-testid="t-text">{item.label}</StyledText>
            ) : (
              <span data-testid="t-bare">{item.label}</span>
            )
          }
        />
      );
  }
}

export function GlassRecipeHarness({
  recipe,
  placement,
}: {
  recipe: GlassRecipe;
  placement: Placement;
}) {
  const surface = <GlassSurface recipe={recipe} />;
  return (
    <div
      data-testid="page"
      style={{ background: "var(--colors-box-bg-main)", color: "var(--colors-text-main)", padding: 24 }}
    >
      {placement === "tile" ? (
        <div data-testid="tile" className={boxRecipe({ variant: "glass" })}>
          {surface}
        </div>
      ) : (
        surface
      )}
    </div>
  );
}

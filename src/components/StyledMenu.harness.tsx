import React from "react";
import StyledMenu, { type StyledMenuItem } from "./StyledMenu";
import { StonedogStyleProvider } from "../config/style-config";
import type { FontSizeProfile } from "../config/types";

/** Mount targets for `StyledMenu.ct.tsx`. State lives here so a keypress can be seen to move it. */

const ENTITIES: StyledMenuItem[] = [
  { id: "acme", label: "Acme Ltd", description: "Delaware corporation" },
  { id: "beta", label: "Beta LLC" },
  { id: "gamma", label: "Gamma Charitable Trust" },
];

/**
 * A switcher in a header row, the way a host places one. `align` picks which
 * edge it sits at, and the menu must stay on screen from either.
 */
export function MenuSwitcher({
  align = "start",
  profile,
  long = false,
}: {
  align?: "start" | "end";
  profile?: FontSizeProfile;
  long?: boolean;
}) {
  const [current, setCurrent] = React.useState("beta");
  const items = long
    ? [
        ...ENTITIES,
        {
          id: "long",
          label:
            "The Extraordinarily Long Name Of A Community Foundation For The Advancement Of Everything",
        },
      ]
    : ENTITIES;
  const label = items.find((item) => item.id === current)?.label ?? "Choose";
  const menu = (
    <div
      data-testid="header"
      style={{
        display: "flex",
        justifyContent: align === "end" ? "flex-end" : "flex-start",
        width: "100%",
      }}
    >
      <StyledMenu
        label={label}
        aria-label={`${label}, switch organisation`}
        items={items}
        currentId={current}
        onSelect={setCurrent}
        align={align}
      />
    </div>
  );
  return profile ? (
    <StonedogStyleProvider fontSizeProfile={profile}>{menu}</StonedogStyleProvider>
  ) : (
    menu
  );
}

/** An account menu: actions and a link, `aria-current` semantics, one disabled. */
export function MenuAccount() {
  const [last, setLast] = React.useState("none");
  return (
    <div>
      <StyledMenu
        label="Account"
        selection="current"
        items={[
          { id: "profile", label: "Profile", href: "#profile" },
          { id: "billing", label: "Billing", disabled: true },
          { id: "signout", label: "Sign out" },
        ]}
        onSelect={setLast}
        data-testid="account"
      />
      <p data-testid="last">{last}</p>
      <button type="button">After the menu</button>
    </div>
  );
}

/** One organisation: a value, not a control. */
export function MenuLocked() {
  return (
    <StyledMenu
      locked
      lockedLabel="Organisation"
      label="Acme Ltd"
      items={[{ id: "acme", label: "Acme Ltd" }]}
      currentId="acme"
    />
  );
}

export default MenuSwitcher;

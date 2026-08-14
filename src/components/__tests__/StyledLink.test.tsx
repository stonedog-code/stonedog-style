import React from "react";
import { render, screen } from "@testing-library/react";
import StyledLink from "../StyledLink";
import { StonedogStyleProvider } from "../../config/style-config";
import type { LinkComponent } from "../../config/link-component";

/**
 * `StyledLink`, at the tier that can answer wiring and ARIA (NEH-430).
 *
 * The component exists in this package at all only because the `linkComponent`
 * seam replaced a `next/link` import, so most of what is worth asserting here
 * is about that seam: that the default works with nothing configured, that a
 * host's component is actually used when supplied, and that the cases which
 * must NOT go through it do not.
 *
 * No colour or size assertions — every variant paints through tokens that jsdom
 * does not resolve, which would be the vacuous kind NEH-406 documents.
 */

/** A stand-in for a host's router link, recording that it was rendered. */
function makeHostLink() {
  const rendered: string[] = [];
  const HostLink: LinkComponent = React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(function HostLink({ href, children, ...rest }, ref) {
    rendered.push(href);
    return (
      <a ref={ref} href={href} data-host-link="yes" {...rest}>
        {children}
      </a>
    );
  }) as LinkComponent;
  return { HostLink, rendered };
}

describe("StyledLink", () => {
  describe("with nothing configured", () => {
    /**
     * The property the whole seam strategy rests on: the default is a real
     * link, not a placeholder. A seam whose default is broken is a required
     * configuration step wearing a disguise.
     */
    it("renders a working, accessible link", () => {
      render(<StyledLink href="/settings">Settings</StyledLink>);

      const link = screen.getByRole("link", { name: "Settings" });
      expect(link).toHaveAttribute("href", "/settings");
    });

    it("does not render through a host link, because there is none", () => {
      render(<StyledLink href="/settings">Settings</StyledLink>);
      expect(screen.getByRole("link")).not.toHaveAttribute("data-host-link");
    });
  });

  describe("with a host link supplied", () => {
    it("renders in-app destinations through it", () => {
      const { HostLink, rendered } = makeHostLink();

      render(
        <StonedogStyleProvider linkComponent={HostLink}>
          <StyledLink href="/settings">Settings</StyledLink>
        </StonedogStyleProvider>,
      );

      expect(screen.getByRole("link")).toHaveAttribute("data-host-link", "yes");
      expect(rendered).toEqual(["/settings"]);
    });

    /**
     * A client-side router cannot navigate off-origin, and several intercept
     * the click and do nothing at all — so an external link handed to one is a
     * link that silently stops working. This is the case the seam must refuse.
     */
    it("does NOT render an external destination through it", () => {
      const { HostLink, rendered } = makeHostLink();

      render(
        <StonedogStyleProvider linkComponent={HostLink}>
          <StyledLink href="https://example.com" isExternal>
            Docs
          </StyledLink>
        </StonedogStyleProvider>,
      );

      expect(screen.getByRole("link")).not.toHaveAttribute("data-host-link");
      expect(rendered).toEqual([]);
    });

    it("forwards a ref through to the underlying anchor", () => {
      // Why RefAttributes is in LinkComponent's props type: on React 18 a ref
      // handed to a plain function component is dropped with a console warning.
      const { HostLink } = makeHostLink();
      const ref = React.createRef<HTMLAnchorElement>();

      render(
        <StonedogStyleProvider linkComponent={HostLink}>
          <StyledLink ref={ref} href="/x">
            x
          </StyledLink>
        </StonedogStyleProvider>,
      );

      expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
    });
  });

  describe("disabled", () => {
    /**
     * There is no `disabled` attribute for an anchor. Removing `href` is what
     * actually stops activation and takes the element out of the tab order;
     * `aria-disabled` alone leaves a fully working link that merely claims not
     * to be.
     */
    it("removes href so the link cannot be activated or focused", () => {
      render(
        <StyledLink href="/settings" disabled>
          Settings
        </StyledLink>,
      );

      // No `href` means no implicit `link` role, which is the point — so query
      // by text rather than by role.
      const anchor = screen.getByText("Settings").closest("a");
      expect(anchor).not.toHaveAttribute("href");
      expect(anchor).toHaveAttribute("aria-disabled", "true");
    });

    it('does not fall back to href="#", which would still navigate', () => {
      // "#" is a live link to the top of the page: focusable, activatable, and
      // it scrolls. A disabled control that does something is worse than one
      // that looks enabled.
      render(
        <StyledLink href="/settings" disabled>
          Settings
        </StyledLink>,
      );
      expect(screen.getByText("Settings").closest("a")).not.toHaveAttribute(
        "href",
        "#",
      );
    });

    it("bypasses the host link entirely", () => {
      const { HostLink, rendered } = makeHostLink();
      render(
        <StonedogStyleProvider linkComponent={HostLink}>
          <StyledLink href="/settings" disabled>
            Settings
          </StyledLink>
        </StonedogStyleProvider>,
      );
      expect(rendered).toEqual([]);
    });
  });

  describe("new window", () => {
    it("sets both rel tokens, not just one", () => {
      // `noopener` severs window.opener (tabnabbing); `noreferrer` also
      // suppresses the Referer header. Separate protections, and older engines
      // implement only one of them.
      render(
        <StyledLink href="https://example.com" isExternal newWindow>
          Docs
        </StyledLink>,
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    });

    it("sets no target at all when not asked for", () => {
      // The original set `target=""` on every non-new-window link, which is a
      // meaningless attribute in the DOM for every one of them.
      render(<StyledLink href="/a">a</StyledLink>);
      expect(screen.getByRole("link")).not.toHaveAttribute("target");
    });
  });

  describe("the external indicator", () => {
    it("is shown for an external link and hidden from screen readers", () => {
      render(
        <StyledLink href="https://example.com" isExternal>
          Docs
        </StyledLink>,
      );

      // The accessible name is the label alone — the glyph must not become part
      // of it, or every external link announces "Docs north east arrow".
      expect(screen.getByRole("link", { name: "Docs" })).toBeInTheDocument();
      expect(screen.getByText("↗")).toHaveAttribute("aria-hidden", "true");
    });

    it("is absent on an in-app link", () => {
      render(<StyledLink href="/a">a</StyledLink>);
      expect(screen.queryByText("↗")).not.toBeInTheDocument();
    });

    it("can be replaced, or removed with null", () => {
      const { unmount } = render(
        <StyledLink href="https://e.com" isExternal externalIndicator="→">
          Docs
        </StyledLink>,
      );
      expect(screen.getByText("→")).toBeInTheDocument();
      unmount();

      render(
        <StyledLink href="https://e.com" isExternal externalIndicator={null}>
          Docs
        </StyledLink>,
      );
      expect(screen.queryByText("↗")).not.toBeInTheDocument();
    });
  });

  /**
   * The silent-narrowing trap `useResolvedVariant` documents: `link` is not in
   * `THEME_VARIANTS`, so passing the default list would coerce it to `solid`
   * and render every link as a filled button. Nothing would fail — it would
   * just look wrong, everywhere.
   */
  it("keeps the link variant instead of narrowing it to solid", () => {
    const { container } = render(<StyledLink href="/a">a</StyledLink>);
    const linkClasses = container.querySelector("a")?.className ?? "";

    const solid = render(
      <StyledLink href="/a" variant="solid">
        a
      </StyledLink>,
    );
    const solidClasses =
      solid.container.querySelector("a")?.className ?? "";

    expect(linkClasses).not.toEqual(solidClasses);
  });

  it("keeps caller-supplied class names alongside the recipe's", () => {
    const { container } = render(
      <StyledLink href="/a" className="mine">
        a
      </StyledLink>,
    );
    expect(container.querySelector("a")?.className).toContain("mine");
  });
});

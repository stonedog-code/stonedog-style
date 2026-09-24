import { renderHook } from "@testing-library/react";
import React from "react";
import {
  StonedogStyleProvider,
  useFontSizeScale,
  useIconSize,
  useResolvedVariant,
  useStyleConfig,
  DEFAULT_STYLE_CONFIG,
  type StyleConfig,
} from "../style-config";
import { DEFAULT_FONT_SIZE_SCALE } from "../font-size";

/** A provider wrapper preset with the given (partial) settings. */
function withConfig(config: Partial<StyleConfig>) {
  return function ConfigWrapper({ children }: { children: React.ReactNode }) {
    return <StonedogStyleProvider {...config}>{children}</StonedogStyleProvider>;
  };
}

describe("useStyleConfig", () => {
  it("returns the defaults when no provider is mounted", () => {
    // Rendering outside the provider must not throw: a host that forgets to
    // wrap should get a plain, readable UI rather than a crash.
    const { result } = renderHook(() => useStyleConfig());
    expect(result.current).toEqual(DEFAULT_STYLE_CONFIG);
  });

  it("fills in only the settings the host did not supply", () => {
    const { result } = renderHook(() => useStyleConfig(), {
      wrapper: withConfig({ fontSizeProfile: "xl" }),
    });
    expect(result.current.fontSizeProfile).toBe("xl");
    expect(result.current.variant).toBe(DEFAULT_STYLE_CONFIG.variant);
    expect(result.current.iconSize).toBe(DEFAULT_STYLE_CONFIG.iconSize);
  });
});

describe("useIconSize", () => {
  it("defaults to 2x", () => {
    // Pinned to what the originating application already renders. This default
    // is a compatibility promise, not a taste judgement — changing it resizes
    // every icon in every existing consumer, invisibly.
    const { result } = renderHook(() => useIconSize());
    expect(result.current).toBe("2x");
    expect(DEFAULT_STYLE_CONFIG.iconSize).toBe("2x");
  });

  it("returns the host's app-wide setting", () => {
    const { result } = renderHook(() => useIconSize(), {
      wrapper: withConfig({ iconSize: "md" }),
    });
    expect(result.current).toBe("md");
  });

  it("is unaffected by the other settings", () => {
    // Each field of StyleConfig merges independently; a host with an opinion
    // about only one must not have the rest reset underneath it.
    const { result } = renderHook(() => useIconSize(), {
      wrapper: withConfig({ fontSizeProfile: "xs", variant: "aurora" }),
    });
    expect(result.current).toBe(DEFAULT_STYLE_CONFIG.iconSize);
  });
});

describe("useFontSizeScale", () => {
  it("defaults to the package's fallbacks at 16px per rem", () => {
    // A host that names no ramp must get the arithmetic every px conversion
    // used before this field existed (NEH-1677).
    const { result } = renderHook(() => useFontSizeScale());
    expect(result.current).toBe(DEFAULT_FONT_SIZE_SCALE);
    expect(DEFAULT_STYLE_CONFIG.fontSizeScale).toBe(DEFAULT_FONT_SIZE_SCALE);
  });

  it("returns the host's scale, by reference, when it supplies one", () => {
    // By reference: the host passes a module-level constant and the provider
    // must not copy or merge it, or a change to one tier would be a change to
    // the object identity every consumer memoises on.
    const scale = { rootPx: 16, ramp: { md: "1.375rem" } };
    const { result } = renderHook(() => useFontSizeScale(), {
      wrapper: withConfig({ fontSizeScale: scale }),
    });
    expect(result.current).toBe(scale);
  });

  it("is unaffected by the other settings", () => {
    const { result } = renderHook(() => useFontSizeScale(), {
      wrapper: withConfig({ fontSizeProfile: "xl", iconSize: "md" }),
    });
    expect(result.current).toBe(DEFAULT_FONT_SIZE_SCALE);
  });
});

describe("useResolvedVariant", () => {
  it("prefers the caller's variant over the app-wide one", () => {
    const { result } = renderHook(() => useResolvedVariant("glass"), {
      wrapper: withConfig({ variant: "matte" }),
    });
    expect(result.current).toBe("glass");
  });

  it("falls back to the app-wide variant when the caller has no opinion", () => {
    const { result } = renderHook(() => useResolvedVariant(undefined), {
      wrapper: withConfig({ variant: "matte" }),
    });
    expect(result.current).toBe("matte");
  });

  it("falls back to solid when neither is set", () => {
    const { result } = renderHook(() => useResolvedVariant(undefined));
    expect(result.current).toBe("solid");
  });

  it.each(["ghost", "selected", "link", "unstyled", "none"])(
    "coerces the non-theme variant %s to solid",
    (variant) => {
      // These are real values elsewhere in the vocabulary, but the theme
      // recipes define no case for them. Passing one through renders an
      // *unstyled* control, which is worse than rendering a plain one.
      const { result } = renderHook(() => useResolvedVariant(variant));
      expect(result.current).toBe("solid");
    },
  );

  it("coerces an unrecognised persisted value to solid", () => {
    // e.g. a variant name written to storage by an older release.
    const { result } = renderHook(() => useResolvedVariant("art-deco"));
    expect(result.current).toBe("solid");
  });
});

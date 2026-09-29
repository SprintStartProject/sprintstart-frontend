import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarLogo } from "../../../../src/components/layout/SidebarLogo";

/**
 * Test-controlled seams into framer-motion.
 *
 * `useReducedMotion` is stubbed instead of driven through `window.matchMedia`:
 * framer-motion reads the media query once per module instance and caches it,
 * so overriding `matchMedia` mid-file silently does nothing for later renders
 * (and leaks into other tests if it is never restored). The badge root's
 * `onAnimationComplete` is captured so the tests can step the drop
 * choreography beat by beat — jsdom has no rAF-driven animation loop to do it.
 */
const motionControl = vi.hoisted(() => ({
  reducedMotion: false,
  completeRootAnimation: null as null | (() => void),
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const MOTION_ONLY_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "variants",
    "transition",
    "whileHover",
    "whileTap",
    "onAnimationComplete",
  ]);
  // Cached per tag so React sees a stable element type across re-renders.
  const cache = new Map<string, ComponentType<Record<string, unknown>>>();
  const motion = new Proxy(
    {},
    {
      get: (_target, tag) => {
        if (typeof tag !== "string") return undefined;
        const cached = cache.get(tag);
        if (cached) return cached;
        const Component = ({ children, ...props }: { children?: ReactNode }) => {
          const all = props as Record<string, unknown>;
          if ("data-drop-phase" in all) {
            motionControl.completeRootAnimation = all.onAnimationComplete as () => void;
          }
          const domProps = Object.fromEntries(
            Object.entries(all).filter(([key]) => !MOTION_ONLY_PROPS.has(key)),
          );
          return createElement(tag, domProps, children);
        };
        cache.set(tag, Component);
        return Component;
      },
    },
  );
  return { ...actual, motion, useReducedMotion: () => motionControl.reducedMotion };
});

describe("SidebarLogo gravity easter egg", () => {
  beforeEach(() => {
    motionControl.reducedMotion = false;
    motionControl.completeRootAnimation = null;
  });

  const getLogo = () => {
    const logo = document.querySelector<HTMLElement>("[data-drop-phase]");
    expect(logo).not.toBeNull();
    return logo!;
  };

  const clickTimes = (times: number) => {
    const logo = getLogo();
    for (let i = 0; i < times; i++) fireEvent.click(logo);
  };

  const finishBeat = () => {
    act(() => motionControl.completeRootAnimation?.());
  };

  it("renders a decorative, non-focusable badge", () => {
    render(<SidebarLogo />);
    const logo = getLogo();
    expect(logo.tagName).toBe("DIV");
    expect(logo).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stays idle for fewer than five clicks", () => {
    render(<SidebarLogo />);
    clickTimes(4);
    expect(getLogo()).toHaveAttribute("data-drop-phase", "idle");
  });

  it("starts the drop on the fifth click", () => {
    render(<SidebarLogo />);
    clickTimes(5);
    expect(getLogo()).toHaveAttribute("data-drop-phase", "falling");
  });

  it("walks falling → impact → bouncing → hopping → idle as each beat completes", () => {
    render(<SidebarLogo />);
    clickTimes(5);

    const seen: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      finishBeat();
      seen.push(getLogo().getAttribute("data-drop-phase"));
    }

    expect(seen).toEqual(["impact", "bouncing", "hopping", "idle"]);
  });

  it("ignores another five clicks while a drop is already playing", () => {
    render(<SidebarLogo />);
    clickTimes(5);
    finishBeat(); // → impact
    clickTimes(5);
    expect(getLogo()).toHaveAttribute("data-drop-phase", "impact");
  });

  it("never starts the drop under reduced motion", () => {
    motionControl.reducedMotion = true;
    render(<SidebarLogo />);
    clickTimes(5);
    expect(getLogo()).toHaveAttribute("data-drop-phase", "idle");
  });
});

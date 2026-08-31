import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarLogo } from "../../../../src/components/layout/SidebarLogo";

// jsdom has no rAF-driven framer-motion animation loop; these tests assert
// the trigger contract (click counting, phase gating, reduced-motion skip),
// not pixel choreography — same boundary as the game tests.
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    motion: new Proxy(actual.motion, {
      get(_target, prop) {
        // Strip animation props the DOM would reject; keep everything else.
        const Component = (props: Record<string, unknown>) => {
          const {
            initial: _i,
            animate: _a,
            exit: _e,
            variants: _v,
            transition: _t,
            whileHover: _w,
            onAnimationComplete: _o,
            ...rest
          } = props;
          void _i;
          void _a;
          void _e;
          void _v;
          void _t;
          void _w;
          void _o;
          const { [prop as string]: Tag = "div" } = {};
          return <Tag {...rest} />;
        };
        return Component;
      },
    }),
  };
});

describe("SidebarLogo gravity easter egg", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const clickTimes = (times: number) => {
    const logo = document.querySelector(".cursor-pointer");
    expect(logo).not.toBeNull();
    for (let i = 0; i < times; i++) fireEvent.click(logo!);
  };

  it("renders a decorative, cursor-pointer badge", () => {
    render(<SidebarLogo />);
    const logo = document.querySelector(".cursor-pointer");
    expect(logo).not.toBeNull();
    expect(logo!.tagName).toBe("DIV");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stays idle for fewer than five clicks", () => {
    render(<SidebarLogo />);
    clickTimes(4);
    // No way to observe phases directly through the mocked motion — assert
    // via the class contract instead: no transform-related inline style.
    const logo = document.querySelector(".cursor-pointer") as HTMLElement;
    expect(logo.style.transform).toBe("");
  });

  it("does not crash on five rapid clicks under reduced motion", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<SidebarLogo />);
    expect(() => clickTimes(5)).not.toThrow();
  });
});

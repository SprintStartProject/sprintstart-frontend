import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  SCROLL_CONTAINER_ATTRIBUTE,
  useScrollLock,
} from "../../../../src/components/ui/useScrollLock";

function Locker({ locked = true }: { locked?: boolean }) {
  useScrollLock(locked);
  return null;
}

afterEach(() => {
  cleanup();
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

describe("useScrollLock", () => {
  it("freezes the page while locked and restores it afterwards", () => {
    const view = render(<Locker />);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    view.unmount();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("does nothing when not locked", () => {
    render(<Locker locked={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the page frozen until the last of several overlays closes", () => {
    const outer = render(<Locker />);
    const inner = render(<Locker />);
    expect(document.body.style.overflow).toBe("hidden");

    // The inner overlay closing must not unlock the page — the outer one is
    // still open. This is the bug a naive implementation has.
    inner.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    outer.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("also freezes a page that scrolls in its own container", () => {
    const container = document.createElement("div");
    container.setAttribute(SCROLL_CONTAINER_ATTRIBUTE, "");
    container.style.overflowY = "scroll";
    document.body.appendChild(container);

    const view = render(<Locker />);
    expect(container.style.overflow).toBe("hidden");

    view.unmount();
    expect(container.style.overflow).toBe("");

    container.remove();
  });

  it("restores whatever overflow the page had before", () => {
    document.body.style.overflow = "auto";

    const view = render(<Locker />);
    expect(document.body.style.overflow).toBe("hidden");

    view.unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("prevents wheel events on non-scrollable background elements while locked", () => {
    const view = render(<Locker />);
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    view.unmount();
    const eventAfter = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 });
    document.body.dispatchEvent(eventAfter);
    expect(eventAfter.defaultPrevented).toBe(false);
  });

  it("lets a wheel over an SVG icon scroll the panel that contains it", () => {
    // An icon is an SVGElement, not an HTMLElement: the walk up to the
    // scrollable panel must still start at it, or hovering an icon blocks scroll.
    const panel = document.createElement("div");
    panel.style.overflowY = "auto";
    Object.defineProperty(panel, "scrollHeight", { configurable: true, value: 500 });
    Object.defineProperty(panel, "clientHeight", { configurable: true, value: 100 });
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    panel.appendChild(icon);
    document.body.appendChild(panel);

    const view = render(<Locker />);
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 });
    icon.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    view.unmount();
    panel.remove();
  });

  it("leaves Ctrl+wheel (browser zoom) alone while locked", () => {
    const view = render(<Locker />);
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
      ctrlKey: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    view.unmount();
  });

  it("lets a sideways wheel scroll a horizontally scrollable block in a short panel", () => {
    // Nothing here scrolls vertically: only the horizontal axis may decide.
    const block = document.createElement("pre");
    block.style.overflowX = "auto";
    Object.defineProperty(block, "scrollWidth", { configurable: true, value: 800 });
    Object.defineProperty(block, "clientWidth", { configurable: true, value: 200 });
    document.body.appendChild(block);

    const view = render(<Locker />);
    const sideways = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 80 });
    block.dispatchEvent(sideways);
    expect(sideways.defaultPrevented).toBe(false);

    const down = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
    block.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);

    view.unmount();
    block.remove();
  });

  it("leaves a two-finger pinch alone while locked", () => {
    const view = render(<Locker />);
    const touch = (y: number) => ({ clientX: 0, clientY: y }) as Touch;
    const pinch = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [touch(10), touch(50)],
    });
    document.body.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(false);
    view.unmount();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterSelect } from "../../../../src/components/ui/FilterSelect";

const OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "RUNNING", label: "Running" },
  { value: "FAILED", label: "Failed" },
];

function renderSelect(overrides: Partial<Parameters<typeof FilterSelect>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <FilterSelect
      label="Filter runs by status"
      value="ALL"
      options={OPTIONS}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange, trigger: screen.getByLabelText("Filter runs by status") };
}

/** A trigger sitting close enough to the right edge that a wide menu would overflow it. */
const nearRightEdge = {
  left: 900,
  right: 1020,
  top: 100,
  bottom: 130,
  width: 120,
  height: 30,
  x: 900,
  y: 100,
  toJSON: () => ({}),
} as DOMRect;

/**
 * This control replaces a native `<select>`, so everything the browser used to
 * provide for free has to be proven here instead.
 */
describe("FilterSelect", () => {
  it("opens on click and reports the chosen option", async () => {
    const user = userEvent.setup();
    const { onChange, trigger } = renderSelect();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("option", { name: "Failed" }));
    expect(onChange).toHaveBeenCalledWith("FAILED");
  });

  it("marks only the selected option as selected", async () => {
    const user = userEvent.setup();
    renderSelect({ value: "RUNNING" });

    await user.click(screen.getByLabelText("Filter runs by status"));

    expect(screen.getByRole("option", { name: "Running" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Failed" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("is fully operable from the keyboard", async () => {
    const user = userEvent.setup();
    const { onChange, trigger } = renderSelect();

    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // The active option is announced through aria-activedescendant rather
    // than by moving focus, so focus must stay on the trigger throughout.
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveFocus();
    expect(trigger.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "Running" }).id,
    );

    await user.keyboard("{End}");
    expect(trigger.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "Failed" }).id,
    );

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("FAILED");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape without selecting", async () => {
    const user = userEvent.setup();
    const { onChange, trigger } = renderSelect();

    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("jumps to an option by typing its first letters", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();

    await user.click(trigger);
    await user.keyboard("fa");

    expect(trigger.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "Failed" }).id,
    );
  });

  it("closes when the pointer goes down outside the control", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();

    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("cannot be opened while disabled", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect({ disabled: true });

    await user.click(trigger);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  /**
   * The menu may be wider than the control it hangs from — options do not wrap
   * — so left-aligning it with a trigger near the right edge pushes it off the
   * window. The dashboard's size picker sits in a toolbar pinned to the right
   * of its widget, which is where this shows up.
   */
  it("keeps a menu wider than its trigger inside the right edge of the window", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();

    // jsdom lays nothing out: the trigger is placed near the right edge by hand
    // and the menu is given a width wider than it.
    trigger.getBoundingClientRect = () => nearRightEdge;
    const menuWidth = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);

    await user.click(trigger);

    const listbox = screen.getByRole("listbox");
    const left = Number.parseFloat(listbox.style.left);

    expect(left).toBeLessThan(nearRightEdge.left);
    expect(left + 300).toBeLessThanOrEqual(window.innerWidth);

    menuWidth.mockRestore();
  });

  it("leaves a menu with room to its right aligned with the trigger", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();

    trigger.getBoundingClientRect = () => ({ ...nearRightEdge, left: 100, right: 220 });
    const menuWidth = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);

    await user.click(trigger);

    expect(screen.getByRole("listbox").style.left).toBe("100px");

    menuWidth.mockRestore();
  });

  /**
   * The menu has to escape the caller's stacking context.
   *
   * An ancestor with `backdrop-filter` / `transform` / `opacity` creates one,
   * and a menu rendered inside it is painted under whatever follows the caller
   * in the DOM however high its `z-index` is — which is how the knowledge-gap
   * owner dropdown ended up under the card beneath it, unclickable.
   */
  it("renders its menu into the body, out of any ancestor stacking context", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <div className="backdrop-blur-md">
        <FilterSelect
          label="Filter runs by status"
          value="ALL"
          options={OPTIONS}
          onChange={onChange}
        />
      </div>,
    );

    const trigger = screen.getByLabelText("Filter runs by status");
    await user.click(trigger);

    const listbox = screen.getByRole("listbox");
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox.closest(".backdrop-blur-md")).toBeNull();

    // And it is still a working menu from out there — the outside-click
    // dismissal must not treat the portaled options as "outside".
    await user.click(screen.getByRole("option", { name: "Failed" }));
    expect(onChange).toHaveBeenCalledWith("FAILED");
  });
});

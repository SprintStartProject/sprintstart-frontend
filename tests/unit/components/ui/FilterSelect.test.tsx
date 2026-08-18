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

  // The portalled mode exists for modals, whose panel clips its overflow and
  // whose footer would otherwise be painted over the open list.
  // Focus stays on the trigger in this pattern, so the browser never scrolls
  // the list on its own the way it would if the options were focused.
  it("scrolls the highlighted option into view as the keyboard moves it", async () => {
    const user = userEvent.setup();
    // vitest.setup stubs this on HTMLElement.prototype (jsdom has no layout),
    // so the spy has to replace it there rather than on Element.
    const scrollIntoView = vi
      .spyOn(window.HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    const { trigger } = renderSelect();
    await user.click(trigger);
    scrollIntoView.mockClear();

    await user.keyboard("{ArrowDown}");

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    scrollIntoView.mockRestore();
  });

  describe("in a portal", () => {
    it("renders the menu outside the control but still picks from it", async () => {
      const user = userEvent.setup();
      const { onChange, trigger } = renderSelect({ menuInPortal: true });

      await user.click(trigger);

      const listbox = await screen.findByRole("listbox");
      expect(listbox).toBeInTheDocument();
      // Out of the control's subtree entirely — that is the whole point.
      expect(trigger.parentElement?.contains(listbox)).toBe(false);
      expect(listbox).toHaveStyle({ position: "fixed" });

      // Regression: the dismiss-on-outside-click handler only knew about the
      // control, so a click on a portalled option closed the menu before the
      // click could land on it.
      await user.click(screen.getByRole("option", { name: "Failed" }));
      expect(onChange).toHaveBeenCalledWith("FAILED");
    });

    it("still closes when the pointer goes down outside", async () => {
      const user = userEvent.setup();
      const { trigger } = renderSelect({ menuInPortal: true });

      await user.click(trigger);
      expect(await screen.findByRole("listbox")).toBeInTheDocument();

      await user.click(document.body);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});

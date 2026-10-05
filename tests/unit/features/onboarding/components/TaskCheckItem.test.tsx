import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskCheckItem } from "../../../../../src/features/onboarding/components/TaskCheckItem";

function renderTask(onToggle = vi.fn()) {
  render(
    <TaskCheckItem
      index={0}
      title="Install Node"
      description="Use the LTS version from nodejs.org"
      isDone={false}
      onToggle={onToggle}
    />,
  );
  return onToggle;
}

describe("TaskCheckItem", () => {
  afterEach(() => window.getSelection()?.removeAllRanges());

  /**
   * Text inside a button cannot be selected, so a task that was one button could not be marked
   * for the buddy or copied. Only the tick is a button now.
   */
  it("keeps the task's text out of any button, so it can be selected", () => {
    renderTask();

    const tick = screen.getByRole("button", { name: "1. Install Node" });
    expect(tick).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Use the LTS version from nodejs.org").closest("button")).toBeNull();
    expect(screen.getByText(/Install Node/).closest("button")).toBeNull();
  });

  it("ticks from the tick, once", async () => {
    const user = userEvent.setup();
    const onToggle = renderTask();

    await user.click(screen.getByRole("button", { name: "1. Install Node" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("still ticks from a plain click anywhere on the row", async () => {
    const user = userEvent.setup();
    const onToggle = renderTask();

    await user.click(screen.getByText("Use the LTS version from nodejs.org"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not tick when the click ends a text selection", () => {
    const onToggle = renderTask();
    const description = screen.getByText("Use the LTS version from nodejs.org");

    const range = document.createRange();
    range.selectNodeContents(description);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    // The click that ends a drag, without the mousedown that would collapse the selection first.
    fireEvent.click(description);

    expect(onToggle).not.toHaveBeenCalled();
  });
});

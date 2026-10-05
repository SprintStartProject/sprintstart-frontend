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

  it("still ticks from a click on the row around the text", async () => {
    const user = userEvent.setup();
    const onToggle = renderTask();
    const row = screen.getByRole("button", { name: "1. Install Node" }).parentElement!;

    await user.click(row);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  /**
   * Review on #309: a double-click to select one word is a single click first, which ticked the
   * task on the way to selecting the word. Clicks on the text select; they do not tick.
   */
  it("does not tick from clicks on the text, single, double or triple", async () => {
    const user = userEvent.setup();
    const onToggle = renderTask();
    const description = screen.getByText("Use the LTS version from nodejs.org");

    await user.click(description);
    await user.dblClick(screen.getByText(/Install Node/));
    await user.tripleClick(description);

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not tick when the click ends a text selection", () => {
    const onToggle = renderTask();
    const description = screen.getByText("Use the LTS version from nodejs.org");
    const row = screen.getByRole("button", { name: "1. Install Node" }).parentElement!;

    const range = document.createRange();
    range.selectNodeContents(description);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    // A drag from the text out onto the row ends in a click there, without the mousedown that
    // would collapse the selection first.
    fireEvent.click(row);

    expect(onToggle).not.toHaveBeenCalled();
  });
});

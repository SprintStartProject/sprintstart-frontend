import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { StarterWorkAddMenu } from "../../../../src/features/starter-work/components/StarterWorkAddMenu";

function setup(overrides: Partial<Parameters<typeof StarterWorkAddMenu>[0]> = {}) {
  const onPickFromIssues = vi.fn();
  const onWriteOne = vi.fn();
  render(
    <StarterWorkAddMenu
      canAct
      onPickFromIssues={onPickFromIssues}
      onWriteOne={onWriteOne}
      {...overrides}
    />,
  );
  return { onPickFromIssues, onWriteOne };
}

describe("StarterWorkAddMenu", () => {
  it("opens the two ways to add work and closes again on the trigger", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("add-tasks-menu"));

    expect(screen.getByRole("menu", { name: "Add tasks" })).toBeInTheDocument();
    expect(screen.getByTestId("pick-from-issues")).toBeInTheDocument();
    expect(screen.getByTestId("add-starter-task")).toBeInTheDocument();

    await user.click(screen.getByTestId("add-tasks-menu"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls the matching handler and closes the menu when an item is picked", async () => {
    const user = userEvent.setup();
    const { onPickFromIssues } = setup();

    await user.click(screen.getByTestId("add-tasks-menu"));
    await user.click(screen.getByTestId("pick-from-issues"));

    expect(onPickFromIssues).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on an outside click", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByTestId("add-tasks-menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByTestId("add-tasks-menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("hides hand-authoring from HR, keeping only picking from issues", async () => {
    const user = userEvent.setup();
    setup({ canAct: false });

    await user.click(screen.getByTestId("add-tasks-menu"));

    expect(screen.queryByTestId("add-starter-task")).not.toBeInTheDocument();
    expect(screen.getByTestId("pick-from-issues")).toBeInTheDocument();
  });
});

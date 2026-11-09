import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArrivalStepThread } from "../../../../src/features/arrival/components/ArrivalStepThread";
import type { ArrivalStep } from "../../../../src/features/arrival/types";

const step = (key: string, over: Partial<ArrivalStep> = {}): ArrivalStep => ({
  key,
  projectId: null,
  projectName: null,
  title: `Step ${key}`,
  description: null,
  href: null,
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
  ...over,
});

function renderThread(over: Partial<Parameters<typeof ArrivalStepThread>[0]> = {}) {
  const props = {
    companySteps: [step("a"), step("b"), step("c")],
    projectSteps: [] as ArrivalStep[],
    hasProject: false,
    projectName: null,
    readOnly: false,
    onMove: vi.fn(),
    onReorder: vi.fn(),
    onEdit: vi.fn(),
    ...over,
  };
  render(<ArrivalStepThread {...props} />);
  return props;
}

describe("ArrivalStepThread", () => {
  it("says there is nothing when both lists are empty", () => {
    renderThread({ companySteps: [] });

    expect(screen.getByText("No steps here yet.")).toBeInTheDocument();
  });

  it("numbers the company steps and labels nothing without a project", () => {
    renderThread();

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[2]).getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("For everyone")).not.toBeInTheDocument();
  });

  it("shows a step's description only when it has one", () => {
    renderThread({ companySteps: [step("a", { description: "Ask IT" }), step("b")] });

    expect(screen.getByText("Ask IT")).toBeInTheDocument();
  });

  it("opens the editor from the card and from nowhere else when read-only", async () => {
    const user = userEvent.setup();
    const props = renderThread();

    await user.click(screen.getByRole("button", { name: 'Edit "Step b"' }));

    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ key: "b" }), "company");
  });

  it("offers neither editing nor moving when read-only", () => {
    renderThread({ readOnly: true });

    expect(screen.queryByRole("button", { name: /Edit "/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move "/ })).not.toBeInTheDocument();
  });

  it("moves a step with the arrows, and not past either end", async () => {
    const user = userEvent.setup();
    const props = renderThread();

    expect(screen.getByRole("button", { name: 'Move "Step a" earlier' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'Move "Step c" later' })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: 'Move "Step b" later' }));
    await user.click(screen.getByRole("button", { name: 'Move "Step b" earlier' }));

    expect(props.onMove).toHaveBeenNthCalledWith(1, "b", "down", "company");
    expect(props.onMove).toHaveBeenNthCalledWith(2, "b", "up", "company");
  });

  it("names the project's own section and counts straight through both", () => {
    renderThread({
      hasProject: true,
      projectName: "Apollo",
      projectSteps: [step("x", { projectId: "p1" }), step("y", { projectId: "p1" })],
    });

    expect(screen.getByText("For everyone")).toBeInTheDocument();
    expect(screen.getByText("Only in Apollo")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[3]).getByText("4")).toBeInTheDocument();
    expect(within(rows[4]).getByText("5")).toBeInTheDocument();
  });

  it("says when the project adds nothing", () => {
    renderThread({ hasProject: true, projectName: "Apollo" });

    expect(screen.getByText("Nothing extra for Apollo yet")).toBeInTheDocument();
  });

  it("names an unnamed project generically", () => {
    renderThread({ hasProject: true, projectName: null });

    expect(screen.getByText("Nothing extra for this project yet")).toBeInTheDocument();
  });

  it("marks a replaced company step and its override, and lets only the override move", async () => {
    const user = userEvent.setup();
    const props = renderThread({
      hasProject: true,
      projectName: "Apollo",
      companySteps: [step("a"), step("b")],
      projectSteps: [
        step("b", { projectId: "p1", title: "Apollo b" }),
        step("z", { projectId: "p1" }),
      ],
    });

    expect(screen.getByText("Overridden")).toHaveAttribute(
      "title",
      "Apollo uses its own version of this step.",
    );
    expect(screen.getByText("Override")).toHaveAttribute(
      "title",
      "Replaces the company-wide wording for this project.",
    );
    expect(screen.queryByRole("button", { name: 'Move "Step b" later' })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: 'Move "Apollo b" later' }));
    expect(props.onMove).toHaveBeenCalledWith("b", "down", "project");
  });

  it("gives a replaced company step a dot instead of the number its override takes", () => {
    renderThread({
      hasProject: true,
      projectName: "Apollo",
      companySteps: [step("a"), step("b"), step("c")],
      projectSteps: [
        step("b", { projectId: "p1", title: "Apollo b" }),
        step("z", { projectId: "p1" }),
      ],
    });

    const rows = screen.getAllByRole("listitem");
    const numberOf = (row: HTMLElement) => within(row).queryByText(/^\d+$/)?.textContent ?? null;
    expect(rows.map(numberOf)).toEqual(["1", null, "2", "3", "4"]);
  });

  it("falls back to a generic project name in the overridden tooltip", () => {
    renderThread({
      hasProject: true,
      projectName: null,
      companySteps: [step("b")],
      projectSteps: [step("b", { projectId: "p1" })],
    });

    expect(screen.getByText("Overridden")).toHaveAttribute(
      "title",
      "This project uses its own version of this step.",
    );
  });

  it("edits a project step in the project scope", async () => {
    const user = userEvent.setup();
    const props = renderThread({
      hasProject: true,
      projectName: "Apollo",
      projectSteps: [step("x", { projectId: "p1", title: "Only here" })],
    });

    await user.click(screen.getByRole("button", { name: 'Edit "Only here"' }));

    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ key: "x" }), "project");
  });

  it("says how each step gets settled, in a tone that tells the system's checks apart", () => {
    renderThread({
      companySteps: [
        step("a"),
        step("b", { settledBy: "OBSERVED", selfConfirmable: false }),
        step("c", { settledBy: "OBSERVED", selfConfirmable: true }),
      ],
    });

    expect(screen.getByText("Self-tick")).toHaveAttribute("title", "They tick it off themselves");
    expect(screen.getByText("Auto only")).toHaveAttribute("title", "Checked by SprintStart only");
    expect(screen.getByText("Auto or tick")).toHaveAttribute(
      "title",
      "Checked by SprintStart, or ticked by them",
    );
  });
});

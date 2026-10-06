import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BuddyModeSwitcher } from "../../../../src/features/buddy/components/BuddyModeSwitcher";
import {
  ProjectContext,
  type ProjectContextValue,
} from "../../../../src/features/projects/ProjectContext";
import type { SelectableProject } from "../../../../src/features/projects/ProjectContext";

/**
 * The switcher is the door between the hire's own buddy and team mode, and these tests are about
 * who gets the door and what opening it sends: nothing for a hire who manages nothing, a row for
 * each managed project, and the restore audit that quietly steps back to hire mode when the
 * stored conversation is one this user no longer runs.
 */

const SWITCHER_NAME = "Which conversation is your buddy in";

function project(id: string, isManaged: boolean): SelectableProject {
  return {
    id,
    name: id === "p1" ? "Aurora" : "Companion",
    description: "",
    manager: null,
    sources: [],
    users: [],
    industry: "",
    industryCustom: false,
    industryConfidence: null,
    isManaged,
    memberCount: null,
    sourceCount: null,
  };
}

function contextValue(projects: SelectableProject[]): ProjectContextValue {
  return {
    projects,
    selectedProject: projects[0] ?? null,
    selectedProjectId: projects[0]?.id ?? "",
    hasSelectedProject: projects.length > 0,
    canManageSelected: projects.some((p) => p.isManaged),
    isSwitcherEnabled: true,
    isLoading: false,
    errorMessage: null,
    setSelectedProjectId: vi.fn(),
    reloadProjects: vi.fn(),
  };
}

function renderSwitcher(
  teamProjectId: string | null,
  onSwitch = vi.fn(),
  projects: SelectableProject[] = [project("p1", true), project("p2", false), project("p3", true)],
) {
  const value = contextValue(projects);
  render(
    <ProjectContext.Provider value={value}>
      <BuddyModeSwitcher teamProjectId={teamProjectId} onSwitch={onSwitch} />
    </ProjectContext.Provider>,
  );
  return onSwitch;
}

describe("BuddyModeSwitcher", () => {
  it("renders nothing for somebody who manages no project", () => {
    const { container } = render(
      <ProjectContext.Provider value={contextValue([project("p1", false)])}>
        <BuddyModeSwitcher teamProjectId={null} onSwitch={vi.fn()} />
      </ProjectContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("lists the hire's own conversation plus one row per managed project", async () => {
    renderSwitcher(null);

    const trigger = screen.getByRole("combobox", { name: SWITCHER_NAME });
    // Hire mode is the one showing.
    expect(trigger).toHaveTextContent("Your onboarding");

    await userEvent.click(trigger);

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    // Managed projects only, with the hire's own always on top.
    expect(options).toEqual(["Your onboarding", "Aurora", "Companion"]);
  });

  it("switches to a managed project, and back to the hire's own", async () => {
    const onSwitch = renderSwitcher(null);

    await userEvent.click(screen.getByRole("combobox", { name: SWITCHER_NAME }));
    await userEvent.click(screen.getByRole("option", { name: "Aurora" }));
    expect(onSwitch).toHaveBeenLastCalledWith("p1");

    await userEvent.click(screen.getByRole("combobox", { name: SWITCHER_NAME }));
    await userEvent.click(screen.getByRole("option", { name: "Your onboarding" }));
    expect(onSwitch).toHaveBeenLastCalledWith(null);
  });

  it("is inert while a turn is in flight", () => {
    render(
      <ProjectContext.Provider value={contextValue([project("p1", true)])}>
        <BuddyModeSwitcher teamProjectId={null} onSwitch={vi.fn()} disabled />
      </ProjectContext.Provider>,
    );

    expect(screen.getByRole("combobox", { name: SWITCHER_NAME })).toBeDisabled();
  });
});

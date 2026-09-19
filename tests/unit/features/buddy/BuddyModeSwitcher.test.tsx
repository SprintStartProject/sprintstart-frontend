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

  it("lists the hire's own conversation plus one row per managed project", () => {
    renderSwitcher(null);

    const select = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Which conversation is your buddy in",
    });
    expect(select.value).toBe(""); // hire mode

    const options = [...select.options].map((option) => option.value);
    // Managed projects only, with the hire's own always on top.
    expect(options).toEqual(["", "p1", "p3"]);
  });

  it("switches to a managed project, and back to the hire's own", async () => {
    const onSwitch = renderSwitcher(null);
    const select = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Which conversation is your buddy in",
    });

    await userEvent.selectOptions(select, "p1");
    expect(onSwitch).toHaveBeenLastCalledWith("p1");

    await userEvent.selectOptions(select, "");
    expect(onSwitch).toHaveBeenLastCalledWith(null);
  });

  it("steps back to hire mode when the stored conversation is no longer this user's", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // p3 was managed when the conversation was stored; this list no longer carries it.
    const onSwitch = renderSwitcher("p3", vi.fn(), [project("p1", true), project("p2", false)]);

    // The audit fires once the list is there — no request goes out for a conversation the
    // manager does not run any more.
    await vi.waitFor(() => {
      expect(onSwitch).toHaveBeenCalledWith(null);
    });
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it("leaves a stored conversation alone while the project list is still loading", () => {
    const onSwitch = vi.fn();
    render(
      <ProjectContext.Provider value={{ ...contextValue([]), isLoading: true }}>
        <BuddyModeSwitcher teamProjectId="p1" onSwitch={onSwitch} />
      </ProjectContext.Provider>,
    );

    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("is inert while a turn is in flight", () => {
    render(
      <ProjectContext.Provider value={contextValue([project("p1", true)])}>
        <BuddyModeSwitcher teamProjectId={null} onSwitch={vi.fn()} disabled />
      </ProjectContext.Provider>,
    );

    const select = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Which conversation is your buddy in",
    });
    expect(select).toBeDisabled();
  });
});

import { vi } from "vitest";
import type {
  ProjectContextValue,
  SelectableProject,
} from "../../../src/features/projects/ProjectContext";

/**
 * Builds a project-context value for tests that render components below the
 * global project selection without mounting the real `ProjectProvider`.
 *
 * Kept in one place so the shape stays in sync with `ProjectContextValue` —
 * otherwise every consumer test would need updating whenever the context grows
 * a field.
 */
export function createProjectContextValue(
  overrides: Partial<ProjectContextValue> = {},
): ProjectContextValue {
  return {
    projects: [],
    selectedProject: null,
    selectedProjectId: "",
    canManageSelected: false,
    isSwitcherEnabled: true,
    isLoading: false,
    errorMessage: null,
    setSelectedProjectId: vi.fn(),
    reloadProjects: vi.fn(),
    ...overrides,
  };
}

/** Builds a selectable project with sensible defaults. */
export function createSelectableProject(
  overrides: Partial<SelectableProject> = {},
): SelectableProject {
  return {
    id: "proj1",
    name: "Project Alpha",
    description: "",
    manager: null,
    sources: [],
    users: [],
    isManaged: true,
    memberCount: 3,
    sourceCount: 2,
    ...overrides,
  };
}

import { createContext } from "react";
import type { AdminProject } from "../../services/projectService";

/**
 * A project the current user can switch to, plus whether they manage it.
 *
 * `isManaged` drives both the grouping in the switcher and whether management
 * affordances are offered. It mirrors the backend's project manager assignment,
 * not the global PM role — holding the PM role does not imply managing a
 * specific project.
 */
export type SelectableProject = AdminProject & {
  isManaged: boolean;
  /**
   * Member and source counts shown on the switcher cards.
   *
   * `null` means "not known at this access level" rather than zero — the
   * self-service project listing a plain member gets does not carry counts, and
   * rendering a confident "0 members" there would be wrong.
   */
  memberCount: number | null;
  sourceCount: number | null;
};

export type ProjectContextValue = {
  /** All projects the user may switch between, managed ones first. */
  projects: SelectableProject[];
  selectedProject: SelectableProject | null;
  /**
   * The selected project's id — or `""` while nothing is selected.
   *
   * This value is only ever published once the loaded project list has confirmed it: a
   * stored id and a `?projectId=` deep link are both held back until a list vouches for
   * them. Consumers may therefore treat a non-empty id as one this user actually
   * reaches, and gate requests on it without re-checking the list themselves.
   */
  selectedProjectId: string;
  /**
   * Whether a confirmed project is selected — the safe gate for anything scoped to one.
   *
   * False while the project list is loading and for a user with no projects at all;
   * every project-scoped request should wait for it rather than re-deriving the same
   * check from {@link selectedProjectId} or {@link selectedProject}.
   */
  hasSelectedProject: boolean;
  /**
   * Whether the user manages the currently selected project.
   *
   * Also gates the manager-only areas (PM dashboard, data ingestion) for the PM
   * role: a PM who is a mere member of the selected project should not reach
   * them. Admins/HR are gated by role alone, so this is only consulted for PMs.
   */
  canManageSelected: boolean;
  /** Whether the project switcher should be offered at all for this role. */
  isSwitcherEnabled: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  setSelectedProjectId: (projectId: string) => void;
  reloadProjects: () => Promise<void>;
};

export const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

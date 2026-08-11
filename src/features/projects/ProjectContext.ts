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
  selectedProjectId: string;
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

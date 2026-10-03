import type {
  AdminUser,
  ProjectSummary,
  UpdateAdminUserRequest,
} from "../../services/adminUserService";
import type {
  AdminProject,
  AdminProjectDetails,
  ProjectSource,
  ProjectUser,
  ProjectUserSummary,
} from "../../services/projectService";
import type { ProjectRole, Skill } from "../team-management/types";

export type LoadingState = "idle" | "loading" | "success" | "error";
export type UserFilter = "all" | "enabled" | "disabled" | "onboarded" | "not-onboarded";
export type AdminTab = "users" | "projects" | "skills" | "tokens";
export type SkillStatusFilter = "all" | "ACTIVE" | "RETIRED";

/**
 * Left-to-right order of every tab this page can show. `TabSwitcher` renders
 * whichever subset `AdminPage` passes it in this order, and `AdminPage` derives
 * the slide direction from the same order, so the content always travels the
 * same way the active pill does.
 */
export const ADMIN_TAB_ORDER: AdminTab[] = ["users", "projects", "skills", "tokens"];

export type UserEditFormState = {
  email: string;
  firstName: string;
  lastName: string;
  permissionGroup: string;
  enabled: boolean;
};

export type ProjectEditFormState = {
  name: string;
  description: string;
};

export type ProjectOverview = AdminProject;

export type {
  AdminProjectDetails,
  AdminUser,
  ProjectRole,
  ProjectSource,
  ProjectSummary,
  ProjectUser,
  ProjectUserSummary,
  Skill,
  UpdateAdminUserRequest,
};

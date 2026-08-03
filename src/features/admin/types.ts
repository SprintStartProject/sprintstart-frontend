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

export type LoadingState = "idle" | "loading" | "success" | "error";
export type UserFilter =
  | "all"
  | "enabled"
  | "disabled"
  | "onboarded"
  | "not-onboarded";
export type AdminTab = "users" | "projects" | "tokens";

/**
 * Left-to-right order of the tabs. Single source of truth: `TabSwitcher`
 * renders in this order and `AdminPage` derives the slide direction from it, so
 * the content always travels the same way the active pill does.
 */
export const ADMIN_TAB_ORDER: AdminTab[] = ["users", "projects", "tokens"];

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
  ProjectSource,
  ProjectSummary,
  ProjectUser,
  ProjectUserSummary,
  UpdateAdminUserRequest,
};

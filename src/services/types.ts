export const PermissionGroup = {
  USER: "USER",
  PM: "PM",
  HR: "HR",
  ADMIN: "ADMIN",
} as const;
export type PermissionGroup =
  (typeof PermissionGroup)[keyof typeof PermissionGroup];

export const DocumentStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];

export type DocumentMetadata = {
  id: string;
  name: string;
  mime: string;
  size?: number;
  status: DocumentStatus;
  uploadDate: string;
};

export type UploadResult = {
  id: string;
  filename: string;
  status: "ok" | "failed";
  error?: string;
};

export interface ProjectRoleSummary {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  authId: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  projectRoles: ProjectRoleSummary[];
  permissionGroup: PermissionGroup;
  enabled: boolean;
  profileIcon: string | null;
  hasCompletedOnboarding: boolean;
  projectIds?: string[];
}

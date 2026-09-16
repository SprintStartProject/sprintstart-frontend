import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { PermissionGroup } from "../../services/types";
import { projectService, type AdminProject } from "../../services/projectService";
import { userService } from "../../services/userService";
import { ProjectContext, type SelectableProject } from "./ProjectContext";
import {
  dropLegacySelection,
  readStoredProjectId,
  storeProjectId,
} from "./projectSelectionStorage";

/**
 * Permission groups that get the global project switcher.
 *
 * Regular users currently keep an implicitly selected project. The loader below
 * already handles their data path (`userService.getMyProjects`), so opening the
 * switcher up to them is a change to this list alone.
 */
const PROJECT_SWITCHER_ROLES: readonly PermissionGroup[] = [
  PermissionGroup.PM,
  PermissionGroup.HR,
  PermissionGroup.ADMIN,
];

function toSelectableProject(
  project: AdminProject,
  isManaged: boolean,
  counts: { memberCount: number | null; sourceCount: number | null } = {
    memberCount: null,
    sourceCount: null,
  },
): SelectableProject {
  return { ...project, isManaged, ...counts };
}

/** Managed projects first, then alphabetically within each group. */
function sortProjects(projects: SelectableProject[]): SelectableProject[] {
  return [...projects].sort((a, b) => {
    if (a.isManaged !== b.isManaged) return a.isManaged ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Loads every project an admin can reach.
 *
 * `isManaged` reflects the actual manager assignment — a project counts as
 * "managed by you" only when the current user is its assigned project manager,
 * not merely because an admin can reach every project. Admins therefore see the
 * assigned PM (and the member count) on projects they do not personally manage,
 * which land in the "Member of" group.
 *
 * `getProjects` already degrades to the self-service listing on 401/403, which
 * is what an HR user hits — the backend restricts `/api/v1/admin/projects` to
 * ADMIN, while the frontend groups HR with admins.
 */
async function loadAdminProjects(currentUserId: string | null): Promise<SelectableProject[]> {
  const projects = await projectService.getProjects();
  return projects.map((project) =>
    toSelectableProject(project, currentUserId !== null && project.manager?.id === currentUserId, {
      memberCount: project.users.length,
      sourceCount: project.sources.length,
    }),
  );
}

/**
 * Loads a project manager's projects: the ones they manage, plus the ones they
 * are only a member of.
 *
 * The managed listing is best-effort — if the role in the token and the
 * assignment in the database disagree the user still sees their memberships
 * rather than an error screen.
 */
async function loadManagerProjects(): Promise<SelectableProject[]> {
  const [managed, memberships] = await Promise.all([
    projectService.getManagedProjects().catch(() => []),
    userService.getMyProjects(),
  ]);

  const managedIds = new Set(managed.map((project) => project.id));

  const managedProjects = managed.map((project) =>
    toSelectableProject(
      {
        id: project.id,
        name: project.name,
        description: project.description,
        manager: null,
        sources: [],
        users: [],
        industry: project.industry,
        industryConfidence: project.industryConfidence,
        industryCustom: project.industryCustom,
      },
      true,
      { memberCount: project.memberCount, sourceCount: null },
    ),
  );

  const memberProjects = memberships
    .filter((project) => !managedIds.has(project.id))
    .map((project) =>
      toSelectableProject(
        {
          id: project.id,
          name: project.name,
          description: "",
          manager: null,
          sources: [],
          users: [],
          industry: "",
          industryConfidence: null,
          industryCustom: false,
        },
        false,
      ),
    );

  return [...managedProjects, ...memberProjects];
}

/**
 * Holds the globally selected project.
 *
 * Must be mounted inside `AuthProvider`: which projects are loaded depends on
 * the authenticated user's permission group. The selection is persisted to
 * localStorage under the signed-in user's own key, and healed on load when the
 * stored project is no longer reachable (deleted, or access revoked).
 *
 * A stored ID is never published on its own: it is read inside `loadProjects` and
 * checked against the loaded list before it reaches the context, so consumers never
 * see a selection no list has vouched for.
 */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const { profile, status } = useAuth();
  const [projects, setProjects] = useState<SelectableProject[]>([]);

  /*
    Empty until the loaded project list vouches for a value. The stored key is scoped to the
    signed-in user, so it cannot be read at mount — there is no user yet — and restoring it into
    state as soon as one arrives would publish an ID that no loaded list has confirmed.
  */
  const [selectedProjectId, setSelectedProjectIdState] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const permissionGroup = profile?.permissionGroup ?? null;
  const userId = profile?.id ?? null;
  const isAuthenticated = status === "authenticated";

  const setSelectedProjectId = useCallback(
    (projectId: string) => {
      setSelectedProjectIdState(projectId);
      storeProjectId(userId ?? "", projectId);
    },
    [userId],
  );

  /*
    Drops the unscoped entry older versions of the app left behind — never adopting its value,
    since it cannot be attributed to the person now signed in. Runs once a user is known, because
    until then there is no way to tell whose selection it was.
  */
  useEffect(() => {
    if (userId) dropLegacySelection();
  }, [userId]);

  const loadProjects = useCallback(async () => {
    if (!isAuthenticated || !permissionGroup || !userId) {
      setProjects([]);
      // The selection belongs to a user, so there is nothing to keep it for without one.
      setSelectedProjectIdState("");
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const isAdmin = permissionGroup === PermissionGroup.ADMIN;
      const isHr = permissionGroup === PermissionGroup.HR;
      const isManager = permissionGroup === PermissionGroup.PM;

      let nextProjects: SelectableProject[];
      if (isAdmin || isHr) {
        nextProjects = await loadAdminProjects(userId);
      } else if (isManager) {
        nextProjects = await loadManagerProjects();
      } else {
        const memberships = await userService.getMyProjects();
        nextProjects = memberships.map((project) =>
          toSelectableProject(
            {
              id: project.id,
              name: project.name,
              description: "",
              manager: null,
              sources: [],
              users: [],
              industry: "",
              industryConfidence: null,
              industryCustom: false,
            },
            false,
          ),
        );
      }

      const sortedProjects = sortProjects(nextProjects);
      setProjects(sortedProjects);

      // Read here rather than on mount: this is the first point at which the stored ID can be
      // checked against the projects this user actually reaches, and an unconfirmed ID must not
      // be published to the consumers that read the context.
      const storedProjectId = readStoredProjectId(userId);

      setSelectedProjectIdState((currentProjectId) => {
        // A selection made in this session — a switcher pick, or a `?projectId=` deep link —
        // wins over the stored one, which is the fallback for a fresh page load.
        const preferredProjectId = currentProjectId || storedProjectId;
        const hasPreferredProject = sortedProjects.some(
          (project) => project.id === preferredProjectId,
        );

        const nextProjectId = hasPreferredProject
          ? preferredProjectId
          : (sortedProjects[0]?.id ?? "");

        storeProjectId(userId, nextProjectId);
        return nextProjectId;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Projects could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, permissionGroup, userId]);

  // Deferred to a microtask so the synchronous `setIsLoading(true)` at the top
  // of `loadProjects` does not run inside the effect body and cascade a render.
  useEffect(() => {
    void Promise.resolve().then(() => loadProjects());
  }, [loadProjects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const value = useMemo(
    () => ({
      projects,
      selectedProject,
      selectedProjectId,
      canManageSelected: selectedProject?.isManaged ?? false,
      isSwitcherEnabled:
        permissionGroup !== null && PROJECT_SWITCHER_ROLES.includes(permissionGroup),
      isLoading,
      errorMessage,
      setSelectedProjectId,
      reloadProjects: loadProjects,
    }),
    [
      projects,
      selectedProject,
      selectedProjectId,
      permissionGroup,
      isLoading,
      errorMessage,
      setSelectedProjectId,
      loadProjects,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

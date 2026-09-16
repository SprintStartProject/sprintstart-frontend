import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * Nothing unconfirmed is ever published. A stored ID is read inside `loadProjects`, and the
 * imperative `setSelectedProjectId` validates against the loaded list — an ID it cannot
 * vouch for (a `?projectId=` deep link that arrived before the list loaded, or one the user
 * cannot reach at all) is parked unpublished until the next load can check it. Consumers
 * therefore never see a selection no list has vouched for.
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

  /*
    A requested project that cannot be confirmed right now — a `?projectId=` deep link that
    landed while the list was still loading, or one this user may not reach. It waits here,
    unpublished and unpersisted, until `loadProjects` can check it against a freshly loaded
    list. A ref, not state: nothing renders from it, and parking must not re-render consumers.
  */
  const requestedProjectIdRef = useRef("");

  const permissionGroup = profile?.permissionGroup ?? null;
  const userId = profile?.id ?? null;
  const isAuthenticated = status === "authenticated";

  const setSelectedProjectId = useCallback(
    (projectId: string) => {
      // The loaded list vouches for the ID: it can go out immediately, the same render that
      // confirms it. This is the only path a selection takes once the list has loaded — the
      // switcher only ever offers projects the list contains.
      if (projects.some((project) => project.id === projectId)) {
        requestedProjectIdRef.current = "";
        setSelectedProjectIdState(projectId);
        storeProjectId(userId ?? "", projectId);
        return;
      }

      // Not confirmable yet — the list is still loading, or the ID names a project this user
      // does not reach. Park it: `loadProjects` checks a parked ID against a freshly loaded
      // list and only publishes it if that list confirms it. The deep link is the legitimate
      // case here (it lands while the list is still loading); an unreachable one is silently
      // dropped, which keeps the user's current selection instead of switching them to
      // something they cannot actually open.
      requestedProjectIdRef.current = projectId;
    },
    [projects, userId],
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
      // A parked request belongs to the session that made it; without a session it must not
      // wait to be confirmed by the next person who signs in.
      requestedProjectIdRef.current = "";
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

      // A deep link that landed while the list was still loading is the strongest expression
      // of intent this session has — ahead of the session's current selection and the stored
      // one. Consumed exactly once: a later reload must not resurrect an abandoned request.
      const requestedProjectId = requestedProjectIdRef.current;
      requestedProjectIdRef.current = "";

      setSelectedProjectIdState((currentProjectId) => {
        // Read here rather than on mount: this is the first point at which the stored ID can
        // be checked against the projects this user actually reaches, and an unconfirmed ID
        // must not be published to the consumers that read the context.
        const storedProjectId = readStoredProjectId(userId);

        // A selection made in this session — a switcher pick, or a deep link the loaded list
        // has just confirmed — wins over the stored one, which is the fallback for a fresh
        // page load.
        const preferredProjectId = requestedProjectId || currentProjectId || storedProjectId;

        // The first preference the loaded list confirms, in intent order: the preferred ID,
        // then the session selection, then the stored one. A preferred ID the list cannot
        // confirm (an unreachable deep link, a deleted stored project) therefore falls back
        // to where the user actually was rather than to the alphabetically first project.
        const confirmedProjectId = [preferredProjectId, currentProjectId, storedProjectId].find(
          (candidateId) =>
            candidateId !== "" && sortedProjects.some((project) => project.id === candidateId),
        );

        const nextProjectId = confirmedProjectId ?? sortedProjects[0]?.id ?? "";

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

  // The safe gate consumers ask before anything scoped to a project. The setter above and the
  // resolution here guarantee a published ID is one `projects` contains, so this is false
  // exactly while nothing is selected: the list is still loading, or the user has none.
  const hasSelectedProject = selectedProject !== null;

  const value = useMemo(
    () => ({
      projects,
      selectedProject,
      selectedProjectId,
      hasSelectedProject,
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
      hasSelectedProject,
      permissionGroup,
      isLoading,
      errorMessage,
      setSelectedProjectId,
      loadProjects,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

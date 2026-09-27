import { useCallback, useState } from "react";
import { getProjectRoles, getSkills } from "../../../services/teamManagementService";
import type { ProjectRole, Skill } from "../../team-management/types";
import type { LoadingState } from "../types";

type UseSkillPoolResult = {
  skills: Skill[];
  roles: ProjectRole[];
  loadingState: LoadingState;
  errorMessage: string;
  /**
   * Loads the global skill pool and its project roles. A no-op after the first
   * successful load unless `force` is passed, so opening the Skills tab
   * repeatedly does not refetch on every visit -- only an explicit refresh does.
   */
  loadSkillPool: (force?: boolean) => Promise<void>;
  /** Inserts or replaces one skill after a create/update mutation, without a full reload. */
  upsertSkill: (skill: Skill) => void;
};

/**
 * Global skill pool for the Access Management "Skills" tab.
 *
 * Loaded lazily -- only once the tab is actually opened, the same way the
 * tokens section only fetches its PAT names once visited -- because every
 * other Access Management tab has no use for it and it would otherwise cost a
 * round trip on every page load.
 */
export function useSkillPool(): UseSkillPoolResult {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadSkillPool = useCallback(
    async (force = false) => {
      if (loaded && !force) return;

      setLoadingState("loading");
      setErrorMessage("");

      try {
        const [nextSkills, nextRoles] = await Promise.all([getSkills(), getProjectRoles()]);

        setSkills(nextSkills);
        setRoles(nextRoles);
        setLoadingState("success");
        setLoaded(true);
      } catch (error) {
        setLoadingState("error");
        setErrorMessage(error instanceof Error ? error.message : "Skills could not be loaded.");
      }
    },
    [loaded],
  );

  const upsertSkill = useCallback((skill: Skill) => {
    setSkills((current) => {
      const exists = current.some((existing) => existing.id === skill.id);

      return exists
        ? current.map((existing) => (existing.id === skill.id ? skill : existing))
        : [...current, skill];
    });
  }, []);

  return { skills, roles, loadingState, errorMessage, loadSkillPool, upsertSkill };
}

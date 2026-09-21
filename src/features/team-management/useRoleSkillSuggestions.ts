import { useCallback, useState } from "react";
import { ApiError } from "../../services/apiClient";
import { parseApiError } from "../../services/apiError";
import { suggestSkillsForRole } from "../../services/teamManagementService";
import type { Skill } from "./types";

export type RoleSkillSuggestionResult =
  { ok: true; skills: Skill[]; addedSkillIds: string[] } | { ok: false; message: string };

/** Runs the server-side role-skill suggestion and derives the session-local additions. */
export function useRoleSkillSuggestions() {
  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);

  const suggest = useCallback(
    async (roleId: string, currentSkillIds: string[]): Promise<RoleSkillSuggestionResult> => {
      setIsSuggesting(roleId);

      try {
        const skills = await suggestSkillsForRole(roleId);
        const existingIds = new Set(currentSkillIds);

        return {
          ok: true,
          skills,
          addedSkillIds: skills.filter((skill) => !existingIds.has(skill.id)).map(({ id }) => id),
        };
      } catch (error) {
        const isServiceUnavailable =
          error instanceof ApiError && (error.status === 502 || error.status === 503);

        return {
          ok: false,
          message: isServiceUnavailable
            ? "AI service unavailable. Try again in a moment."
            : parseApiError(error, "Could not suggest skills for this role."),
        };
      } finally {
        setIsSuggesting(null);
      }
    },
    [],
  );

  return { isSuggesting, suggest };
}

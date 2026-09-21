import { useCallback, useState } from "react";
import { ApiError } from "../../services/apiClient";
import { parseApiError } from "../../services/apiError";
import { suggestSkillsForRole } from "../../services/teamManagementService";
import type { SuggestSkillsContext } from "../../services/teamManagementService";
import type { SkillSuggestion } from "./types";

export type RoleSkillSuggestionResult =
  { ok: true; suggestions: SkillSuggestion[] } | { ok: false; message: string };

/** Requests non-persisted role-skill suggestions and normalizes service failures for the panel. */
export function useRoleSkillSuggestions() {
  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);

  const suggest = useCallback(
    async (roleId: string, context?: SuggestSkillsContext): Promise<RoleSkillSuggestionResult> => {
      setIsSuggesting(roleId);

      try {
        const suggestions = await suggestSkillsForRole(roleId, context);

        return {
          ok: true,
          suggestions,
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

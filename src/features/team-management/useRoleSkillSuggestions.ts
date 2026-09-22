import { useCallback, useRef, useState } from "react";
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
  // Identifies the most recently started request, so a slower, older request
  // resolving after a newer one cannot clear `isSuggesting` out from under it
  // -- e.g. suggesting for role A, switching to role B and suggesting there
  // too before A answers must leave B's spinner alone once A's late response
  // arrives.
  const latestRequestIdRef = useRef(0);

  const suggest = useCallback(
    async (roleId: string, context?: SuggestSkillsContext): Promise<RoleSkillSuggestionResult> => {
      const requestId = ++latestRequestIdRef.current;
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
        if (latestRequestIdRef.current === requestId) {
          setIsSuggesting(null);
        }
      }
    },
    [],
  );

  return { isSuggesting, suggest };
}

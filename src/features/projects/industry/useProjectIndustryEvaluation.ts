import { useCallback, useState } from "react";
import { ApiError } from "../../../services/apiClient";
import { parseApiError } from "../../../services/apiError";
import { projectService, type ProjectIndustryEvaluation } from "../../../services/projectService";

export type ProjectIndustryEvaluationResult =
  { ok: true; evaluation: ProjectIndustryEvaluation } | { ok: false; message: string };

/**
 * Owns one project's industry (re-)evaluation call.
 *
 * `lastEvaluation` (evidence included) is session-local only — the backend
 * does not persist the evidence list, so there is nothing to show before this
 * session's first successful call.
 */
export function useProjectIndustryEvaluation(projectId: string) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<ProjectIndustryEvaluation | null>(null);

  const evaluate = useCallback(async (): Promise<ProjectIndustryEvaluationResult> => {
    setIsEvaluating(true);

    try {
      const evaluation = await projectService.evaluateProjectIndustry(projectId);
      setLastEvaluation(evaluation);
      return { ok: true, evaluation };
    } catch (error) {
      const isServiceUnavailable =
        error instanceof ApiError && (error.status === 502 || error.status === 503);

      return {
        ok: false,
        message: isServiceUnavailable
          ? "AI service unavailable. Try again in a moment."
          : parseApiError(error, "Could not evaluate the project's industry."),
      };
    } finally {
      setIsEvaluating(false);
    }
  }, [projectId]);

  return { isEvaluating, lastEvaluation, evaluate };
}

import { apiClient } from "./apiClient";
import type { Finding, FindingSeverity } from "../features/pm-area/analysis/findings";

/** One of an analysis's checks as it ended, kept so a stored run can say which check failed. */
export type ProjectAnalysisRunTask = {
  id: Finding["area"];
  label: string;
  status: string;
  note?: string;
};

/** One finished project analysis, as the backend keeps it. */
export type ProjectAnalysisRun = {
  id: string;
  at: string;
  /** `null` when a check could not run — see `failedChecks`. */
  score: number | null;
  /** Derived by the backend from `findings`. */
  counts: Record<FindingSeverity, number>;
  /** Derived by the backend from `tasks`. Anything above 0 means the run has no score. */
  failedChecks: number;
  findings: Finding[];
  tasks: ProjectAnalysisRunTask[];
};

/** What the client sends for a finished run; the backend derives the counts itself. */
export type SaveProjectAnalysisRun = Pick<ProjectAnalysisRun, "score" | "findings" | "tasks">;

function runsUrl(projectId: string): string {
  return `/api/v1/insights/project-analysis/runs?projectId=${encodeURIComponent(projectId)}`;
}

/**
 * The history of a project's analyses, kept per project on the backend so the score and "since
 * the last run" follow the project to every device and every PM of it.
 *
 * No mock fallback: a made-up history would compare a real run with a score nobody ever saw.
 * Failures propagate; the analysis decides what an unreachable history means for it.
 */
export const projectAnalysisService = {
  /**
   * Returns the newest runs of a project, newest first. An empty list means it was never analysed.
   *
   * @param limit How many runs to return; the backend clamps it to 1–50.
   */
  async listRuns(projectId: string, limit = 10): Promise<ProjectAnalysisRun[]> {
    return await apiClient.fetch<ProjectAnalysisRun[]>(`${runsUrl(projectId)}&limit=${limit}`);
  },

  /**
   * Stores a finished run and returns it as kept, with its counts.
   *
   * Rejected with 400 when the run has a score although one of its checks failed — the client
   * never sends that, the backend only makes sure of it.
   */
  async saveRun(projectId: string, run: SaveProjectAnalysisRun): Promise<ProjectAnalysisRun> {
    return await apiClient.fetch<ProjectAnalysisRun>(runsUrl(projectId), {
      method: "POST",
      body: JSON.stringify(run),
    });
  },
};

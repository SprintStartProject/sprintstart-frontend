import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/useAuth";
import { insightsService } from "../../../services/faqService";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { projectService } from "../../../services/projectService";
import { queryKeys } from "../../../services/queryKeys";
import {
  getTeamOverview,
  getUserOnboardingFeedback,
  type OnboardingFeedback,
} from "../../../services/teamManagementService";
import { fetchIngestionSources } from "../../data-ingestion/ingestionSources";
import { useProjectContext } from "../../projects/useProjectContext";
import { isUnread } from "../useMemberOpenItems";
import {
  buildFindings,
  countBySeverity,
  healthScore,
  type AnalysisIndustry,
  type Finding,
  type FindingArea,
  type FindingSeverity,
} from "./findings";

export type AnalysisTaskStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type AnalysisTask = {
  id: FindingArea;
  label: string;
  status: AnalysisTaskStatus;
  /** What the task did, in a few words: "Rescanned · 3 gaps", "Kept your industry". */
  note?: string;
};

/** The three refreshes that ask the AI to redo work; everything else is re-read either way. */
export type AnalysisOptions = {
  rescanGaps: boolean;
  reevaluateIndustry: boolean;
  /** Destructive — replaces the FAQ's entries — so it is never on by default. */
  regroupQuestions: boolean;
};

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  rescanGaps: true,
  reevaluateIndustry: true,
  regroupQuestions: false,
};

/** One finished analysis, as remembered for the next one to compare against. */
export type AnalysisRunSummary = {
  at: string;
  score: number;
  counts: Record<FindingSeverity, number>;
};

export type AnalysisPhase = "idle" | "running" | "done";

const TASKS: readonly Pick<AnalysisTask, "id" | "label">[] = [
  { id: "team", label: "Team & open items" },
  { id: "onboarding", label: "Onboarding metrics" },
  { id: "escalations", label: "Escalation inbox" },
  { id: "questions", label: "Recurring questions" },
  { id: "gaps", label: "Knowledge gaps" },
  { id: "ingestion", label: "Data sources" },
  { id: "industry", label: "Industry" },
];

/**
 * How long each check shows as running at the least, and how far apart they finish. The reads
 * are often done in a few hundred milliseconds; without a floor the whole scan flashes past
 * before anyone can see what was looked at.
 */
const MIN_TASK_MS = 700;
const STAGGER_MS = 260;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function storageKey(viewerId: string, projectId: string) {
  return `sprintstart.pm-analysis.${viewerId}.${projectId}`;
}

function readLastRun(viewerId: string, projectId: string): AnalysisRunSummary | null {
  if (!projectId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(viewerId, projectId));
    return raw ? (JSON.parse(raw) as AnalysisRunSummary) : null;
  } catch {
    // Storage off or unreadable (private window, blocked site data): no comparison, no harm.
    return null;
  }
}

function writeLastRun(viewerId: string, projectId: string, run: AnalysisRunSummary) {
  try {
    window.localStorage.setItem(storageKey(viewerId, projectId), JSON.stringify(run));
  } catch {
    // See `readLastRun`: remembering the last score is a convenience, never a requirement.
  }
}

function errorNote(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Could not be read";
}

/**
 * Runs a project analysis: every refresh the PM area offers, at once, then one list of what the
 * results say.
 *
 * Every read goes through the shared query cache (`fetchQuery` with `staleTime: 0`), so the cards
 * on the overview update in the same moment the analysis finishes — the analysis does not keep a
 * private copy that could disagree with them. The AI refreshes are opt-in per run (see
 * {@link AnalysisOptions}); the industry is never re-evaluated over one a person set by hand.
 *
 * The last finished run's score is kept per viewer and project in browser storage, only so the
 * next run can say whether things got better.
 */
export function useProjectAnalysis() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { selectedProjectId: projectId, selectedProject } = useProjectContext();
  const viewerId = profile?.id ?? "";

  const canEvaluateIndustry =
    profile?.permissionGroup === "ADMIN" || (selectedProject?.isManaged ?? false);

  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [tasks, setTasks] = useState<AnalysisTask[]>(() =>
    TASKS.map((task) => ({ ...task, status: "pending" })),
  );
  const [findings, setFindings] = useState<Finding[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<AnalysisRunSummary | null>(() =>
    readLastRun(viewerId, projectId),
  );
  /** The run before the current one — what the results compare against. */
  const [previousRun, setPreviousRun] = useState<AnalysisRunSummary | null>(null);
  /** Bumped when the industry was re-evaluated, for the industry card to read it again. */
  const [industryRevision, setIndustryRevision] = useState(0);

  // Only the newest run may write: a project switch or a second run makes an older one moot.
  const runRef = useRef(0);

  // A different project (or viewer) has a different last run; one in flight belongs to the old one.
  useEffect(() => {
    runRef.current += 1;
    void Promise.resolve().then(() => {
      setLastRun(readLastRun(viewerId, projectId));
      setPhase("idle");
      setFindings([]);
      setScore(null);
    });
  }, [viewerId, projectId]);

  const run = useCallback(
    async (options: AnalysisOptions) => {
      if (!projectId) return;
      const runId = ++runRef.current;
      const current = () => runRef.current === runId;

      setPhase("running");
      setFindings([]);
      setScore(null);
      setPreviousRun(readLastRun(viewerId, projectId));
      setTasks(TASKS.map((task) => ({ ...task, status: "pending" })));

      const update = (id: FindingArea, patch: Partial<AnalysisTask>) => {
        if (!current()) return;
        setTasks((all) => all.map((task) => (task.id === id ? { ...task, ...patch } : task)));
      };

      async function check<T>(
        id: FindingArea,
        work: () => Promise<{ value: T; note?: string; skipped?: boolean }>,
      ): Promise<T | null> {
        const index = TASKS.findIndex((task) => task.id === id);
        update(id, { status: "running" });
        const floor = sleep(MIN_TASK_MS + index * STAGGER_MS);
        try {
          const [result] = await Promise.all([work(), floor]);
          update(id, { status: result.skipped ? "skipped" : "done", note: result.note });
          return result.value;
        } catch (error) {
          await floor;
          update(id, { status: "failed", note: errorNote(error) });
          return null;
        }
      }

      const fresh = <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
        queryClient.fetchQuery({ queryKey, queryFn, staleTime: 0 });

      const [team, onboarding, escalations, faq, gaps, sources, industry] = await Promise.all([
        check("team", async () => {
          const roster = await fresh(queryKeys.teamOverview.filtered(projectId), () =>
            getTeamOverview(undefined, undefined, [projectId]),
          );
          const flagged = roster.filter((member) => member.hasFeedback);
          const feedback = await Promise.allSettled(
            flagged.map((member) =>
              fresh(queryKeys.memberFeedback.byUser(member.userId), () =>
                getUserOnboardingFeedback(member.userId),
              ),
            ),
          );
          const feedbackByUser: Record<string, OnboardingFeedback[]> = {};
          feedback.forEach((result, index) => {
            if (result.status === "fulfilled") feedbackByUser[flagged[index].userId] = result.value;
          });
          const unread = Object.values(feedbackByUser).flat().filter(isUnread).length;
          return {
            value: { roster, feedbackByUser },
            note: `${roster.length} members · ${unread} unread`,
          };
        }),
        check("onboarding", async () => {
          const [metrics, attention] = await Promise.all([
            fresh(queryKeys.onboardingMetrics.project(projectId), () =>
              onboardingMetricsService.fetchProjectMetrics(projectId),
            ),
            fresh(queryKeys.attention.byProject(projectId), () =>
              onboardingMetricsService.fetchAttention(projectId),
            ),
          ]);
          return { value: { metrics, attention }, note: `${metrics.memberCount} hires` };
        }),
        check("escalations", async () => {
          const open = await fresh(queryKeys.knowledgeRequest.open(projectId), () =>
            knowledgeRequestService.listOpen(projectId),
          );
          void queryClient.invalidateQueries({
            queryKey: queryKeys.knowledgeRequest.openCount(projectId),
          });
          return { value: open, note: `${open.length} open` };
        }),
        check("questions", async () => {
          let regrouped: number | null = null;
          if (options.regroupQuestions) {
            regrouped = (await insightsService.refreshFAQGroups(projectId)).groupCount;
          }
          const overview = await fresh(queryKeys.faq.groups(projectId), () =>
            insightsService.fetchFAQGroups(projectId),
          );
          return {
            value: overview,
            note:
              regrouped !== null
                ? `Regrouped · ${regrouped} questions`
                : `${overview.groups.length} tracked`,
          };
        }),
        check("gaps", async () => {
          let rescanned = false;
          if (options.rescanGaps) {
            await knowledgeGapService.refreshKnowledgeGaps(projectId);
            rescanned = true;
          }
          const overview = await fresh(queryKeys.knowledgeGaps.overview(projectId), () =>
            knowledgeGapService.fetchKnowledgeGaps(projectId),
          );
          const open = overview.gaps.filter((gap) => gap.severity !== "covered").length;
          return { value: overview, note: `${rescanned ? "Rescanned · " : ""}${open} open` };
        }),
        check("ingestion", async () => {
          const list = await fresh(queryKeys.ingestion.sourceStatuses(projectId), () =>
            fetchIngestionSources(projectId),
          );
          return {
            value: list.map((source) => ({
              name: source.name,
              errors: source.errors,
              lastRunAt: source.lastRunAt,
              backendStatus: source.backendStatus,
            })),
            note: `${list.length} sources`,
          };
        }),
        check("industry", async () => {
          const before = await projectService.getAccessibleProject(projectId);
          const toIndustry = (
            project: typeof before,
            previous?: string | null,
          ): AnalysisIndustry => ({
            industry: project.industry,
            confidence: project.industryConfidence,
            custom: project.industryCustom,
            ...(previous !== undefined ? { previous } : {}),
          });

          if (!options.reevaluateIndustry || !canEvaluateIndustry) {
            return { value: toIndustry(before), note: "Checked", skipped: false };
          }
          // A person's choice outranks the model's: never evaluate over a hand-set industry.
          if (before.industryCustom) {
            return { value: toIndustry(before), note: "Kept your hand-set industry" };
          }
          await projectService.evaluateProjectIndustry(projectId);
          const after = await projectService.getAccessibleProject(projectId);
          if (current()) setIndustryRevision((revision) => revision + 1);
          return {
            value: toIndustry(after, before.industry || null),
            note: after.industry ? `Re-evaluated · ${after.industry}` : "Re-evaluated",
          };
        }),
      ]);

      if (!current()) return;

      const result = buildFindings({
        roster: team?.roster ?? null,
        feedbackByUser: team?.feedbackByUser ?? {},
        metrics: onboarding?.metrics ?? null,
        attention: onboarding?.attention ?? null,
        escalations,
        faq,
        gaps,
        sources,
        industry,
      });
      const nextScore = healthScore(result);
      const summary: AnalysisRunSummary = {
        at: new Date().toISOString(),
        score: nextScore,
        counts: countBySeverity(result),
      };

      writeLastRun(viewerId, projectId, summary);
      setLastRun(summary);
      setFindings(result);
      setScore(nextScore);
      setPhase("done");
    },
    [canEvaluateIndustry, projectId, queryClient, viewerId],
  );

  const reset = useCallback(() => {
    runRef.current += 1;
    setPhase("idle");
  }, []);

  return {
    phase,
    tasks,
    findings,
    score,
    lastRun,
    previousRun,
    industryRevision,
    canEvaluateIndustry,
    run,
    reset,
  };
}

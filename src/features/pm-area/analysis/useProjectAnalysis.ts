import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/useAuth";
import { insightsService } from "../../../services/faqService";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import {
  projectAnalysisService,
  type ProjectAnalysisRun,
} from "../../../services/projectAnalysisService";
import { projectService } from "../../../services/projectService";
import { queryKeys } from "../../../services/queryKeys";
import {
  getTeamOverviewOrThrow,
  getUserOnboardingFeedback,
  type OnboardingFeedback,
} from "../../../services/teamManagementService";
import { fetchIngestionSources } from "../../data-ingestion/ingestionSources";
import { useProjectContext } from "../../projects/useProjectContext";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
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
  /** What the task did, in a few words: "7 members · 2 unread", "3 open". */
  note?: string;
  /** What the task is doing while it runs, in a sentence — shown under "Now checking". */
  activity?: string;
  /** Epoch millis, for the time a check took. */
  startedAt?: number;
  finishedAt?: number;
};

/** One line of the live log beside the scan: a check starting, finishing or failing. */
export type AnalysisLogEntry = {
  id: number;
  at: number;
  area: FindingArea;
  kind: "start" | "done" | "failed" | "skipped";
  text: string;
};

/** What each check does, in the words the "Now checking" block uses. */
function describeTask(id: FindingArea): string {
  switch (id) {
    case "team":
      return "Reading the roster, open skip requests and unread feedback";
    case "onboarding":
      return "Reading onboarding metrics — who is stalled, who waits on a review";
    case "escalations":
      return "Reading the questions the buddy passed on to a person";
    case "questions":
      return "Reading the recurring questions and what is on the rise";
    case "gaps":
      return "Reading the documentation gaps";
    case "ingestion":
      return "Checking every connected source's last sync";
    case "industry":
      return "Reading the project's industry";
  }
}

/** One finished analysis, as remembered for the next one to compare against. */
export type AnalysisRunSummary = {
  at: string;
  /** `null` when the run was incomplete — see `failedChecks`. */
  score: number | null;
  counts: Record<FindingSeverity, number>;
  /** How many checks could not run. Anything above 0 means the run has no score. */
  failedChecks: number;
};

/** The complete run the results compare against: the one before, or the last one with a score. */
export type AnalysisComparison = { at: string; score: number };

function summarise(run: ProjectAnalysisRun): AnalysisRunSummary {
  return {
    at: run.at,
    score: run.score,
    counts: run.counts,
    failedChecks: run.failedChecks,
  };
}

/**
 * What a run compares against: the newest complete run of [runs] (newest first). An incomplete
 * run is never a baseline — its score would not mean anything.
 */
function comparisonFor(runs: readonly ProjectAnalysisRun[]): AnalysisComparison | null {
  const complete = runs.find((run) => run.score !== null);
  return complete && complete.score !== null ? { at: complete.at, score: complete.score } : null;
}

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

/** "1 member", "7 members". */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function errorNote(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Could not be read";
}

/**
 * Runs a project analysis: every part of the PM area read again at once, then one list of what
 * the results say.
 *
 * Every read goes through the shared query cache (`fetchQuery` with `staleTime: 0`), so the cards
 * on the overview update in the same moment the analysis finishes — the analysis does not keep a
 * private copy that could disagree with them.
 *
 * It only reads. It used to offer to rescan the knowledge gaps, re-evaluate the industry and
 * regroup the questions with the AI, but the backend redoes the first two on its own after every
 * import and the knowledge gaps and FAQ pages have their own buttons for the rare manual case — so
 * the options cost an AI call per run and bought, as a rule, the same answer again. Gaps that are
 * behind the newest import show up as a finding instead (see `buildFindings`).
 *
 * Every finished run is kept per project on the backend (see `projectAnalysisService`): the last
 * one's results can be opened again later, on any device and by any PM of the project, and the
 * next run can say whether things got better since the last complete one.
 */
export function useProjectAnalysis() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { selectedProjectId: projectId } = useProjectContext();
  const viewerId = profile?.id ?? "";

  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [log, setLog] = useState<AnalysisLogEntry[]>([]);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [tasks, setTasks] = useState<AnalysisTask[]>(() =>
    TASKS.map((task) => ({ ...task, status: "pending" })),
  );
  const [findings, setFindings] = useState<Finding[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const { data: runs } = useQueryFetch(
    queryKeys.projectAnalysis.runs(projectId),
    () => projectAnalysisService.listRuns(projectId),
    { enabled: Boolean(projectId) },
  );
  const stored = runs?.[0] ?? null;
  const lastRun: AnalysisRunSummary | null = stored ? summarise(stored) : null;
  /** The complete run before the current one — what the results compare against. */
  const [previousRun, setPreviousRun] = useState<AnalysisComparison | null>(null);
  /**
   * Bumped whenever a run finishes, for the cards that keep their data outside the shared query
   * cache (the industry card) to read it again. Everything else refreshes through the cache.
   */
  const [refreshRevision, setRefreshRevision] = useState(0);

  // Only the newest run may write: a project switch or a second run makes an older one moot.
  const runRef = useRef(0);

  // A different project (or viewer) has a different last run; one in flight belongs to the old one.
  useEffect(() => {
    runRef.current += 1;
    void Promise.resolve().then(() => {
      setPhase("idle");
      setFindings([]);
      setScore(null);
    });
  }, [viewerId, projectId]);

  const run = useCallback(async () => {
    if (!projectId) return;
    const runId = ++runRef.current;
    const current = () => runRef.current === runId;

    setPhase("running");
    setFindings([]);
    setScore(null);
    const runsKey = queryKeys.projectAnalysis.runs(projectId);
    // The history as it stands before this run. Not being able to read it costs the comparison,
    // never the run.
    const history =
      queryClient.getQueryData<ProjectAnalysisRun[]>(runsKey) ??
      (await queryClient
        .fetchQuery({
          queryKey: runsKey,
          queryFn: () => projectAnalysisService.listRuns(projectId),
        })
        .catch(() => []));
    if (!current()) return;
    const before = comparisonFor(history);
    setPreviousRun(before);
    // This run's tasks as they progress, kept here as well as in state so the stored record can
    // be written from them once everything has settled.
    let runTasks: AnalysisTask[] = TASKS.map((task) => ({ ...task, status: "pending" }));
    setTasks(runTasks);
    setLog([]);
    setRunStartedAt(Date.now());
    let logId = 0;
    const addLog = (area: FindingArea, kind: AnalysisLogEntry["kind"], text: string) => {
      if (!current()) return;
      const entry = { id: ++logId, at: Date.now(), area, kind, text };
      setLog((entries) => [...entries, entry]);
    };

    const update = (id: FindingArea, patch: Partial<AnalysisTask>) => {
      if (!current()) return;
      runTasks = runTasks.map((task) => (task.id === id ? { ...task, ...patch } : task));
      setTasks(runTasks);
    };

    async function check<T>(
      id: FindingArea,
      work: () => Promise<{ value: T; note?: string; skipped?: boolean }>,
    ): Promise<T | null> {
      const label = TASKS.find((task) => task.id === id)?.label ?? id;
      if (!current()) return null;
      const activity = describeTask(id);
      update(id, { status: "running", activity, startedAt: Date.now() });
      addLog(id, "start", activity);
      try {
        const result = await work();
        const kind = result.skipped ? "skipped" : "done";
        update(id, { status: kind, note: result.note, finishedAt: Date.now() });
        addLog(id, kind, `${label}: ${result.note ?? "done"}`);
        return result.value;
      } catch (error) {
        const note = errorNote(error);
        update(id, { status: "failed", note, finishedAt: Date.now() });
        addLog(id, "failed", `${label} failed: ${note}`);
        return null;
      }
    }

    const fresh = <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
      queryClient.fetchQuery({ queryKey, queryFn, staleTime: 0 });

    const [team, onboarding, escalations, faq, gaps, sources, industry] = await Promise.all([
      check("team", async () => {
        // Never the forgiving `getTeamOverview`: its mock fallback would turn a failed read into
        // findings about people who do not exist.
        const roster = await fresh(queryKeys.teamOverview.filtered(projectId), () =>
          getTeamOverviewOrThrow([projectId]),
        );
        const flagged = roster.filter((member) => member.hasFeedback);
        const feedback = await Promise.allSettled(
          flagged.map((member) =>
            fresh(queryKeys.memberFeedback.byUser(member.userId), () =>
              getUserOnboardingFeedback(member.userId),
            ),
          ),
        );
        // A member whose feedback could not be read is not a member with nothing unread.
        const unreadable = feedback.filter((result) => result.status === "rejected").length;
        if (unreadable > 0) {
          throw new Error(`Feedback of ${count(unreadable, "member")} could not be read`);
        }
        const feedbackByUser: Record<string, OnboardingFeedback[]> = {};
        feedback.forEach((result, index) => {
          if (result.status === "fulfilled") feedbackByUser[flagged[index].userId] = result.value;
        });
        const unread = Object.values(feedbackByUser).flat().filter(isUnread).length;
        return {
          value: { roster, feedbackByUser },
          note: `${count(roster.length, "member")} · ${unread} unread`,
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
        return { value: { metrics, attention }, note: count(metrics.memberCount, "hire") };
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
        const overview = await fresh(queryKeys.faq.groups(projectId), () =>
          insightsService.fetchFAQGroups(projectId),
        );
        return { value: overview, note: `${overview.groups.length} tracked` };
      }),
      check("gaps", async () => {
        const overview = await fresh(queryKeys.knowledgeGaps.overview(projectId), () =>
          knowledgeGapService.fetchKnowledgeGaps(projectId),
        );
        const open = overview.gaps.filter((gap) => gap.severity !== "covered").length;
        return { value: overview, note: `${open} open` };
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
          note: count(list.length, "source"),
        };
      }),
      check("industry", async () => {
        const project = await projectService.getAccessibleProject(projectId);
        const industry: AnalysisIndustry = {
          industry: project.industry,
          confidence: project.industryConfidence,
          custom: project.industryCustom,
        };
        return { value: industry, note: project.industry || "Not determined" };
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
    const finishedTasks = runTasks;
    // A check that could not run made no findings, and the score only subtracts for findings —
    // so scoring anyway would read "could not look" as "nothing wrong", and the more checks
    // failed the better it would look. An incomplete run gets no score at all.
    const complete = finishedTasks.every((task) => task.status !== "failed");
    const nextScore = complete ? healthScore(result) : null;
    const storedTasks = finishedTasks.map(({ id, label, status, note }) => ({
      id,
      label,
      status,
      ...(note !== undefined ? { note } : {}),
    }));
    // What the backend will keep, in the same shape — used as is when it cannot be reached, so
    // the results can still be reopened in this session.
    const local: ProjectAnalysisRun = {
      id: `local-${runId}`,
      at: new Date().toISOString(),
      score: nextScore,
      counts: countBySeverity(result),
      failedChecks: finishedTasks.filter((task) => task.status === "failed").length,
      findings: result,
      tasks: storedTasks,
    };
    const saved = await projectAnalysisService
      .saveRun(projectId, { score: nextScore, findings: result, tasks: storedTasks })
      .catch((error: unknown) => {
        console.warn(
          "The project analysis could not be stored; it is kept for this session only",
          error,
        );
        return local;
      });
    if (!current()) return;
    queryClient.setQueryData<ProjectAnalysisRun[]>(runsKey, (old) => [saved, ...(old ?? [])]);

    setFindings(result);
    setScore(nextScore);
    setPhase("done");
    setRefreshRevision((revision) => revision + 1);
  }, [projectId, queryClient]);

  /** Whether the last run's results are there to be shown again. */
  const canOpenLast = stored !== null;

  /** Shows the last finished run's results again, as they were — nothing is re-read. */
  const openLast = useCallback(() => {
    if (!stored) return;
    runRef.current += 1;
    setFindings(stored.findings);
    setScore(stored.score);
    setTasks(
      TASKS.map((task) => {
        const saved = stored.tasks.find((candidate) => candidate.id === task.id);
        return {
          ...task,
          status: (saved?.status as AnalysisTaskStatus | undefined) ?? "done",
          note: saved?.note,
        };
      }),
    );
    setPreviousRun(comparisonFor(runs?.slice(1) ?? []));
    setPhase("done");
  }, [stored, runs]);

  const reset = useCallback(() => {
    runRef.current += 1;
    setPhase("idle");
  }, []);

  return {
    phase,
    tasks,
    /** The live log of the current run, oldest first. */
    log,
    /** When the current run started, epoch millis — for its elapsed time. */
    runStartedAt,
    findings,
    score,
    lastRun,
    /** When the results on screen were produced — now, or the stored run's time. */
    resultsAt: phase === "done" ? (stored?.at ?? null) : null,
    canOpenLast,
    openLast,
    previousRun,
    refreshRevision,
    run,
    reset,
  };
}

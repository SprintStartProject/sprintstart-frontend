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
  lastAnalysisKey,
  readRecord,
  useStoredRecord,
  type StoredAnalysis,
} from "./analysisStorage";
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

/** What each check does, in the words the "Now checking" block uses — depends on the options. */
function describeTask(id: FindingArea, options: AnalysisOptions): string {
  switch (id) {
    case "team":
      return "Reading the roster, open skip requests and unread feedback";
    case "onboarding":
      return "Reading onboarding metrics — who is stalled, who waits on a review";
    case "escalations":
      return "Reading the questions the buddy passed on to a person";
    case "questions":
      return options.regroupQuestions
        ? "Asking the AI to regroup every recurring question"
        : "Reading the recurring questions and what is on the rise";
    case "gaps":
      return options.rescanGaps
        ? "Asking the AI to rescan every component's documentation"
        : "Reading the documentation gaps";
    case "ingestion":
      return "Checking every connected source's last sync";
    case "industry":
      return options.reevaluateIndustry
        ? "Re-evaluating the project's industry with the AI"
        : "Reading the project's industry";
  }
}

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
const START_STAGGER_MS = 140;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "1 member", "7 members". */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
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
 * The last finished run is kept per viewer and project in browser storage (see
 * `analysisStorage`): its results can be opened again later, and the next run can say whether
 * things got better.
 */
export function useProjectAnalysis() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { selectedProjectId: projectId, selectedProject } = useProjectContext();
  const viewerId = profile?.id ?? "";

  const canEvaluateIndustry =
    profile?.permissionGroup === "ADMIN" || (selectedProject?.isManaged ?? false);

  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [log, setLog] = useState<AnalysisLogEntry[]>([]);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [tasks, setTasks] = useState<AnalysisTask[]>(() =>
    TASKS.map((task) => ({ ...task, status: "pending" })),
  );
  const [findings, setFindings] = useState<Finding[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const storageKey = projectId ? lastAnalysisKey(viewerId, projectId) : null;
  const [stored, writeStored] = useStoredRecord<StoredAnalysis>(storageKey);
  const lastRun: AnalysisRunSummary | null = stored
    ? { at: stored.at, score: stored.score, counts: stored.counts }
    : null;
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
      const before = readRecord<StoredAnalysis>(lastAnalysisKey(viewerId, projectId));
      setPreviousRun(before ? { at: before.at, score: before.score, counts: before.counts } : null);
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
        const index = TASKS.findIndex((task) => task.id === id);
        const label = TASKS[index].label;
        // Started a beat apart, so the log reads as a sequence rather than seven lines at once.
        await sleep(index * START_STAGGER_MS);
        if (!current()) return null;
        const activity = describeTask(id, options);
        update(id, { status: "running", activity, startedAt: Date.now() });
        addLog(id, "start", activity);
        const floor = sleep(MIN_TASK_MS + index * STAGGER_MS);
        try {
          const [result] = await Promise.all([work(), floor]);
          const kind = result.skipped ? "skipped" : "done";
          update(id, { status: kind, note: result.note, finishedAt: Date.now() });
          addLog(id, kind, `${label}: ${result.note ?? "done"}`);
          return result.value;
        } catch (error) {
          await floor;
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
            note: count(list.length, "source"),
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
      const finishedTasks = runTasks;
      const record: StoredAnalysis = {
        at: new Date().toISOString(),
        score: nextScore,
        counts: countBySeverity(result),
        findings: result,
        tasks: finishedTasks,
        previous: before ? { at: before.at, score: before.score } : null,
      };

      writeStored(record);
      setFindings(result);
      setScore(nextScore);
      setPhase("done");
    },
    [canEvaluateIndustry, projectId, queryClient, viewerId, writeStored],
  );

  /** Whether the last run's results (not only its score) are there to be shown again. */
  const canOpenLast = Boolean(stored?.findings);

  /** Shows the last finished run's results again, as they were — nothing is re-read. */
  const openLast = useCallback(() => {
    if (!stored?.findings) return;
    runRef.current += 1;
    setFindings(stored.findings);
    setScore(stored.score);
    setTasks(
      TASKS.map((task) => {
        const saved = stored.tasks?.find((candidate) => candidate.id === task.id);
        return {
          ...task,
          status: (saved?.status as AnalysisTaskStatus | undefined) ?? "done",
          note: saved?.note,
        };
      }),
    );
    setPreviousRun(
      stored.previous
        ? {
            at: stored.previous.at,
            score: stored.previous.score,
            counts: { critical: 0, warning: 0, info: 0, good: 0 },
          }
        : null,
    );
    setPhase("done");
  }, [stored]);

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
    industryRevision,
    canEvaluateIndustry,
    run,
    reset,
  };
}

// ============================================================
// OnBoardingItemPage.tsx
// ============================================================

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { centralSpringToken } from "../../../styles/tokens";
import type {
  OnboardingStepDetail,
  OnboardingTaskEndpoint,
  OnboardingResourceEndpoint,
  StepStatus,
} from "../types";
import { onboardingService } from "../../../services/onboardingService";
import { useToast } from "../../../context/useToast";
import { Button } from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/Textarea";
import { StepOriginBadge } from "./StepOriginBadge";
import { TaskCheckItem } from "./TaskCheckItem";
import { useMoments } from "../../moments";

import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Target,
  ExternalLink,
  MessageSquareCheck,
  Loader2,
  AlertCircle,
  Trophy,
  CircleArrowRight,
  ClipboardCheck,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

type LoadingState = "idle" | "loading" | "success" | "error";

/**
 * Where the user goes once this step is behind them.
 *
 * Resolved from the path rather than assumed, because "next" is not always another step:
 * clearing the last step of a phase leaves its knowledge check as the only thing standing
 * between the user and the rest of their journey.
 */
type NextAction =
  | {
      kind: "step";
      stepId: string;
      /**
       * True when the step has never been started. The rocket marks a
       * *beginning*, and the lookup above also admits already-in-progress
       * steps -- picking a half-finished one back up is a return, not a
       * departure.
       */
      isFirstStart: boolean;
    }
  | { kind: "check"; phaseId: string }
  | { kind: "done" };

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

/**
 * Detail view for a specific onboarding step.
 *
 * This component is responsible for:
 * - Fetching detailed step data, tasks, and resources on mount.
 * - Managing local completion state for individual tasks.
 * - Handling step skipping and feedback submission.
 * - Synchronizing progress updates with the backend `onboardingService`.
 */
export function OnBoardingItemPage() {
  const { stepId } = useParams<{ stepId: string }>();
  const navigate = useNavigate();

  const [stepDetail, setStepDetail] = useState<OnboardingStepDetail | null>(null);
  const [tasks, setTasks] = useState<OnboardingTaskEndpoint[]>([]);
  const [resources, setResources] = useState<OnboardingResourceEndpoint[]>([]);

  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [skipReason, setSkipReason] = useState<string>("");
  const toast = useToast();
  const [skipLoading, setSkipLoading] = useState<boolean>(false);

  // Ticks every 60s so the "time on step" display stays current while a step is open.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [feedbackHelpful, setFeedbackHelpful] = useState<boolean | null>(null);
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  const [localFinished, setLocalFinished] = useState<Set<string>>(new Set());

  const [nextLoading, setNextLoading] = useState<boolean>(false);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);

  const currentStepId = stepDetail?.id;
  const currentPhaseId = stepDetail?.phaseId;
  const currentStatus = stepDetail?.status;

  const { flyby } = useMoments();

  /**
   * Works out what comes after this step, once the step is behind the user.
   *
   * Resolved up front rather than on click so the button can say where it leads. A locked
   * phase is never a candidate: while this phase's knowledge check is unpassed the next
   * phase stays locked, and its steps are not reachable yet.
   */
  useEffect(() => {
    if (!currentStepId || !currentPhaseId) return;
    if (currentStatus !== "FINISHED" && currentStatus !== "SKIPPED") return;

    const resolveNextAction = async () => {
      try {
        const path = await onboardingService.fetchPath();

        const nextStep = path.phases
          .filter((phase) => !phase.locked)
          .flatMap((phase) => phase.steps)
          .find(
            (step) =>
              step.id !== currentStepId && step.status !== "FINISHED" && step.status !== "SKIPPED",
          );
        if (nextStep) {
          setNextAction({
            kind: "step",
            stepId: nextStep.id,
            isFirstStart: nextStep.status === "WAITING",
          });
          return;
        }

        // No reachable step left: either this phase's own check is what blocks the way,
        // or the whole journey is done.
        const ownPhase = path.phases.find((phase) => phase.id === currentPhaseId);
        setNextAction(
          ownPhase?.checkSummary?.required && !ownPhase.checkSummary.passed
            ? { kind: "check", phaseId: ownPhase.id }
            : { kind: "done" },
        );
      } catch (err) {
        console.error("Failed to resolve the next onboarding action:", err);
      }
    };

    void resolveNextAction();
  }, [currentStepId, currentPhaseId, currentStatus]);

  /**
   * Follows [nextAction]: starts and opens the next step, or returns to the overview —
   * pointing it at the pending knowledge check when that is what is waiting.
   */
  const goToNextStep = async (): Promise<void> => {
    if (!nextAction) return;

    if (nextAction.kind !== "step") {
      void navigate("/onboarding", {
        state: nextAction.kind === "check" ? { focusCheckPhaseId: nextAction.phaseId } : undefined,
      });
      return;
    }

    setNextLoading(true);
    try {
      await onboardingService.startStep(nextAction.stepId);
      if (nextAction.isFirstStart) flyby();
    } catch (err) {
      console.error("Failed to start next onboarding step:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't start the step.");
    } finally {
      setNextLoading(false);
    }
    void navigate(`/onboarding/${nextAction.stepId}`);
  };

  const updateStepStatus = async (newStatus: StepStatus) => {
    if (!stepDetail) return;
    try {
      await onboardingService.updateStepStatus(stepDetail, newStatus);
      setStepDetail((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (err) {
      console.error("Error updating step:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't update the step.");
    }
  };

  const updateTaskFinished = async (taskId: string, finished: boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      await onboardingService.updateTask(task, finished);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, finished } : t)));
      setLocalFinished((prev) => {
        const next = new Set(prev);
        if (finished) {
          next.add(taskId);
        } else {
          next.delete(taskId);
        }
        return next;
      });
    } catch (err) {
      console.error("Error updating task:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't update the task.");
    }
  };

  /**
   * Data Fetching Effect: Loads the full hierarchy of a step (details, tasks, resources).
   * It also initializes the local 'finished' state for tasks based on the fetched data.
   */
  useEffect(() => {
    if (!stepId) return;

    const load = async (): Promise<void> => {
      setLoadingState("loading");
      setErrorMessage("");

      try {
        const step = await onboardingService.fetchStep(stepId);
        setStepDetail(step);
        if (step.feedback) {
          setFeedbackHelpful(step.feedback.helpful);
          setFeedbackComment(step.feedback.comment ?? "");
          setFeedbackSubmitted(true);
        }
        setSkipReason(step.skip?.reason ?? "");

        const fetchedTasks = await onboardingService.fetchTasks(stepId);
        setTasks(fetchedTasks);

        const fetchedResources = await onboardingService.fetchResources(stepId);
        setResources(fetchedResources);

        const alreadyDone = new Set(
          fetchedTasks.filter((task) => task.finished).map((task) => task.id),
        );
        setLocalFinished(alreadyDone);

        setLoadingState("success");
      } catch (err) {
        setLoadingState("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    };

    void load();
  }, [stepId]);

  // ── SKIP ──────────────────────────────────────────────────
  const skipCurrentStep = async (): Promise<void> => {
    if (!stepDetail) return;
    const reason = skipReason.trim();
    if (!reason) return;

    setSkipLoading(true);
    try {
      const created = await onboardingService.skipStep(stepDetail, reason);
      // The create-skip response is status-based; the step-detail skip block is
      // accepted-based (null = still pending), so map it into that shape.
      setStepDetail((prev) =>
        prev
          ? {
              ...prev,
              skip: {
                id: created.id,
                stepId: created.stepId,
                reason: created.reason,
                accepted: null,
                reviewComment: created.reviewComment,
                reviewedAt: null,
              },
            }
          : prev,
      );
      toast.success("Skip request submitted");
    } catch (err) {
      console.error("Error skipping step:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't submit the skip request.");
    } finally {
      setSkipLoading(false);
    }
  };

  const submitFeedback = async (): Promise<void> => {
    if (!stepDetail || feedbackHelpful === null || !feedbackComment.trim()) return;
    setFeedbackLoading(true);
    try {
      await onboardingService.submitFeedback(stepDetail.id, feedbackHelpful, feedbackComment);
      setFeedbackSubmitted(true);
      toast.success("Feedback submitted");
    } catch (err) {
      console.error("Error submitting feedback:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't submit your feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const toggleTask = (taskId: string): void => {
    const isCurrentlyDone = localFinished.has(taskId);
    void updateTaskFinished(taskId, !isCurrentlyDone);
  };

  // ── DERIVED ───────────────────────────────────────────────
  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const doneTasks = sortedTasks.filter((t) => localFinished.has(t.id)).length;
  // The step-detail skip block exposes `accepted` (null = pending review).
  const hasPendingSkipRequest = stepDetail?.skip ? stepDetail.skip.accepted === null : false;
  const allTasksDone = sortedTasks.length === 0 || doneTasks === sortedTasks.length;
  const taskPercentage =
    sortedTasks.length > 0 ? Math.round((doneTasks / sortedTasks.length) * 100) : 0;

  // ── LOADING ───────────────────────────────────────────────
  if (loadingState === "loading" || loadingState === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading step...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────
  if (loadingState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-danger-solid" />
          <h2 className="mb-2 text-lg font-semibold text-app-text">Could not load step</h2>
          <p className="mb-6 text-sm text-app-text-muted">{errorMessage}</p>
          <Button variant="primary" onClick={() => void navigate("/onboarding")}>
            Back to Onboarding Overview
          </Button>
        </div>
      </div>
    );
  }

  // ── EMPTY ─────────────────────────────────────────────────
  if (!stepDetail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <div className="text-center">
          <p className="mb-4 text-sm text-app-text-muted">Step not found.</p>
          <Button variant="primary" onClick={() => void navigate("/onboarding")}>
            Back to Onboarding Overview
          </Button>
        </div>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app-bg">
      {/* HEADER */}
      <section
        aria-label="Page header"
        className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl"
      >
        <div className="app-page-content py-4">
          <button
            onClick={() => void navigate("/onboarding")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-app-text-muted transition-all hover:text-app-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Onboarding Overview
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Status-Badge */}
              <div
                className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                  stepDetail.status === "FINISHED"
                    ? "bg-app-success-bg text-app-success-text"
                    : stepDetail.status === "IN_PROGRESS"
                      ? "bg-app-warning-bg text-app-warning-text"
                      : stepDetail.status === "SKIPPED"
                        ? "bg-app-neutral-bg text-app-text-muted"
                        : "bg-app-brand-soft text-app-brand-text"
                }`}
              >
                {stepDetail.status === "FINISHED"
                  ? "Finished"
                  : stepDetail.status === "IN_PROGRESS"
                    ? "In Progress"
                    : stepDetail.status === "SKIPPED"
                      ? "Skipped"
                      : "Open"}
              </div>

              <h1 className="text-2xl font-bold text-app-text sm:text-3xl">{stepDetail.title}</h1>
              <div className="mt-3">
                <StepOriginBadge step={stepDetail} />
              </div>
              <p className="mt-2 text-sm text-app-text-muted">{stepDetail.description}</p>
            </div>

            {stepDetail.estimatedMinutes > 0 && (
              <div className="hidden shrink-0 items-center gap-2 rounded-xl bg-app-surface-muted px-3 py-2 text-sm text-app-text-muted sm:flex">
                <Clock3 className="h-4 w-4" />
                {formatMinutes(stepDetail.estimatedMinutes)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <main className="app-page-content py-6 pb-24">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN */}
          <div className="space-y-6 lg:col-span-2">
            {/* Expected Outcomes */}
            {stepDetail.expectedOutcomes && stepDetail.expectedOutcomes.length > 0 && (
              <div className="rounded-2xl border border-app-border bg-app-surface p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-app-brand" />
                  <h2 className="font-semibold text-app-text">Expected Outcomes</h2>
                </div>
                <ul className="space-y-3">
                  {stepDetail.expectedOutcomes.map((outcome, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-app-success-solid" />
                      <span className="text-sm text-app-text">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* TASKS (Step by Step) */}
            {sortedTasks.length > 0 && (
              <div className="rounded-2xl border border-app-border bg-app-surface p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-app-warning-solid" />
                    <h2 className="font-semibold text-app-text">Tasks</h2>
                  </div>
                  <span className="text-xs text-app-text-muted">
                    {doneTasks}/{sortedTasks.length} completed
                  </span>
                </div>

                {/* Progress Bar. Sprung rather than tweened so it overshoots a
                    hair on each tick — the bar reacts to the click instead of
                    catching up to it half a second later. */}
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-app-border-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end"
                    initial={false}
                    animate={{ width: `${taskPercentage}%` }}
                    transition={centralSpringToken}
                  />
                </div>

                <div className="space-y-3">
                  {sortedTasks.map((task, index) => (
                    <TaskCheckItem
                      key={task.id}
                      index={index}
                      title={task.title}
                      description={task.description}
                      isDone={localFinished.has(task.id)}
                      onToggle={() => toggleTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* mark step as done */}
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <h3 className="mb-3 text-sm font-semibold text-app-text">Complete Step</h3>
              <button
                onClick={() =>
                  stepDetail.status === "FINISHED" ? undefined : void updateStepStatus("FINISHED")
                }
                disabled={stepDetail.status === "FINISHED" || !allTasksDone}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-200 ${
                  stepDetail.status === "FINISHED"
                    ? "cursor-default border-app-success-border bg-app-success-bg text-app-success-text"
                    : allTasksDone
                      ? "border-dashed border-app-border-strong text-app-text-muted hover:border-app-brand-border-strong hover:text-app-brand"
                      : "cursor-not-allowed border-dashed border-app-border text-app-text-disabled"
                }`}
              >
                {stepDetail.status === "FINISHED" ? (
                  <Trophy className="h-5 w-5 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0" />
                )}
                <span className="flex-1 text-left text-sm font-medium">
                  {stepDetail.status === "FINISHED"
                    ? "Finished!"
                    : allTasksDone
                      ? "Mark as Completed"
                      : `Still ${sortedTasks.length - doneTasks} task${sortedTasks.length - doneTasks === 1 ? "" : "s"} pending`}
                </span>
              </button>

              {/* Once this step is behind the user (finished or skipped),
                  jump straight to the next pending step. */}
              {(stepDetail.status === "FINISHED" || stepDetail.status === "SKIPPED") && (
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => void goToNextStep()}
                  disabled={!nextAction}
                  loading={nextLoading}
                  trailingIcon={
                    nextLoading ? undefined : nextAction?.kind === "check" ? (
                      <ClipboardCheck className="h-4 w-4" />
                    ) : (
                      <CircleArrowRight className="h-4 w-4" />
                    )
                  }
                  className="mt-3"
                >
                  {nextLoading || !nextAction
                    ? "Loading..."
                    : nextAction.kind === "check"
                      ? "Start knowledge check"
                      : nextAction.kind === "done"
                        ? "Back to overview"
                        : "Continue to next step"}
                </Button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* STATUS */}
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <h3 className="mb-3 text-sm font-semibold text-app-text">Status</h3>
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  stepDetail.status === "FINISHED"
                    ? "bg-app-success-bg text-app-success-text"
                    : stepDetail.status === "SKIPPED"
                      ? "bg-app-danger-bg text-app-danger-text"
                      : "bg-app-surface-muted text-app-text-muted"
                }`}
              >
                {stepDetail.status === "FINISHED" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : stepDetail.status === "SKIPPED" ? (
                  <CircleArrowRight className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {stepDetail.status === "FINISHED"
                  ? "Finished"
                  : stepDetail.status === "IN_PROGRESS"
                    ? "In Progress"
                    : stepDetail.status === "SKIPPED"
                      ? "Skipped"
                      : "Open"}
              </div>
              {stepDetail.status === "FINISHED" && stepDetail.completedAt && (
                <p className="mt-3 text-xs text-app-text-muted">
                  Completed on{" "}
                  {new Date(stepDetail.completedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
              {stepDetail.startedAt && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-app-text-muted">
                  <Clock3 className="h-3.5 w-3.5" />
                  {stepDetail.status === "FINISHED" || stepDetail.status === "SKIPPED"
                    ? "Time spent: "
                    : "Time on step: "}
                  {formatMinutes(
                    Math.max(
                      0,
                      Math.floor(
                        ((stepDetail.completedAt
                          ? new Date(stepDetail.completedAt).getTime()
                          : now) -
                          new Date(stepDetail.startedAt).getTime()) /
                          60000,
                      ),
                    ),
                  )}
                </p>
              )}
            </div>

            {/* RESOURCES */}
            {resources.length > 0 && (
              <div className="rounded-2xl border border-app-border bg-app-surface p-5">
                <h3 className="mb-3 text-sm font-semibold text-app-text">Resources</h3>
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between rounded-xl border border-app-border p-3 transition-all hover:border-app-brand-border-strong"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-app-text">
                          {resource.title}
                        </p>
                        {resource.description && (
                          <p className="mt-0.5 truncate text-xs text-app-text-subtle">
                            {resource.description}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="ml-2 h-4 w-4 shrink-0 text-app-text-subtle transition-all group-hover:text-app-brand" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/*SKIP STEP */}
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-app-text">
                <CircleArrowRight className="h-4 w-4 text-app-danger-solid" />
                Skip Step
              </h3>
              <Textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Reason for skipping..."
                aria-label="Reason for skipping"
                minRows={3}
                maxRows={10}
                disabled={skipLoading || stepDetail.status === "SKIPPED" || hasPendingSkipRequest}
              />
              <Button
                variant="primary"
                className="mt-3"
                onClick={() => void skipCurrentStep()}
                loading={skipLoading}
                disabled={
                  !skipReason.trim() || stepDetail.status === "SKIPPED" || hasPendingSkipRequest
                }
              >
                {skipLoading
                  ? "Skipping..."
                  : hasPendingSkipRequest
                    ? "Skip Requested"
                    : stepDetail.status === "SKIPPED"
                      ? "Step Skipped"
                      : "Skip Step"}
              </Button>
            </div>

            {/* FEEDBACK */}
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-app-text">
                <MessageSquareCheck className="h-4 w-4 text-app-brand" />
                Feedback
              </h3>
              {feedbackSubmitted ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-app-text-muted">
                    {feedbackHelpful ? (
                      <ThumbsUp className="h-4 w-4 text-app-success-solid" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 text-app-danger-solid" />
                    )}
                    <span>{feedbackHelpful ? "Marked as helpful" : "Marked as not helpful"}</span>
                  </div>
                  {feedbackComment && (
                    <p className="rounded-xl bg-app-surface-muted p-3 text-sm text-app-text">
                      {feedbackComment}
                    </p>
                  )}
                  <button
                    onClick={() => setFeedbackSubmitted(false)}
                    className="text-left text-xs text-app-text-muted transition-all hover:text-app-text"
                  >
                    Edit feedback
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex gap-2">
                    <button
                      onClick={() => setFeedbackHelpful(true)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                        feedbackHelpful === true
                          ? "border-app-success-border bg-app-success-bg text-app-success-text"
                          : "border-app-border text-app-text-muted hover:border-app-brand-border-strong"
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Helpful
                    </button>
                    <button
                      onClick={() => setFeedbackHelpful(false)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                        feedbackHelpful === false
                          ? "border-app-danger-border bg-app-danger-bg text-app-danger-text"
                          : "border-app-border text-app-text-muted hover:border-app-brand-border-strong"
                      }`}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Not helpful
                    </button>
                  </div>
                  <Textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us what worked or what was missing..."
                    aria-label="Feedback comment"
                    minRows={3}
                    maxRows={10}
                  />
                  <Button
                    variant="primary"
                    onClick={() => void submitFeedback()}
                    disabled={feedbackHelpful === null || !feedbackComment.trim()}
                    loading={feedbackLoading}
                    className="mt-3"
                  >
                    {feedbackLoading ? "Submitting..." : "Submit feedback"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

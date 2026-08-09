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
import { Button } from "../../../components/ui/Button";
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
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

type LoadingState = "idle" | "loading" | "success" | "error";

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

  const [stepDetail, setStepDetail] = useState<OnboardingStepDetail | null>(
    null,
  );
  const [tasks, setTasks] = useState<OnboardingTaskEndpoint[]>([]);
  const [resources, setResources] = useState<OnboardingResourceEndpoint[]>([]);

  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [skipReason, setSkipReason] = useState<string>("");
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

  const { flyby } = useMoments();

  /**
   * Jumps to the next actionable step in the user's path: fetches the whole path,
   * picks the first step that isn't finished/skipped (excluding this one), starts it
   * and navigates there. Falls back to the overview when nothing is left to do.
   */
  const goToNextStep = async (): Promise<void> => {
    setNextLoading(true);
    try {
      const path = await onboardingService.fetchPath();
      // Never jump into a locked phase: if the current phase's knowledge check still
      // blocks the next one, there is no reachable next step, so fall back to the
      // overview where the pending check is shown.
      const nextStep = path.phases
        .filter((phase) => !phase.locked)
        .flatMap((phase) => phase.steps)
        .find(
          (step) =>
            step.id !== stepDetail?.id &&
            step.status !== "FINISHED" &&
            step.status !== "SKIPPED",
        );

      if (nextStep) {
        // The rocket marks a step *beginning*, so it only flies when this one
        // has not been started before. The path filter above admits both
        // untouched and already-in-progress steps, and picking a half-finished
        // one back up is a return, not a departure.
        const isFirstStart = nextStep.status === "WAITING";

        try {
          await onboardingService.startStep(nextStep.id);
        } catch (err) {
          console.error("Failed to start next onboarding step:", err);
        }

        if (isFirstStart) flyby();
        void navigate(`/onboarding/${nextStep.id}`);
      } else {
        // Nothing pending left — journey complete, go back to the overview.
        void navigate("/onboarding");
      }
    } catch (err) {
      console.error("Error navigating to next step:", err);
    } finally {
      setNextLoading(false);
    }
  };

  const updateStepStatus = async (newStatus: StepStatus) => {
    if (!stepDetail) return;
    try {
      await onboardingService.updateStepStatus(stepDetail, newStatus);
      setStepDetail((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (err) {
      console.error("Error updating step:", err);
    }
  };

  const updateTaskFinished = async (taskId: string, finished: boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      await onboardingService.updateTask(task, finished);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, finished } : t)),
      );
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
    } catch (err) {
      console.error("Error skipping step:", err);
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
    } catch (err) {
      console.error("Error submitting feedback:", err);
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
  const hasPendingSkipRequest = stepDetail?.skip
    ? stepDetail.skip.accepted === null
    : false;
  const allTasksDone =
    sortedTasks.length === 0 || doneTasks === sortedTasks.length;
  const taskPercentage =
    sortedTasks.length > 0
      ? Math.round((doneTasks / sortedTasks.length) * 100)
      : 0;

  // ── LOADING ───────────────────────────────────────────────
  if (loadingState === "loading" || loadingState === "idle") {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading step...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────
  if (loadingState === "error") {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-app-danger-solid mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-app-text mb-2">
            Could not load step
          </h2>
          <p className="text-sm text-app-text-muted mb-6">
            {errorMessage}
          </p>
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
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-app-text-muted text-sm mb-4">
            Step not found.
          </p>
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
      <section aria-label="Page header" className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-content py-4">
          <button
            onClick={() => void navigate("/onboarding")}
            className="inline-flex items-center gap-2 text-sm text-app-text-muted hover:text-app-text transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Onboarding Overview
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Status-Badge */}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${
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

              <h1 className="text-2xl sm:text-3xl font-bold text-app-text">
                {stepDetail.title}
              </h1>
              <div className="mt-3">
                <StepOriginBadge step={stepDetail} />
              </div>
              <p className="text-app-text-muted mt-2 text-sm">
                {stepDetail.description}
              </p>
            </div>

            {stepDetail.estimatedMinutes > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-app-surface-muted text-sm text-app-text-muted shrink-0">
                <Clock3 className="w-4 h-4" />
                {formatMinutes(stepDetail.estimatedMinutes)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <main className="app-page-content py-6 pb-24">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expected Outcomes */}
            {stepDetail.expectedOutcomes && stepDetail.expectedOutcomes.length > 0 && (
              <div className="rounded-2xl border border-app-border bg-app-surface p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-app-brand" />
                  <h2 className="font-semibold text-app-text">
                    Expected Outcomes
                  </h2>
                </div>
                <ul className="space-y-3">
                  {stepDetail.expectedOutcomes.map((outcome, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-app-success-solid shrink-0 mt-0.5" />
                      <span className="text-sm text-app-text">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* TASKS (Step by Step) */}
            {sortedTasks.length > 0 && (
              <div className="rounded-2xl border border-app-border bg-app-surface p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-app-warning-solid" />
                    <h2 className="font-semibold text-app-text">
                      Tasks
                    </h2>
                  </div>
                  <span className="text-xs text-app-text-muted">
                    {doneTasks}/{sortedTasks.length} completed
                  </span>
                </div>

                {/* Progress Bar. Sprung rather than tweened so it overshoots a
                    hair on each tick — the bar reacts to the click instead of
                    catching up to it half a second later. */}
                <div className="bg-app-border-muted rounded-full h-1.5 mb-5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-app-brand to-app-progress-fill-end rounded-full"
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
              <h3 className="font-semibold text-app-text text-sm mb-3">
                Complete Step
              </h3>
              <button
                onClick={() =>
                  stepDetail.status === "FINISHED"
                    ? undefined
                    : void updateStepStatus("FINISHED")
                }
                disabled={stepDetail.status === "FINISHED" || !allTasksDone}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                  stepDetail.status === "FINISHED"
                    ? "border-app-success-border bg-app-success-bg text-app-success-text cursor-default"
                    : allTasksDone
                      ? "border-dashed border-app-border-strong hover:border-app-brand-border-strong text-app-text-muted hover:text-app-brand"
                      : "border-dashed border-app-border text-app-text-disabled cursor-not-allowed"
                }`}
              >
                {stepDetail.status === "FINISHED" ? (
                  <Trophy className="w-5 h-5 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 shrink-0" />
                )}
                <span className="text-sm font-medium flex-1 text-left">
                  {stepDetail.status === "FINISHED"
                    ? "Finished!"
                    : allTasksDone
                      ? "Mark as Completed"
                      : `Still ${sortedTasks.length - doneTasks} task${sortedTasks.length - doneTasks === 1 ? "" : "s"} pending`}
                </span>
              </button>

              {/* Once this step is behind the user (finished or skipped),
                  jump straight to the next pending step. */}
              {(stepDetail.status === "FINISHED" ||
                stepDetail.status === "SKIPPED") && (
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => void goToNextStep()}
                  loading={nextLoading}
                  trailingIcon={
                    nextLoading ? undefined : (
                      <CircleArrowRight className="h-4 w-4" />
                    )
                  }
                  className="mt-3"
                >
                  {nextLoading ? "Loading..." : "Continue to next step"}
                </Button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

            {/* STATUS */}
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <h3 className="font-semibold text-app-text text-sm mb-3">
                Status
              </h3>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                  stepDetail.status === "FINISHED"
                    ? "bg-app-success-bg text-app-success-text"
                    : stepDetail.status === "SKIPPED"
                      ? "bg-app-danger-bg text-app-danger-text"
                      : "bg-app-surface-muted text-app-text-muted"
                }`}
              >
                {stepDetail.status === "FINISHED" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : stepDetail.status === "SKIPPED" ? (
                  <CircleArrowRight className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
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
                <p className="text-xs text-app-text-muted mt-3">
                  Completed on{" "}
                  {new Date(stepDetail.completedAt).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "short", day: "numeric" },
                  )}
                </p>
              )}
              {stepDetail.startedAt && (
                <p className="flex items-center gap-1.5 text-xs text-app-text-muted mt-3">
                  <Clock3 className="w-3.5 h-3.5" />
                  {stepDetail.status === "FINISHED" ||
                  stepDetail.status === "SKIPPED"
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
                <h3 className="font-semibold text-app-text text-sm mb-3">
                  Resources
                </h3>
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-app-border hover:border-app-brand-border-strong transition-all group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-app-text truncate">
                          {resource.title}
                        </p>
                        {resource.description && (
                          <p className="text-xs text-app-text-subtle truncate mt-0.5">
                            {resource.description}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-app-text-subtle group-hover:text-app-brand transition-all shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/*SKIP STEP */}
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <h3 className="flex items-center gap-2 font-semibold text-app-text text-sm mb-3">
                <CircleArrowRight className="w-4 h-4 text-app-danger-solid" />
                Skip Step
              </h3>
              <textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Reason for skipping..."
                className="w-full h-24 p-3 rounded-xl border border-app-border bg-app-surface text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-app-focus transition-all resize-none"
                disabled={
                  skipLoading ||
                  stepDetail.status === "SKIPPED" ||
                  hasPendingSkipRequest
                }
              />
              <Button
                variant="primary"
                className="mt-3"
                onClick={() => void skipCurrentStep()}
                loading={skipLoading}
                disabled={
                  !skipReason.trim() ||
                  stepDetail.status === "SKIPPED" ||
                  hasPendingSkipRequest
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
              <h3 className="flex items-center gap-2 font-semibold text-app-text text-sm mb-3">
                <MessageSquareCheck className="w-4 h-4 text-app-brand" />
                Feedback
              </h3>
              {feedbackSubmitted ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-app-text-muted">
                    {feedbackHelpful ? (
                      <ThumbsUp className="w-4 h-4 text-app-success-solid" />
                    ) : (
                      <ThumbsDown className="w-4 h-4 text-app-danger-solid" />
                    )}
                    <span>{feedbackHelpful ? "Marked as helpful" : "Marked as not helpful"}</span>
                  </div>
                  {feedbackComment && (
                    <p className="text-sm text-app-text bg-app-surface-muted rounded-xl p-3">
                      {feedbackComment}
                    </p>
                  )}
                  <button
                    onClick={() => setFeedbackSubmitted(false)}
                    className="text-xs text-app-text-muted hover:text-app-text transition-all text-left"
                  >
                    Edit feedback
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setFeedbackHelpful(true)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        feedbackHelpful === true
                          ? "border-app-success-border bg-app-success-bg text-app-success-text"
                          : "border-app-border text-app-text-muted hover:border-app-brand-border-strong"
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Helpful
                    </button>
                    <button
                      onClick={() => setFeedbackHelpful(false)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        feedbackHelpful === false
                          ? "border-app-danger-border bg-app-danger-bg text-app-danger-text"
                          : "border-app-border text-app-text-muted hover:border-app-brand-border-strong"
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Not helpful
                    </button>
                  </div>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us what worked or what was missing..."
                    className="w-full h-24 p-3 rounded-xl border border-app-border bg-app-surface text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-app-focus transition-all resize-none"
                  />
                  <Button
                    variant="primary"
                    onClick={() => void submitFeedback()}
                    disabled={
                      feedbackHelpful === null || !feedbackComment.trim()
                    }
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

// ============================================================
// OnBoardingItemPage.tsx
// ============================================================

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type {
  OnboardingStepDetail,
  OnboardingTaskEndpoint,
  OnboardingResourceEndpoint,
  StepStatus,
} from "../../types/onboarding";
import { onboardingService } from "../../services/onboardingService";

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

  const [localFinished, setLocalFinished] = useState<Set<string>>(new Set());

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

  // ── DATA FETCHING ─────────────────────────────────────────
  useEffect(() => {
    if (!stepId) return;

    const load = async (): Promise<void> => {
      setLoadingState("loading");
      setErrorMessage("");

      try {
        const step = await onboardingService.fetchStep(stepId);
        setStepDetail(step);
        setSkipReason(step.skipReason ?? "");

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

  // ── TOGGLE TASK ───────────────────────────────────────────
  const skipCurrentStep = async (): Promise<void> => {
    if (!stepDetail) return;
    const reason = skipReason.trim();
    if (!reason) return;

    setSkipLoading(true);
    try {
      await onboardingService.skipStep(stepDetail, reason);
      setStepDetail((prev) =>
        prev ? { ...prev, status: "SKIPPED", skipReason: reason } : prev,
      );
    } catch (err) {
      console.error("Error skipping step:", err);
    } finally {
      setSkipLoading(false);
    }
  };

  const toggleTask = (taskId: string): void => {
    const isCurrentlyDone = localFinished.has(taskId);
    void updateTaskFinished(taskId, !isCurrentlyDone);
  };

  // ── DERIVED ───────────────────────────────────────────────
  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const doneTasks = sortedTasks.filter((t) => localFinished.has(t.id)).length;
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
          <button
            onClick={() => void navigate("/onboarding")}
            className="px-5 py-2.5 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all"
          >
            Back to Onboarding Overview
          </button>
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
          <button
            onClick={() => void navigate("/onboarding")}
            className="px-4 py-2 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all"
          >
            Back to Onboarding Overview
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app-bg">
      {/* HEADER */}
      <div className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
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

                {/* Progress Bar */}
                <div className="bg-app-border-muted rounded-full h-1.5 mb-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-app-brand to-app-progress-fill-end rounded-full transition-all duration-500"
                    style={{ width: `${taskPercentage}%` }}
                  />
                </div>

                <div className="space-y-3">
                  {sortedTasks.map((task, index) => {
                    const isDone = localFinished.has(task.id);
                    return (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className={`w-full text-left flex items-start gap-4 rounded-xl border p-4 transition-all ${
                          isDone
                            ? "border-app-success-border bg-app-success-bg"
                            : "border-app-border hover:border-app-brand-border-strong"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-app-success-solid shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 text-app-text-disabled shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span
                            className={`text-sm font-medium ${
                              isDone
                                ? "line-through text-app-text-subtle"
                                : "text-app-text"
                            }`}
                          >
                            {index + 1}. {task.title}
                          </span>
                          {task.description && (
                            <p className="text-xs text-app-text-muted mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
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
                  void updateStepStatus(
                    stepDetail.status === "FINISHED" ? "WAITING" : "FINISHED",
                  )
                }
                disabled={!allTasksDone && stepDetail.status !== "FINISHED"}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                  stepDetail.status === "FINISHED"
                    ? "border-app-success-border bg-app-success-bg text-app-success-text hover:bg-app-success-bg"
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
                {stepDetail.status === "FINISHED" && (
                  <span className="text-xs opacity-60">undo</span>
                )}
              </button>
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
                onChange={(event) => setSkipReason(event.target.value)}
                placeholder="Reason for skipping..."
                className="w-full h-24 p-3 rounded-xl border border-app-border bg-app-surface text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-app-focus transition-all resize-none"
                disabled={skipLoading || stepDetail.status === "SKIPPED"}
              />
              <button
                className="mt-3 px-4 py-2 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all disabled:cursor-not-allowed disabled:bg-app-border"
                onClick={() => void skipCurrentStep()}
                disabled={
                  skipLoading ||
                  !skipReason.trim() ||
                  stepDetail.status === "SKIPPED"
                }
              >
                {skipLoading
                  ? "Skipping..."
                  : stepDetail.status === "SKIPPED"
                    ? "Step Skipped"
                    : "Skip Step"}
              </button>
            </div>

            {/* FEEDBACK */}
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <h3 className="flex items-center gap-2 font-semibold text-app-text text-sm mb-3">
                <MessageSquareCheck className="w-4 h-4 text-app-brand" />
                Feedback
              </h3>
              <textarea
                placeholder="Your feedback about this step..."
                className="w-full h-24 p-3 rounded-xl border border-app-border bg-app-surface text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-app-focus transition-all resize-none"
              />
              <button className="mt-3 px-4 py-2 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all">
                Submit feedback
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

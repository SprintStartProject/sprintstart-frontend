import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageSquareCheck,
  PlayCircle,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Textarea } from "../../../../components/ui/Textarea";
import { useToast } from "../../../../context/useToast";
import { onboardingService } from "../../../../services/onboardingService";
import { centralSpringToken } from "../../../../styles/tokens";
import { useMoments } from "../../../moments";
import { formatMinutes, isSkipPending } from "../../journey";
import type {
  OnboardingResourceEndpoint,
  OnboardingStepDetail,
  OnboardingTaskEndpoint,
} from "../../types";
import { StepOriginBadge } from "../StepOriginBadge";
import { TaskCheckItem } from "../TaskCheckItem";

type Props = {
  stepId: string;
  /**
   * What the path says this step's status is. Not rendered -- the loaded step is what is shown --
   * but a change re-reads the step, which is how a start that happened outside this component
   * lands here. Opening a WAITING step fires `PUT /start` and this `GET` in the same tick, so the
   * read frequently came back WAITING and left "Start step" on a step that had already begun.
   */
  stepStatus?: OnboardingStepDetail["status"];
  /** Re-reads the path after anything that changes it: a start, a completion, a skip request. */
  onPathChanged: () => Promise<void> | void;
  /**
   * The member is looking at an answered skip request whose answer is still marked new.
   *
   * Called from here rather than from whatever opened the step: "opened" includes "Up next",
   * "Continue" and "Start now", so the answer was marked seen as part of moving the member on --
   * before it had been drawn -- and a deep link, which sets the open step directly, never marked
   * it at all.
   */
  onSkipAnswerSeen?: (skipId: string) => void;
  /** Where "continue" leads once the step is behind the member; the page works it out. */
  continueLabel: string;
  onContinue: () => void;
  /** `inline` sits inside a list row; `focus` fills the graph when zoomed into a step. */
  layout?: "inline" | "focus";
};

type Drawer = "skip" | "feedback" | null;

function minutesBetween(from: string, to: number): number {
  return Math.max(0, Math.floor((to - new Date(from).getTime()) / 60000));
}

/**
 * A step, worked through where it is.
 *
 * Replaces the separate step page: opening a step there meant leaving the path, and coming back meant
 * finding one's place in it again. Here the step unfolds inside the list row -- or fills the graph when
 * zoomed into -- with its tasks, what it should lead to and what helps, and completing it moves on
 * without the path ever leaving the screen. Skipping and feedback stay one click away but out of the
 * way, since most steps need neither.
 */
export function StepWorkspace({
  stepId,
  stepStatus,
  onPathChanged,
  onSkipAnswerSeen,
  continueLabel,
  onContinue,
  layout = "inline",
}: Props) {
  const toast = useToast();
  const { flyby } = useMoments();
  const [step, setStep] = useState<OnboardingStepDetail | null>(null);
  const [tasks, setTasks] = useState<OnboardingTaskEndpoint[]>([]);
  const [resources, setResources] = useState<OnboardingResourceEndpoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"start" | "complete" | "skip" | "feedback" | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [skipReason, setSkipReason] = useState("");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Through a ref, so that a new handler identity does not re-read the step.
  const onSkipAnswerSeenRef = useRef(onSkipAnswerSeen);
  useEffect(() => {
    onSkipAnswerSeenRef.current = onSkipAnswerSeen;
  }, [onSkipAnswerSeen]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      onboardingService.fetchStep(stepId),
      onboardingService.fetchTasks(stepId),
      onboardingService.fetchResources(stepId),
    ])
      .then(([detail, fetchedTasks, fetchedResources]) => {
        if (cancelled) return;
        setStep(detail);
        // A read that worked clears a failure from an earlier one: this effect re-runs when the
        // path's status for the step changes, and the old message used to survive the retry.
        setError(null);
        // The shared predicate, not `accepted !== null`: an `accepted` the backend omits is a
        // request nobody has answered, and marking its non-existent answer seen is a lie the
        // server then records.
        if (detail.skip && !isSkipPending(detail.skip) && !detail.skip.answerSeenAt) {
          onSkipAnswerSeenRef.current?.(detail.skip.id);
        }
        setTasks([...fetchedTasks].sort((left, right) => left.position - right.position));
        setResources(fetchedResources);
        setSkipReason(detail.skip?.reason ?? "");
        if (detail.feedback) {
          setHelpful(detail.feedback.helpful);
          setComment(detail.feedback.comment ?? "");
          setFeedbackSent(true);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [stepId, stepStatus]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        Could not load this step: {error}
      </div>
    );
  }

  if (!step) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-sm text-app-text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-app-brand" aria-hidden="true" />
        Loading step…
      </div>
    );
  }

  const doneTasks = tasks.filter((task) => task.finished).length;
  const allTasksDone = doneTasks === tasks.length;
  const isBehind = step.status === "FINISHED" || step.status === "SKIPPED";
  const skipPending = isSkipPending(step.skip);
  const skipDeclined = !!step.skip && step.skip.accepted === false && step.status !== "SKIPPED";
  const skipApproved = !!step.skip && step.skip.accepted === true;
  const isFocus = layout === "focus";

  const start = async () => {
    setBusy("start");
    try {
      await onboardingService.startStep(step.id);
      flyby();
      setStep({ ...step, status: "IN_PROGRESS", startedAt: new Date().toISOString() });
      await onPathChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't start the step.");
    } finally {
      setBusy(null);
    }
  };

  const toggleTask = async (task: OnboardingTaskEndpoint) => {
    const finished = !task.finished;
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === task.id ? { ...candidate, finished } : candidate,
      ),
    );
    try {
      await onboardingService.updateTask(task, finished);
    } catch (reason) {
      setTasks((current) =>
        current.map((candidate) => (candidate.id === task.id ? task : candidate)),
      );
      toast.error(reason instanceof Error ? reason.message : "Couldn't update the task.");
    }
  };

  const complete = async () => {
    setBusy("complete");
    try {
      await onboardingService.completeStep(step.id);
      setStep({ ...step, status: "FINISHED", completedAt: new Date().toISOString() });
      await onPathChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't complete the step.");
    } finally {
      setBusy(null);
    }
  };

  const requestSkip = async () => {
    const reason = skipReason.trim();
    if (!reason) return;
    setBusy("skip");
    try {
      const created = await onboardingService.skipStep(step, reason);
      setStep({
        ...step,
        skip: {
          id: created.id,
          stepId: created.stepId,
          reason: created.reason,
          accepted: null,
          reviewComment: created.reviewComment,
          reviewedAt: null,
        },
      });
      setDrawer(null);
      toast.success("Skip request sent to your project manager");
      await onPathChanged();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Couldn't send the skip request.");
    } finally {
      setBusy(null);
    }
  };

  const sendFeedback = async () => {
    if (helpful === null || !comment.trim()) return;
    setBusy("feedback");
    try {
      await onboardingService.submitFeedback(step.id, helpful, comment);
      setFeedbackSent(true);
      setDrawer(null);
      toast.success("Thanks for the feedback");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Couldn't send your feedback.");
    } finally {
      setBusy(null);
    }
  };

  const outcomes = step.expectedOutcomes ?? [];

  return (
    <div className={isFocus ? "space-y-5" : "space-y-4"}>
      {/* ── What it is ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-app-text-muted">
          <StepOriginBadge step={step} />
          {step.estimatedMinutes > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {formatMinutes(step.estimatedMinutes)}
            </span>
          ) : null}
          {step.startedAt ? (
            <span>
              · {isBehind ? "took" : "on it for"}{" "}
              {formatMinutes(
                Math.max(
                  1,
                  minutesBetween(
                    step.startedAt,
                    step.completedAt ? new Date(step.completedAt).getTime() : now,
                  ),
                ),
              )}
            </span>
          ) : null}
        </div>
        {step.description ? (
          <p className={`leading-relaxed text-app-text-muted ${isFocus ? "text-base" : "text-sm"}`}>
            {step.description}
          </p>
        ) : null}
      </div>

      {/* ── Where a skip request or feedback stands -- said up front, in colour ── */}
      {skipPending ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-app-warning-border bg-app-warning-bg px-3 py-2.5 text-sm text-app-warning-text">
          <SkipForward className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Skip requested</span> — your project manager decides.
            You can keep working on it meanwhile.
            {step.skip?.reason ? (
              <span className="mt-0.5 block text-xs opacity-80">“{step.skip.reason}”</span>
            ) : null}
          </span>
        </div>
      ) : skipApproved ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-app-success-border bg-app-success-bg px-3 py-2.5 text-sm text-app-success-text">
          <SkipForward className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Skip approved</span> — your project manager agreed you
            can leave this one out.
            {step.skip?.reviewComment ? (
              <span className="mt-0.5 block text-xs text-app-text-muted">
                “{step.skip.reviewComment}”
              </span>
            ) : null}
          </span>
        </div>
      ) : skipDeclined ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-app-warning-border bg-app-surface px-3 py-2.5 text-sm text-app-text">
          <SkipForward
            className="mt-0.5 h-4 w-4 shrink-0 text-app-warning-text"
            aria-hidden="true"
          />
          <span>
            <span className="font-semibold">Skip declined</span> — your project manager would like
            you to do this one.
            {step.skip?.reviewComment ? (
              <span className="mt-0.5 block text-xs text-app-text-muted">
                “{step.skip.reviewComment}”
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      {feedbackSent && drawer !== "feedback" ? (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-sm ${
            helpful === false
              ? "border-app-danger-border bg-app-danger-bg text-app-danger-text"
              : "border-app-success-border bg-app-success-bg text-app-success-text"
          }`}
        >
          {helpful === false ? (
            <ThumbsDown className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className="font-semibold">
              {helpful === false
                ? "You found this step not helpful"
                : "You found this step helpful"}
            </span>
            {comment ? <span className="mt-0.5 block text-xs opacity-80">“{comment}”</span> : null}
          </span>
        </div>
      ) : null}

      <div
        className={`grid gap-4 ${resources.length > 0 || outcomes.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
      >
        {/* ── Tasks ── */}
        <div className="min-w-0 space-y-3">
          {tasks.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-app-text">Tasks</h4>
                <span className="text-xs text-app-text-muted tabular-nums">
                  {doneTasks}/{tasks.length} done
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-app-border-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end"
                  initial={false}
                  animate={{ width: `${Math.round((doneTasks / tasks.length) * 100)}%` }}
                  transition={centralSpringToken}
                />
              </div>
              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <TaskCheckItem
                    key={task.id}
                    index={index}
                    title={task.title}
                    description={task.description}
                    isDone={task.finished}
                    onToggle={() => void toggleTask(task)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-app-border px-4 py-3 text-sm text-app-text-muted">
              No checklist for this one — do what the description says, then mark it complete.
            </p>
          )}
        </div>

        {/* ── What it leads to, and what helps ── */}
        {outcomes.length > 0 || resources.length > 0 ? (
          <div className="space-y-3">
            {outcomes.length > 0 ? (
              <div className="rounded-2xl bg-app-surface-muted p-3">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-app-text">
                  <Lightbulb className="h-3.5 w-3.5 text-app-brand" aria-hidden="true" />
                  You’re done when
                </h4>
                <ul className="space-y-1.5">
                  {outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2 text-xs text-app-text">
                      <CheckCircle2
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-success-solid"
                        aria-hidden="true"
                      />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {resources.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-app-text">Resources</h4>
                <div className="space-y-1.5">
                  {resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-2 rounded-xl border border-app-border px-3 py-2 transition-colors hover:border-app-brand-border"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-app-text">
                          {resource.title}
                        </span>
                        {resource.description ? (
                          <span className="block truncate text-[11px] text-app-text-subtle">
                            {resource.description}
                          </span>
                        ) : null}
                      </span>
                      <ExternalLink
                        className="h-3.5 w-3.5 shrink-0 text-app-text-subtle group-hover:text-app-brand"
                        aria-hidden="true"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Drawers ── */}
      {drawer === "skip" ? (
        <div className="space-y-2 rounded-2xl border border-app-warning-border bg-app-warning-bg/50 p-3">
          <p className="text-xs text-app-text-muted">
            Already know this, or it doesn’t apply to you? Your project manager decides.
          </p>
          <Textarea
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
            placeholder="Why skip it?"
            aria-label="Reason for skipping"
            minRows={2}
            maxRows={6}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busy === "skip"}
              disabled={!skipReason.trim()}
              onClick={() => void requestSkip()}
            >
              Request skip
            </Button>
          </div>
        </div>
      ) : null}
      {drawer === "feedback" ? (
        <div className="space-y-2 rounded-2xl border border-app-brand-border bg-app-brand-soft/40 p-3">
          <div className="flex gap-2">
            {[true, false].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={helpful === value}
                onClick={() => setHelpful(value)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  helpful === value
                    ? value
                      ? "border-app-success-border bg-app-success-bg text-app-success-text"
                      : "border-app-danger-border bg-app-danger-bg text-app-danger-text"
                    : "border-app-border text-app-text-muted hover:border-app-brand-border"
                }`}
              >
                {value ? (
                  <ThumbsUp className="h-3.5 w-3.5" />
                ) : (
                  <ThumbsDown className="h-3.5 w-3.5" />
                )}
                {value ? "Helpful" : "Not helpful"}
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What worked, or what was missing?"
            aria-label="Feedback comment"
            minRows={2}
            maxRows={6}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDrawer(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busy === "feedback"}
              disabled={helpful === null || !comment.trim()}
              onClick={() => void sendFeedback()}
            >
              Send feedback
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── The one thing to do ── */}
      <div className="flex flex-col gap-3 border-t border-app-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {!isBehind ? (
            <button
              type="button"
              disabled={skipPending}
              aria-expanded={drawer === "skip"}
              onClick={() => setDrawer(drawer === "skip" ? null : "skip")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-app-warning-border bg-app-warning-bg px-3 py-1.5 text-xs font-semibold text-app-warning-text transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-70"
            >
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
              {skipPending ? "Skip requested" : "Skip"}
            </button>
          ) : null}
          <button
            type="button"
            aria-expanded={drawer === "feedback"}
            onClick={() => setDrawer(drawer === "feedback" ? null : "feedback")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-brand-border bg-app-brand-soft px-3 py-1.5 text-xs font-semibold text-app-brand-text transition-opacity hover:opacity-90"
          >
            <MessageSquareCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {feedbackSent ? "Edit feedback" : "Feedback"}
          </button>
        </div>

        {step.status === "WAITING" ? (
          <Button
            variant="primary"
            loading={busy === "start"}
            icon={<PlayCircle className="h-4 w-4" />}
            onClick={() => void start()}
          >
            Start step
          </Button>
        ) : isBehind ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-app-success-text">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              {step.status === "SKIPPED" ? "Skipped" : "Done"}
            </span>
            <Button
              variant="primary"
              onClick={onContinue}
              trailingIcon={<ChevronRight className="h-4 w-4" />}
            >
              {continueLabel}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            loading={busy === "complete"}
            disabled={!allTasksDone}
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() => void complete()}
          >
            {allTasksDone
              ? "Mark as complete"
              : `${tasks.length - doneTasks} ${tasks.length - doneTasks === 1 ? "task" : "tasks"} to go`}
          </Button>
        )}
      </div>
    </div>
  );
}

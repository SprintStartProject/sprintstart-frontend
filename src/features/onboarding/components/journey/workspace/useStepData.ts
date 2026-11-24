import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { onboardingService } from "../../../../../services/onboardingService";
import { isSkipPending } from "../../../journey";
import type {
  OnboardingResourceEndpoint,
  OnboardingStepDetail,
  OnboardingTaskEndpoint,
} from "../../../../../services/onboardingTypes";
import { onBuddyPathChanged } from "./buddyKit";
import { failureMessage, keepTyping, needsRead, sortedByPosition } from "./workspaceRules";
import type { LoadedStep } from "./workspaceRules";

type Setter<T> = Dispatch<SetStateAction<T>>;

/** What the member has typed or chosen in the two drawers, and whether feedback already went out. */
export type Drafts = {
  skipReason: string;
  helpful: boolean | null;
  comment: string;
  feedbackSent: boolean;
};

type DraftSetters = {
  setSkipReason: Setter<string>;
  setHelpful: Setter<boolean | null>;
  setComment: Setter<string>;
  setFeedbackSent: Setter<boolean>;
};

type ReadResult = {
  detail: OnboardingStepDetail;
  tasks: OnboardingTaskEndpoint[];
  resources: OnboardingResourceEndpoint[];
};

type Sinks = DraftSetters & {
  setStep: Setter<OnboardingStepDetail | null>;
  setTasks: Setter<OnboardingTaskEndpoint[]>;
  setResources: Setter<OnboardingResourceEndpoint[]>;
  setError: Setter<string | null>;
};

async function readStep(stepId: string): Promise<ReadResult> {
  const [detail, tasks, resources] = await Promise.all([
    onboardingService.fetchStep(stepId),
    onboardingService.fetchTasks(stepId),
    onboardingService.fetchResources(stepId),
  ]);

  return { detail, tasks, resources };
}

/**
 * Tells the page the member is looking at an answered skip request whose answer is still new.
 *
 * The shared predicate, not `accepted !== null`: an `accepted` the backend omits is a request
 * nobody has answered, and marking its non-existent answer seen is a lie the server then records.
 */
function announceSkipAnswer(
  detail: OnboardingStepDetail,
  seen: ((skipId: string) => void) | undefined,
) {
  if (detail.skip && !isSkipPending(detail.skip) && !detail.skip.answerSeenAt) {
    seen?.(detail.skip.id);
  }
}

/** Puts a read into the state, keeping what the member is typing when it is the same step. */
function applyRead(read: ReadResult, last: LoadedStep | null, sinks: Sinks, stepId: string) {
  const { detail } = read;
  const sameLast = last?.stepId === stepId ? last : null;
  const skipReason = detail.skip?.reason ?? "";
  const comment = detail.feedback?.comment ?? "";

  sinks.setStep(detail);
  // A read that worked clears a failure from an earlier one: the reading effect re-runs when the
  // path's status for the step changes, and the old message would otherwise survive the retry.
  sinks.setError(null);
  sinks.setTasks(sortedByPosition(read.tasks));
  sinks.setResources(read.resources);
  sinks.setSkipReason((current) => keepTyping(current, sameLast?.skipReason, skipReason));

  if (detail.feedback) {
    sinks.setHelpful(detail.feedback.helpful);
    sinks.setComment((current) => keepTyping(current, sameLast?.comment, comment));
    sinks.setFeedbackSent(true);
  }
}

/**
 * Reads a step with its tasks and resources, and again whenever something outside this component
 * changed it.
 *
 * Bumped by the buddy when it changed the path, so the open step re-reads: ticking a line off in
 * the conversation must show on the checklist behind the dock.
 */
export function useStepData(input: {
  stepId: string;
  stepStatus: OnboardingStepDetail["status"] | undefined;
  onSkipAnswerSeen: ((skipId: string) => void) | undefined;
}) {
  const { stepId, stepStatus, onSkipAnswerSeen } = input;
  const [step, setStep] = useState<OnboardingStepDetail | null>(null);
  const [tasks, setTasks] = useState<OnboardingTaskEndpoint[]>([]);
  const [resources, setResources] = useState<OnboardingResourceEndpoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const buddyChanges = useBuddyChanges();

  // Through a ref, so that a new handler identity does not re-read the step.
  const seenRef = useRef(onSkipAnswerSeen);
  useEffect(() => {
    seenRef.current = onSkipAnswerSeen;
  }, [onSkipAnswerSeen]);

  // What the last read brought, so a re-read can tell the member's own typing from the server's
  // text, and the page's path refresh after a buddy change need not read the step a second time.
  const loadedRef = useRef<LoadedStep | null>(null);

  useEffect(() => {
    const last = loadedRef.current;
    if (!needsRead(last, stepId, buddyChanges, stepStatus)) return;

    const sinks = {
      setStep,
      setTasks,
      setResources,
      setError,
      setSkipReason,
      setHelpful,
      setComment,
      setFeedbackSent,
    };
    let cancelled = false;

    readStep(stepId)
      .then((read) => {
        if (cancelled) return;
        announceSkipAnswer(read.detail, seenRef.current);
        applyRead(read, last, sinks, stepId);
        loadedRef.current = {
          stepId,
          buddyChanges,
          status: read.detail.status,
          skipReason: read.detail.skip?.reason ?? "",
          comment: read.detail.feedback?.comment ?? "",
        };
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(failureMessage(reason, "Unknown error"));
      });

    return () => {
      cancelled = true;
    };
  }, [stepId, stepStatus, buddyChanges]);

  const drafts: Drafts = { skipReason, helpful, comment, feedbackSent };
  const setters: DraftSetters = { setSkipReason, setHelpful, setComment, setFeedbackSent };

  return { step, setStep, tasks, setTasks, resources, error, drafts, setters };
}

/** Counts the times the buddy changed the path, so a reader can depend on it. */
function useBuddyChanges(): number {
  const [count, setCount] = useState(0);
  useEffect(() => onBuddyPathChanged(() => setCount((current) => current + 1)), []);
  return count;
}

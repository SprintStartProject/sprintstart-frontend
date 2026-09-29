import { useEffect, useId, useRef, useState } from "react";
import { Hand } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../services/apiClient";
import { parseApiError } from "../../../services/apiError";
import { useToastApi } from "../../../context/useToast";
import { useProjectContext } from "../../projects/useProjectContext";
import { useCurrentTask, useGrabTask } from "../hooks/useTaskPool";

type GrabTaskButtonProps = {
  taskId: string;
  title: string;
  /** Whether this is already the hire's task. Read off the board when not given. */
  isCurrent?: boolean;
  /**
   * The title of the task the hire is on, for "Swap … for this?" — null when they are on none.
   * Read off the board's current-task card when not given, which misses a hire who dismissed that
   * card; a caller that already knows (the pool card does) should say.
   */
  currentTitle?: string | null;
  /** Told once the task really is the hire's, e.g. so a dialog around the button can close. */
  onGrabbed?: () => void;
};

/**
 * Grabbing a task by hand — the same claim the buddy's "Work toward this task" makes.
 *
 * Two presses, not one. A grab aims the hire's whole plan at the task and replaces whatever they
 * were on, so the button first turns into a question that says exactly that ("Swap … for this?")
 * and only the second press claims. That keeps the confirm the buddy route always had, without the
 * detour through a conversation for somebody who already knows what they want.
 *
 * The first press unmounts the button it was made on, so focus is moved on purpose: to "Yes, grab
 * it" when the question appears — which is described by the question, so a screen reader reads it —
 * and back to "Grab this" when it is cancelled or fails. Otherwise focus falls to `<body>` and a
 * keyboard user has to find their way back through the whole board.
 */
export function GrabTaskButton({
  taskId,
  title,
  isCurrent,
  currentTitle,
  onGrabbed,
}: GrabTaskButtonProps) {
  const { selectedProjectId } = useProjectContext();
  const cached = useCurrentTask(selectedProjectId);
  const grab = useGrabTask(selectedProjectId);
  const toast = useToastApi();
  const [confirming, setConfirming] = useState(false);

  const grabRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Only a question that was open hands focus back; the first render must not steal it.
  const wasConfirming = useRef(false);
  const questionId = useId();

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (wasConfirming.current) grabRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const replaces = currentTitle === undefined ? (cached?.title ?? null) : currentTitle;

  if (isCurrent ?? cached?.taskId === taskId) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-app-brand-text">
        <Hand className="h-3.5 w-3.5" aria-hidden="true" />
        You&apos;re on this one
      </span>
    );
  }

  const handleConfirm = () => {
    grab.mutate(taskId, {
      onSuccess: () => {
        setConfirming(false);
        toast.success(`You're on "${title}" now`, {
          description: "It's on your board, and your buddy will shape your next steps around it.",
        });
        onGrabbed?.();
      },
      onError: (error) => {
        setConfirming(false);
        toast.error(
          // 409 is "not LIVE" — closed at its source, but also retired or removed by the PM.
          error instanceof ApiError && error.status === 409
            ? "That task isn't open anymore — pick another one."
            : parseApiError(error, "Couldn't grab that task. Try again in a moment."),
        );
      },
    });
  };

  if (!confirming) {
    return (
      <Button
        ref={grabRef}
        variant="primary"
        size="xs"
        icon={<Hand className="h-3.5 w-3.5" aria-hidden="true" />}
        onClick={() => setConfirming(true)}
      >
        Grab this
      </Button>
    );
  }

  return (
    <span
      className="inline-flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Confirm grab"
    >
      <span id={questionId} className="text-xs text-app-text-muted">
        {replaces ? (
          <>
            Swap <span className="font-medium text-app-text">&quot;{replaces}&quot;</span> for this?
          </>
        ) : (
          "Make this your task?"
        )}
      </span>
      <Button
        ref={confirmRef}
        variant="primary"
        size="xs"
        loading={grab.isPending}
        aria-describedby={questionId}
        onClick={handleConfirm}
      >
        Yes, grab it
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={grab.isPending}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </span>
  );
}

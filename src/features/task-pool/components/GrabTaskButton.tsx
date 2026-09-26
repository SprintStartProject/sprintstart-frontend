import { useState } from "react";
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
 */
export function GrabTaskButton({ taskId, title, isCurrent, onGrabbed }: GrabTaskButtonProps) {
  const { selectedProjectId } = useProjectContext();
  const current = useCurrentTask(selectedProjectId);
  const grab = useGrabTask(selectedProjectId);
  const toast = useToastApi();
  const [confirming, setConfirming] = useState(false);

  if (isCurrent ?? current?.taskId === taskId) {
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
        toast.success(`You're on “${title}” now`, {
          description: "It's on your board, and your buddy will shape your next steps around it.",
        });
        onGrabbed?.();
      },
      onError: (error) => {
        setConfirming(false);
        toast.error(
          error instanceof ApiError && error.status === 409
            ? "That task just closed where it lives — pick another one."
            : parseApiError(error, "Couldn't grab that task. Try again in a moment."),
        );
      },
    });
  };

  if (!confirming) {
    return (
      <Button
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
      <span className="text-xs text-app-text-muted">
        {current?.title ? (
          <>
            Swap <span className="font-medium text-app-text">“{current.title}”</span> for this?
          </>
        ) : (
          "Make this your task?"
        )}
      </span>
      <Button variant="primary" size="xs" loading={grab.isPending} onClick={handleConfirm}>
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

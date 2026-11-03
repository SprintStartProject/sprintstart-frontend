import { useState } from "react";
import { useToast } from "../../context/useToast";
import type { OnboardingTaskEndpoint } from "../../features/onboarding/types";
import {
  createOnboardingTaskForStep,
  deleteOnboardingStep,
  deleteOnboardingTask,
  updateOnboardingTask,
} from "../../services/teamManagementService";
import { moveTask, type DetailOnboardingStep } from "./memberRules";
import type { MemberData } from "./useMemberData";
import type { StepRoute } from "./useStepRoute";
import type { StepTasks } from "./useStepTasks";

const failureText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type Shared = {
  data: MemberData;
  tasks: StepTasks;
  /** The step or task a write is in flight for, so its controls can show it. */
  actionId: string | null;
  setActionId: (id: string | null) => void;
};

/** Deleting a step, from its details panel or from the graph where there is no panel to ask in. */
function useStepDeletion({
  data,
  route,
  actionId,
  setActionId,
}: Omit<Shared, "tasks"> & { route: StepRoute }) {
  const toast = useToast();
  const [graphStepToDelete, setGraphStepToDelete] = useState<string | null>(null);
  const [stepToDelete, setStepToDelete] = useState<DetailOnboardingStep | null>(null);

  async function remove(step: DetailOnboardingStep) {
    setActionId(step.id);
    try {
      await deleteOnboardingStep(step.id);
      setStepToDelete(null);
      if (route.detailStepId === step.id) route.setDetailStepId("");
      // The member too: the deleted step may have been their current one.
      await Promise.all([data.refreshOnboardingPath(), data.refreshMember()]);
      toast.success("Step deleted");
    } catch (error) {
      toast.error(failureText(error, "Couldn't delete the step."));
    } finally {
      setActionId(null);
    }
  }

  return {
    graphStepToDelete,
    setGraphStepToDelete,
    stepToDelete,
    setStepToDelete,
    remove,
    actionId,
  };
}

/** The new task's form: where it goes and what was typed. */
function useTaskDraft() {
  const [insertTarget, setInsertTarget] = useState<{ stepId: string; position: number } | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return {
    insertTarget,
    setInsertTarget,
    title,
    setTitle,
    description,
    setDescription,
    clear: () => {
      setInsertTarget(null);
      setTitle("");
      setDescription("");
    },
  };
}

/** Dragging a task over another: the list moves at once, and the server's order wins after. */
function useTaskReorder({ tasks, actionId, setActionId }: Omit<Shared, "data">) {
  const toast = useToast();

  return async function reorder(stepId: string, activeTaskId: string, overTaskId: string) {
    // A second drag while the first is still being written would compute its move from the
    // optimistic list and send positions against the same stale state.
    if (actionId === stepId) return;
    const move = moveTask(tasks.tasksById[stepId] ?? [], activeTaskId, overTaskId);
    if (!move) return;

    setActionId(stepId);
    tasks.setTasksById((current) => ({ ...current, [stepId]: move.next }));
    try {
      // One request per moved task: there is no batch endpoint, so a failure halfway through
      // leaves the ones before it written. The refresh in both branches is what the list then
      // shows -- the server's order, not this optimistic one.
      for (const task of move.changed) {
        await updateOnboardingTask(task.id, {
          position: task.position,
          title: task.title,
          description: task.description,
          finished: task.finished,
        });
      }
      await tasks.refreshStepTasks(stepId);
    } catch (error) {
      toast.error("The new order could not be saved in full", {
        description: `${error instanceof Error ? `${error.message} ` : ""}The list now shows what the server has.`,
      });
      await tasks.refreshStepTasks(stepId);
    } finally {
      setActionId(null);
    }
  };
}

/** Adding, deleting and reordering the tasks of a step. */
function useTaskEditing(shared: Shared) {
  const { data, tasks, setActionId } = shared;
  const toast = useToast();
  const draft = useTaskDraft();
  const [taskToDelete, setTaskToDelete] = useState<OnboardingTaskEndpoint | null>(null);
  const [adding, setAdding] = useState(false);

  async function remove(task: OnboardingTaskEndpoint) {
    setActionId(task.stepId);
    try {
      await deleteOnboardingTask(task.id);
      setTaskToDelete(null);
      await tasks.refreshStepTasks(task.stepId);
      await data.refreshOnboardingPath();
      toast.success("Task deleted");
    } catch (error) {
      toast.error(failureText(error, "Couldn't delete the task."));
    } finally {
      setActionId(null);
    }
  }

  async function create() {
    const target = draft.insertTarget;
    if (!target || !draft.title.trim()) return;

    setAdding(true);
    setActionId(target.stepId);
    try {
      await createOnboardingTaskForStep(target.stepId, {
        position: target.position,
        title: draft.title.trim(),
        description: draft.description.trim(),
        finished: false,
      });
      draft.clear();
      await tasks.refreshStepTasks(target.stepId);
      // Adding a task reopens a completed step on the backend (status back to IN_PROGRESS).
      // Refresh the path so the step cards update, and the team-overview member data so the
      // header progress bar and current step reflect the change too.
      await Promise.all([data.refreshOnboardingPath(), data.refreshMember()]);
      toast.success("Task added");
    } catch (error) {
      toast.error(failureText(error, "Couldn't create the task."));
    } finally {
      setAdding(false);
      setActionId(null);
    }
  }

  return {
    draft,
    taskToDelete,
    setTaskToDelete,
    adding,
    remove,
    create,
    reorder: useTaskReorder(shared),
  };
}

/** Everything the PM does to the steps and tasks of the path. */
export function useStepEditing(data: MemberData, tasks: StepTasks, route: StepRoute) {
  const [actionId, setActionId] = useState<string | null>(null);
  const shared = { data, tasks, actionId, setActionId };

  return {
    actionId,
    steps: useStepDeletion({ ...shared, route }),
    tasks: useTaskEditing(shared),
  };
}

export type StepEditing = ReturnType<typeof useStepEditing>;

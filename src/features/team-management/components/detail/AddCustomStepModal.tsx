import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { Textarea } from "../../../../components/ui/Textarea";
import { Input } from "../../../../components/ui/Input";
import { Button } from "../../../../components/ui/Button";
import { DragHandle } from "../../../../components/ui/DragHandle";
import { Modal } from "../../../../components/ui/Modal";

export type CustomStepTaskDraft = {
  title: string;
  description: string;
};

/** One step or question of the phase the new step is placed into. */
export type PlacementOption = { id: string; title: string; kind: "step" | "question" };

/**
 * Where in the phase graph the new step goes. Left out, the modal only asks for the step itself.
 */
export type StepPlacement = {
  phaseTitle: string;
  options: PlacementOption[];
  waitsOn: string[];
  unlocks: string[];
  onWaitsOnChange: (ids: string[]) => void;
  onUnlocksChange: (ids: string[]) => void;
  /** Set when the step goes where the PM double-clicked the canvas. */
  pinned?: boolean;
};

type AddCustomStepModalProps = {
  open: boolean;
  title: string;
  description: string;
  expectedOutcome: string;
  estimatedMinutes: string;
  tasks: CustomStepTaskDraft[];
  addingStep: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onExpectedOutcomeChange: (value: string) => void;
  onEstimatedMinutesChange: (value: string) => void;
  onTasksChange: (updater: (current: CustomStepTaskDraft[]) => CustomStepTaskDraft[]) => void;
  onClose: () => void;
  onSubmit: () => void;
  placement?: StepPlacement;
};

function PlacementPicker({
  label,
  hint,
  icon,
  options,
  selected,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  options: PlacementOption[];
  selected: string[];
  disabled: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="flex items-center gap-1.5 text-xs font-semibold text-app-text">
        {icon}
        {label}
      </legend>
      <p className="mt-0.5 text-xs text-app-text-muted">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.length === 0 ? (
          <span className="text-xs text-app-text-subtle">Nothing in this phase yet.</span>
        ) : (
          options.map((option) => {
            const isSelected = selected.includes(option.id);
            const isDisabled = !isSelected && disabled.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isDisabled}
                onClick={() =>
                  onChange(
                    isSelected
                      ? selected.filter((id) => id !== option.id)
                      : [...selected, option.id],
                  )
                }
                className={`max-w-full truncate rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected
                    ? "border-app-brand bg-app-brand-soft font-semibold text-app-brand-text"
                    : "border-app-border bg-app-surface text-app-text-muted hover:border-app-border-strong hover:text-app-text"
                }`}
                title={option.title}
              >
                {option.kind === "question" ? "Q · " : ""}
                {option.title}
              </button>
            );
          })
        )}
      </div>
    </fieldset>
  );
}

export function AddCustomStepModal({
  open,
  title,
  description,
  expectedOutcome,
  estimatedMinutes,
  tasks,
  addingStep,
  onTitleChange,
  onDescriptionChange,
  onExpectedOutcomeChange,
  onEstimatedMinutesChange,
  onTasksChange,
  onClose,
  onSubmit,
  placement,
}: AddCustomStepModalProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function reorderTasks(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;

    onTasksChange((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  return (
    <Modal
      isOpen={open}
      title={placement ? `Add a step to ${placement.phaseTitle}` : "Add Custom Step"}
      description={
        placement
          ? "The step is added to this member's path only. Say where it sits in the phase, and it is connected into the graph."
          : "Add the project-specific step for the selected slot."
      }
      size="lg"
      zIndexClassName="z-[60]"
      bodyClassName="max-h-[min(68vh,720px)] overflow-y-auto px-7 py-6"
      closeLabel="Close add step modal"
      isDismissDisabled={addingStep}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={addingStep}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={title.trim().length === 0}
            loading={addingStep}
            icon={<Plus className="h-4 w-4" />}
          >
            {addingStep ? "Adding..." : "Add step"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {placement ? (
          <div className="space-y-4 rounded-2xl border border-app-brand-border bg-app-brand-soft/40 p-3">
            <PlacementPicker
              label="Opens after"
              hint="The step unlocks once these are done. Leave empty to open it right away."
              icon={<ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
              options={placement.options}
              selected={placement.waitsOn}
              disabled={placement.unlocks}
              onChange={placement.onWaitsOnChange}
            />
            <PlacementPicker
              label="Leads to"
              hint="These wait on the new step from now on — a direct connection between both sides is routed through it."
              icon={<ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
              options={placement.options}
              selected={placement.unlocks}
              disabled={placement.waitsOn}
              onChange={placement.onUnlocksChange}
            />
            {placement.pinned ? (
              <p className="text-xs text-app-text-muted">
                It is placed where you double-clicked the graph.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Title and estimated minutes in one row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-3">
            <label htmlFor="custom-step-title" className="text-xs font-medium text-app-text-muted">
              Step title *
            </label>
            <Input
              id="custom-step-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="e.g., Meet your colleagues"
              className="mt-1"
            />
          </div>

          <div>
            <label
              htmlFor="custom-step-minutes"
              className="text-xs font-medium text-app-text-muted"
            >
              Est. minutes *
            </label>
            <Input
              id="custom-step-minutes"
              type="number"
              min="1"
              value={estimatedMinutes}
              onChange={(event) => onEstimatedMinutesChange(event.target.value)}
              placeholder="30"
              className="mt-1 [appearance:textfield] px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Description field - auto-resizing */}
        <div>
          <label
            htmlFor="custom-step-description"
            className="text-xs font-medium text-app-text-muted"
          >
            Description
          </label>
          <div className="mt-1">
            <Textarea
              id="custom-step-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Describe what the member should do. Keep it clear and actionable."
              minRows={3}
              maxRows={10}
            />
          </div>
        </div>

        {/* Expected outcome field - auto-resizing */}
        <div>
          <label
            htmlFor="custom-step-expected-outcome"
            className="text-xs font-medium text-app-text-muted"
          >
            Expected outcome
          </label>
          <div className="mt-1">
            <Textarea
              id="custom-step-expected-outcome"
              value={expectedOutcome}
              onChange={(event) => onExpectedOutcomeChange(event.target.value)}
              placeholder="What should the member achieve by completing this step?"
              minRows={2}
              maxRows={8}
            />
          </div>
        </div>

        {/* Tasks section */}
        <div className="rounded-2xl border border-app-border bg-app-surface-muted p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-app-text">Tasks</p>
              <p className="mt-0.5 text-xs text-app-text-muted">
                Optional breakdown of this step into smaller tasks
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onTasksChange((current) => [...current, { title: "", description: "" }])
              }
              icon={<Plus className="h-3.5 w-3.5" />}
              className="text-app-brand hover:bg-app-brand-soft hover:text-app-brand-text"
            >
              Add task
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {tasks.map((task, index) => (
              <div
                key={index}
                draggable
                onDragStart={(event: DragEvent<HTMLDivElement>) => {
                  event.dataTransfer.effectAllowed = "move";
                  setDraggedIndex(index);
                }}
                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                  if (draggedIndex === null || draggedIndex === index) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverIndex(index);
                }}
                onDragLeave={(event: DragEvent<HTMLDivElement>) => {
                  const nextTarget = event.relatedTarget;
                  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                    return;
                  }
                  setDragOverIndex((current) => (current === index ? null : current));
                }}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  if (draggedIndex !== null) {
                    reorderTasks(draggedIndex, index);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`group/task-item relative rounded-xl border bg-app-bg p-3 transition-all ${
                  dragOverIndex === index && draggedIndex !== index
                    ? "border-app-brand bg-app-brand-soft shadow-sm"
                    : "border-app-border"
                } ${draggedIndex === index ? "scale-[0.99] opacity-50" : ""}`}
              >
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/task-item:opacity-100">
                  <span className="rounded bg-app-surface px-2 py-0.5 text-xs font-medium text-app-text-muted">
                    Task {index + 1}
                  </span>

                  {tasks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={() =>
                        onTasksChange((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="hover:bg-app-danger-bg hover:text-app-danger-text"
                      aria-label={`Remove task ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex items-center">
                      <DragHandle visibleClassName="group-hover/task-item:mr-1 group-hover/task-item:w-4 group-hover/task-item:opacity-100" />
                      <label
                        htmlFor={`custom-task-title-${index}`}
                        className="text-xs font-medium text-app-text-muted"
                      >
                        Task title
                      </label>
                    </div>
                    <input
                      id={`custom-task-title-${index}`}
                      value={task.title}
                      onChange={(event) =>
                        onTasksChange((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  title: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                      placeholder="What needs to be done?"
                      className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`custom-task-description-${index}`}
                      className="mb-1 block text-xs font-medium text-app-text-muted"
                    >
                      Task description (optional)
                    </label>
                    <Textarea
                      id={`custom-task-description-${index}`}
                      value={task.description}
                      onChange={(event) =>
                        onTasksChange((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  description: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                      placeholder="Additional details for this task"
                      minRows={1}
                      maxRows={6}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {tasks.length === 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-app-border bg-app-surface p-3 text-center">
              <p className="text-xs text-app-text-muted">
                No tasks added yet. Tasks help break down complex steps.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

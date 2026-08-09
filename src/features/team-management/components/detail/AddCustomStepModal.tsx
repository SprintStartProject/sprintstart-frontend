import { Plus, X } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { AutoResizeTextarea } from '../../../../components/ui/AutoResizeTextarea';
import { Button } from '../../../../components/ui/Button';
import { DragHandle } from '../../../../components/ui/DragHandle';
import { Modal } from '../../../../components/ui/Modal';

export type CustomStepTaskDraft = {
    title: string;
    description: string;
};

type AddCustomStepModalProps = {
    open: boolean;
    title: string;
    description: string;
    expectedOutcome: string;
    estimatedMinutes: string;
    tasks: CustomStepTaskDraft[];
    addingStep: boolean;
    errorMessage: string;
    onTitleChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onExpectedOutcomeChange: (value: string) => void;
    onEstimatedMinutesChange: (value: string) => void;
    onTasksChange: (updater: (current: CustomStepTaskDraft[]) => CustomStepTaskDraft[]) => void;
    onClose: () => void;
    onSubmit: () => void;
};

export function AddCustomStepModal({
    open,
    title,
    description,
    expectedOutcome,
    estimatedMinutes,
    tasks,
    addingStep,
    errorMessage,
    onTitleChange,
    onDescriptionChange,
    onExpectedOutcomeChange,
    onEstimatedMinutesChange,
    onTasksChange,
    onClose,
    onSubmit,
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
            title="Add Custom Step"
            description="Add the project-specific step for the selected slot."
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
                        {addingStep ? 'Adding...' : 'Add step'}
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                {/* Title and estimated minutes in one row */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-3">
                        <label htmlFor="custom-step-title" className="text-xs font-medium text-app-text-muted">
                            Step title *
                        </label>
                        <input
                            id="custom-step-title"
                            value={title}
                            onChange={(event) => onTitleChange(event.target.value)}
                            placeholder="e.g., Meet your colleagues"
                            className="mt-1 w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand"
                        />
                    </div>

                    <div>
                        <label htmlFor="custom-step-minutes" className="text-xs font-medium text-app-text-muted">
                            Est. minutes *
                        </label>
                        <input
                            id="custom-step-minutes"
                            type="number"
                            min="1"
                            value={estimatedMinutes}
                            onChange={(event) => onEstimatedMinutesChange(event.target.value)}
                            placeholder="30"
                            className="mt-1 w-full rounded-xl border border-app-border bg-app-bg px-2 py-1.5 text-center text-sm text-app-text outline-none focus:border-app-brand [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                    </div>
                </div>

                {/* Description field - auto-resizing */}
                <div>
                    <label htmlFor="custom-step-description" className="text-xs font-medium text-app-text-muted">
                        Description
                    </label>
                    <div className="mt-1">
                        <AutoResizeTextarea
                            id="custom-step-description"
                            value={description}
                            onChange={onDescriptionChange}
                            placeholder="Describe what the member should do. Keep it clear and actionable."
                            minRows={3}
                            maxRows={10}
                        />
                    </div>
                </div>

                {/* Expected outcome field - auto-resizing */}
                <div>
                    <label htmlFor="custom-step-expected-outcome" className="text-xs font-medium text-app-text-muted">
                        Expected outcome
                    </label>
                    <div className="mt-1">
                        <AutoResizeTextarea
                            id="custom-step-expected-outcome"
                            value={expectedOutcome}
                            onChange={onExpectedOutcomeChange}
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
                                onTasksChange((current) => [
                                    ...current,
                                    { title: '', description: '' },
                                ])
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
                                    event.dataTransfer.effectAllowed = 'move';
                                    setDraggedIndex(index);
                                }}
                                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                                    if (draggedIndex === null || draggedIndex === index) return;
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                    setDragOverIndex(index);
                                }}
                                onDragLeave={(event: DragEvent<HTMLDivElement>) => {
                                    const nextTarget = event.relatedTarget;
                                    if (
                                        nextTarget instanceof Node &&
                                        event.currentTarget.contains(nextTarget)
                                    ) {
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
                                        ? 'border-app-brand bg-app-brand-soft shadow-sm'
                                        : 'border-app-border'
                                } ${draggedIndex === index ? 'scale-[0.99] opacity-50' : ''}`}
                            >
                                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/task-item:opacity-100">
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
                                                    current.filter(
                                                        (_, itemIndex) => itemIndex !== index,
                                                    ),
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
                                            <label htmlFor={`custom-task-title-${index}`} className="text-xs font-medium text-app-text-muted">
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
                                        <label htmlFor={`custom-task-description-${index}`} className="mb-1 block text-xs font-medium text-app-text-muted">
                                            Task description (optional)
                                        </label>
                                        <AutoResizeTextarea
                                            id={`custom-task-description-${index}`}
                                            value={task.description}
                                            onChange={(value) =>
                                                onTasksChange((current) =>
                                                    current.map((item, itemIndex) =>
                                                        itemIndex === index
                                                            ? {
                                                                  ...item,
                                                                  description: value,
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

                {errorMessage && (
                    <div className="rounded-xl border border-app-danger-border bg-app-danger-bg p-3">
                        <p className="text-xs font-medium text-app-danger-text">
                            {errorMessage}
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    );
}

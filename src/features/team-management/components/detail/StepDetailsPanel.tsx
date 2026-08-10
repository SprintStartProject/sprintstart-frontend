import {
    CheckCircle2,
    Circle,
    MessageSquareText,
    Plus,
    SkipForward,
    ThumbsDown,
    ThumbsUp,
    Trash2,
} from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { DragHandle } from '../../../../components/ui/DragHandle';
import { SidePanel } from '../../../../components/ui/SidePanel';
import { StepOriginBadge } from '../../../onboarding/components/StepOriginBadge';
import type {
    OnboardingStepEndpoint,
    OnboardingTaskEndpoint,
} from '../../../onboarding/types';
import type { OnboardingFeedback } from '../../../../services/teamManagementService';

type DetailOnboardingStep = OnboardingStepEndpoint & {
    startedAt?: string | null;
    durationMinutes?: number | null;
    skip?: {
        id?: string;
        status?: string;
        accepted?: boolean | null;
        reason?: string;
        reviewComment?: string | null;
        reviewedAt?: string | null;
    } | null;
};

type TaskInsertTarget = {
    stepId: string;
    position: number;
} | null;

type StepDetailsPanelProps = {
    step: DetailOnboardingStep;
    tasks: OnboardingTaskEndpoint[];
    doneTaskCount: number;
    actualMinutes: number | null;
    feedbackItems: OnboardingFeedback[];
    skipReason: string;
    taskInsertTarget: TaskInsertTarget;
    newTaskTitle: string;
    newTaskDescription: string;
    addingTask: boolean;
    stepActionId: string | null;
    stepToDelete: DetailOnboardingStep | null;
    taskToDelete: OnboardingTaskEndpoint | null;
    onClose: () => void;
    onRequestDeleteStep: (step: DetailOnboardingStep) => void;
    onCancelDeleteStep: () => void;
    onConfirmDeleteStep: (step: DetailOnboardingStep) => void;
    onRequestDeleteTask: (task: OnboardingTaskEndpoint) => void;
    onCancelDeleteTask: () => void;
    onConfirmDeleteTask: (task: OnboardingTaskEndpoint) => void;
    onTaskInsertTargetChange: (target: TaskInsertTarget) => void;
    onNewTaskTitleChange: (value: string) => void;
    onNewTaskDescriptionChange: (value: string) => void;
    onCreateTask: () => void;
    formatMinutes: (minutes?: number | null) => string;
    getStepStatusStyles: (status: string) => string;
    onReorderTasks?: (
        activeTaskId: string,
        overTaskId: string,
    ) => void;
};

export function StepDetailsPanel({
    step,
    tasks,
    doneTaskCount,
    actualMinutes,
    feedbackItems,
    skipReason,
    taskInsertTarget,
    newTaskTitle,
    newTaskDescription,
    addingTask,
    stepActionId,
    stepToDelete,
    taskToDelete,
    onClose,
    onRequestDeleteStep,
    onCancelDeleteStep,
    onConfirmDeleteStep,
    onRequestDeleteTask,
    onCancelDeleteTask,
    onConfirmDeleteTask,
    onTaskInsertTargetChange,
    onNewTaskTitleChange,
    onNewTaskDescriptionChange,
    onCreateTask,
    formatMinutes,
    getStepStatusStyles,
    onReorderTasks,
}: StepDetailsPanelProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
    const skipStatus = getSkipStatus(step);
    return (
        <SidePanel
            isOpen
            onClose={onClose}
            title={step.title}
            description={step.description}
            badge={
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStepStatusStyles(step.status)}`}>
                        {step.status.replace('_', ' ')}
                    </span>
                    <StepOriginBadge step={step} />
                </div>
            }
            panelBackgroundClassName="bg-app-surface"
            headerDividerClassName=""
            footerClassName="border-t border-app-border bg-app-surface px-6 py-5"
            closeAriaLabel="Close step details"
            footer={
                stepToDelete?.id === step.id ? (
                    <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3">
                        <p className="text-sm text-app-danger-text">
                            Delete{' '}
                            <span className="font-medium">{step.title}</span>
                            ? This cannot be undone.
                        </p>

                        <div className="mt-3 flex justify-end gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onCancelDeleteStep}
                                disabled={stepActionId === step.id}
                            >
                                Cancel
                            </Button>

                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => onConfirmDeleteStep(step)}
                                loading={stepActionId === step.id}
                            >
                                {stepActionId === step.id
                                    ? 'Deleting...'
                                    : 'Delete'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button
                        variant="dangerSoft"
                        fullWidth
                        onClick={() => onRequestDeleteStep(step)}
                        disabled={stepActionId !== null}
                        icon={<Trash2 className="h-4 w-4" />}
                    >
                        Delete step
                    </Button>
                )
            }
        >
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-app-border bg-app-surface-muted px-3 py-2">
                    <p className="text-app-text-muted">Estimate</p>
                    <p className="mt-1 font-semibold text-app-text">
                        {formatMinutes(step.estimatedMinutes)}
                    </p>
                </div>

                <div className="rounded-xl border border-app-border bg-app-surface-muted px-3 py-2">
                    <p className="text-app-text-muted">Actual</p>
                    <p className="mt-1 font-semibold text-app-text">
                        {actualMinutes ? formatMinutes(actualMinutes) : 'Open'}
                    </p>
                </div>
            </div>

            <section className="mt-6">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-app-text">
                        Tasks
                    </h3>
                    <span className="rounded-full bg-app-surface-muted px-2.5 py-1 text-xs text-app-text-muted">
                        {doneTaskCount}/{tasks.length} done
                    </span>
                </div>

                <div className="mt-3 space-y-2">
                    {tasks.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                            <p>No tasks for this step.</p>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                    onTaskInsertTargetChange({
                                        stepId: step.id,
                                        position: 0,
                                    })
                                }
                                icon={<Plus className="h-3.5 w-3.5" />}
                                className="mt-3"
                            >
                                Add first task
                            </Button>
                        </div>
                    ) : (
                        tasks.map((task, index) => (
                            <TaskItem
                                key={task.id}
                                task={task}
                                index={index}
                                step={step}
                                taskInsertTarget={taskInsertTarget}
                                newTaskTitle={newTaskTitle}
                                newTaskDescription={newTaskDescription}
                                addingTask={addingTask}
                                draggedTaskId={draggedTaskId}
                                dragOverTaskId={dragOverTaskId}
                                stepActionId={stepActionId}
                                taskToDelete={taskToDelete}
                                onTaskInsertTargetChange={onTaskInsertTargetChange}
                                onNewTaskTitleChange={onNewTaskTitleChange}
                                onNewTaskDescriptionChange={onNewTaskDescriptionChange}
                                onCreateTask={onCreateTask}
                                onRequestDeleteTask={onRequestDeleteTask}
                                onCancelDeleteTask={onCancelDeleteTask}
                                onConfirmDeleteTask={onConfirmDeleteTask}
                                draggable={Boolean(onReorderTasks)}
                                onDragStart={(taskId) => setDraggedTaskId(taskId)}
                                onDragOver={(taskId) => setDragOverTaskId(taskId)}
                                onDragLeave={() => setDragOverTaskId(null)}
                                onDrop={(taskId) => {
                                    if (onReorderTasks && draggedTaskId && draggedTaskId !== taskId) {
                                        onReorderTasks(draggedTaskId, taskId);
                                    }
                                    setDraggedTaskId(null);
                                    setDragOverTaskId(null);
                                }}
                            />
                        ))
                    )}

                    {taskInsertTarget?.stepId === step.id && tasks.length === 0 && (
                        <NewTaskForm
                            title={newTaskTitle}
                            description={newTaskDescription}
                            addingTask={addingTask}
                            onTitleChange={onNewTaskTitleChange}
                            onDescriptionChange={onNewTaskDescriptionChange}
                            onCancel={() => {
                                onTaskInsertTargetChange(null);
                                onNewTaskTitleChange('');
                                onNewTaskDescriptionChange('');
                            }}
                            onSubmit={onCreateTask}
                        />
                    )}
                </div>
            </section>

            <section className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-app-text">
                    Requests & feedback
                </h3>

                {skipReason && (
                    <div className={`rounded-2xl border px-4 py-3 ${
                        step.status === 'SKIPPED'
                            ? 'border-app-danger-border bg-app-danger-bg'
                            : 'border-app-warning-border bg-app-warning-bg'
                    }`}>
                        <div className="flex items-start gap-3">
                            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface ${
                                step.status === 'SKIPPED'
                                    ? 'text-app-danger-text'
                                    : 'text-app-warning-text'
                            }`}>
                                <SkipForward className="h-4 w-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-app-text">
                                        Skip request
                                    </p>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        step.status === 'SKIPPED'
                                            ? 'bg-app-surface text-app-danger-text'
                                            : 'bg-app-surface text-app-warning-text'
                                    }`}>
                                        {skipStatus}
                                    </span>
                                </div>

                                <p className="mt-2 text-sm text-app-text">
                                    {skipReason}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {feedbackItems.length > 0 ? (
                    feedbackItems.map((feedback) => {
                        const rating = getFeedbackRating(feedback.helpful);

                        return (
                            <div
                                key={feedback.id}
                                className="rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3"
                            >
                                <div className="flex items-start gap-3">
                                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${rating.iconClassName}`}>
                                        {rating.icon}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-app-text">
                                                Feedback
                                            </p>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rating.badgeClassName}`}>
                                                {rating.label}
                                            </span>
                                            {feedback.read === false && (
                                                <span className="rounded-full bg-app-warning-bg px-2 py-0.5 text-xs font-medium text-app-warning-text">
                                                    Unread
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-2 text-sm text-app-text">
                                            {feedback.message}
                                        </p>

                                        {feedback.createdAt && (
                                            <p className="mt-2 text-xs text-app-text-muted">
                                                {new Date(feedback.createdAt).toLocaleDateString(
                                                    'en-US',
                                                    {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    },
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    !skipReason && (
                        <p className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                            No skip request or feedback for this step.
                        </p>
                    )
                )}
            </section>
        </SidePanel>
    );
}

function TaskItem({
    task,
    index,
    step,
    taskInsertTarget,
    newTaskTitle,
    newTaskDescription,
    addingTask,
    draggedTaskId,
    dragOverTaskId,
    stepActionId,
    taskToDelete,
    onTaskInsertTargetChange,
    onNewTaskTitleChange,
    onNewTaskDescriptionChange,
    onCreateTask,
    onRequestDeleteTask,
    onCancelDeleteTask,
    onConfirmDeleteTask,
    draggable,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    task: OnboardingTaskEndpoint;
    index: number;
    step: DetailOnboardingStep;
    taskInsertTarget: TaskInsertTarget;
    newTaskTitle: string;
    newTaskDescription: string;
    addingTask: boolean;
    draggedTaskId: string | null;
    dragOverTaskId: string | null;
    stepActionId: string | null;
    taskToDelete: OnboardingTaskEndpoint | null;
    onTaskInsertTargetChange: (target: TaskInsertTarget) => void;
    onNewTaskTitleChange: (value: string) => void;
    onNewTaskDescriptionChange: (value: string) => void;
    onCreateTask: () => void;
    onRequestDeleteTask: (task: OnboardingTaskEndpoint) => void;
    onCancelDeleteTask: () => void;
    onConfirmDeleteTask: (task: OnboardingTaskEndpoint) => void;
    draggable: boolean;
    onDragStart: (taskId: string) => void;
    onDragOver: (taskId: string) => void;
    onDragLeave: () => void;
    onDrop: (taskId: string) => void;
}) {
    const isDragging = draggedTaskId === task.id;
    const isDragTarget = dragOverTaskId === task.id && draggedTaskId !== task.id;

    return (
        <div className="group/task-insert space-y-1">
            {index === 0 && (
                <TaskInsertButton
                    label={`Add task before ${task.title}`}
                    onClick={() =>
                        onTaskInsertTargetChange({
                            stepId: step.id,
                            position: 0,
                        })
                    }
                />
            )}

            {index === 0 &&
                taskInsertTarget?.stepId === step.id &&
                taskInsertTarget.position === 0 && (
                    <NewTaskForm
                        title={newTaskTitle}
                        description={newTaskDescription}
                        addingTask={addingTask}
                        onTitleChange={onNewTaskTitleChange}
                        onDescriptionChange={onNewTaskDescriptionChange}
                        onCancel={() => {
                            onTaskInsertTargetChange(null);
                            onNewTaskTitleChange('');
                            onNewTaskDescriptionChange('');
                        }}
                        onSubmit={onCreateTask}
                    />
                )}

            <div
                draggable={draggable}
                onDragStart={(event: DragEvent<HTMLDivElement>) => {
                    if (!draggable) return;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', task.id);
                    onDragStart(task.id);
                }}
                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                    if (!draggable) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    onDragOver(task.id);
                }}
                onDragLeave={(event: DragEvent<HTMLDivElement>) => {
                    if (!draggable) return;
                    const nextTarget = event.relatedTarget;
                    if (
                        nextTarget instanceof Node &&
                        event.currentTarget.contains(nextTarget)
                    ) {
                        return;
                    }
                    onDragLeave();
                }}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                    if (!draggable) return;
                    event.preventDefault();
                    onDrop(task.id);
                }}
                className={`group/task flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition-all ${
                    isDragTarget
                        ? 'border-app-brand bg-app-brand-soft shadow-sm'
                        : 'border-app-border bg-app-surface-muted'
                } ${isDragging ? 'scale-[0.99] opacity-50' : ''}`}
            >
                <div className="flex min-w-0">
                    {draggable && (
                        <DragHandle
                            visibleClassName="group-hover/task:mr-1 group-hover/task:w-4 group-hover/task:opacity-100"
                            className="mt-0.5"
                        />
                    )}

                    <div className="flex min-w-0 gap-2">
                        {task.finished ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-app-success-solid" />
                        ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-app-text-disabled" />
                        )}

                        <div className="min-w-0">
                            <p className={`text-sm font-medium ${
                                task.finished
                                    ? 'line-through text-app-text-subtle'
                                    : 'text-app-text'
                            }`}>
                                {task.title}
                            </p>
                            {task.description && (
                                <p className="mt-1 text-xs text-app-text-muted">
                                    {task.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onRequestDeleteTask(task)}
                    disabled={stepActionId !== null}
                    className="rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-danger-bg hover:text-app-danger-text disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Delete ${task.title}`}
                    title="Delete task"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {taskToDelete?.id === task.id && (
                <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3">
                    <p className="text-sm text-app-danger-text">
                        Delete{' '}
                        <span className="font-medium">
                            {task.title}
                        </span>
                        ? This cannot be undone.
                    </p>

                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancelDeleteTask}
                            disabled={stepActionId === task.stepId}
                            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-xs font-medium text-app-text hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onConfirmDeleteTask(task)}
                            loading={stepActionId === task.stepId}
                        >
                            {stepActionId === task.stepId
                                ? 'Deleting...'
                                : 'Delete'}
                        </Button>
                    </div>
                </div>
            )}

            <TaskInsertButton
                label={`Add task after ${task.title}`}
                onClick={() =>
                    onTaskInsertTargetChange({
                        stepId: step.id,
                        position: index + 1,
                    })
                }
            />

            {taskInsertTarget?.stepId === step.id &&
                taskInsertTarget.position === index + 1 && (
                    <NewTaskForm
                        title={newTaskTitle}
                        description={newTaskDescription}
                        addingTask={addingTask}
                        onTitleChange={onNewTaskTitleChange}
                        onDescriptionChange={onNewTaskDescriptionChange}
                        onCancel={() => {
                            onTaskInsertTargetChange(null);
                            onNewTaskTitleChange('');
                            onNewTaskDescriptionChange('');
                        }}
                        onSubmit={onCreateTask}
                    />
                )}
        </div>
    );
}

function getSkipStatus(step: DetailOnboardingStep) {
    if (step.skip?.status) {
        return step.skip.status.charAt(0) + step.skip.status.slice(1).toLowerCase();
    }

    if (step.skip?.accepted === true || step.status === 'SKIPPED') {
        return 'Accepted';
    }

    if (step.skip?.accepted === false) {
        return 'Denied';
    }

    return 'Pending';
}

function getFeedbackRating(helpful?: boolean | null) {
    if (helpful === true) {
        return {
            label: 'Helpful',
            icon: <ThumbsUp className="h-4 w-4" />,
            iconClassName: 'bg-app-success-bg text-app-success-solid',
            badgeClassName: 'bg-app-success-bg text-app-success-solid',
        };
    }

    if (helpful === false) {
        return {
            label: 'Not helpful',
            icon: <ThumbsDown className="h-4 w-4" />,
            iconClassName: 'bg-app-danger-bg text-app-danger-text',
            badgeClassName: 'bg-app-danger-bg text-app-danger-text',
        };
    }

    return {
        label: 'Feedback',
        icon: <MessageSquareText className="h-4 w-4" />,
        iconClassName: 'bg-app-surface text-app-text-muted',
        badgeClassName: 'bg-app-border-muted text-app-text-muted',
    };
}

function TaskInsertButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-4 w-full items-center justify-center border-y border-transparent text-app-text-muted transition-all before:h-px before:flex-1 before:bg-app-border-muted after:h-px after:flex-1 after:bg-app-border-muted hover:text-app-brand"
            aria-label={label}
            title="Add task here"
        >
            <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/step-insert:opacity-100 group-hover/task-insert:opacity-100" />
        </button>
    );
}

function NewTaskForm({
    title,
    description,
    addingTask,
    onTitleChange,
    onDescriptionChange,
    onCancel,
    onSubmit,
}: {
    title: string;
    description: string;
    addingTask: boolean;
    onTitleChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
}) {
    return (
        <div className="rounded-2xl border border-app-brand-border bg-app-brand-soft p-3">
            <Input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Task title"
                aria-label="Task title"
            />
            <Input
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                placeholder="Optional description"
                aria-label="Task description"
                className="mt-2"
            />
            <div className="mt-3 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={addingTask}
                    className="rounded-xl border border-app-border px-3 py-2 text-xs font-medium text-app-text hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Cancel
                </button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={onSubmit}
                    disabled={title.trim().length === 0}
                    loading={addingTask}
                    icon={<Plus className="h-3.5 w-3.5" />}
                >
                    {addingTask ? 'Adding...' : 'Add task'}
                </Button>
            </div>
        </div>
    );
}

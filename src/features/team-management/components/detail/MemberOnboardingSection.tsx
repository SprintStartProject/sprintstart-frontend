import {
    AlertTriangle,
    CheckCircle2,
    Circle,
    Clock,
    ClipboardList,
    Plus,
    SkipForward,
} from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { DragHandle } from '../../../../components/ui/DragHandle';
import { StepOriginBadge } from '../../../onboarding/components/StepOriginBadge';
import type {
    OnboardingPhaseEndpoint,
    OnboardingStepEndpoint,
} from '../../../onboarding/types';

type DetailOnboardingStep = OnboardingStepEndpoint & {
    startedAt?: string | null;
    durationMinutes?: number | null;
    skip?: {
        id?: string;
        status?: string;
        reason?: string;
    } | null;
};

type StepTaskCount = {
    total: number;
    done: number;
};

type StepInsertTarget = {
    phaseId: string;
    position: number;
};

type MemberOnboardingSectionProps = {
    phases: OnboardingPhaseEndpoint[];
    selectedPhase?: OnboardingPhaseEndpoint;
    selectedPhaseSteps: DetailOnboardingStep[];
    selectedStep?: DetailOnboardingStep | null;
    nextStep?: DetailOnboardingStep | null;
    finishedSteps: number;
    totalSteps: number;
    estimatedMinutes: number;
    skippedSteps: number;
    pendingSkipCount: number;
    stepTaskCounts: Record<string, StepTaskCount>;
    onSelectPhase: (phaseId: string, firstStepId: string) => void;
    onSelectStep: (stepId: string) => void;
    onAddStep: (target: StepInsertTarget) => void;
    onReorderSteps: (
        phaseId: string,
        activeStepId: string,
        overStepId: string,
    ) => void;
    formatMinutes: (minutes?: number | null) => string;
    getActualMinutes: (step: DetailOnboardingStep) => number | null;
    getStepStatusStyles: (status: string) => string;
};

export function MemberOnboardingSection({
    phases,
    selectedPhase,
    selectedPhaseSteps,
    selectedStep,
    nextStep,
    finishedSteps,
    totalSteps,
    estimatedMinutes,
    skippedSteps,
    pendingSkipCount,
    stepTaskCounts,
    onSelectPhase,
    onSelectStep,
    onAddStep,
    onReorderSteps,
    formatMinutes,
    getActualMinutes,
    getStepStatusStyles,
}: MemberOnboardingSectionProps) {
    return (
        <div className="rounded-2xl border border-app-border bg-app-surface p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-app-brand" />
                        <h2 className="text-lg font-semibold text-app-text">
                            Member onboarding
                        </h2>
                    </div>

                    <p className="mt-1 text-sm text-app-text-muted">
                        Preview the member journey and add project-specific steps.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
                    <MetricCard label="Done" value={`${finishedSteps}/${totalSteps || 0}`} />
                    <MetricCard label="Estimate" value={formatMinutes(estimatedMinutes)} />
                    <MetricCard label="Skipped" value={String(skippedSteps)} />
                    <MetricCard
                        label="Requests"
                        value={String(pendingSkipCount)}
                        warning={pendingSkipCount > 0}
                    />
                </div>
            </div>

            {phases.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-6 text-sm text-app-text-muted">
                    No onboarding path details are available for this user yet.
                </div>
            ) : (
                <>
                    <PhasePicker
                        phases={phases}
                        selectedPhaseId={selectedPhase?.id}
                        onSelectPhase={onSelectPhase}
                    />

                    <div className="mt-5">
                        <div>
                            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-app-text">
                                        {selectedPhase?.title}
                                    </h3>
                                    {selectedPhase?.description && (
                                        <p className="mt-1 text-xs text-app-text-muted">
                                            {selectedPhase.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <StepList
                                selectedPhase={selectedPhase}
                                steps={selectedPhaseSteps}
                                selectedStep={selectedStep}
                                nextStep={nextStep}
                                stepTaskCounts={stepTaskCounts}
                                onSelectStep={onSelectStep}
                                onAddStep={onAddStep}
                                onReorderSteps={onReorderSteps}
                                formatMinutes={formatMinutes}
                                getActualMinutes={getActualMinutes}
                                getStepStatusStyles={getStepStatusStyles}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function MetricCard({
    label,
    value,
    warning = false,
}: {
    label: string;
    value: string;
    warning?: boolean;
}) {
    return (
        <div className={`rounded-2xl border px-3 py-2 ${
            warning
                ? 'border-app-warning-border bg-app-warning-bg'
                : 'border-app-border bg-app-surface-muted'
        }`}>
            <p className="text-xs text-app-text-muted">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${
                warning ? 'text-app-warning-text' : 'text-app-text'
            }`}>
                {value}
            </p>
        </div>
    );
}

function PhasePicker({
    phases,
    selectedPhaseId,
    onSelectPhase,
}: {
    phases: OnboardingPhaseEndpoint[];
    selectedPhaseId?: string;
    onSelectPhase: (phaseId: string, firstStepId: string) => void;
}) {
    return (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {phases.map((phase) => {
                const steps = phase.steps ?? [];
                const completed = steps.filter(
                    (step) =>
                        step.status === 'FINISHED' ||
                        step.status === 'SKIPPED',
                ).length;
                const percentage =
                    steps.length > 0
                        ? Math.round((completed / steps.length) * 100)
                        : 0;
                const isSelected = phase.id === selectedPhaseId;

                return (
                    <button
                        key={phase.id}
                        type="button"
                        onClick={() => onSelectPhase(phase.id, steps[0]?.id ?? '')}
                        className={`rounded-2xl border p-4 text-left transition-all duration-200 motion-reduce:hover:scale-100 ${
                            isSelected
                                ? 'border-app-brand bg-app-brand-soft'
                                : 'border-app-border bg-app-surface-muted hover:scale-[1.02] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-app-text">
                                {phase.title}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${
                                percentage === 100
                                    ? 'bg-app-success-bg text-app-success-text'
                                    : 'bg-app-surface text-app-text-muted'
                            }`}>
                                {percentage}%
                            </span>
                        </div>

                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-app-border-muted">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>

                        <p className="mt-2 text-xs text-app-text-muted">
                            {completed}/{steps.length} steps
                        </p>
                    </button>
                );
            })}
        </div>
    );
}

function StepList({
    selectedPhase,
    steps,
    selectedStep,
    nextStep,
    stepTaskCounts,
    onSelectStep,
    onAddStep,
    onReorderSteps,
    formatMinutes,
    getActualMinutes,
    getStepStatusStyles,
}: {
    selectedPhase?: OnboardingPhaseEndpoint;
    steps: DetailOnboardingStep[];
    selectedStep?: DetailOnboardingStep | null;
    nextStep?: DetailOnboardingStep | null;
    stepTaskCounts: Record<string, StepTaskCount>;
    onSelectStep: (stepId: string) => void;
    onAddStep: (target: StepInsertTarget) => void;
    onReorderSteps: (
        phaseId: string,
        activeStepId: string,
        overStepId: string,
    ) => void;
    formatMinutes: (minutes?: number | null) => string;
    getActualMinutes: (step: DetailOnboardingStep) => number | null;
    getStepStatusStyles: (status: string) => string;
}) {
    const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
    const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

    if (steps.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-5 text-sm text-app-text-muted">
                <p>This phase has no steps yet.</p>
                {selectedPhase && (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                            onAddStep({
                                phaseId: selectedPhase.id,
                                position: 0,
                            })
                        }
                        icon={<Plus className="h-3.5 w-3.5" />}
                        className="mt-3"
                    >
                        Add first step
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {steps.map((step, index) => {
                const skipReason = step.skip?.reason;
                const isSelected = step.id === selectedStep?.id;
                const isNextStep = step.id === nextStep?.id;
                const actualMinutes = getActualMinutes(step);
                const timingDelta =
                    actualMinutes && step.estimatedMinutes
                        ? actualMinutes - step.estimatedMinutes
                        : null;
                const isDragging = draggedStepId === step.id;
                const isDragTarget =
                    dragOverStepId === step.id && draggedStepId !== step.id;

                return (
                    <div
                        key={step.id}
                        className="group/step-insert space-y-1"
                        onDragOver={(event) => {
                            if (!draggedStepId || draggedStepId === step.id) return;

                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            setDragOverStepId(step.id);
                        }}
                        onDragLeave={(event) => {
                            const nextTarget = event.relatedTarget;

                            if (
                                nextTarget instanceof Node &&
                                event.currentTarget.contains(nextTarget)
                            ) {
                                return;
                            }

                            setDragOverStepId((currentStepId) =>
                                currentStepId === step.id ? null : currentStepId,
                            );
                        }}
                        onDrop={(event) => {
                            event.preventDefault();

                            if (!selectedPhase || !draggedStepId) return;

                            onReorderSteps(
                                selectedPhase.id,
                                draggedStepId,
                                step.id,
                            );
                            setDraggedStepId(null);
                            setDragOverStepId(null);
                        }}
                    >
                        {index === 0 && selectedPhase && (
                            <StepInsertButton
                                label={`Add step before ${step.title}`}
                                onClick={() =>
                                    onAddStep({
                                        phaseId: selectedPhase.id,
                                        position: 0,
                                    })
                                }
                            />
                        )}

                        <StepCard
                            step={step}
                            isSelected={isSelected}
                            isNextStep={isNextStep}
                            skipReason={skipReason}
                            actualMinutes={actualMinutes}
                            timingDelta={timingDelta}
                            taskCount={stepTaskCounts[step.id]}
                            onSelect={() => onSelectStep(step.id)}
                            onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', step.id);
                                setDraggedStepId(step.id);
                            }}
                            onDragEnd={() => {
                                setDraggedStepId(null);
                                setDragOverStepId(null);
                            }}
                            isDragging={isDragging}
                            isDragTarget={isDragTarget}
                            formatMinutes={formatMinutes}
                            getStepStatusStyles={getStepStatusStyles}
                        />

                        {selectedPhase && (
                            <StepInsertButton
                                label={`Add step after ${step.title}`}
                                onClick={() =>
                                    onAddStep({
                                        phaseId: selectedPhase.id,
                                        position: index + 1,
                                    })
                                }
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function StepCard({
    step,
    isSelected,
    isNextStep,
    skipReason,
    actualMinutes,
    timingDelta,
    taskCount,
    onSelect,
    onDragStart,
    onDragEnd,
    isDragging,
    isDragTarget,
    formatMinutes,
    getStepStatusStyles,
}: {
    step: DetailOnboardingStep;
    isSelected: boolean;
    isNextStep: boolean;
    skipReason?: string;
    actualMinutes: number | null;
    timingDelta: number | null;
    taskCount?: StepTaskCount;
    onSelect: () => void;
    onDragStart: (event: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
    isDragging: boolean;
    isDragTarget: boolean;
    formatMinutes: (minutes?: number | null) => string;
    getStepStatusStyles: (status: string) => string;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
            className={`group/step w-full rounded-2xl border bg-app-surface p-4 text-left transition-all ${
                isDragTarget
                    ? 'border-app-brand bg-app-brand-soft shadow-sm'
                    : isSelected
                    ? 'border-app-brand shadow-sm'
                    : isNextStep
                      ? 'border-app-brand-border bg-app-brand-soft'
                      : 'border-app-border hover:border-app-border-strong'
            } ${
                step.status === 'FINISHED' || step.status === 'SKIPPED'
                    ? 'opacity-70'
                    : ''
            } ${
                isDragging ? 'scale-[0.99] opacity-50' : ''
            }`}
        >
            <div className="flex gap-4">
                <div className="flex items-center">
                    <DragHandle visibleClassName="group-hover/step:mr-1 group-hover/step:w-4 group-hover/step:opacity-100 group-hover/step:text-app-text-muted" />

                    <span>
                        {step.status === 'FINISHED' ? (
                            <CheckCircle2 className="h-5 w-5 text-app-success-solid" />
                        ) : step.status === 'SKIPPED' ? (
                            <SkipForward className="h-5 w-5 text-app-danger-solid" />
                        ) : step.status === 'IN_PROGRESS' ? (
                            <Clock className="h-5 w-5 text-app-warning-text" />
                        ) : (
                            <Circle className="h-5 w-5 text-app-text-disabled" />
                        )}
                    </span>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            {isNextStep && (
                                <Badge variant="brand" size="sm" className="mb-1">
                                    Up next
                                </Badge>
                            )}
                            <h4 className={`text-sm font-semibold ${
                                step.status === 'FINISHED' ||
                                step.status === 'SKIPPED'
                                    ? 'line-through text-app-text-subtle'
                                    : 'text-app-text'
                            }`}>
                                {step.title}
                            </h4>
                            <div className="mt-2">
                                <StepOriginBadge step={step} />
                            </div>
                        </div>

                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getStepStatusStyles(step.status)}`}>
                            {step.status.replace('_', ' ')}
                        </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-app-text-muted">
                        <span className="rounded-full bg-app-surface-muted px-2 py-0.5">
                            {formatMinutes(step.estimatedMinutes)}
                        </span>
                        <span className="rounded-full bg-app-surface-muted px-2 py-0.5">
                            {taskCount
                                ? `${taskCount.done}/${taskCount.total} tasks`
                                : 'Tasks ...'}
                        </span>
                        {actualMinutes && (
                            <span className={`rounded-full px-2 py-0.5 ${
                                timingDelta !== null && timingDelta > 0
                                    ? 'bg-app-warning-bg text-app-warning-text'
                                    : 'bg-app-success-bg text-app-success-text'
                            }`}>
                                Actual {formatMinutes(actualMinutes)}
                                {timingDelta === 0
                                    ? ' (on time)'
                                    : timingDelta !== null
                                      ? ` (${timingDelta > 0 ? '+' : '-'}${formatMinutes(Math.abs(timingDelta))})`
                                      : ''}
                            </span>
                        )}
                        {skipReason && (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
                                step.status === 'SKIPPED'
                                    ? 'border-app-danger-border bg-app-danger-bg text-app-danger-text'
                                    : 'border-app-warning-border bg-app-warning-bg text-app-warning-text'
                            }`}>
                                <AlertTriangle className="h-3 w-3" />
                                {step.status === 'SKIPPED'
                                    ? 'Skipped'
                                    : 'Skip requested'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StepInsertButton({
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
            title="Add step here"
        >
            <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/step-insert:opacity-100 group-hover/task-insert:opacity-100" />
        </button>
    );
}

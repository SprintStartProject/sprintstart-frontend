import { Link, Minus, Pencil, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import type { BlueprintStep, BlueprintTask } from "../../types.ts";
import { activatesOnKey } from "./activatesOnKey.ts";
import { CollapseToggle } from "./CollapseToggle.tsx";
import type { OutlineActions } from "./outlineActions.ts";

interface StepProps {
  step: BlueprintStep;
  actions: OutlineActions;
}

function StepActions({ step, actions }: StepProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="ghost"
        icon={<Pencil className="h-3.5 w-3.5" />}
        onClick={() => actions.whenEditable(() => actions.openEdit({ kind: "step", item: step }))}
      >
        Edit step
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<Plus className="h-3.5 w-3.5" />}
        onClick={() => actions.openCreate("task", step.id, step.blueprintTasks.length)}
      >
        Add task
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<Plus className="h-3.5 w-3.5" />}
        onClick={() => actions.openCreate("resource", step.id, 0)}
      >
        Add resource
      </Button>
    </div>
  );
}

function TaskRow({
  task,
  index,
  actions,
}: {
  task: BlueprintTask;
  index: number;
  actions: OutlineActions;
}) {
  const open = () => actions.openEdit({ kind: "task", item: task });
  return (
    <li
      {...actions.dragProps("task", task.id, index)}
      className="flex items-center gap-2 rounded-lg border border-app-border-muted bg-app-surface-muted p-1"
    >
      <div
        role="button"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-pointer px-2 py-1"
        onClick={open}
        onKeyDown={activatesOnKey(open)}
      >
        • {task.title}
      </div>
      <Button
        aria-label={`Delete task ${task.title}`}
        iconOnly
        size="sm"
        variant="dangerGhost"
        loading={actions.deletingId === task.id}
        onClick={() => actions.requestDelete("task", task.id, task.title)}
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </Button>
    </li>
  );
}

function ResourceRow({
  resource,
  actions,
}: {
  resource: BlueprintStep["blueprintResources"][number];
  actions: OutlineActions;
}) {
  const open = () => actions.openEdit({ kind: "resource", item: resource });
  return (
    <li className="flex items-center gap-2 rounded-lg border border-app-border-muted bg-app-surface-muted p-1">
      <div
        role="button"
        tabIndex={0}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1"
        onClick={open}
        onKeyDown={activatesOnKey(open)}
      >
        <Link className="h-3.5 w-3.5 shrink-0" />
        {resource.title}
      </div>
      <Button
        aria-label={`Delete resource ${resource.title}`}
        iconOnly
        size="sm"
        variant="dangerGhost"
        loading={actions.deletingId === resource.id}
        onClick={() => actions.requestDelete("resource", resource.id, resource.title)}
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </Button>
    </li>
  );
}

const LIST_HEADING = "mb-1 text-xs font-semibold tracking-wide text-app-text-subtle uppercase";

/** A step's checklist of tasks and its attached links, each only when it has any. */
function StepContents({ step, actions }: StepProps) {
  return (
    <>
      {step.blueprintTasks.length > 0 ? (
        <div className="mt-3">
          <p className={LIST_HEADING}>Tasks</p>
          <ul className="space-y-1 text-sm text-app-text-muted">
            {step.blueprintTasks.map((task, index) => (
              <TaskRow key={task.id} task={task} index={index} actions={actions} />
            ))}
          </ul>
        </div>
      ) : null}
      {step.blueprintResources.length > 0 ? (
        <div className="mt-3">
          <p className={LIST_HEADING}>Resources</p>
          <ul className="space-y-1 text-sm text-app-text-muted">
            {step.blueprintResources.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} actions={actions} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

interface StepCardProps extends StepProps {
  index: number;
}

/** One step of a fixed phase: what it is, its tasks and resources, and what can be done to it. */
export function StepCard({ step, index, actions }: StepCardProps) {
  const collapsed = actions.stepsCollapsed.has(step.id);
  return (
    <article
      {...actions.dragProps("step", step.id, index)}
      className="rounded-xl border border-app-border bg-app-surface p-4 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <CollapseToggle
          collapsed={collapsed}
          kind="step"
          name={step.title}
          onToggle={() => actions.stepsCollapsed.toggle(step.id)}
        />
        <div className="min-w-0">
          <h4 className="font-medium text-app-text">
            {step.position + 1}. {step.title}
          </h4>
          <p className="mt-1 text-sm text-app-text-muted">{step.description}</p>
          {!collapsed ? (
            <p className="mt-2 text-xs text-app-text-subtle">
              {step.type} · {step.estimatedMinutes} min · {step.expectedOutcome}
            </p>
          ) : null}
        </div>
      </div>
      {!collapsed ? (
        <>
          <StepActions step={step} actions={actions} />
          <StepContents step={step} actions={actions} />
        </>
      ) : null}
    </article>
  );
}

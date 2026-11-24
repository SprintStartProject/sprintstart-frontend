import { Plus } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { Textarea } from "../../../components/ui/Textarea.tsx";
import type { BlueprintStep } from "../../../services/blueprintTypes.ts";
import { Detail, DetailList, EmptyDetailListItem, ItemRow, SaveError } from "./DetailParts.tsx";
import { fieldSetter, type BlueprintStepMetadata } from "./metadata.ts";

type Task = BlueprintStep["blueprintTasks"][number];
type Resource = BlueprintStep["blueprintResources"][number];

export type StepDetailsProps = {
  step: BlueprintStep;
  editable: boolean;
  saveError: string | null;
  metadata: BlueprintStepMetadata;
  onMetadataChange: Dispatch<SetStateAction<BlueprintStepMetadata>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddTask: (step: BlueprintStep) => void;
  onRemoveTask: (task: Task) => void;
  onAddResource: (step: BlueprintStep) => void;
  onRemoveResource: (resource: Resource) => void;
  onEditTask: (task: Task) => void;
  onEditResource: (resource: Resource) => void;
};

type StepFormProps = Pick<
  StepDetailsProps,
  "saveError" | "metadata" | "onMetadataChange" | "onSubmit"
>;

function StepForm({ saveError, metadata, onMetadataChange, onSubmit }: StepFormProps) {
  const set = fieldSetter<BlueprintStepMetadata>(onMetadataChange);

  return (
    <form id="edit-blueprint-step" className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
      <Field label="Title" required>
        <Input
          value={metadata.title}
          onChange={(event) => set("title")(event.target.value)}
          required
        />
      </Field>
      <Field label="Description" required>
        <Textarea
          value={metadata.description}
          onChange={(event) => set("description")(event.target.value)}
          required
        />
      </Field>
      <Field label="Step type">
        <Select
          value={metadata.type}
          onChange={(event) => set("type")(event.target.value as BlueprintStep["type"])}
        >
          <option value="DOCUMENT">Document</option>
          <option value="VIDEO">Video</option>
          <option value="TASK">Task</option>
        </Select>
      </Field>
      <Field label="Estimated minutes">
        <Input
          type="number"
          min="1"
          value={metadata.estimatedMinutes}
          onChange={(event) => set("estimatedMinutes")(Number(event.target.value))}
        />
      </Field>
      <Field label="Expected outcome">
        <Textarea
          value={metadata.expectedOutcome}
          onChange={(event) => set("expectedOutcome")(event.target.value)}
        />
      </Field>
      <SaveError message={saveError} />
    </form>
  );
}

/** The step as read-only text, for a version that cannot be edited. */
function StepSummary({ step }: { step: BlueprintStep }) {
  return (
    <div className="space-y-5">
      <p className="text-app-text-muted">{step.description || "No description yet."}</p>
      <dl className="grid grid-cols-2 gap-3">
        <Detail label="Type" value={step.type} />
        <Detail label="Duration" value={`${step.estimatedMinutes} minutes`} />
      </dl>
      <Detail label="Expected outcome" value={step.expectedOutcome || "Not specified."} />
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={onClick}>
      {label}
    </Button>
  );
}

type TaskListProps = Pick<
  StepDetailsProps,
  "step" | "editable" | "onAddTask" | "onRemoveTask" | "onEditTask"
>;

function TaskList({ step, editable, onAddTask, onRemoveTask, onEditTask }: TaskListProps) {
  return (
    <DetailList
      title="Tasks"
      action={editable ? <AddButton label="Add task" onClick={() => onAddTask(step)} /> : undefined}
    >
      {step.blueprintTasks.length ? (
        step.blueprintTasks
          .toSorted((left, right) => left.position - right.position)
          .map((task) => (
            <ItemRow
              key={task.id}
              item={task}
              kind="task"
              editable={editable}
              onEdit={() => onEditTask(task)}
              onRemove={() => onRemoveTask(task)}
            />
          ))
      ) : (
        <EmptyDetailListItem>No tasks have been added.</EmptyDetailListItem>
      )}
    </DetailList>
  );
}

type ResourceListProps = Pick<
  StepDetailsProps,
  "step" | "editable" | "onAddResource" | "onRemoveResource" | "onEditResource"
>;

function ResourceList({
  step,
  editable,
  onAddResource,
  onRemoveResource,
  onEditResource,
}: ResourceListProps) {
  return (
    <DetailList
      title="Resources"
      action={
        editable ? (
          <AddButton label="Add resource" onClick={() => onAddResource(step)} />
        ) : undefined
      }
    >
      {step.blueprintResources.length ? (
        step.blueprintResources.map((resource) => (
          <ItemRow
            key={resource.id}
            item={resource}
            kind="resource"
            editable={editable}
            onEdit={() => onEditResource(resource)}
            onRemove={() => onRemoveResource(resource)}
          />
        ))
      ) : (
        <EmptyDetailListItem>No resources have been added.</EmptyDetailListItem>
      )}
    </DetailList>
  );
}

/**
 * A step's details: its fields while it can be edited, its text otherwise, and always its tasks
 * and resources -- on a draft they must stay reachable.
 */
export function StepDetails(props: StepDetailsProps) {
  return (
    <div className="space-y-6 text-sm">
      {props.editable ? <StepForm {...props} /> : <StepSummary step={props.step} />}
      <TaskList {...props} />
      <ResourceList {...props} />
    </div>
  );
}

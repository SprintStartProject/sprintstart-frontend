import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Field";
import { Input } from "../../../../components/ui/Input";
import { Textarea } from "../../../../components/ui/Textarea";
import { useToast } from "../../../../context/useToast";
import { formatMinutes } from "../../../onboarding/journey";
import type { OnboardingStepEndpoint } from "../../../onboarding/types";
import { updateOnboardingStep } from "../../../../services/teamManagementService";

/**
 * A step's text, edited where the step is: in the details beside the graph.
 *
 * The graph is where a PM builds a member's path now -- drop a blank step, draw what it waits on and
 * what it opens -- so naming and describing that step belongs there too, rather than in a dialog that
 * has to be filled in before the step exists. Opens straight into editing for a step just added.
 */
export function StepQuickEdit({
  step,
  startEditing = false,
  onSaved,
}: {
  step: OnboardingStepEndpoint;
  startEditing?: boolean;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description ?? "");
  const [minutes, setMinutes] = useState(String(step.estimatedMinutes || 30));
  const [outcome, setOutcome] = useState(step.expectedOutcomes?.[0] ?? "");

  const reset = () => {
    setTitle(step.title);
    setDescription(step.description ?? "");
    setMinutes(String(step.estimatedMinutes || 30));
    setOutcome(step.expectedOutcomes?.[0] ?? "");
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateOnboardingStep(step.id, {
        position: step.position,
        title: title.trim(),
        description: description.trim(),
        type: step.type,
        estimatedMinutes: Math.max(1, Math.round(Number(minutes)) || 30),
        expectedOutcome: outcome.trim(),
      });
      await onSaved();
      setEditing(false);
    } catch (error) {
      toast.error("Couldn't save the step", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="space-y-2">
        {step.expectedOutcomes?.[0] ? (
          <p className="text-xs text-app-text-muted">
            <span className="font-semibold text-app-text-subtle">Outcome: </span>
            {step.expectedOutcomes[0]}
          </p>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          icon={<Pencil className="h-3.5 w-3.5" />}
          onClick={() => {
            reset();
            setEditing(true);
          }}
        >
          Edit text · {formatMinutes(step.estimatedMinutes)}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-app-brand-border bg-app-brand-soft/30 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field label="Title" required>
        <Input
          size="sm"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          // A step that was just dropped on the canvas has nothing but a placeholder name yet.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={startEditing}
          onFocus={(event) => startEditing && event.currentTarget.select()}
        />
      </Field>
      <Field label="Description">
        <Textarea
          minRows={2}
          maxRows={6}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
        <Field label="Minutes">
          <Input
            size="sm"
            type="number"
            min={1}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </Field>
        <Field label="Expected outcome">
          <Input size="sm" value={outcome} onChange={(event) => setOutcome(event.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => {
            reset();
            setEditing(false);
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          type="submit"
          loading={saving}
          disabled={!title.trim()}
          icon={<Check className="h-3.5 w-3.5" />}
        >
          Save
        </Button>
      </div>
    </form>
  );
}

import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Modal } from "../../../components/ui/Modal.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { Textarea } from "../../../components/ui/Textarea.tsx";
import { kindLabels } from "../pathEditorCopy.ts";
import type { ItemForm } from "../useItemForm.ts";

const FORM_ID = "create-blueprint-item";

function TitleFields({ form }: { form: ItemForm }) {
  const { values, kind, setField } = form;
  if (kind === "question") {
    return (
      <>
        <Field label="Node title" required>
          <Input
            value={values.questionTitle}
            onChange={(event) => setField("questionTitle", event.target.value)}
            required
          />
        </Field>
        <Field label="Question" required>
          <Textarea
            value={values.title}
            onChange={(event) => setField("title", event.target.value)}
            required
          />
        </Field>
      </>
    );
  }
  return (
    <Field label={kind === "option" ? "Label" : "Title"} required>
      <Input
        value={values.title}
        onChange={(event) => setField("title", event.target.value)}
        required
      />
    </Field>
  );
}

function PhaseFields({ form }: { form: ItemForm }) {
  const { values, setField } = form;
  const isAi = values.phaseType === "AI_ENHANCED";
  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-app-border bg-app-surface-muted p-3">
        <div>
          <p className="text-sm font-medium text-app-text">Phase type</p>
          <p className="text-xs text-app-text-muted">
            {isAi ? "AI-enhanced blueprint" : "Fixed blueprint"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Use AI prompt for this phase"
          aria-checked={isAi}
          onClick={() => setField("phaseType", isAi ? "FIXED" : "AI_ENHANCED")}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
            isAi ? "border-app-brand bg-app-brand" : "border-app-border-strong bg-app-neutral-bg"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              isAi ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {isAi ? (
        <Field label="AI prompt" required>
          <Textarea
            value={values.aiPrompt}
            onChange={(event) => setField("aiPrompt", event.target.value)}
            placeholder="Describe how AI should tailor this phase."
            required
          />
        </Field>
      ) : null}
    </>
  );
}

function StepFields({ form }: { form: ItemForm }) {
  const { values, setField } = form;
  return (
    <>
      <Field label="Step type">
        <Select
          value={values.stepType}
          onChange={(event) => setField("stepType", event.target.value)}
        >
          <option value="VIDEO">Video</option>
          <option value="DOCUMENT">Document</option>
          <option value="TASK">Task</option>
        </Select>
      </Field>
      <Field label="Estimated minutes" required>
        <Input
          type="number"
          min="1"
          value={values.minutes}
          onChange={(event) => setField("minutes", event.target.value)}
          required
        />
      </Field>
      <Field label="Expected outcome" required>
        <Textarea
          value={values.outcome}
          onChange={(event) => setField("outcome", event.target.value)}
          required
        />
      </Field>
    </>
  );
}

function QuestionFields({ form }: { form: ItemForm }) {
  const { values, setField } = form;
  return (
    <>
      <Field label="Question type">
        <Select
          value={values.questionType}
          onChange={(event) => setField("questionType", event.target.value)}
        >
          <option value="MULTIPLE_CHOICE">Multiple choice</option>
          <option value="SHORT_TEXT">Short text</option>
        </Select>
      </Field>
      <Field label="Explanation">
        <Textarea
          value={values.explanation}
          onChange={(event) => setField("explanation", event.target.value)}
        />
      </Field>
      <Field label="Correct answer (for free text)">
        <Input
          value={values.correctAnswer}
          onChange={(event) => setField("correctAnswer", event.target.value)}
        />
      </Field>
    </>
  );
}

/** The fields only some kinds of item have, after the title every kind shares. */
function KindFields({ form }: { form: ItemForm }) {
  const { values, kind, setField } = form;
  const hasDescription = kind !== null && kind !== "option" && kind !== "question";
  return (
    <>
      {hasDescription ? (
        // A phase may have no description; everything else that has one must have one.
        <Field label="Description" required={kind !== "phase"}>
          <Textarea
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
            required={kind !== "phase"}
          />
        </Field>
      ) : null}
      {kind === "phase" ? <PhaseFields form={form} /> : null}
      {kind === "resource" ? (
        <Field label="URL" required>
          <Input
            type="url"
            value={values.url}
            onChange={(event) => setField("url", event.target.value)}
            required
          />
        </Field>
      ) : null}
      {kind === "step" ? <StepFields form={form} /> : null}
      {kind === "question" ? <QuestionFields form={form} /> : null}
      {kind === "option" ? (
        <label className="flex items-center gap-2 text-sm text-app-text">
          <input
            type="checkbox"
            checked={values.isCorrect}
            onChange={(event) => setField("isCorrect", event.target.checked)}
          />{" "}
          Correct answer
        </label>
      ) : null}
    </>
  );
}

interface ItemFormModalProps {
  form: ItemForm;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** The overlay for adding a phase, step, task, resource, question or option, or editing one. */
export function ItemFormModal({ form, onSubmit }: ItemFormModalProps) {
  const { target, editTarget } = form;
  const addLabel = `Add ${target ? kindLabels[target.kind] : "item"}`;
  return (
    <Modal
      isOpen={target !== null || editTarget !== null}
      zIndexClassName="z-[60]"
      title={editTarget ? `Edit ${kindLabels[editTarget.kind]}` : addLabel}
      description="This is reusable blueprint content, not a change to an active onboarding path."
      errorMessage={form.error ?? undefined}
      onClose={form.close}
      footer={
        <>
          <Button variant="secondary" onClick={form.finish}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={form.isSaving}>
            {editTarget ? "Save changes" : addLabel}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-4" onSubmit={onSubmit}>
        <TitleFields form={form} />
        <KindFields form={form} />
      </form>
    </Modal>
  );
}

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { Textarea } from "../../../components/ui/Textarea.tsx";
import type { BlueprintOption, BlueprintQuestion } from "../../../services/blueprintTypes.ts";
import { Detail, EmptyDetailListItem, SaveError } from "./DetailParts.tsx";
import { fieldSetter, type BlueprintQuestionMetadata } from "./metadata.ts";

export type QuestionDetailsProps = {
  question: BlueprintQuestion;
  editable: boolean;
  metadata: BlueprintQuestionMetadata;
  saveError: string | null;
  onMetadataChange: Dispatch<SetStateAction<BlueprintQuestionMetadata>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddOption: (question: BlueprintQuestion, label: string, correct: boolean) => Promise<void>;
  onRemoveOption: (option: BlueprintOption) => Promise<void>;
  onEditOption: (option: BlueprintOption) => void;
};

type QuestionFormProps = Pick<
  QuestionDetailsProps,
  "saveError" | "metadata" | "onMetadataChange" | "onSubmit"
>;

function QuestionForm({ saveError, metadata, onMetadataChange, onSubmit }: QuestionFormProps) {
  const set = fieldSetter<BlueprintQuestionMetadata>(onMetadataChange);

  return (
    <form
      id="edit-blueprint-question"
      className="space-y-5"
      onSubmit={(event) => void onSubmit(event)}
    >
      <Field label="Title" required>
        <Input
          value={metadata.title}
          onChange={(event) => set("title")(event.target.value)}
          required
        />
      </Field>
      <Field label="Question type">
        <Select
          value={metadata.type}
          onChange={(event) => set("type")(event.target.value as BlueprintQuestion["type"])}
        >
          <option value="MULTIPLE_CHOICE">Multiple choice</option>
          <option value="SHORT_TEXT">Short text</option>
        </Select>
      </Field>
      <Field label="Question" required>
        <Textarea
          value={metadata.question}
          onChange={(event) => set("question")(event.target.value)}
          required
        />
      </Field>
      <Field label="Explanation">
        <Textarea
          value={metadata.explanation ?? ""}
          onChange={(event) => set("explanation")(event.target.value)}
        />
      </Field>
      <Field label="Correct answer">
        <Input
          value={metadata.correctAnswer ?? ""}
          onChange={(event) => set("correctAnswer")(event.target.value)}
        />
      </Field>
      <SaveError message={saveError} />
    </form>
  );
}

/** The question as read-only text, for a version that cannot be edited. */
function QuestionSummary({ question }: { question: BlueprintQuestion }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3">
        <Detail label="Type" value={question.type.replace("_", " ")} />
        <Detail label="Options" value={String(question.blueprintCheckOptions.length)} />
      </dl>
      <Detail label="Question" value={question.question} />
      <Detail label="Explanation" value={question.explanation || "Not specified."} />
    </div>
  );
}

/** The add-option form's state: open or not, what was typed, and how the save went. */
function useOptionAdder(
  question: BlueprintQuestion,
  onAddOption: QuestionDetailsProps["onAddOption"],
) {
  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [correct, setCorrect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onAddOption(question, label, correct);
      setLabel("");
      setCorrect(false);
      setIsAdding(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Option could not be added.");
    } finally {
      setSaving(false);
    }
  }

  return { isAdding, label, correct, saving, error, setIsAdding, setLabel, setCorrect, submit };
}

type OptionAdder = ReturnType<typeof useOptionAdder>;

function AddOptionForm({ adder }: { adder: OptionAdder }) {
  return (
    <form
      className="mt-3 space-y-3 rounded-lg bg-app-surface-muted p-3"
      onSubmit={(event) => void adder.submit(event)}
    >
      <Field label="Option" required>
        <Input
          value={adder.label}
          onChange={(event) => adder.setLabel(event.target.value)}
          required
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-app-text">
        <input
          type="checkbox"
          checked={adder.correct}
          onChange={(event) => adder.setCorrect(event.target.checked)}
        />{" "}
        Correct option
      </label>
      <SaveError message={adder.error} />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => adder.setIsAdding(false)}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={adder.saving}>
          Add option
        </Button>
      </div>
    </form>
  );
}

type OptionRowProps = {
  option: BlueprintOption;
  editable: boolean;
  onEdit: (option: BlueprintOption) => void;
  onRemove: (option: BlueprintOption) => Promise<void>;
};

function OptionRow({ option, editable, onEdit, onRemove }: OptionRowProps) {
  return (
    <li className="relative rounded-lg bg-app-surface-muted">
      <button
        type="button"
        aria-label={`Edit option ${option.label}`}
        className="absolute inset-0 cursor-pointer rounded-lg"
        onClick={() => onEdit(option)}
      />
      <div className="pointer-events-none relative flex items-center justify-between gap-3 p-3">
        <span className="font-medium text-app-text">{option.label}</span>
        <div className="flex items-center gap-2">
          <Badge variant={option.correct ? "success" : "neutral"}>
            {option.correct ? "Correct" : "Incorrect"}
          </Badge>
          {editable ? (
            <Button
              aria-label={`Delete option ${option.label}`}
              iconOnly
              size="sm"
              variant="dangerGhost"
              className="pointer-events-auto relative"
              onClick={(event) => {
                event.stopPropagation();
                void onRemove(option);
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

type OptionsSectionProps = Pick<
  QuestionDetailsProps,
  "question" | "editable" | "onAddOption" | "onRemoveOption" | "onEditOption"
>;

function OptionsSection({
  question,
  editable,
  onAddOption,
  onRemoveOption,
  onEditOption,
}: OptionsSectionProps) {
  const adder = useOptionAdder(question, onAddOption);
  const options = question.blueprintCheckOptions;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-app-text">Options</h3>
        {editable && question.type === "MULTIPLE_CHOICE" ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => adder.setIsAdding(true)}
          >
            Add option
          </Button>
        ) : null}
      </div>
      {adder.isAdding ? <AddOptionForm adder={adder} /> : null}
      <ul className="mt-2 space-y-2">
        {options.length ? (
          options
            .toSorted((left, right) => left.position - right.position)
            .map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                editable={editable}
                onEdit={onEditOption}
                onRemove={onRemoveOption}
              />
            ))
        ) : (
          <EmptyDetailListItem>No options have been added.</EmptyDetailListItem>
        )}
      </ul>
    </section>
  );
}

/** A knowledge check's details: its fields while it can be edited, its text otherwise, and its options. */
export function QuestionDetails(props: QuestionDetailsProps) {
  return (
    <div className="space-y-6 text-sm">
      {props.editable ? <QuestionForm {...props} /> : <QuestionSummary question={props.question} />}
      <OptionsSection {...props} />
    </div>
  );
}

import { CircleCheckBig, Minus, Pencil, Plus, Square } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import type { BlueprintOption, BlueprintQuestion } from "../../types.ts";
import { CollapseToggle } from "./CollapseToggle.tsx";
import type { OutlineActions } from "./outlineActions.ts";
import { activatesOnKey } from "./activatesOnKey.ts";

interface QuestionProps {
  question: BlueprintQuestion;
  actions: OutlineActions;
}

function QuestionToolbar({ question, actions }: QuestionProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        icon={<Pencil className="h-3.5 w-3.5" />}
        onClick={() =>
          actions.whenEditable(() => actions.openEdit({ kind: "question", item: question }))
        }
      >
        Edit
      </Button>
      {question.type === "MULTIPLE_CHOICE" ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() =>
            actions.openCreate("option", question.id, question.blueprintCheckOptions.length)
          }
        >
          Add option
        </Button>
      ) : null}
    </div>
  );
}

function OptionRow({
  option,
  index,
  actions,
}: {
  option: BlueprintOption;
  index: number;
  actions: OutlineActions;
}) {
  const open = () => actions.openEdit({ kind: "option", item: option });
  return (
    <li
      {...actions.dragProps("option", option.id, index)}
      className="flex items-center gap-2 rounded-lg border border-app-border-muted bg-app-surface-muted p-1"
    >
      <div
        role="button"
        tabIndex={0}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1"
        onClick={open}
        onKeyDown={activatesOnKey(open)}
      >
        {option.correct ? (
          <CircleCheckBig className="h-4 w-4 text-app-success-text" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        {option.label}
      </div>
      <Button
        aria-label={`Delete option ${option.label}`}
        iconOnly
        size="sm"
        variant="dangerGhost"
        loading={actions.deletingId === option.id}
        onClick={() => actions.requestDelete("option", option.id, option.label)}
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </Button>
    </li>
  );
}

function QuestionSummary({
  question,
  collapsed,
}: {
  question: BlueprintQuestion;
  collapsed: boolean;
}) {
  return (
    <div className="min-w-0">
      {!collapsed ? (
        <p className="text-xs text-app-text-subtle">{question.type.replace("_", " ")}</p>
      ) : null}
      <h4 className="mt-1 font-medium text-app-text">
        {question.position + 1}. {question.question}
      </h4>
      {question.explanation ? (
        <p className="mt-1 text-sm text-app-text-muted">{question.explanation}</p>
      ) : null}
    </div>
  );
}

interface QuestionCardProps extends QuestionProps {
  index: number;
}

/** One knowledge-check question: its wording, its answer options, and what can be done to it. */
export function QuestionCard({ question, index, actions }: QuestionCardProps) {
  const collapsed = actions.questionsCollapsed.has(question.id);
  return (
    <article
      {...actions.dragProps("question", question.id, index)}
      className="rounded-xl border border-app-border bg-app-surface p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CollapseToggle
            collapsed={collapsed}
            kind="question"
            name={question.question}
            onToggle={() => actions.questionsCollapsed.toggle(question.id)}
          />
          <QuestionSummary question={question} collapsed={collapsed} />
        </div>
        {!collapsed ? <QuestionToolbar question={question} actions={actions} /> : null}
      </div>
      {!collapsed && question.blueprintCheckOptions.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-app-text-muted">
          {question.blueprintCheckOptions.map((option, optionIndex) => (
            <OptionRow key={option.id} option={option} index={optionIndex} actions={actions} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

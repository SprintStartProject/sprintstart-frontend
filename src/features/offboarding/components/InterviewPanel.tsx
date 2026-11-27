import { BookOpenCheck, FolderGit2, MessageCircleQuestion, Sparkles } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { InterviewQuestion, RiskQuery } from "../../../services/offboardingTypes";
import { PmCard, PmCardHeader } from "../../pm-area";
import { useInterviewPlan } from "../useInterviewPlan";
import { InterviewQuestionItem } from "./InterviewQuestionItem";

/** The questions grouped by component, components in the order of their most urgent question. */
function byComponent(questions: InterviewQuestion[]): [string, InterviewQuestion[]][] {
  const groups = new Map<string, InterviewQuestion[]>();
  questions.forEach((question) => {
    groups.set(question.component, [...(groups.get(question.component) ?? []), question]);
  });
  return [...groups.entries()];
}

function QuestionGroups({ questions }: { questions: InterviewQuestion[] }) {
  return (
    <div className="space-y-4">
      {byComponent(questions).map(([component, items]) => (
        <PmCard key={component} aria-label={component}>
          <PmCardHeader icon={FolderGit2} title={component} meta={`${items.length}`} />
          <ul className="-mx-4 -mb-4 divide-y divide-app-border border-t border-app-border">
            {items.map((question) => (
              <InterviewQuestionItem key={question.text} question={question} />
            ))}
          </ul>
        </PmCard>
      ))}
    </div>
  );
}

function AnsweredByRecords({ questions }: { questions: InterviewQuestion[] }) {
  return (
    <details className="rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-app-text">
        <BookOpenCheck className="h-4 w-4" aria-hidden />
        Already in the records ({questions.length})
      </summary>
      <ul className="mt-2 divide-y divide-app-border">
        {questions.map((question) => (
          <InterviewQuestionItem key={question.text} question={question} />
        ))}
      </ul>
    </details>
  );
}

/**
 * Plans the exit interview of the departure entered under Ranking: the questions only the leaving
 * people can answer, by component, and apart from them the ones the project's records answer.
 */
export function InterviewPanel({
  projectId,
  query,
}: {
  projectId: string;
  query: RiskQuery | null;
}) {
  const { plan, planning, failed, request } = useInterviewPlan(projectId);

  if (!query) {
    return (
      <EmptyState
        icon={<MessageCircleQuestion className="h-6 w-6" />}
        title="Nobody named yet"
        size="sm"
      >
        Rank a departure first.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        loading={planning}
        onClick={() => request(query)}
        icon={<Sparkles className="h-4 w-4" />}
      >
        Plan the interview
      </Button>
      {failed && (
        <EmptyState title="The interview could not be planned" size="sm">
          Try again in a moment.
        </EmptyState>
      )}
      {plan && plan.questions.length === 0 && (
        <EmptyState title="Nothing to ask" size="sm">
          The records answer everything at risk.
        </EmptyState>
      )}
      {plan && <QuestionGroups questions={plan.questions} />}
      {plan && plan.answeredByRecords.length > 0 && (
        <AnsweredByRecords questions={plan.answeredByRecords} />
      )}
    </div>
  );
}

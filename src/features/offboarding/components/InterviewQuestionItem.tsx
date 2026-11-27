import { ArrowRightLeft, BookOpenCheck, Lightbulb, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import type { InterviewQuestion, InterviewQuestionType } from "../../../services/offboardingTypes";

const TYPES: Record<InterviewQuestionType, { icon: LucideIcon; label: string }> = {
  rationale: { icon: Lightbulb, label: "Why it is built this way" },
  operational: { icon: Wrench, label: "How to run or fix it" },
  gotcha: { icon: TriangleAlert, label: "What breaks unexpectedly" },
  handover: { icon: ArrowRightLeft, label: "What to watch when taking over" },
};

const TRIGGERS: Record<string, string> = {
  orphaned: "nobody left",
  abandoned: "lines of leavers",
  hotspot: "hotspot",
  coupled: "changes with others",
  concentrated: "one holder",
};

function RecordAnswer({ question }: { question: InterviewQuestion }) {
  return (
    <details className="mt-2 text-xs text-app-text-muted">
      <summary className="inline-flex cursor-pointer items-center gap-1 font-medium text-app-text">
        <BookOpenCheck className="h-3.5 w-3.5" aria-hidden />
        What the records say
      </summary>
      <p className="mt-1">{question.recordAnswer}</p>
      {question.sources.length > 0 && <p className="mt-1">{question.sources.join(", ")}</p>}
    </details>
  );
}

/** One question with what makes it worth asking, and what the records already say about it. */
export function InterviewQuestionItem({ question }: { question: InterviewQuestion }) {
  const type = TYPES[question.type];
  const Icon = type.icon;
  return (
    <li className="flex gap-3 px-4 py-3">
      <span title={type.label} className="mt-0.5 text-app-brand-text">
        <Icon className="h-4 w-4" aria-label={type.label} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-app-text">{question.text}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {question.coverage === "partial" && (
            <Badge variant="warning" size="sm">
              partly in the records
            </Badge>
          )}
          {question.triggers.map((trigger) => (
            <Badge key={trigger} variant="neutral" size="sm">
              {TRIGGERS[trigger] ?? trigger}
            </Badge>
          ))}
        </div>
        {question.recordAnswer && <RecordAnswer question={question} />}
      </div>
    </li>
  );
}

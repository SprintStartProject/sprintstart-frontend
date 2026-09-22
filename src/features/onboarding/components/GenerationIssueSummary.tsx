import { groupIssues } from "../generationIssues.ts";
import type { OnboardingGenerationIssueEndpoint } from "../types.ts";

/**
 * Why phases are missing from a journey, grouped by what actually happened to them.
 *
 * Sixteen phase names in one comma-separated line is a wall nobody reads, and it does not say
 * which of them is a broken connection and which is a gap in the project's documents — two very
 * different problems, with two different people who can do something about them.
 */
export function GenerationIssueSummary({
  issues,
}: {
  issues: OnboardingGenerationIssueEndpoint[];
}) {
  return (
    <ul className="space-y-3 text-left">
      {groupIssues(issues).map((group) => {
        const Icon = group.icon;
        return (
          <li
            key={group.status}
            className="rounded-xl border border-app-border bg-app-surface p-3 text-sm"
          >
            <p className="flex items-center gap-2 font-semibold text-app-text">
              <Icon className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
              {group.label}
              <span className="font-normal text-app-text-muted">
                · {group.titles.length} {group.titles.length === 1 ? "phase" : "phases"}
              </span>
            </p>
            <p className="mt-1 text-app-text-muted">{group.meaning}</p>
            <p className="mt-2 text-xs text-app-text-subtle">{group.titles.join(" · ")}</p>
          </li>
        );
      })}
    </ul>
  );
}

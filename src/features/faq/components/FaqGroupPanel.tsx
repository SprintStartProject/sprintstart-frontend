import { AlertCircle, BookOpen, FileText, MessageSquareMore } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { SidePanel } from "../../../components/ui/SidePanel";
import { SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { insightsService } from "../../../services/faqService";
import { queryKeys } from "../../../services/queryKeys";
import { useProjectContext } from "../../projects/useProjectContext";
import { formatAskedAt } from "../format";
import type { FAQGroup } from "../types";
import { TrendBadge } from "./TrendBadge";

function GroupDetail({ groupId }: { groupId: string }) {
  const { selectedProjectId } = useProjectContext();
  const {
    data: detail,
    loading,
    error,
  } = useQueryFetch(queryKeys.faq.detail(selectedProjectId, groupId), () =>
    insightsService.fetchFAQGroup(selectedProjectId, groupId),
  );

  if (loading) {
    return (
      <SkeletonGroup label="Loading group details" className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonLine key={index} className="h-14 w-full rounded-xl" />
        ))}
      </SkeletonGroup>
    );
  }

  if (error || !detail) {
    return (
      <EmptyState icon={<AlertCircle className="h-8 w-8" />} title="Could not load this question">
        The group may no longer exist, or the backend could not be reached.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="brand" className="gap-1.5">
          {detail.count} times asked
        </Badge>
        {detail.trend && <TrendBadge trend={detail.trend} recentCount={detail.recentCount} />}
        {detail.lastAskedAt && (
          <span className="text-xs text-app-text-muted">
            Last asked {formatAskedAt(detail.lastAskedAt)}
          </span>
        )}
      </div>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-app-text-muted uppercase">
          <MessageSquareMore aria-hidden="true" className="h-3.5 w-3.5" />
          How it is asked
          <span className="font-normal tracking-normal normal-case">
            · {detail.questions.length} {detail.questions.length === 1 ? "wording" : "wordings"}
          </span>
        </h3>
        <ul className="space-y-2">
          {detail.questions.map((question) => (
            <li
              key={question.id}
              className="rounded-xl border border-app-border bg-app-surface p-3.5"
            >
              <p className="text-sm leading-snug text-app-text">
                {question.text}
                {/* Repeats collapse into a multiplier rather than repeating the line: ten
                    identical rows say nothing the count does not. */}
                {(question.occurrences ?? 1) > 1 && (
                  <span className="ml-1.5 text-xs font-medium text-app-text-muted">
                    ({question.occurrences}×)
                  </span>
                )}
              </p>
              {question.askedAt && (
                <p className="mt-1.5 text-xs text-app-text-muted">
                  {(question.occurrences ?? 1) > 1 ? "Last asked " : ""}
                  {formatAskedAt(question.askedAt)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-app-text-muted uppercase">
          <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
          Answering documents
        </h3>
        {detail.answeringDocuments.length === 0 ? (
          <EmptyState size="sm">No document answers this yet — worth writing one down.</EmptyState>
        ) : (
          <ul className="divide-y divide-app-border-muted rounded-xl border border-app-border bg-app-surface">
            {detail.answeringDocuments.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-3.5 py-3">
                <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-app-text-disabled" />
                <span className="min-w-0 flex-1 truncate text-sm text-app-text">{doc.title}</span>
                {doc.source && (
                  <span className="shrink-0 rounded bg-app-surface-muted px-2 py-0.5 text-xs text-app-text-muted">
                    {doc.source}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type FaqGroupPanelProps = {
  groupId: string | null;
  /** The list entry, when known, so the header has a title before the detail arrives. */
  group: FAQGroup | null;
  onClose: () => void;
};

/**
 * One recurring question in a side panel over the list: every wording it was asked in, and the
 * documents that answer it.
 *
 * Used to be a page of its own, so reading three questions meant three round trips back to the
 * list and losing the scroll position each time.
 */
export function FaqGroupPanel({ groupId, group, onClose }: FaqGroupPanelProps) {
  return (
    <PanelPresence value={groupId}>
      {(id) => (
        <SidePanel
          isOpen
          onClose={onClose}
          title={group?.title ?? "Recurring question"}
          description={group?.question}
          leading={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand-text">
              <MessageSquareMore aria-hidden="true" className="h-5 w-5" />
            </span>
          }
          widthClassName="w-full sm:w-[34rem]"
          contentClassName="px-4 py-5 sm:px-6"
          closeAriaLabel="Close question details"
        >
          <GroupDetail groupId={id} />
        </SidePanel>
      )}
    </PanelPresence>
  );
}

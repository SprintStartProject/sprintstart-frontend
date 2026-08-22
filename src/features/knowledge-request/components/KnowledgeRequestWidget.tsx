import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { formatWaiting } from "../format";

type KnowledgeRequestWidgetProps = {
  projectId: string;
};

/**
 * Compact PM-dashboard summary of the escalation inbox, leading with the open count — questions a
 * person still owes an answer — and the longest wait. Same widget → `/insights/*` page split as the
 * other dashboard widgets.
 */
export function KnowledgeRequestWidget({ projectId }: KnowledgeRequestWidgetProps) {
  const navigate = useNavigate();
  const { data: open, loading } = useFetch(
    () => (projectId ? knowledgeRequestService.listOpen(projectId) : Promise.resolve([])),
    [projectId],
  );

  const go = () => void navigate("/insights/knowledge-requests");

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Loader2 className="h-5 w-5 animate-spin text-app-brand" aria-hidden="true" />
      </div>
    );
  }

  const count = open?.length ?? 0;
  // Oldest open request = longest wait; the thing that has been waiting on a person.
  const longestWait =
    count > 0
      ? [...(open ?? [])].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0].createdAt
      : null;

  return (
    <ClickableCard
      onClick={go}
      interactive={false}
      className="cursor-pointer rounded-2xl border border-app-border bg-app-surface p-5 transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[button:hover]:!border-app-border has-[button:hover]:!bg-app-surface"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-app-brand" aria-hidden="true" />
          <span className="text-sm font-semibold text-app-text">Escalation inbox</span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            go();
          }}
          className="flex items-center gap-1 rounded-lg text-xs text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          Open inbox
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {count > 0 ? (
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-app-warning-solid" aria-hidden="true" />
          <p className="text-sm text-app-text">
            <span className="font-semibold">{count}</span> question
            {count === 1 ? "" : "s"} waiting on a person.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-app-success-solid" aria-hidden="true" />
          <p className="text-sm text-app-text-muted">Inbox clear — nothing escalated.</p>
        </div>
      )}

      {longestWait && (
        <p className="mt-3 text-xs text-app-text-muted">
          Longest wait:{" "}
          <span className="font-medium text-app-text">{formatWaiting(longestWait)}</span>
        </p>
      )}
    </ClickableCard>
  );
}

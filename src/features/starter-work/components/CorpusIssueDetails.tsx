import { useEffect } from "react";
import { AlignLeft, CircleDot, ExternalLink, Info, Loader2, Plus, Tag } from "lucide-react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { DrawerCard } from "../../admin/components/DrawerCard";
import { Badge } from "../../../components/ui/Badge";
import { BuddyMarkdown } from "../../buddy/components/BuddyMarkdown";
import { parseCandidateSource, trackerLabel } from "../sourceId";
import type { StarterWorkCandidate } from "../types";

type CorpusIssueDetailsProps = {
  candidate: StarterWorkCandidate;
  /** HR reads the detail but does not decide, so the footer is theirs to hide. */
  canAct: boolean;
  isPromoting: boolean;
  /** The last promote error, surfaced next to the button that raised it. */
  error: string | null;
  onPromote: (sourceId: string) => Promise<boolean>;
  onClose: () => void;
};

function formatUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The full view of one browsable corpus issue, opened from the list.
 *
 * The row is deliberately compact — it carries a name and a number, no more — so the whole issue
 * body lives here, rendered as the Markdown it is written in. Adding it to the pool is the one
 * decision, and it fills the footer; the source link sits in the header beside the close button so
 * the reader can jump to the real issue without hunting.
 *
 * A pooled or removed issue is shown without an add button, with the footer saying why, matching the
 * list: rejection is sticky and an offer that cannot be taken would only mislead.
 */
export function CorpusIssueDetails({
  candidate,
  canAct,
  isPromoting,
  error,
  onPromote,
  onClose,
}: CorpusIssueDetailsProps) {
  const parsed = parseCandidateSource(candidate.sourceId);
  const tracker = trackerLabel(candidate.tracker);
  const updated = formatUpdated(candidate.updatedAtSource);
  const isAvailable = candidate.poolState === "AVAILABLE";

  // Close on a pointer-down in empty space, but leave clicks inside the drawer and clicks on a
  // list row alone — so clicking another issue switches to it and clicking the open one closes it,
  // without this handler racing the row and reopening it. Mirrors the review drawer.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[role="dialog"]') || target?.closest("[data-corpus-row]")) {
        return;
      }
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  // The pool state used to fill the footer; for a pooled or removed issue it now reads as one line
  // in the Information card up top, so the footer holds only the action (or the reason there is none).
  const poolStatus = isAvailable ? null : candidate.poolState === "IN_POOL" ? (
    <Badge variant="success" size="sm">
      Already in the pool
    </Badge>
  ) : (
    <span className="text-app-text-muted">Taken out of the pool — it cannot go back.</span>
  );

  const footerAction = isAvailable ? (
    canAct ? (
      <button
        type="button"
        data-testid={`promote-issue-${candidate.sourceId}`}
        disabled={isPromoting}
        onClick={() => void onPromote(candidate.sourceId)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-app-brand px-4 py-2.5 text-sm font-semibold text-white shadow-app-brand-lift transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPromoting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        Add to the pool
      </button>
    ) : (
      <p className="text-center text-sm text-app-text-muted">
        Only a project manager can add work to the pool.
      </p>
    )
  ) : null;

  const hasInfo = Boolean(parsed.owner || parsed.repo || parsed.repoLabel || updated || poolStatus);

  return (
    <DetailsSideDrawer
      isOpen
      onClose={onClose}
      title={candidate.title}
      leading={
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand-text">
          <CircleDot className="h-5 w-5" aria-hidden="true" />
        </span>
      }
      badge={
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="brand" size="md">
            {tracker}
          </Badge>
          {parsed.numberLabel && (
            <Badge variant="neutral" size="md">
              {parsed.numberLabel}
            </Badge>
          )}
        </div>
      }
      actions={
        candidate.sourceUrl ? (
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-2 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open issue
          </a>
        ) : undefined
      }
      footer={
        footerAction || error ? (
          <div className="w-full space-y-3">
            {error && (
              <p className="rounded-xl border border-app-danger-border bg-app-danger-bg p-3 text-xs font-medium text-app-danger-text">
                {error}
              </p>
            )}
            {footerAction}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {hasInfo && (
          <DrawerCard label="Information" icon={Info} index={0}>
            <dl className="space-y-2 text-sm">
              {parsed.owner && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-app-text-subtle">Owner</dt>
                  <dd className="text-right font-medium text-app-text">{parsed.owner}</dd>
                </div>
              )}
              {parsed.repo ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-app-text-subtle">Repository</dt>
                  <dd className="text-right font-medium text-app-text">{parsed.repo}</dd>
                </div>
              ) : (
                parsed.repoLabel && (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-app-text-subtle">Repository</dt>
                    <dd className="text-right font-medium text-app-text">{parsed.repoLabel}</dd>
                  </div>
                )
              )}
              {updated && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-app-text-subtle">Updated</dt>
                  <dd className="text-right text-app-text-muted">{updated}</dd>
                </div>
              )}
              {poolStatus && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-app-text-subtle">Pool status</dt>
                  <dd className="text-right">{poolStatus}</dd>
                </div>
              )}
            </dl>
          </DrawerCard>
        )}

        <DrawerCard label="Issue" icon={AlignLeft} index={1}>
          {candidate.excerpt ? (
            <div className="text-sm leading-relaxed text-app-text-muted">
              <BuddyMarkdown content={candidate.excerpt} />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-app-text-muted">
              This issue has no description in the corpus.
            </p>
          )}
          {candidate.excerptTruncated && (
            <p className="mt-3 text-xs text-app-text-subtle">
              This text is shortened. Open the issue to read all of it.
            </p>
          )}
        </DrawerCard>

        {candidate.labels.length > 0 && (
          <DrawerCard label="Labels" icon={Tag} index={2}>
            <ul className="flex flex-wrap gap-1.5">
              {candidate.labels.map((label) => (
                <li key={label}>
                  <Badge variant="neutral" size="md">
                    {label}
                  </Badge>
                </li>
              ))}
            </ul>
          </DrawerCard>
        )}

        {candidate.hasAssignee === true && (
          <DrawerCard label="Status" icon={Info} index={3}>
            <p className="text-sm leading-relaxed text-app-text-muted">
              Someone is already on this issue. It is still yours to add — the pool is a suggestion,
              not a claim.
            </p>
          </DrawerCard>
        )}
      </div>
    </DetailsSideDrawer>
  );
}

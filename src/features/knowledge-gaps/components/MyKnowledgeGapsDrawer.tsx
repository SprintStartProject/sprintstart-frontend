import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, FileWarning } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { formatDateTime, formatRelativeDate } from "../format";
import { SEVERITY_ORDER, SEVERITY_STYLES } from "../severity";
import { GapTypeChips, SeverityPill, SeveritySummaryBar } from "./SeverityIndicators";
import type { KnowledgeGap } from "../types";

export type MyKnowledgeGapsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  /** The caller's own gaps, `covered` components already dropped. */
  gaps: KnowledgeGap[];
  /** Used to keep the reader out of their own "shared with" list. */
  currentUserId: string | null;
  /**
   * Whether to offer the knowledge-gaps page. PM/Admin only, because that is who the page and
   * the endpoints behind it are for -- offering it to a member would land them on a redirect.
   */
  canOpenFullPage: boolean;
};

/** Worst first, then by component name -- the order the knowledge-gaps pages use. */
function worstFirst(gaps: readonly KnowledgeGap[]): KnowledgeGap[] {
  return [...gaps].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.component.localeCompare(b.component),
  );
}

function documentsMissing(gaps: readonly KnowledgeGap[]): number {
  return gaps.reduce((total, gap) => total + gap.missingTypes.length, 0);
}

/** Small uppercase caption over a chip group. */
function ChipLabel({ children }: { children: string }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
      {children}
    </p>
  );
}

/** One `label -- value` line of the source column. */
function MetaRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-xs text-app-text-muted">{label}</dt>
      <dd className="truncate text-xs font-medium text-app-text" title={title}>
        {value}
      </dd>
    </div>
  );
}

/** One owned component, spelled out -- nothing here is truncated or collapsed. */
function GapDetails({ gap, currentUserId }: { gap: KnowledgeGap; currentUserId: string | null }) {
  const present = gap.presentTypes ?? [];
  const { longLabel, ring } = SEVERITY_STYLES[gap.severity];
  const firstIngested = gap.firstIngested ?? gap.lastIngested;

  // Everyone else on the hook for this component. The reader is in `owners` by definition --
  // that is why it is in this list -- so they are never their own "shared with".
  const coOwners = gap.owners.filter((owner) => owner.id !== currentUserId);

  return (
    <li className={`rounded-2xl border ${ring} bg-app-surface p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg leading-tight font-semibold break-words text-app-text">
            {gap.component}
          </p>
          <p className="mt-1 text-xs text-app-text-muted">
            {gap.missingTypes.length === 1
              ? "1 document missing"
              : `${gap.missingTypes.length} documents missing`}{" "}
            &middot; {longLabel}
          </p>
        </div>

        <SeverityPill severity={gap.severity} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <ChipLabel>Missing</ChipLabel>
          <GapTypeChips types={gap.missingTypes} tone="missing" />

          {present.length > 0 && (
            <div className="mt-3">
              <ChipLabel>Already documented</ChipLabel>
              <GapTypeChips types={present} tone="present" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <ChipLabel>Source</ChipLabel>
          <dl className="space-y-1">
            <MetaRow
              label="First ingested"
              value={formatRelativeDate(firstIngested)}
              title={formatDateTime(firstIngested)}
            />
            <MetaRow
              label="Last ingested"
              value={formatRelativeDate(gap.lastIngested)}
              title={formatDateTime(gap.lastIngested)}
            />
            <MetaRow
              label="Last analyzed"
              value={formatRelativeDate(gap.refreshedAt)}
              title={formatDateTime(gap.refreshedAt)}
            />
          </dl>

          {coOwners.length > 0 && (
            <div className="mt-3">
              <ChipLabel>Shared with</ChipLabel>
              <p className="text-xs break-words text-app-text">
                {coOwners.map((owner) => `${owner.firstname} ${owner.lastname}`).join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The components you own, in full, from the dashboard card.
 *
 * A drawer and not a page, because the page already exists and is PM/Admin-only: everything
 * here comes off `/knowledge-gaps/mine`, which every project member may read, so a member
 * finally has somewhere to see the whole of what has been put in their name instead of the
 * four lines a dashboard cell has room for. A manager gets the same drawer plus the way
 * through to the page, which is where the things only they can do -- reassigning an owner,
 * triggering a rescan -- actually live.
 *
 * Read-only on purpose, and not for lack of ideas: uploading a document, refreshing the
 * analysis and setting an owner are all PM/Admin endpoints, so there is nothing else here a
 * member could be offered that would not simply fail.
 *
 * Portalled to `<body>` because it is opened from inside a dashboard widget. The card sits in
 * a `SpotlightCard`, which applies a transform when the tilt effect is on -- and a transformed
 * ancestor makes `position: fixed` resolve against itself, which would trap the drawer inside
 * a quarter of a row. Same reason `FilterSelect` portals its menu.
 */
export function MyKnowledgeGapsDrawer({
  isOpen,
  onClose,
  gaps,
  currentUserId,
  canOpenFullPage,
}: MyKnowledgeGapsDrawerProps) {
  const navigate = useNavigate();
  const ordered = worstFirst(gaps);
  const missing = documentsMissing(gaps);

  return createPortal(
    <DetailsSideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Your knowledge gaps"
      closeAriaLabel="Close your knowledge gaps"
      showOverlay
      zIndexClassName="z-50"
      widthClassName="w-full sm:w-[min(94vw,34rem)] lg:w-[min(72vw,46rem)]"
      leading={
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand">
          <FileWarning className="h-6 w-6" />
        </div>
      }
      badge={
        <span>
          {gaps.length === 1 ? "1 component" : `${gaps.length} components`} &middot;{" "}
          {missing === 1 ? "1 document missing" : `${missing} documents missing`}
        </span>
      }
      actions={
        canOpenFullPage ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClose();
              void navigate("/insights/knowledge-gaps");
            }}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            All knowledge gaps
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm leading-relaxed text-app-text-muted">
            These components are in your name. A gap closes once the missing document has been
            written and ingested into the project.
          </p>
          <SeveritySummaryBar gaps={gaps} className="mt-4" />
        </div>

        <ul className="space-y-3">
          {ordered.map((gap) => (
            <GapDetails key={gap.id} gap={gap} currentUserId={currentUserId} />
          ))}
        </ul>

        <p className="flex items-center gap-1.5 text-xs text-app-text-muted">
          <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Recomputed when the project&rsquo;s sources are re-ingested.
        </p>
      </div>
    </DetailsSideDrawer>,
    document.body,
  );
}

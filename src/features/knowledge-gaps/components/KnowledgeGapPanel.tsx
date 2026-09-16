import { useState } from "react";
import { AlertCircle, Clock, Database, FileCheck, ShieldAlert, User } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FilterSelect } from "../../../components/ui/FilterSelect";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { SidePanel } from "../../../components/ui/SidePanel";
import { SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { useToast } from "../../../context/useToast";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { queryKeys } from "../../../services/queryKeys";
import { getTeamOverview } from "../../../services/teamManagementService";
import { useProjectContext } from "../../projects/useProjectContext";
import { daysSince, formatDateTime, formatRelativeDate } from "../format";
import { SEVERITY_FILL, SEVERITY_STYLES } from "../severity";
import type { KnowledgeGap } from "../types";

// Nudge the PM to re-ingest when the newest artifact is older than this.
const STALE_AFTER_DAYS = 30;

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldAlert;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-app-text-muted uppercase">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function GapDetail({ gapId }: { gapId: string }) {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();
  const toast = useToast();
  const [savingOwners, setSavingOwners] = useState(false);

  const {
    data: gap,
    loading,
    error,
    refetch: refetchGap,
  } = useQueryFetch(queryKeys.knowledgeGaps.detail(selectedProjectId, gapId), () =>
    knowledgeGapService.fetchKnowledgeGap(selectedProjectId, gapId),
  );

  const { data: teamUsers } = useQueryFetch(
    queryKeys.teamOverview.filtered(selectedProjectId || null),
    () => getTeamOverview(undefined, undefined, selectedProjectId ? [selectedProjectId] : undefined),
  );

  if (loading) {
    return (
      <SkeletonGroup label="Loading gap details" className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonLine key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </SkeletonGroup>
    );
  }

  if (error || !gap) {
    return (
      <EmptyState icon={<AlertCircle className="h-8 w-8" />} title="Could not load this gap">
        This knowledge gap may no longer exist.
      </EmptyState>
    );
  }

  // A component has a single owner; assigning replaces any previous one.
  const currentOwner = gap.owners[0] ?? null;

  /*
    One control for one property: the dropdown names the current owner and "Unassigned" is how
    it is cleared. The owner therefore has to be among the options even though the list is the
    project's team — an owner who has since left it would otherwise leave the trigger blank.
  */
  const teamOptions = [...(teamUsers ?? [])]
    .sort((a, b) => `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`))
    .map((u) => ({ value: u.userId, label: `${u.firstname} ${u.lastname}` }));

  const ownerIsOnTeam = teamOptions.some((option) => option.value === currentOwner?.id);

  const ownerOptions = [
    { value: "", label: "Unassigned" },
    ...(currentOwner && !ownerIsOnTeam
      ? [{ value: currentOwner.id, label: `${currentOwner.firstname} ${currentOwner.lastname}` }]
      : []),
    ...teamOptions,
  ];

  const setOwner = async (userId: string) => {
    setSavingOwners(true);
    try {
      await knowledgeGapService.setComponentOwners(
        selectedProjectId,
        gap.component,
        userId ? [userId] : [],
      );
      refetchGap();
      toast.success(userId ? "Owner updated" : "Owner removed");
    } catch (err) {
      console.error("Failed to update owner", err);
      toast.error(err instanceof Error ? err.message : "Couldn't update the owner.");
    } finally {
      setSavingOwners(false);
    }
  };

  const firstIngested = gap.firstIngested ?? gap.lastIngested;
  const daysSinceIngest = daysSince(gap.lastIngested);
  const isStale = daysSinceIngest > STALE_AFTER_DAYS;
  const { bar } = SEVERITY_STYLES[gap.severity];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-app-border">
          <div
            className={`h-full rounded-full ${bar}`}
            style={{ width: SEVERITY_FILL[gap.severity] }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-app-text-muted">Missing doc types</dt>
            <dd className="text-2xl font-bold text-app-text tabular-nums">
              {gap.missingTypes.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-app-text-muted">Present document types</dt>
            <dd className="text-2xl font-bold text-app-text tabular-nums">
              {gap.presentTypes?.length ?? 0}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-app-text-muted">
          First ingested {formatDateTime(firstIngested)} · {formatRelativeDate(firstIngested)}
        </p>
      </section>

      <Section icon={ShieldAlert} title="Missing documentation">
        {gap.missingTypes.length === 0 ? (
          <p className="text-sm text-app-text-muted">Nothing missing.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {gap.missingTypes.map((type) => (
              <span
                key={type}
                className="rounded-lg border border-app-border bg-app-surface-muted px-2.5 py-1 text-sm text-app-text"
              >
                {type}
              </span>
            ))}
          </div>
        )}

        {gap.presentTypes && gap.presentTypes.length > 0 && (
          <>
            <p className="mt-4 mb-2 flex items-center gap-1.5 text-xs text-app-text-muted">
              <FileCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Already documented
            </p>
            <div className="flex flex-wrap gap-2">
              {gap.presentTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-lg border border-app-success-border bg-app-success-bg px-2.5 py-1 text-sm text-app-success-text"
                >
                  {type}
                </span>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section icon={User} title="Owner">
        {currentOwner ? (
          <div className="mb-3 flex items-center gap-3">
            <UserAvatar
              fallbackName={`${currentOwner.firstname} ${currentOwner.lastname}`}
              seed={currentOwner.id}
              size={36}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-app-text">
                {currentOwner.firstname} {currentOwner.lastname}
              </p>
              <p className="truncate text-xs text-app-text-muted">
                @{currentOwner.username}
                {currentOwner.role ? ` · ${currentOwner.role}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="mb-3 text-sm text-app-text-muted">No owner assigned yet.</p>
        )}

        <FilterSelect
          label={currentOwner ? "Change the owner of this component" : "Assign an owner"}
          value={currentOwner?.id ?? ""}
          options={ownerOptions}
          onChange={(userId) => void setOwner(userId)}
          disabled={savingOwners}
          className="w-full"
        />
      </Section>

      <Section icon={Database} title="Data source">
        <p className="flex items-center gap-2 text-sm text-app-text">
          <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-app-text-muted" />
          Last ingested {formatRelativeDate(gap.lastIngested)}
        </p>
        <p className="mt-1 pl-6 text-xs text-app-text-muted">
          {formatDateTime(gap.lastIngested)} · analyzed {formatDateTime(gap.refreshedAt)}
        </p>

        {isStale && (
          <p className="mt-3 rounded-lg border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
            This data was last ingested {daysSinceIngest} days ago — re-ingest the source to refresh
            it.
          </p>
        )}

        {/* Straight to this component's repository: Data Ingestion accepts the component
            (`owner/repo`) as a `sourceId` and opens that source's details. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void navigate(`/data-ingestion?sourceId=${encodeURIComponent(gap.component)}`)
          }
          icon={<Database className="h-3.5 w-3.5" />}
          className="mt-4"
        >
          Update data source
        </Button>
      </Section>
    </div>
  );
}

type KnowledgeGapPanelProps = {
  gapId: string | null;
  /** The list entry, when known, so the header is right before the detail arrives. */
  gap: KnowledgeGap | null;
  onClose: () => void;
};

/**
 * One knowledge gap in a side panel over the list: what is missing, who owns it, and where to
 * go to fix the source. Used to be a page of its own.
 */
export function KnowledgeGapPanel({ gapId, gap, onClose }: KnowledgeGapPanelProps) {
  return (
    <PanelPresence value={gapId}>
      {(id) => (
        <SidePanel
          isOpen
          onClose={onClose}
          title={gap?.component ?? "Knowledge gap"}
          badge={
            gap ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[gap.severity].badge}`}
              >
                {SEVERITY_STYLES[gap.severity].longLabel}
              </span>
            ) : undefined
          }
          leading={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand-text">
              <ShieldAlert aria-hidden="true" className="h-5 w-5" />
            </span>
          }
          widthClassName="w-full sm:w-[34rem]"
          contentClassName="px-4 py-5 sm:px-6"
          closeAriaLabel="Close gap details"
        >
          <GapDetail gapId={id} />
        </SidePanel>
      )}
    </PanelPresence>
  );
}

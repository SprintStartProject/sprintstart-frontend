import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Loader2,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { DrawerCard } from "../../admin/components/DrawerCard";
import {
  formatDateTime,
  formatJiraInstanceDomain,
  formatNumber,
  getAiSyncStatusLabel,
  getRunStatusLabel,
  getRunStatusTone,
  getSourceLabel,
  isRunInProgress,
  SOURCE_META,
} from "../data.ts";
import type { AiSyncStatus, IngestionRun } from "../types.ts";

type RunDetailsPanelProps = {
  run: IngestionRun;
  /**
   * The repository the run ingested, resolved best-effort from the run's
   * artifacts (the backend does not persist a repo on a run). Falls back to the
   * source-system label when the run produced no attributable artifacts.
   */
  sourceLabel?: string;
  onClose: () => void;
};

type Tone = "success" | "running" | "warning" | "neutral";

const TONE_CHIP: Record<Tone, string> = {
  success: "border border-app-success-border bg-app-success-bg text-app-success-text",
  running: "border border-app-brand-border bg-app-brand-soft text-app-brand-text",
  // Danger palette: keeps failure labels red on red instead of amber-yellow on a
  // red-looking background.
  warning: "border border-app-danger-border bg-app-danger-bg text-app-danger-text",
  neutral: "border border-app-border bg-app-neutral-bg text-app-neutral-text",
};

/**
 * Slide-out panel with the full detail of one ingestion run: a status hero, the
 * headline result as stat tiles, and the pipeline as a stage timeline
 * (fetch → save → AI index) so the local run status and the separate AI-index
 * stage are legible at a glance rather than as two competing badges.
 */
export function RunDetailsPanel({ run, sourceLabel, onClose }: RunDetailsPanelProps) {
  const runTone = getRunStatusTone(run.status) as Tone;
  const aiLabel = getAiSyncStatusLabel(run.aiSyncStatus);
  const duration = formatDuration(run.startedAt, run.finishedAt, run.status);
  const repoLabel = sourceLabel ?? getSourceLabel(run.sourceSystem);
  const originRow = buildOriginRow(run);
  // Hero icon follows the run's source system (GitHub → GitBranch, Jira → Ticket,
  // Upload → FileText) so a Jira run never shows the GitHub glyph.
  const SourceIcon = SOURCE_META[run.sourceSystem].icon;

  return (
    <DetailsSideDrawer
      isOpen
      onClose={onClose}
      title={`Run · ${repoLabel}`}
      closeAriaLabel="Close run details"
      zIndexClassName="z-50"
      showOverlay
      leading={
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-app-border bg-app-surface-muted text-app-text-muted">
          <SourceIcon className="h-6 w-6" />
        </div>
      }
      badge={
        <>
          <Chip tone={runTone}>{getRunStatusLabel(run.status)}</Chip>
          {aiLabel && (
            <Chip tone={aiSyncTone(run.aiSyncStatus)} spinning={run.aiSyncStatus === "PENDING"}>
              {aiLabel}
            </Chip>
          )}
        </>
      }
    >
      {run.failureReason && (
        <div className="mb-6 rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3">
          <p className="text-sm font-semibold text-app-warning-text">This run failed</p>
          <p className="mt-1 text-sm wrap-break-word text-app-text-muted">{run.failureReason}</p>
        </div>
      )}

      <DrawerCard label="Result" icon={Database} index={0}>
        <div className="grid grid-cols-2 gap-2.5">
          <Tile label="Ingested" icon={Database}>
            {formatNumber(run.ingestedCount)}
          </Tile>
          <Tile label="Updated" icon={CheckCircle2}>
            {formatNumber(run.updatedCount)}
          </Tile>
          <Tile label="Deleted" icon={Trash2}>
            {formatNumber(run.deletedCount)}
          </Tile>
          <Tile label="Failed" icon={XCircle} warn={run.failedCount > 0}>
            {formatNumber(run.failedCount)}
          </Tile>
        </div>
      </DrawerCard>

      {/* On a wide (lg) drawer the pipeline timeline and the run information sit
          side by side; they stack on narrower widths. */}
      <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-2">
        <DrawerCard label="Information" icon={Clock3} index={1}>
          <dl className="-my-1">
            <InfoRow label="Repository" value={repoLabel} />
            {originRow && <InfoRow label={originRow.label} value={originRow.value} />}
            <InfoRow label="Started" value={formatDateTime(run.startedAt)} />
            <InfoRow
              label="Finished"
              value={
                run.finishedAt
                  ? formatDateTime(run.finishedAt)
                  : isRunInProgress(run.status)
                    ? "In progress"
                    : "Not reported"
              }
            />
            <InfoRow label="Duration" value={duration} />
            <InfoRow label="Run ID" value={run.runId} mono />
          </dl>
        </DrawerCard>

        {/* `flex flex-col` + a flex-1 list lets the timeline stretch to the
            information card's height, so its connecting lines fill the card
            instead of leaving a gap below the last stage. */}
        <DrawerCard label="Pipeline" icon={GitBranch} index={2} className="flex flex-col">
          <ol className="flex flex-1 flex-col">
            {buildStages(run).map((stage, index, all) => (
              <Stage key={stage.title} stage={stage} isLast={index === all.length - 1} />
            ))}
          </ol>
        </DrawerCard>
      </div>

      {run.failedItems.length > 0 && (
        <DrawerCard
          label={`Failed items (${run.failedItems.length})`}
          icon={XCircle}
          index={3}
          className="mt-4 sm:mt-5"
        >
          <div className="space-y-3">
            {run.failedItems.map((item) => (
              <div
                key={`${item.artifactIdentifier}-${item.reason}`}
                className="rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3"
              >
                <p className="text-sm font-medium wrap-break-word text-app-warning-text">
                  {item.artifactIdentifier}
                </p>
                <p className="mt-1 text-sm text-app-text-muted">{item.reason}</p>
              </div>
            ))}
          </div>
        </DrawerCard>
      )}
    </DetailsSideDrawer>
  );
}

/**
 * The connector-specific origin of a run, shown next to the repository in the
 * details panel: the GitHub owner (from `run.owner`, falling back to the first
 * segment of `"owner/name"`) or the Jira instance domain (from the instance URL
 * in `run.sourceId`). Both are already carried on the run, so no extra fetch is
 * needed. Returns null for uploads and runs with no attributable origin.
 */
function buildOriginRow(run: IngestionRun): { label: string; value: string } | null {
  if (run.sourceSystem === "JIRA") {
    return run.sourceId ? { label: "Domain", value: formatJiraInstanceDomain(run.sourceId) } : null;
  }

  if (run.sourceSystem === "GITHUB") {
    const owner = run.owner ?? run.sourceId?.split("/")[0] ?? null;
    return owner ? { label: "Owner", value: owner } : null;
  }

  return null;
}

type StageState = "ok" | "run" | "warn" | "wait";
type StageInfo = { title: string; meta: string; state: StageState };

function buildStages(run: IngestionRun): StageInfo[] {
  const running = isRunInProgress(run.status);
  const failedNote = run.failedCount > 0 ? `, ${formatNumber(run.failedCount)} failed` : "";

  const fetchStage: StageInfo = {
    title: `Fetched from ${getSourceLabel(run.sourceSystem)}`,
    meta: `${formatNumber(run.ingestedCount + run.failedCount)} items pulled`,
    state: "ok",
  };
  const deletedNote = run.deletedCount > 0 ? `, ${formatNumber(run.deletedCount)} deleted` : "";
  const saveStage: StageInfo = {
    // A run-level failure reason explains the stage better than the counters do.
    meta:
      run.status === "FAILED" && run.failureReason
        ? run.failureReason
        : `${formatNumber(run.ingestedCount)} stored${deletedNote}${failedNote}`,
    title: "Saved locally",
    state: run.status === "FAILED" ? "warn" : "ok",
  };

  let indexStage: StageInfo;
  if (running || run.aiSyncStatus === "PENDING") {
    indexStage = { title: "Indexing into AI", meta: "In progress…", state: "run" };
  } else if (run.aiSyncStatus === "FAILED") {
    indexStage = {
      title: "Indexing into AI",
      meta: run.aiSyncFailureReason ?? "Indexing failed",
      state: "warn",
    };
  } else {
    indexStage = {
      title: "Indexed into AI",
      meta: `${formatNumber(run.ingestedCount)} embedded`,
      state: "ok",
    };
  }

  return [fetchStage, saveStage, indexStage];
}

function aiSyncTone(status: AiSyncStatus): Tone {
  if (status === "SUCCEEDED") return "success";
  if (status === "PENDING") return "running";
  return "warning";
}

function Chip({
  tone,
  spinning = false,
  children,
}: {
  tone: Tone;
  spinning?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${TONE_CHIP[tone]}`}
    >
      {spinning && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {children}
    </span>
  );
}

function Tile({
  label,
  icon: Icon,
  warn = false,
  children,
}: {
  label: string;
  icon: LucideIcon;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface-muted px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-app-text-subtle">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p
        className={`mt-1.5 text-xl font-bold tabular-nums ${
          warn ? "text-app-danger-text" : "text-app-text"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

const STAGE_DOT: Record<StageState, string> = {
  ok: "bg-app-success-bg text-app-success-text",
  run: "bg-app-brand-soft text-app-brand-text",
  warn: "bg-app-warning-bg text-app-warning-text",
  wait: "bg-app-bg-soft text-app-text-disabled",
};

function Stage({ stage, isLast }: { stage: StageInfo; isLast: boolean }) {
  return (
    // Non-last stages grow so the connecting line stretches and the timeline
    // fills the card height; a min-height keeps each stage comfortably spaced.
    <li className={`flex gap-3.5 ${isLast ? "" : "min-h-16 flex-1"}`}>
      <div className="flex flex-col items-center">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${STAGE_DOT[stage.state]}`}
        >
          {stage.state === "ok" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : stage.state === "run" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : stage.state === "warn" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
        {!isLast && <span className="my-1 w-0.5 flex-1 bg-app-border" />}
      </div>
      <div className="pb-4 pt-1">
        <p className="text-sm font-semibold text-app-text">{stage.title}</p>
        <p className="mt-0.5 text-xs text-app-text-subtle">{stage.meta}</p>
      </div>
    </li>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-t border-app-border py-2.5 first:border-t-0">
      <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">{label}</dt>
      <dd
        className={`min-w-0 text-[13px] font-semibold break-words text-app-text ${
          mono ? "font-mono text-xs font-medium" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDuration(
  startedAt: string,
  finishedAt: string | null,
  status: IngestionRun["status"],
) {
  if (!finishedAt) return isRunInProgress(status) ? "Running…" : "—";

  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

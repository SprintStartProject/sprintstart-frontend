import {
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  Loader2,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import {
  formatDateTime,
  formatJiraInstanceDomain,
  formatNumber,
  getAiSyncStatusLabel,
  getRunStatusLabel,
  getRunStatusTone,
  getSourceLabel,
  isRunInProgress,
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
  success:
    "border border-app-success-border bg-app-success-bg text-app-success-text",
  running: "border border-app-brand-border bg-app-brand-soft text-app-brand-text",
  // Danger palette: keeps failure labels red on red instead of amber-yellow on a
  // red-looking background.
  warning:
    "border border-app-danger-border bg-app-danger-bg text-app-danger-text",
  neutral: "border border-app-border bg-app-neutral-bg text-app-neutral-text",
};

/**
 * Slide-out panel with the full detail of one ingestion run: a status hero, the
 * headline result as stat tiles, and the pipeline as a stage timeline
 * (fetch → save → AI index) so the local run status and the separate AI-index
 * stage are legible at a glance rather than as two competing badges.
 */
export function RunDetailsPanel({
  run,
  sourceLabel,
  onClose,
}: RunDetailsPanelProps) {
  const runTone = getRunStatusTone(run.status) as Tone;
  const aiLabel = getAiSyncStatusLabel(run.aiSyncStatus);
  const duration = formatDuration(run.startedAt, run.finishedAt, run.status);
  const repoLabel = sourceLabel ?? getSourceLabel(run.sourceSystem);
  const originRow = buildOriginRow(run);

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
          <GitBranch className="h-6 w-6" />
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
          <p className="text-sm font-semibold text-app-warning-text">
            This run failed
          </p>
          <p className="mt-1 wrap-break-word text-sm text-app-text-muted">
            {run.failureReason}
          </p>
        </div>
      )}

      <Section title="Result">
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
      </Section>

      <Section title="Pipeline">
        <ol className="flex flex-col">
          {buildStages(run).map((stage, index, all) => (
            <Stage key={stage.title} stage={stage} isLast={index === all.length - 1} />
          ))}
        </ol>
      </Section>

      <Section title="Timing">
        <dl className="overflow-hidden rounded-xl border border-app-border">
          <InfoRow label="Repository" value={repoLabel} />
          {originRow && (
            <InfoRow label={originRow.label} value={originRow.value} />
          )}
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
      </Section>

      {run.failedItems.length > 0 && (
        <Section title={`Failed items (${run.failedItems.length})`}>
          <div className="space-y-3">
            {run.failedItems.map((item) => (
              <div
                key={`${item.artifactIdentifier}-${item.reason}`}
                className="rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3"
              >
                <p className="wrap-break-word text-sm font-medium text-app-warning-text">
                  {item.artifactIdentifier}
                </p>
                <p className="mt-1 text-sm text-app-text-muted">{item.reason}</p>
              </div>
            ))}
          </div>
        </Section>
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
function buildOriginRow(
  run: IngestionRun,
): { label: string; value: string } | null {
  if (run.sourceSystem === "JIRA") {
    return run.sourceId
      ? { label: "Domain", value: formatJiraInstanceDomain(run.sourceId) }
      : null;
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
  const failedNote =
    run.failedCount > 0 ? `, ${formatNumber(run.failedCount)} failed` : "";

  const fetchStage: StageInfo = {
    title: `Fetched from ${getSourceLabel(run.sourceSystem)}`,
    meta: `${formatNumber(run.ingestedCount + run.failedCount)} items pulled`,
    state: "ok",
  };
  const deletedNote =
    run.deletedCount > 0 ? `, ${formatNumber(run.deletedCount)} deleted` : "";
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-app-border pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-app-text-subtle">
        {title}
      </h3>
      {children}
    </section>
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
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${STAGE_DOT[stage.state]}`}
        >
          {stage.state === "ok" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : stage.state === "run" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : stage.state === "warn" ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
        {!isLast && <span className="my-0.5 w-0.5 flex-1 bg-app-border" />}
      </div>
      <div className="pb-4">
        <p className="text-[13px] font-semibold text-app-text">{stage.title}</p>
        <p className="text-xs text-app-text-subtle">{stage.meta}</p>
      </div>
    </li>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-app-border px-4 py-2.5 first:border-t-0">
      <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">{label}</dt>
      <dd
        className={`min-w-0 break-words text-[13px] font-semibold text-app-text ${
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

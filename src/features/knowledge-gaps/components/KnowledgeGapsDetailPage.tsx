// ============================================================
// KnowledgeGapsDetailPage.tsx
// Route: /insights/knowledge-gaps/:gapId
// ============================================================

import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { useParams, useNavigate } from "react-router-dom";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { getTeamOverview } from "../../../services/teamManagementService";
import { useFetch } from "../../../hooks/useFetch";
import { formatDateTime, formatRelativeDate, daysSince } from "../format";
import { SEVERITY_STYLES } from "../severity";
import { useProjectContext } from "../../projects/useProjectContext";

import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  User,
  UserPlus,
  X,
  FileCheck,
  ShieldAlert,
  Wrench,
  Database,
} from "lucide-react";

// Nudge the PM to re-ingest when the newest artifact is older than this.
const STALE_AFTER_DAYS = 30;

// ─────────────────────────────────────────────────────────────
// COMPONENT: KnowledgeGapsDetailPage
// ─────────────────────────────────────────────────────────────

export function KnowledgeGapsDetailPage() {
  const { selectedProjectId } = useProjectContext();
  const { gapId } = useParams<{ gapId: string }>();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [savingOwners, setSavingOwners] = useState(false);

  const {
    data: gap,
    loading,
    error,
  } = useFetch(
    () => knowledgeGapService.fetchKnowledgeGap(selectedProjectId, gapId ?? ""),
    [gapId, refreshKey],
  );

  const { data: teamUsers } = useFetch(() => getTeamOverview(), []);

  // ── LOADING ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading gap details...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────

  if (error || !gap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-danger-solid" />
          <h2 className="mb-2 text-lg font-semibold text-app-text">Could not load gap</h2>
          <p className="mb-6 text-sm text-app-text-muted">
            This knowledge gap may no longer exist.
          </p>
          <Button variant="primary" onClick={() => void navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const { badge, bar, longLabel, ring } = SEVERITY_STYLES[gap.severity];

  // A component has a single owner; assigning replaces any previous one.
  const currentOwner = gap.owners[0] ?? null;
  const assignableUsers = (teamUsers ?? []).filter((u) => u.userId !== currentOwner?.id);

  const saveOwners = async (userIds: string[]) => {
    setSavingOwners(true);
    try {
      await knowledgeGapService.setComponentOwners(selectedProjectId, gap.component, userIds);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      console.error("Failed to update owner", err);
    } finally {
      setSavingOwners(false);
    }
  };

  const setOwner = (userId: string) => {
    if (userId) void saveOwners([userId]);
  };
  const clearOwner = () => void saveOwners([]);

  const firstIngested = gap.firstIngested ?? gap.lastIngested;
  const daysSinceIngest = daysSince(gap.lastIngested);
  const isStale = daysSinceIngest > STALE_AFTER_DAYS;

  // ── RENDER ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-app-bg">
      {/* ── HEADER ──────────────────────────────────────── */}
      <div className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-content py-4">
          <Button
            variant="ghost"
            onClick={() => void navigate(-1)}
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4"
          >
            Back
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 text-xl font-semibold text-app-text sm:text-2xl">
                {gap.component}
              </h1>
              <div className="flex items-center gap-2 text-xs text-app-text-muted">
                <Clock className="h-3.5 w-3.5" />
                First ingested {formatDateTime(firstIngested)} · {formatRelativeDate(firstIngested)}
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${badge}`}>
              {longLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────── */}
      <main className="app-page-content space-y-4 py-8 pb-24">
        {/* Severity + stats hero */}
        <div className={`rounded-2xl border bg-app-surface/70 p-5 backdrop-blur-md ${ring}`}>
          {/* Severity bar full width */}
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-app-border">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{
                width: gap.severity === "high" ? "100%" : gap.severity === "medium" ? "60%" : "30%",
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-app-surface-muted p-3">
              <div className="mb-1 flex items-center gap-1 text-xs text-app-text-muted">
                <FileCheck className="h-3.5 w-3.5" />
                Present document types
              </div>
              <div className="text-2xl font-semibold text-app-text">
                {gap.presentTypes?.length ?? 0}
              </div>
            </div>
            <div className="rounded-xl bg-app-surface-muted p-3">
              <div className="mb-1 flex items-center gap-1 text-xs text-app-text-muted">
                <Wrench className="h-3.5 w-3.5" />
                Missing doc types
              </div>
              <div className="text-2xl font-semibold text-app-text">{gap.missingTypes.length}</div>
            </div>
          </div>
        </div>

        {/* Present types */}
        {gap.presentTypes && gap.presentTypes.length > 0 && (
          <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-app-text-muted uppercase">
              <FileCheck className="h-3.5 w-3.5" />
              Present document types
            </div>
            <div className="flex flex-wrap gap-2">
              {gap.presentTypes.map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-app-success-border bg-app-success-bg px-3 py-1.5 text-sm text-app-success-text"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing types */}
        <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-app-text-muted uppercase">
            <ShieldAlert className="h-3.5 w-3.5" />
            Missing documentation types
          </div>
          <div className="flex flex-wrap gap-2">
            {gap.missingTypes.map((t) => (
              <span
                key={t}
                className="rounded-lg border border-app-border bg-app-surface-muted px-3 py-1.5 text-sm text-app-text"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Owner */}
        <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-app-text-muted uppercase">
            <User className="h-3.5 w-3.5" />
            Owner
          </div>
          <div className="space-y-2">
            {!currentOwner && <p className="text-sm text-app-text-muted">No owner assigned yet.</p>}
            {currentOwner && (
              <div className="flex items-center gap-3 rounded-xl bg-app-surface-muted p-3">
                {/* Avatar initials */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-brand-soft">
                  <span className="text-xs font-semibold text-app-brand-text">
                    {currentOwner.firstname[0]}
                    {currentOwner.lastname[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text">
                    {currentOwner.firstname} {currentOwner.lastname}
                  </div>
                  <div className="text-xs text-app-text-muted">
                    @{currentOwner.username}
                    {currentOwner.role ? ` · ${currentOwner.role}` : ""}
                  </div>
                </div>
                <button
                  onClick={clearOwner}
                  disabled={savingOwners}
                  title="Remove owner"
                  className="shrink-0 text-app-text-muted transition-colors hover:text-app-danger-solid disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Assign / change owner */}
          <div className="mt-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 shrink-0 text-app-text-muted" />
            <Select
              size="sm"
              value=""
              aria-label={currentOwner ? "Change owner" : "Assign owner"}
              disabled={savingOwners || assignableUsers.length === 0}
              onChange={(e) => setOwner(e.target.value)}
              className="flex-1"
            >
              <option value="" disabled>
                {currentOwner ? "Change owner…" : "Assign owner…"}
              </option>
              {assignableUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.firstname} {u.lastname}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Data source */}
        <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-app-text-muted uppercase">
            <Database className="h-3.5 w-3.5" />
            Data source
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 text-sm text-app-text">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-app-text-muted" />
                <span>
                  Last ingested{" "}
                  <span className="font-medium">{formatDateTime(gap.lastIngested)}</span>{" "}
                  <span className="text-app-text-muted">
                    · {formatRelativeDate(gap.lastIngested)}
                  </span>
                </span>
              </div>
              <div className="pl-6 text-xs text-app-text-muted">
                Last analyzed {formatDateTime(gap.refreshedAt)}
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => void navigate("/data-ingestion")}
              icon={<Database className="h-4 w-4" />}
              className="shrink-0"
            >
              Update data source
            </Button>
          </div>
          {isStale && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              This data was last ingested {daysSinceIngest} days ago — re-ingest the source to
              refresh it.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// KnowledgeGapsDetailPage.tsx
// Route: /insights/knowledge-gaps/:gapId
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import { buttonHoverMotion, hoverSpringToken } from "../../../styles/tokens";
import { useParams, useNavigate } from "react-router-dom";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { getTeamOverview } from "../../../services/teamManagementService";
import { useFetch } from "../../../hooks/useFetch";
import { formatDateTime, formatRelativeDate, daysSince } from "../format";
import { SEVERITY_STYLES } from "../severity";

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
  const { gapId } = useParams<{ gapId: string }>();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [savingOwners, setSavingOwners] = useState(false);

  const {
    data: gap,
    loading,
    error,
  } = useFetch(
    () => knowledgeGapService.fetchKnowledgeGap(gapId ?? ""),
    [gapId, refreshKey],
  );

  const { data: teamUsers } = useFetch(() => getTeamOverview(), []);

  // ── LOADING ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading gap details...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────

  if (error || !gap) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-app-danger-solid mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-app-text mb-2">
            Could not load gap
          </h2>
          <p className="text-sm text-app-text-muted mb-6">
            This knowledge gap may no longer exist.
          </p>
          <motion.button
            onClick={() => void navigate(-1)}
            {...buttonHoverMotion}
            className="rounded-xl bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover hover:shadow-[0_10px_26px_-10px_var(--color-app-brand)]"
          >
            Go back
          </motion.button>
        </div>
      </div>
    );
  }

  const { badge, bar, longLabel, ring } = SEVERITY_STYLES[gap.severity];

  // A component has a single owner; assigning replaces any previous one.
  const currentOwner = gap.owners[0] ?? null;
  const assignableUsers = (teamUsers ?? []).filter(
    (u) => u.userId !== currentOwner?.id,
  );

  const saveOwners = async (userIds: string[]) => {
    setSavingOwners(true);
    try {
      await knowledgeGapService.setComponentOwners(gap.component, userIds);
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
          <motion.button
            onClick={() => void navigate(-1)}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.97 }}
            transition={hoverSpringToken}
            className="mb-4 flex items-center gap-1.5 text-sm text-app-text-muted transition-colors hover:text-app-text"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </motion.button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-app-text mb-1">
                {gap.component}
              </h1>
              <div className="flex items-center gap-2 text-xs text-app-text-muted">
                <Clock className="w-3.5 h-3.5" />
                First ingested {formatDateTime(firstIngested)} ·{" "}
                {formatRelativeDate(firstIngested)}
              </div>
            </div>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${badge}`}>
              {longLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────── */}
      <main className="app-page-content py-8 pb-24 space-y-4">

        {/* Severity + stats hero */}
        <div className={`rounded-2xl border bg-app-surface/70 p-5 backdrop-blur-md ${ring}`}>
          {/* Severity bar full width */}
          <div className="h-1.5 rounded-full bg-app-border mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{
                width:
                  gap.severity === "high"
                    ? "100%"
                    : gap.severity === "medium"
                      ? "60%"
                      : "30%",
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-app-surface-muted rounded-xl p-3">
              <div className="text-xs text-app-text-muted mb-1 flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5" />
                Present document types
              </div>
              <div className="text-2xl font-semibold text-app-text">
                {gap.presentTypes?.length ?? 0}
              </div>
            </div>
            <div className="bg-app-surface-muted rounded-xl p-3">
              <div className="text-xs text-app-text-muted mb-1 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5" />
                Missing doc types
              </div>
              <div className="text-2xl font-semibold text-app-text">
                {gap.missingTypes.length}
              </div>
            </div>
          </div>
        </div>

        {/* Present types */}
        {gap.presentTypes && gap.presentTypes.length > 0 && (
          <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-3">
              <FileCheck className="w-3.5 h-3.5" />
              Present document types
            </div>
            <div className="flex flex-wrap gap-2">
              {gap.presentTypes.map((t) => (
                <span
                  key={t}
                  className="text-sm text-app-success-text bg-app-success-bg border border-app-success-border rounded-lg px-3 py-1.5"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing types */}
        <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            Missing documentation types
          </div>
          <div className="flex flex-wrap gap-2">
            {gap.missingTypes.map((t) => (
              <span
                key={t}
                className="text-sm text-app-text bg-app-surface-muted border border-app-border rounded-lg px-3 py-1.5"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Owner */}
        <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-3">
            <User className="w-3.5 h-3.5" />
            Owner
          </div>
          <div className="space-y-2">
            {!currentOwner && (
              <p className="text-sm text-app-text-muted">
                No owner assigned yet.
              </p>
            )}
            {currentOwner && (
              <div className="flex items-center gap-3 bg-app-surface-muted rounded-xl p-3">
                {/* Avatar initials */}
                <div className="w-8 h-8 rounded-full bg-app-brand-soft flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-app-brand-text">
                    {currentOwner.firstname[0]}{currentOwner.lastname[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
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
                  className="text-app-text-muted hover:text-app-danger-solid transition-colors disabled:opacity-60 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Assign / change owner */}
          <div className="mt-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-app-text-muted shrink-0" />
            <select
              value=""
              disabled={savingOwners || assignableUsers.length === 0}
              onChange={(e) => setOwner(e.target.value)}
              className="flex-1 text-sm rounded-lg border border-app-border bg-app-bg text-app-text px-3 py-2 disabled:opacity-60"
            >
              <option value="" disabled>
                {currentOwner ? "Change owner…" : "Assign owner…"}
              </option>
              {assignableUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.firstname} {u.lastname}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data source */}
        <div className="rounded-2xl border border-app-border/70 bg-app-surface/70 p-5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-3">
            <Database className="w-3.5 h-3.5" />
            Data source
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-app-text space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-app-text-muted shrink-0" />
                <span>
                  Last ingested{" "}
                  <span className="font-medium">
                    {formatDateTime(gap.lastIngested)}
                  </span>{" "}
                  <span className="text-app-text-muted">
                    · {formatRelativeDate(gap.lastIngested)}
                  </span>
                </span>
              </div>
              <div className="text-xs text-app-text-muted pl-6">
                Last analyzed {formatDateTime(gap.refreshedAt)}
              </div>
            </div>
            <motion.button
              onClick={() => void navigate("/data-ingestion")}
              {...buttonHoverMotion}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover hover:shadow-[0_10px_26px_-10px_var(--color-app-brand)]"
            >
              <Database className="w-4 h-4" />
              Update data source
            </motion.button>
          </div>
          {isStale && (
            <div className="mt-3 flex items-center gap-2 text-xs text-app-warning-text bg-app-warning-bg border border-app-warning-border rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              This data was last ingested {daysSinceIngest} days ago — re-ingest the
              source to refresh it.
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

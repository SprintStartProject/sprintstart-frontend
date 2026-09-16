import { useState } from "react";
import {
  AlignLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { DrawerCard } from "../../admin/components/DrawerCard";
import { AccountEnabledToggle } from "../../admin/components/AccountEnabledToggle";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { orientationService } from "../../../services/orientationService";
import { queryKeys } from "../../../services/queryKeys";
import { OrientationEditor } from "../../orientation/components/OrientationEditor";
import { formatRelativeDate } from "../format";
import type { StarterWorkTask } from "../types";
import { capturePoolFlightRect, type PoolFlightRect } from "./poolFlight";

type StarterWorkTaskDetailsProps = {
  task: StarterWorkTask;
  /** Whether nobody has looked at this task yet — read from the unreviewed queue, not the task itself. */
  unseen: boolean;
  /** Needed to read and write the task's orientation; the section is hidden without one selected. */
  projectId: string | null;
  /** HR reads the drawer but does not decide, write orientation, or flag Task 0. */
  canAct: boolean;
  onApprove: (id: string, origin?: PoolFlightRect) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onToggleTaskZero: (task: StarterWorkTask, eligible: boolean) => Promise<void>;
  onClose: () => void;
};

/**
 * The one detail drawer for every pool task, opened from the review queue, the pool cloud and the
 * pool list alike.
 *
 * The body is split into labelled sections matching the admin user drawer — what the task is, the
 * AI's scope-safety rationale, where it stands (looked-at status, the Task 0 flag) and its
 * orientation. The footer's decision mirrors what still needs deciding: an unreviewed task offers
 * both "Looks good" and "Remove"; one already looked at only offers "Remove", since vouching for it
 * again says nothing new.
 */
export function StarterWorkTaskDetails({
  task,
  unseen,
  projectId,
  canAct,
  onApprove,
  onReject,
  onToggleTaskZero,
  onClose,
}: StarterWorkTaskDetailsProps) {
  const queryClient = useQueryClient();
  const [isDeciding, setIsDeciding] = useState(false);
  const [isTogglingZero, setIsTogglingZero] = useState(false);
  const [isEditingOrientation, setIsEditingOrientation] = useState(false);

  const orientationQueryKey = queryKeys.starterWork.taskOrientation(task.id, projectId ?? "");
  const orientation = useQueryFetch(
    orientationQueryKey,
    () => orientationService.fetchTaskOrientation(task.id, projectId as string),
    { enabled: canAct && Boolean(projectId) },
  );

  const decide = async (action: () => Promise<void>) => {
    setIsDeciding(true);
    try {
      await action();
      onClose();
    } catch {
      // The page's handler already raised a toast for the failure; keep the drawer
      // open so the reader can try again.
      setIsDeciding(false);
    }
  };

  const handleToggleTaskZero = async (eligible: boolean) => {
    setIsTogglingZero(true);
    try {
      await onToggleTaskZero(task, eligible);
    } catch {
      // The page's handler already raised a toast for the failure.
    } finally {
      setIsTogglingZero(false);
    }
  };

  const refetchOrientation = () => {
    void queryClient.invalidateQueries({ queryKey: orientationQueryKey });
  };

  return (
    <DetailsSideDrawer
      isOpen
      onClose={onClose}
      showOverlay
      title={task.title}
      leading={
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand-text">
          <Target className="h-5 w-5" aria-hidden="true" />
        </span>
      }
      actions={
        task.sourceUrl ? (
          <a
            href={task.sourceUrl}
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
        canAct ? (
          unseen ? (
            <div className="grid w-full grid-cols-2 gap-3">
              <button
                type="button"
                data-testid={`approve-task-${task.id}`}
                disabled={isDeciding}
                onClick={(event) => {
                  const origin = capturePoolFlightRect(event.currentTarget);
                  void decide(() => onApprove(task.id, origin));
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-app-success-border bg-app-success-bg px-4 py-2.5 text-sm font-semibold text-app-success-text transition-colors hover:border-app-success-solid hover:bg-app-success-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeciding ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                Looks good
              </button>
              <button
                type="button"
                data-testid={`reject-task-${task.id}`}
                disabled={isDeciding}
                onClick={() => void decide(() => onReject(task.id))}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-2.5 text-sm font-semibold text-app-danger-text transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid={`reject-task-${task.id}`}
              disabled={isDeciding}
              onClick={() => void decide(() => onReject(task.id))}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-2.5 text-sm font-semibold text-app-danger-text transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeciding ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4" aria-hidden="true" />
              )}
              Remove from pool
            </button>
          )
        ) : undefined
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {(task.summary || task.competencyKeys.length > 0) && (
          <DrawerCard label="What it is" icon={AlignLeft} index={0}>
            {task.summary && (
              <p className="text-sm leading-relaxed text-app-text-muted">{task.summary}</p>
            )}
            {task.competencyKeys.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {task.competencyKeys.map((key) => (
                  <li key={key}>
                    <Badge variant="purple" size="md">
                      {key}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </DrawerCard>
        )}

        {task.rationale && (
          <DrawerCard label="Why this is a safe first task" icon={ShieldCheck} index={1}>
            <p className="text-sm leading-relaxed text-app-text">{task.rationale}</p>
          </DrawerCard>
        )}

        <DrawerCard label="Where it stands" icon={Sparkles} index={2}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-app-text">
                  {unseen ? "Not looked at yet" : "Looked at"}
                </p>
                <p className="text-xs text-app-text-muted">
                  {unseen
                    ? "Hires can already pick it, it just sits lower on their list."
                    : "Ranked normally for hires."}
                </p>
              </div>
              {unseen ? (
                <Badge variant="brand" size="sm">
                  Not looked at
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Looked at
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-app-border pt-3">
              <div>
                <p className="text-sm font-semibold text-app-text">Use as Task 0</p>
                <p className="text-xs text-app-text-muted">
                  Handed to a new hire as their very first task, on any project.
                </p>
              </div>
              {canAct ? (
                <AccountEnabledToggle
                  enabled={task.taskZeroEligible}
                  disabled={isTogglingZero}
                  ariaLabel="Use as Task 0"
                  onChange={(eligible) => void handleToggleTaskZero(eligible)}
                />
              ) : (
                <Badge variant={task.taskZeroEligible ? "purple" : "neutral"} size="sm">
                  {task.taskZeroEligible ? "Task 0" : "Not Task 0"}
                </Badge>
              )}
            </div>

            <div className="border-t border-app-border pt-3">
              <p className="text-sm font-semibold text-app-text">Visible for</p>
              <p className="text-xs text-app-text-muted">
                Every project — the pool is shared, and any hire can claim it.
              </p>
            </div>
          </div>
        </DrawerCard>

        {canAct && (
          <DrawerCard label="Orientation" icon={PencilLine} index={3}>
            {!projectId ? (
              <p className="text-sm text-app-text-muted">
                Pick a project to read or write this task&apos;s orientation.
              </p>
            ) : orientation.loading ? (
              <p className="text-sm text-app-text-muted">Loading…</p>
            ) : orientation.error ? (
              <p className="text-sm text-app-text-muted">Orientation unavailable right now.</p>
            ) : (
              <>
                <p className="text-sm text-app-text-muted">
                  {orientation.data?.packet
                    ? `A guide is written, updated ${formatRelativeDate(orientation.data.packet.assembledAt)}.`
                    : "No guide yet. Hires get an AI orientation until you write one."}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  icon={<PencilLine className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setIsEditingOrientation(true)}
                >
                  {orientation.data?.packet ? "Edit orientation" : "Write orientation"}
                </Button>
              </>
            )}
          </DrawerCard>
        )}
      </div>

      {isEditingOrientation && projectId && orientation.data && (
        <OrientationEditor
          taskTitle={task.title}
          taskUrl={task.sourceUrl}
          initial={orientation.data.packet}
          onSave={async (input) => {
            await orientationService.authorTaskOrientation(task.id, projectId, input);
            refetchOrientation();
            return true;
          }}
          onRevert={
            orientation.data.packet
              ? async () => {
                  await orientationService.revertTaskOrientation(task.id, projectId);
                  refetchOrientation();
                  return true;
                }
              : undefined
          }
          onClose={() => setIsEditingOrientation(false)}
        />
      )}
    </DetailsSideDrawer>
  );
}

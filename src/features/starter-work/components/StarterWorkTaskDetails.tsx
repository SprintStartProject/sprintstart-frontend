import { useState } from "react";
import {
  AlignLeft,
  Check,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { DrawerCard } from "../../admin/components/DrawerCard";
import { Badge } from "../../../components/ui/Badge";
import type { StarterWorkTask } from "../types";
import { capturePoolFlightRect, type PoolFlightRect } from "./poolFlight";

type StarterWorkTaskDetailsProps = {
  task: StarterWorkTask;
  /** HR reads the detail but does not decide, so the footer is theirs to hide. */
  canAct: boolean;
  onApprove: (id: string, origin?: PoolFlightRect) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onClose: () => void;
};

/**
 * The full view of one mined starter task, opened from the review list.
 *
 * The body is split into the same kind of labelled sections the admin user drawer uses â€” summary,
 * the AI's scope-safety rationale (the claim a PM is being asked to check) and the skills the task
 * exercises. The two decisions fill the footer; a successful one closes the drawer, since the task
 * then leaves the queue behind it.
 */
export function StarterWorkTaskDetails({
  task,
  canAct,
  onApprove,
  onReject,
  onClose,
}: StarterWorkTaskDetailsProps) {
  const [isDeciding, setIsDeciding] = useState(false);

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
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
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
              disabled={isDeciding}
              onClick={() => void decide(() => onReject(task.id))}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-2.5 text-sm font-semibold text-app-danger-text transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Take it out of the pool
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {task.summary && (
          <DrawerCard label="Summary" icon={AlignLeft} index={0}>
            <p className="text-sm leading-relaxed text-app-text-muted">{task.summary}</p>
          </DrawerCard>
        )}

        {task.rationale && (
          <DrawerCard label="Why this is a safe first task" icon={ShieldCheck} index={1}>
            <p className="text-sm leading-relaxed text-app-text">{task.rationale}</p>
          </DrawerCard>
        )}

        {task.competencyKeys.length > 0 && (
          <DrawerCard label="Skills" icon={Sparkles} index={2}>
            <p className="mb-3 text-sm text-app-text-muted">Each one becomes a prerequisite.</p>
            <ul className="flex flex-wrap gap-1.5">
              {task.competencyKeys.map((key) => (
                <li key={key}>
                  <Badge variant="purple" size="md">
                    {key}
                  </Badge>
                </li>
              ))}
            </ul>
          </DrawerCard>
        )}
      </div>
    </DetailsSideDrawer>
  );
}

import { Check, Loader2, X } from "lucide-react";
import type { ProposedAction } from "../types";
import { BUDDY_ACTION_OPEN_ORIENTATION } from "../types";
import { BuddyOrientationCard } from "./BuddyOrientationCard";

type BuddyActionProposalsProps = {
  /** The message these actions were proposed in — needed to target the confirm. */
  messageId: string;
  actions: ProposedAction[];
  onConfirm: (messageId: string, action: ProposedAction) => void;
  onDismiss: (messageId: string, actionId: string) => void;
};

/**
 * The confirm affordance for actions the buddy proposed. Nothing here has changed anything yet —
 * the buddy offered, and only a click on "Confirm" mutates. Each action shows its own state: the
 * offer, a spinner while it runs, the outcome line once resolved (styled by whether it worked), a
 * retry on a transport error, or a quiet note when declined.
 *
 * Shared by the full-page conversation and the floating widget so a proposal looks and behaves the
 * same wherever the hire meets it.
 */
export function BuddyActionProposals({
  messageId,
  actions,
  onConfirm,
  onDismiss,
}: BuddyActionProposalsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {actions.map((action) => {
        if (action.status === "dismissed") {
          return (
            <p key={action.id} className="text-xs text-app-text-disabled">
              Dismissed — nothing changed.
            </p>
          );
        }

        if (action.status === "resolved") {
          return (
            <div key={action.id} className="flex flex-col">
              <p
                className={`flex min-w-0 items-start gap-1.5 text-sm break-words ${
                  action.ok ? "text-app-text" : "text-app-text-muted"
                }`}
              >
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    action.ok ? "text-app-success-solid" : "text-app-text-disabled"
                  }`}
                  aria-hidden="true"
                />
                {action.outcome}
              </p>
              {/* Opening orientation is the one action whose result is content, not
                                just an outcome line: the packet renders right here in the thread
                                instead of navigating to a page. */}
              {action.action === BUDDY_ACTION_OPEN_ORIENTATION && action.ok && (
                <BuddyOrientationCard />
              )}
            </div>
          );
        }

        const isConfirming = action.status === "confirming";

        return (
          <div
            key={action.id}
            className="flex max-w-full min-w-0 flex-col gap-1.5 rounded-xl border border-app-border bg-app-bg p-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* `action.label` is written by the model, so its length is not ours to
                                assume. In a 384 px panel an unbreakable one would push the button
                                past the edge -- hence the wrap and the left alignment that follows
                                from a label running to two lines. */}
              <button
                type="button"
                onClick={() => onConfirm(messageId, action)}
                disabled={isConfirming}
                className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-app-brand px-3 py-1.5 text-left text-sm font-medium break-words text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConfirming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {action.label}
              </button>
              <button
                type="button"
                onClick={() => onDismiss(messageId, action.id)}
                disabled={isConfirming}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Not now
              </button>
            </div>
            {action.status === "error" && (
              <p className="text-xs text-app-danger-text">
                Couldn&apos;t reach the server — try again.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

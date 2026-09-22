import { Check, Info, Loader2, RotateCcw, TriangleAlert, Users, X } from "lucide-react";
import type { ProposedAction, ProposalRisk } from "../types";
import {
  BUDDY_ACTION_AMEND_CHECKLIST,
  BUDDY_ACTION_OPEN_ORIENTATION,
  BUDDY_ACTION_REWORD_CHECKLIST,
  BUDDY_ACTION_TICK_CHECKLIST,
} from "../types";
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
 *
 * **An action that came back "couldn't" can be run again, and that is not the same as a retry on a
 * transport error.** A confirm used to be spent whichever way it went: a refusal replaced the
 * button with its own outcome line and left nothing to press. That is fine when the refusal is
 * permanent, and it was badly wrong when it was not — a hire whose packet failed to assemble had
 * the only control for it taken away, and the mentor, which is never told what became of a
 * proposal, went on asking them to click a button that was no longer on screen. So the outcome
 * stays, and the offer comes back under it.
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
            <div key={action.id} className="flex flex-col items-start">
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
              {/* Under the refusal, not instead of it. The outcome is why it did not work and is
                  the thing worth reading; this is only the way to try it once the reason has been
                  dealt with. Never offered on success — running a confirmed action twice is how
                  somebody claims the same task twice. Hire actions only: a stored team
                  proposal is settled server-side once decided, so confirming it again
                  could only be refused. */}
              {!action.ok && "action" in action && (
                <button
                  type="button"
                  onClick={() => onConfirm(messageId, action)}
                  className="mt-1.5 ml-5.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Try again: {action.label}
                </button>
              )}
              {/* Opening orientation is the one hire action whose result is content, not
                                just an outcome line: the packet renders right here in the thread
                                instead of navigating to a page. Stored proposals have no `action`
                                name to match — their payoff is always the outcome line. */}
              {"action" in action &&
                action.action === BUDDY_ACTION_OPEN_ORIENTATION &&
                action.ok && <BuddyOrientationCard />}
            </div>
          );
        }

        const isConfirming = action.status === "confirming";
        const isStored = "proposalId" in action;
        // Fail closed: a proposal whose risk did not survive the stream (or that arrived
        // without its description) is not confirmable — an approval card for a project
        // mutation must never guess how loudly to warn, nor confirm what it cannot show.
        const isUnsupported = isStored && (action.risk === null || !action.preview);
        const previewId = `buddy-proposal-preview-${action.id}`;

        return (
          <div
            key={action.id}
            className="flex max-w-full min-w-0 flex-col gap-1.5 rounded-xl border border-app-border bg-app-bg p-2.5"
          >
            {/* Shown before the press, not after it, and only where the payload is *content*.
                `place_checklist` is the one action whose confirm writes the mentor's own sentences
                onto a surface the hire owns — the same reason the assessment proposal names the
                skill and the level rather than saying "Save this". The lines are in the reply
                above as well; having them here is what makes the two comparable, so a list that
                does not match what was written is visible before it is kept, not after. */}
            {!isStored && action.checklistItems && action.checklistItems.length > 0 && (
              <div className="min-w-0">
                {action.checklistTitle && (
                  <p className="text-sm font-medium break-words text-app-text">
                    {action.checklistTitle}
                  </p>
                )}
                {/* Named as an addition when it is one. The card keeps everything it already has,
                    and these lines go after it — saying so is the difference between agreeing to
                    three new steps and agreeing to whatever the list becomes. */}
                {action.action === BUDDY_ACTION_AMEND_CHECKLIST && (
                  <p className="text-xs text-app-text-muted">
                    Added to the end of that list — nothing on it changes:
                  </p>
                )}
                {action.action === BUDDY_ACTION_TICK_CHECKLIST && (
                  <p className="text-xs text-app-text-muted">
                    Ticked off on that list — nothing else on it changes:
                  </p>
                )}
                <ul className="mt-1 space-y-0.5">
                  {action.checklistItems.map((item, index) => (
                    <li
                      key={`${action.id}-${index}`}
                      className="text-xs break-words text-app-text-muted"
                    >
                      · {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* The one offer that *replaces* something already on a card, so it shows both: the
                line as it reads now and as it would read. Only the new wording would be asking
                them to agree to a change they would have to go and diff for themselves.

                `<del>`/`<ins>` rather than a struck-through paragraph: `line-through` is paint
                only, and to a screen reader two plain paragraphs are two near-identical sentences
                with nothing saying which one is leaving. The spoken labels are there as well
                because not every screen reader announces the elements themselves.

                Keyed off the action, like the amend and tick branches above, so a future action
                that happens to carry both fields does not render as a rewording. */}
            {!isStored &&
              action.action === BUDDY_ACTION_REWORD_CHECKLIST &&
              action.lineBefore &&
              action.lineAfter && (
                <div className="min-w-0 text-xs">
                  <del className="block break-words text-app-text-muted line-through">
                    <span className="sr-only">Currently: </span>
                    {action.lineBefore}
                  </del>
                  <ins className="block break-words text-app-text no-underline">
                    <span className="sr-only">Would become: </span>
                    {action.lineAfter}
                  </ins>
                </div>
              )}

            {/* Whitespace kept: the note's first line becomes the card's heading, so a preview that
                reflowed it would not be showing what would be kept. */}
            {!isStored && action.noteText && (
              <p className="min-w-0 text-xs break-words whitespace-pre-wrap text-app-text-muted">
                {action.noteText}
              </p>
            )}
            {/* What the manager is agreeing to comes FIRST, in the buddy's own words, and the
                confirm button describes it (aria-describedby): the target is the stored id, so
                this text is the offer's full description — never a summary the client
                recomposed, and never read after the button that acts on it. */}
            {isStored && action.preview && (
              <p id={previewId} className="text-xs leading-relaxed break-words text-app-text-muted">
                {action.preview}
              </p>
            )}

            {/* A stored proposal warns about itself before it is even clicked: how much it would
                change decides how loudly the card speaks, before any confirm happens. */}
            {isStored && action.risk !== null && <ProposalRiskBadge risk={action.risk} />}

            {isUnsupported && (
              <>
                <p
                  data-testid="buddy-proposal-unsupported"
                  className="text-xs leading-relaxed text-app-warning-text"
                >
                  This proposal arrived without its details, so it cannot be confirmed here. Ask the
                  buddy to propose it again.
                </p>
                <div className="flex flex-wrap items-center gap-2">
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
              </>
            )}
            {!isUnsupported && (
              <div className="flex flex-wrap items-center gap-2">
                {/* `action.label` is written by the model, so its length is not ours to
                                assume. In a 384 px panel an unbreakable one would push the button
                                past the edge -- hence the wrap and the left alignment that follows
                                from a label running to two lines. */}
                <button
                  type="button"
                  onClick={() => onConfirm(messageId, action)}
                  disabled={isConfirming}
                  aria-describedby={isStored && action.preview ? previewId : undefined}
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
            )}
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

/** How each risk tells the manager what it is about to change — icon and words, per the palette's colour-blind rule. */
const RISK_BADGES: Record<ProposalRisk, { label: string; icon: typeof Info; className: string }> = {
  STANDARD: {
    label: "Standard change",
    icon: Info,
    className: "border-app-border bg-app-surface-muted text-app-text-muted",
  },
  DESTRUCTIVE: {
    label: "Cannot be undone",
    icon: TriangleAlert,
    className: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
  },
  BULK: {
    label: "Affects everyone",
    icon: Users,
    className: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  },
};

/**
 * The stored proposal's own warning about how much it would change.
 *
 * Never colour alone: the icon and the label carry the meaning for a colour-blind reader, and
 * the token colours only underline it. Rendered once per card, above the buttons — the manager
 * reads what kind of change this is before reading what to click.
 */
function ProposalRiskBadge({ risk }: { risk: ProposalRisk }) {
  const badge = RISK_BADGES[risk];
  const Icon = badge.icon;

  return (
    <span
      data-testid="buddy-proposal-risk"
      className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {badge.label}
    </span>
  );
}

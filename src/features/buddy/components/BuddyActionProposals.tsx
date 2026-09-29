import { AlertCircle, Check, Info, Loader2, TriangleAlert, Users, X } from "lucide-react";
import { Field } from "../../../components/ui/Field";
import { Textarea } from "../../../components/ui/Textarea";
import { actionDraftKey } from "../actionDrafts";
import type { ActionDrafts } from "../actionDrafts";
import type { ProposedAction, ProposalRisk } from "../types";
import {
  BUDDY_ACTION_AMEND_CHECKLIST,
  BUDDY_ACTION_FLAG_TO_PM,
  BUDDY_ACTION_OPEN_ORIENTATION,
  BUDDY_ACTION_REWORD_CHECKLIST,
  BUDDY_ACTION_TICK_CHECKLIST,
} from "../types";
import { BuddyOrientationCard } from "./BuddyOrientationCard";

type BuddyActionProposalsProps = {
  /** The message these actions were proposed in — needed to target the confirm. */
  messageId: string;
  actions: ProposedAction[];
  /** The session's wording for the offers that carry an editable message — see `actionDrafts`. */
  actionDrafts: ActionDrafts;
  /** Records one, so it outlives whichever surface is on screen. */
  setActionDraft: (key: string, text: string) => void;
  onConfirm: (messageId: string, action: ProposedAction) => void;
  onDismiss: (messageId: string, action: ProposedAction) => void;
};

type BuddyProposalCardProps = {
  messageId: string;
  action: ProposedAction;
  actionDrafts: ActionDrafts;
  setActionDraft: (key: string, text: string) => void;
  onConfirm: (messageId: string, action: ProposedAction) => void;
  onDismiss: (messageId: string, action: ProposedAction) => void;
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
 * stays, and the offer comes back under it — whole, field and all, because a flag the backend
 * could not send is precisely the one whose wording is worth another look.
 *
 * Each one is its own {@link BuddyProposalCard} rather than an inline branch of the map below: a
 * flag to the PM carries the hire's own words, and those are edited **before** confirming, so the
 * offer is a component with an identity of its own rather than a row inside the callback — and what
 * the hire typed is held by the **session** (`actionDrafts`), not by the card, so closing the dock
 * or handing the conversation over to `/buddy` cannot throw away a half-worded question.
 */
export function BuddyActionProposals({
  messageId,
  actions,
  actionDrafts,
  setActionDraft,
  onConfirm,
  onDismiss,
}: BuddyActionProposalsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {actions.map((action) => (
        <BuddyProposalCard
          key={action.id}
          messageId={messageId}
          action={action}
          actionDrafts={actionDrafts}
          setActionDraft={setActionDraft}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

/**
 * One proposed action, from offer to settled — and the only place the hire's own words can be
 * edited before they leave the product.
 *
 * A `flag_to_pm` is the one proposal whose payload is a message a person reads: the buddy composes
 * the question, but it arrives in a PM's inbox in the hire's name, so the whole question is shown
 * in a field above the button and is theirs to correct. What is confirmed is therefore exactly what
 * the field held (see `handleConfirm`), never the original proposal. Every other action echoes a
 * target back verbatim and a stored team proposal confirms by id — nothing there is editable, so
 * nothing there grows a field.
 */
function BuddyProposalCard({
  messageId,
  action,
  actionDrafts,
  setActionDraft,
  onConfirm,
  onDismiss,
}: BuddyProposalCardProps) {
  const isStored = "proposalId" in action;
  const isFlagToPm = !isStored && action.action === BUDDY_ACTION_FLAG_TO_PM;
  const isConfirming = action.status === "confirming";
  const draftKey = actionDraftKey(messageId, action.id);
  // The hire's own words for this offer, if they have touched it — read from the session, never
  // from state of this card's own: the dock unmounts when it is closed and `/buddy` mounts a
  // second card for the same action, so wording kept here would be thrown away by either gesture.
  // Until they edit, the field holds the question the buddy composed.
  const editedQuestion = actionDrafts[draftKey] ?? (isFlagToPm ? (action.question ?? "") : "");
  /** A flag with nothing in it is not a question — the confirm stays out of reach rather than
   *  letting the backend answer with a refusal the hire cannot act on. The field says so out
   *  loud (`error` below): a disabled button is not a reason, and a screen reader gets nothing
   *  from it. */
  const hasQuestion = editedQuestion.trim().length > 0;
  const canConfirm = !isConfirming && (!isFlagToPm || hasQuestion);

  /** The card's only way out: the offer's button before it has run, and the very same button after
   *  a refusal. Both come through here, so neither can send a question other than the one on
   *  screen — and never an empty one. */
  const handleConfirm = () => {
    if (isFlagToPm) {
      const question = editedQuestion.trim();
      if (!question) return;
      // What was sent is what the field now holds; only the trim can differ. A refused retry
      // has to hand the wording back exactly as the PM would have read it, not padded.
      if (question !== editedQuestion) setActionDraft(draftKey, question);
      onConfirm(messageId, { ...action, question });
      return;
    }

    onConfirm(messageId, action);
  };

  if (action.status === "dismissed") {
    return <p className="text-xs text-app-text-disabled">Dismissed — nothing changed.</p>;
  }

  // A hire offer the backend could not run is **not** spent: it keeps its card — reason above it,
  // field and buttons as they were — so the hire can act on what the refusal said. That matters
  // most for a flag, whose wording is the one thing on the card they can correct. A success *is*
  // spent (running a confirmed action twice is how somebody claims the same task twice), and a
  // stored team proposal is settled server-side once decided.
  const wasRefused = action.ok === false && action.outcome !== undefined;
  const isSettled = action.status === "resolved" && (action.ok === true || isStored);

  // Kept above the card while a retry is on its way, not just when the refusal arrives: pressing
  // the button again must not blank out the sentence explaining why it did not work. The one state
  // that drops it is a transport error *after* such a retry — the card's own note below is the
  // newer story, and two messages about one press read as two failures.
  const outcomeLine =
    action.status === "resolved" || (wasRefused && action.status !== "error") ? (
      <p
        className={`flex min-w-0 items-start gap-1.5 text-sm break-words ${
          action.ok ? "text-app-text" : "text-app-text-muted"
        }`}
      >
        {action.ok ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-app-success-solid" aria-hidden="true" />
        ) : (
          /* Not a checkmark: an offer that kept its card for a retry must not wear the mark of
             something that went through. Icon and sentence say the same thing — the shape carries
             the meaning, not the colour alone (AGENTS §7). */
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-app-warning-text"
            aria-hidden="true"
          />
        )}
        {action.outcome}
      </p>
    ) : null;

  if (isSettled) {
    return (
      <div className="flex flex-col items-start">
        {outcomeLine}
        {/* Opening orientation is the one hire action whose result is content, not just an
            outcome line: the packet renders right here in the thread instead of navigating to a
            page. Stored proposals have no `action` name to match — their payoff is always the
            outcome line. */}
        {"action" in action && action.action === BUDDY_ACTION_OPEN_ORIENTATION && action.ok && (
          <BuddyOrientationCard />
        )}
      </div>
    );
  }

  // Fail closed: a proposal whose risk did not survive the stream (or that arrived
  // without its description) is not confirmable — an approval card for a project
  // mutation must never guess how loudly to warn, nor confirm what it cannot show.
  const isUnsupported = isStored && (action.risk === null || !action.preview);
  const previewId = `buddy-proposal-preview-${action.id}`;

  return (
    <>
      {/* Under the refusal, never instead of it: the outcome says why it did not work, and the
          card below is how it is tried again — whole, because a flag that came back unsent is
          exactly the one whose wording is worth another look. */}
      {outcomeLine}
      <div className="flex max-w-full min-w-0 flex-col gap-1.5 rounded-xl border border-app-border bg-app-bg p-2.5">
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
                onClick={() => onDismiss(messageId, action)}
                disabled={isConfirming}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Not now
              </button>
            </div>
          </>
        )}
        {/* The one proposal whose payload is a *message*: the buddy composes the question,
                the hire sends it under their own name, and a person reads it — so it is shown in
                full, editable, above the button that sends it. Four things follow from that, and
                all are enforced: what goes out is the field's own text (`handleConfirm`), the field
                is then made to hold exactly that, an empty field cannot be confirmed and *says why*
                (`Field`'s `error` — its presence is the error state, and it is announced), and the
                wording is held by the session rather than by this card (`actionDrafts`) — neither a
                dock the hire closes nor the hand-off to `/buddy` may throw away a half-worded
                question. */}
        {isFlagToPm && (
          <Field
            label="Sends to your PM"
            hint="Edit it if it is not quite right — this exact text is what they will read."
            error={hasQuestion ? undefined : "Write a question before sending."}
            required
            disabled={isConfirming}
          >
            <Textarea
              value={editedQuestion}
              onChange={(event) => setActionDraft(draftKey, event.target.value)}
              placeholder="What do you need answered?"
              minRows={2}
              maxRows={5}
            />
          </Field>
        )}

        {!isUnsupported && (
          <div className="flex flex-wrap items-center gap-2">
            {/* `action.label` is written by the model, so its length is not ours to
                                assume. In a 384 px panel an unbreakable one would push the button
                                past the edge -- hence the wrap and the left alignment that follows
                                from a label running to two lines. */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
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
              onClick={() => onDismiss(messageId, action)}
              disabled={isConfirming}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Not now
            </button>
          </div>
        )}
        {/* The other thing that leaves the product in the hire's name: a skip request's
                reason, which is the whole of what that PM reads. A static line rather than a
                field, and deliberately left where it was — a sentence to acknowledge, not one to
                compose. A flag's question is the field above, because that one is rewordable. */}
        {!isStored && action.reason && (
          <p className="px-1 text-xs break-words text-app-text-muted">
            Your reason: &ldquo;{action.reason}&rdquo;
          </p>
        )}
        {action.status === "error" && (
          <p className="text-xs text-app-danger-text">
            Couldn&apos;t reach the server — try again.
          </p>
        )}
      </div>
    </>
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

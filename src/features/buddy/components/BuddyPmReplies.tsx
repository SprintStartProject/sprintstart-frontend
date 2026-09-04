import { BookCheck, Clock, MessageSquareOff, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateTime, formatWaiting, hasWaitedADay } from "../../knowledge-request/format";
import type { PmReplies } from "../hooks/usePmReplies";

/**
 * What the hire has sent to a person, beside the conversation rather than inside it.
 *
 * `FlagToPmButton` tells a hire "the answer will show up here once they reply", and until this
 * existed the app did not keep that promise — the loop closed only if the hire happened to ask
 * the buddy the same question again and retrieval happened to surface the new canonical answer.
 * Escalation is the *last-resort* channel, so its round trip is the one a hire is most likely
 * blocked on, and a prompt reply that produces no visible signal reads exactly like being
 * ignored.
 *
 * **It sits in a rail, not at the top of the thread.** As messages it pushed the live
 * conversation down every time — the record grows and never shrinks, so the thing the hire came
 * for started further from the top each visit. A rail is where a chat keeps this sort of
 * standing context; the buddy's own thread stays the buddy's own thread.
 *
 * It is still read from the server on every mount rather than being part of the transcript, and
 * that is the point: a visit opens fresh, so a message inside it would scroll away with
 * everything else, and a hire who was not on the page when the answer landed would never see it.
 *
 * Attributed to the PM by role rather than by name — a `CanonicalAnswer` carries an `authorId`,
 * and no hire-accessible endpoint resolves one to a name, so "your PM" is what can be said
 * truthfully without a new backend read.
 *
 * Scoped to the hire, not to the selected project: these are their own questions, and hiding the
 * ones asked on another project would mean an answer silently never arriving.
 */
export function BuddyPmReplies({
  answered,
  waiting,
  dismissed,
  onClose,
}: PmReplies & { onClose: () => void }) {
  // Nothing to say is the common case — a hire who has never escalated should see no trace of a
  // feature they have not used. The page reads the same emptiness from `hasAny` and does not
  // offer the rail at all, so this guard is the backstop rather than the mechanism.
  if (answered.length === 0 && waiting.length === 0 && dismissed.length === 0) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="truncate text-sm font-bold tracking-wide text-app-text-muted uppercase">
          Sent to your PM
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the PM replies"
          className="shrink-0 rounded p-1 text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-5">
        {answered.length > 0 && (
          <Group
            icon={BookCheck}
            title={answered.length === 1 ? "Your PM answered" : "Your PM answered these"}
          >
            {answered.map((request) => (
              <li key={request.id} className="rounded-xl bg-app-surface-muted/60 p-3">
                <p className="text-sm font-medium text-app-text">{request.question}</p>
                <p className="mt-1.5 text-sm whitespace-pre-wrap text-app-text-muted">
                  {request.answer?.answer}
                </p>
                <p className="mt-2 text-xs text-app-text-disabled">
                  Answered by your PM
                  {request.answeredAt && ` · ${formatDateTime(request.answeredAt)}`}
                  {" · the buddy knows this now, so you can ask it directly next time"}
                </p>
              </li>
            ))}
          </Group>
        )}

        {waiting.length > 0 && (
          <Group icon={Clock} title="Still with your PM">
            {waiting.map((request) => (
              <li
                key={request.id}
                className="rounded-xl bg-app-surface-muted/60 px-3 py-2.5 text-sm text-app-text-muted"
              >
                {request.question}
                {/* The wait is the information, and a long one is worth flagging — said in
                                    words as well as tinted, per the colour-blind rule. */}
                <span
                  className={`mt-1.5 flex items-center gap-1 text-xs ${
                    hasWaitedADay(request.createdAt)
                      ? "font-medium text-app-warning-text"
                      : "text-app-text-disabled"
                  }`}
                >
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Waiting {formatWaiting(request.createdAt)}
                </span>
              </li>
            ))}
          </Group>
        )}

        {/* A dismissed question is shown rather than quietly dropped: the hire was told to wait
                    for an answer that is now never coming, and letting it sit under "still with your
                    PM" forever would be the same broken promise in a different place. */}
        {dismissed.length > 0 && (
          <Group icon={MessageSquareOff} title="Closed without an answer">
            {dismissed.map((request) => (
              <li
                key={request.id}
                className="rounded-xl bg-app-surface-muted/40 px-3 py-2.5 text-sm text-app-text-muted"
              >
                {request.question}
                <span className="mt-1 block text-xs text-app-text-disabled">
                  Worth asking your PM directly.
                </span>
              </li>
            ))}
          </Group>
        )}
      </div>
    </div>
  );
}

/** One status group: a tinted icon, its label, and the questions in it. */
function Group({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
        <h3 className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
          {title}
        </h3>
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

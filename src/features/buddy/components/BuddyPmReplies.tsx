import { useMemo } from "react";
import { BookCheck, Clock, MessageSquareOff, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { formatDateTime, formatWaiting, hasWaitedADay } from "../../knowledge-request/format";
import type { KnowledgeRequest } from "../../knowledge-request/types";

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
export function BuddyPmReplies() {
  const { data, loading, error } = useFetch<KnowledgeRequest[]>(
    () => knowledgeRequestService.listMine(),
    [],
  );

  const { answered, waiting, dismissed } = useMemo(() => {
    const requests = data ?? [];
    return {
      answered: requests.filter((r) => r.status === "ANSWERED" && r.answer !== null),
      waiting: requests.filter((r) => r.status === "OPEN"),
      dismissed: requests.filter((r) => r.status === "DISMISSED"),
    };
  }, [data]);

  // Nothing to say is the common case — a hire who has never escalated should see no trace of a
  // feature they have not used, and the rail collapses to nothing rather than standing empty. A
  // failed load is silent for the same reason: this is a record of something that already
  // happened, so an error banner beside the composer would be noise the hire cannot act on, and
  // the next mount retries anyway.
  if (loading || error) return null;
  if (answered.length === 0 && waiting.length === 0 && dismissed.length === 0) return null;

  return (
    <aside
      aria-label="Questions you sent to your PM"
      className="min-h-0 shrink-0 overflow-y-auto border-b border-app-border py-5 xl:w-80 xl:border-r xl:border-b-0 xl:pr-6"
    >
      <div className="flex items-center gap-2 pb-4">
        <Send className="h-4 w-4 shrink-0 text-app-brand-text" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-app-text">Sent to your PM</h2>
      </div>

      <div className="flex flex-col gap-5">
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
    </aside>
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

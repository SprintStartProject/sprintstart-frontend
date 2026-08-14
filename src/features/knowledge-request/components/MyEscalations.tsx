import { useMemo } from "react";
import { BookCheck, Clock, MessageSquareOff } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { formatDateTime, formatWaiting } from "../format";
import type { KnowledgeRequest } from "../types";

/**
 * The hire's half of the growth loop: what came back from the person they asked.
 *
 * `FlagToPmButton` tells a hire "the answer will show up here once they reply", and until this
 * existed the app did not keep that promise — the loop closed only if the hire happened to ask the
 * buddy the same question again and retrieval happened to surface the new canonical answer. Since
 * escalation is the *last-resort* channel, its round trip is the one a hire is most likely blocked
 * on, and a prompt reply that produces no visible signal reads exactly like being ignored.
 *
 * Deliberately not part of the conversation. The buddy thread opens fresh every visit by design, so
 * a message in it would scroll away with everything else; this reads the server on every mount, so
 * a hire who was not on the page when the answer landed still finds it.
 *
 * It is attributed to the PM rather than shown in the mentor's voice: the hire asked a *person*, and
 * rendering their reply as something the buddy knows would hide that a human answered. Attribution
 * is by role — a `CanonicalAnswer` carries an `authorId`, and no hire-accessible endpoint resolves
 * one to a name, so "your PM" is what can be said truthfully without a new backend read.
 *
 * Scoped to the hire, not to the selected project: these are their own questions, and hiding the
 * ones asked on another project would mean an answer silently never arriving.
 */
export function MyEscalations() {
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
  // feature they have not used. A failed load is silent for the same reason: this is a record of
  // something that already happened, so an error banner above the composer would be noise the
  // hire cannot act on, and the next mount retries anyway.
  if (loading || error) return null;
  if (answered.length === 0 && waiting.length === 0 && dismissed.length === 0) return null;

  return (
    // Owns its own page spacing rather than taking it from a wrapper in `BuddyPage`: every
    // return above this one is `null`, and a padded wrapper around nothing is a visible gap.
    <div className="shrink-0 px-4 pt-4">
      <section
        className="mx-auto w-full max-w-3xl rounded-xl border border-app-border bg-app-surface p-3"
        aria-label="Questions you sent to your PM"
      >
        {answered.length > 0 && (
          <>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-app-text-muted uppercase">
              {answered.length === 1 ? "Your PM answered" : "Your PM answered these"}
            </h2>
            <ul className="space-y-3">
              {answered.map((request) => (
                <li key={request.id}>
                  <div className="flex items-start gap-2">
                    <BookCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-app-success-solid"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-app-text">{request.question}</p>
                  </div>
                  <p className="mt-1.5 pl-6 text-sm whitespace-pre-wrap text-app-text-muted">
                    {request.answer?.answer}
                  </p>
                  <p className="mt-1.5 pl-6 text-xs text-app-text-disabled">
                    Answered by your PM
                    {request.answeredAt && ` · ${formatDateTime(request.answeredAt)}`}
                    {" · the buddy knows this now, so you can ask it directly next time"}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        {waiting.length > 0 && (
          <>
            <h2
              className={`mb-2 text-xs font-medium tracking-wide text-app-text-muted uppercase ${
                answered.length > 0 ? "mt-4" : ""
              }`}
            >
              Still with your PM
            </h2>
            <ul className="space-y-1.5">
              {waiting.map((request) => (
                <li key={request.id} className="flex items-start justify-between gap-3">
                  <p className="text-sm text-app-text-muted">{request.question}</p>
                  <span
                    className="flex shrink-0 items-center gap-1 text-xs text-app-text-disabled"
                    title="How long this has waited on a person"
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatWaiting(request.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* A dismissed question is shown rather than quietly dropped: the hire was told to
                    wait for an answer that is now never coming, and letting it sit under "still with
                    your PM" forever would be the same broken promise in a different place. */}
        {dismissed.length > 0 && (
          <>
            <h2
              className={`mb-2 text-xs font-medium tracking-wide text-app-text-muted uppercase ${
                answered.length > 0 || waiting.length > 0 ? "mt-4" : ""
              }`}
            >
              Closed without an answer
            </h2>
            <ul className="space-y-1.5">
              {dismissed.map((request) => (
                <li key={request.id} className="flex items-start gap-2">
                  <MessageSquareOff
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-text-disabled"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-app-text-muted">
                    {request.question}{" "}
                    <span className="text-app-text-disabled">— worth asking your PM directly.</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

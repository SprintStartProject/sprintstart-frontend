import { useMemo } from "react";
import { useFetch } from "../../../hooks/useFetch";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { formatDateTime, formatWaiting, hasWaitedADay } from "../../knowledge-request/format";
import type { KnowledgeRequest } from "../../knowledge-request/types";
import { BuddyMessage } from "./BuddyMessage";

/**
 * The hire's half of the growth loop, told as part of the conversation: what came back from the
 * person they asked.
 *
 * `FlagToPmButton` tells a hire "the answer will show up here once they reply", and until this
 * existed the app did not keep that promise — the loop closed only if the hire happened to ask
 * the buddy the same question again and retrieval happened to surface the new canonical answer.
 * Escalation is the *last-resort* channel, so its round trip is the one a hire is most likely
 * blocked on, and a prompt reply that produces no visible signal reads exactly like being
 * ignored.
 *
 * **It is now shown as messages rather than as a widget beside the chat.** A card in a sidebar
 * said "here is some data about your escalations"; a reply from a named person in the thread
 * says what actually happened — somebody answered you. It is still read from the server on
 * every mount rather than being part of the buddy's transcript, which is the point: the buddy
 * thread opens fresh every visit, so a message inside it would scroll away with everything
 * else, and a hire who was not on the page when the answer landed would never see it.
 *
 * The reply is attributed to the PM, not spoken in the buddy's voice: the hire asked a *person*,
 * and dressing their answer as something the buddy knows would hide that a human was involved.
 * Attribution is by role — a `CanonicalAnswer` carries an `authorId`, and no hire-accessible
 * endpoint resolves one to a name, so "your PM" is what can be said truthfully without a new
 * backend read.
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
  // feature they have not used. A failed load is silent for the same reason: this is a record of
  // something that already happened, so an error banner above the conversation would be noise
  // the hire cannot act on, and the next mount retries anyway.
  if (loading || error) return null;
  if (answered.length === 0 && waiting.length === 0 && dismissed.length === 0) return null;

  return (
    <section className="flex flex-col gap-4" aria-label="Questions you sent to your PM">
      {answered.length > 0 && (
        <>
          <ThreadDivider>
            {answered.length === 1 ? "Your PM answered" : "Your PM answered these"}
          </ThreadDivider>
          {answered.map((request) => (
            // The question and the answer as the exchange it was: the hire's words, then the
            // person's. A bare answer with no question above it is the half of a conversation
            // that needs the other half to make sense.
            <div key={request.id} className="flex flex-col gap-4">
              <BuddyMessage speaker="YOU" showName>
                {request.question}
              </BuddyMessage>
              <BuddyMessage
                speaker="PM"
                showName
                meta={
                  <>
                    Answered by your PM
                    {request.answeredAt && ` · ${formatDateTime(request.answeredAt)}`}
                    {" · the buddy knows this now, so you can ask it directly next time"}
                  </>
                }
              >
                {request.answer?.answer}
              </BuddyMessage>
            </div>
          ))}
        </>
      )}

      {waiting.length > 0 && (
        <>
          <ThreadDivider>Still with your PM</ThreadDivider>
          {waiting.map((request) => (
            <BuddyMessage
              key={request.id}
              speaker="YOU"
              showName
              meta={
                // The wait is the information here, and a long one is worth flagging — so it
                // is said in words as well as tinted, per the colour-blind rule.
                <span
                  className={
                    hasWaitedADay(request.createdAt) ? "font-medium text-app-warning-text" : ""
                  }
                >
                  Waiting on a person · {formatWaiting(request.createdAt)}
                </span>
              }
            >
              {request.question}
            </BuddyMessage>
          ))}
        </>
      )}

      {/* A dismissed question is shown rather than quietly dropped: the hire was told to wait
                for an answer that is now never coming, and letting it sit under "still with your
                PM" forever would be the same broken promise in a different place. */}
      {dismissed.length > 0 && (
        <>
          <ThreadDivider>Closed without an answer</ThreadDivider>
          {dismissed.map((request) => (
            <BuddyMessage
              key={request.id}
              speaker="YOU"
              showName
              meta="Closed without a reply — worth asking your PM directly."
            >
              {request.question}
            </BuddyMessage>
          ))}
        </>
      )}

      <ThreadDivider>Today</ThreadDivider>
    </section>
  );
}

/**
 * The hairline-and-label rule a chat puts between days. Here it separates what came back from a
 * person from what the buddy is about to say, which is the same job: telling one stretch of the
 * conversation from another without adding a heading nobody asked for.
 */
function ThreadDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-app-border" aria-hidden="true" />
      <span className="text-xs font-medium text-app-text-muted">{children}</span>
      <span className="h-px flex-1 bg-app-border" aria-hidden="true" />
    </div>
  );
}

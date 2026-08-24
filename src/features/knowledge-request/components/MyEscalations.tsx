import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookCheck, Clock, Hourglass, MessageSquareOff } from "lucide-react";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { useFetch } from "../../../hooks/useFetch";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { formatDateTime, formatWaiting, hasWaitedADay } from "../format";
import type { KnowledgeRequest } from "../types";

/**
 * Entrance for the card itself: a short rise, so the box settles into the page
 * rather than appearing mid-frame. Collapsed to an instant appearance under
 * reduced motion.
 */
const cardEntrance = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

/**
 * Per-item stagger delay, matching the detail drawer's reveal cadence
 * (see `DrawerCard`): each entry starts a beat after the one above it.
 */
const staggerDelay = (index: number): number => index * 0.07;

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
  const prefersReducedMotion = useReducedMotion();
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
      {/* The dashboard's widget frame, borrowed: cursor spotlight, hover border lift and the
                tilt toggle all come from `SpotlightCard`, so this box reads as the same design
                system as the PM dashboard while staying a plain informational surface. */}
      <motion.div {...(prefersReducedMotion ? {} : cardEntrance)}>
        <SpotlightCard roundedClassName="rounded-2xl" className="mx-auto w-full max-w-3xl">
          <section
            className="flex flex-col gap-5 p-5 sm:p-6"
            aria-label="Questions you sent to your PM"
          >
            {answered.length > 0 && (
              <>
                <SectionHeading icon={BookCheck} tone="success">
                  {answered.length === 1 ? "Your PM answered" : "Your PM answered these"}
                </SectionHeading>
                <ul className="-mt-4 space-y-4">
                  {answered.map((request, index) => (
                    <motion.li
                      key={request.id}
                      {...(prefersReducedMotion
                        ? {}
                        : {
                            initial: { opacity: 0, y: 12 },
                            animate: { opacity: 1, y: 0 },
                            transition: {
                              duration: 0.35,
                              delay: staggerDelay(index),
                              ease: [0.16, 1, 0.3, 1] as const,
                            },
                          })}
                      className="rounded-xl bg-app-surface-muted/60 p-3"
                    >
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
                    </motion.li>
                  ))}
                </ul>
              </>
            )}

            {waiting.length > 0 && (
              <>
                <SectionHeading icon={Hourglass} tone={hasOpenLongWait(waiting) ? "warning" : null}>
                  Still with your PM
                </SectionHeading>
                <ul className="-mt-4 space-y-2">
                  {waiting.map((request, index) => (
                    <motion.li
                      key={request.id}
                      {...(prefersReducedMotion
                        ? {}
                        : {
                            initial: { opacity: 0, y: 12 },
                            animate: { opacity: 1, y: 0 },
                            transition: {
                              duration: 0.35,
                              delay: staggerDelay(index),
                              ease: [0.16, 1, 0.3, 1] as const,
                            },
                          })}
                      className="flex items-start justify-between gap-3 rounded-xl bg-app-surface-muted/60 px-3 py-2.5"
                    >
                      <p className="text-sm text-app-text-muted">{request.question}</p>
                      <span
                        title="How long this has waited on a person"
                        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          hasWaitedADay(request.createdAt)
                            ? "bg-app-warning-bg font-medium text-app-warning-text"
                            : "bg-app-surface text-app-text-disabled"
                        }`}
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatWaiting(request.createdAt)}
                        {hasWaitedADay(request.createdAt) && (
                          <span className="sr-only"> or more</span>
                        )}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </>
            )}

            {/* A dismissed question is shown rather than quietly dropped: the hire was told to
                        wait for an answer that is now never coming, and letting it sit under "still with
                        your PM" forever would be the same broken promise in a different place. */}
            {dismissed.length > 0 && (
              <>
                <SectionHeading icon={MessageSquareOff} tone={null}>
                  Closed without an answer
                </SectionHeading>
                <ul className="-mt-4 space-y-2">
                  {dismissed.map((request, index) => (
                    <motion.li
                      key={request.id}
                      {...(prefersReducedMotion
                        ? {}
                        : {
                            initial: { opacity: 0, y: 12 },
                            animate: { opacity: 1, y: 0 },
                            transition: {
                              duration: 0.35,
                              delay: staggerDelay(index),
                              ease: [0.16, 1, 0.3, 1] as const,
                            },
                          })}
                      className="flex items-start gap-2 rounded-xl bg-app-surface-muted/40 px-3 py-2.5"
                    >
                      <MessageSquareOff
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-text-disabled"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-app-text-muted">
                        {request.question}{" "}
                        <span className="text-app-text-disabled">
                          — worth asking your PM directly.
                        </span>
                      </p>
                    </motion.li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </SpotlightCard>
      </motion.div>
    </div>
  );
}

/** Which accent a section header carries — `null` is the quiet default. */
type HeadingTone = "success" | "warning" | null;

const HEADING_TONE_CLASSES: Record<"success" | "warning", string> = {
  success: "bg-app-success-bg text-app-success-text",
  warning: "bg-app-warning-bg text-app-warning-text",
};

/**
 * A status group's label row: soft-tinted icon tile plus the uppercase label,
 * matching the section headers of the admin detail drawer (`DrawerCard`).
 * The tile tint pairs color with the icon shape, per the color-blind rule.
 */
function SectionHeading({
  icon: Icon,
  tone = null,
  children,
}: {
  icon: typeof BookCheck;
  tone?: HeadingTone;
  children: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          tone === null ? "bg-app-brand-soft text-app-brand" : HEADING_TONE_CLASSES[tone]
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h2 className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
        {children}
      </h2>
    </div>
  );
}

/** Whether any still-open question has waited a day or more — tints the waiting header. */
function hasOpenLongWait(waiting: KnowledgeRequest[]): boolean {
  return waiting.some((request) => hasWaitedADay(request.createdAt));
}

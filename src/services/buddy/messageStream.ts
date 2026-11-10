import { readBuddyStream } from "./readBuddyStream";
import type { BuddyStreamHandlers, ProposalRisk } from "./featureTypes";
import type { BuddyStreamChunk } from "./streamChunk";

/**
 * Per-message switches that ride along with the content — see `streamMessage`.
 */
export type BuddyMessageOptions = {
  /**
   * Whether the mentor may act on this message (tools, action proposals, board writes). Sent
   * per message rather than held on the session: it is a mood, not a setting — a hire who turned
   * it off to look something up and then asks the mentor to *do* something should not have to
   * remember which state they left the switch in.
   */
  capabilitiesEnabled?: boolean;
  /**
   * Narrows what this message may draw on. Field names as the backend serializes them
   * (`BuddySessionFilters`' `@SerialName`s) — this module is the one place that speaks the wire
   * vocabulary; callers hand over the composer's camelCase shape, already mapped.
   */
  filters?: { source_systems?: string[]; time_from?: string; time_to?: string };
};

type ActionProposalHandler = NonNullable<BuddyStreamHandlers["onActionProposal"]>;

/**
 * The risk carried on a team-mode proposal, read only as far as the wire is trusted.
 *
 * The backend's `BuddyProposalRisk` enum only ever sends the three known values, but a version
 * skew, a partial deployment or a malformed event could deliver anything else. This validates
 * rather than casts, and fails *closed*: an unknown or absent value comes back `null`, and the
 * card renders an explicit unsupported state instead of a confirmable offer — an approval card
 * for a project mutation must never guess how loudly to warn. The console note keeps the drift
 * findable rather than silent.
 */
export function readProposalRisk(risk: string | undefined): ProposalRisk | null {
  if (risk === "DESTRUCTIVE" || risk === "BULK" || risk === "STANDARD") return risk;

  if (risk !== undefined) {
    console.warn(`Buddy sent an unknown proposal risk: ${risk}`);
  }

  return null;
}

/**
 * The JSON body of a message: a team target replaces the conversation, and each optional part is
 * left out rather than sent empty. Omitted, never null — carrying `teamProjectId: null` would send
 * a field the contract does not have.
 */
export function messageBody({
  content,
  sessionId,
  teamProjectId,
  currentPage,
  options,
}: {
  content: string;
  sessionId: string | undefined;
  teamProjectId: string | undefined;
  currentPage: string | undefined;
  options: BuddyMessageOptions | undefined;
}): Record<string, unknown> {
  return {
    content,
    ...(teamProjectId ? { teamProjectId } : { sessionId }),
    ...(currentPage ? { currentPage } : {}),
    ...(options?.capabilitiesEnabled === undefined
      ? {}
      : { capabilitiesEnabled: options.capabilitiesEnabled }),
    ...(options?.filters ? { filters: options.filters } : {}),
  };
}

/** A hire-mode proposal's snake_case wire fields as the camelCase payload the card echoes back. */
export function toActionProposal(
  event: BuddyStreamChunk & { action: string; label: string },
): Parameters<ActionProposalHandler>[0] {
  return {
    action: event.action,
    label: event.label,
    question: event.question,
    taskId: event.task_id,
    title: event.title,
    attesterId: event.attester_id,
    githubLogin: event.github_login,
    competencyKey: event.competency_key,
    level: event.level,
    stepId: event.step_id,
    questionId: event.question_id,
    phaseId: event.phase_id,
    onboardingTaskId: event.onboarding_task_id,
    answer: event.answer,
    optionIds: event.option_ids,
    description: event.description,
    reason: event.reason,
    waitsOnIds: event.waits_on_ids,
    unlocksIds: event.unlocks_ids,
    checklistTitle: event.checklist_title,
    checklistItems: event.checklist_items,
    cardId: event.card_id,
    noteText: event.note_text,
    lineBefore: event.line_before,
    lineAfter: event.line_after,
    linkUrl: event.link_url,
    linkLabel: event.link_label,
    cardIds: event.card_ids,
    cardNames: event.card_names,
    preview: event.preview,
  };
}

function relayProposal(handlers: BuddyStreamHandlers, event: BuddyStreamChunk): void {
  // Team mode stores its proposals server-side and offers them by id, so the presence
  // of `proposal_id` is what says "this is a stored proposal, confirm goes by id" — a
  // hire-mode offer carries the tool name to echo instead, and never an id.
  if (event.proposal_id) {
    if (event.label) {
      handlers.onStoredProposal?.({
        proposalId: event.proposal_id,
        label: event.label,
        // Absent, not blank: a missing preview blocks confirmation on the card rather
        // than rendering as invisible text.
        preview: event.preview ?? null,
        risk: readProposalRisk(event.risk),
      });
    }
    return;
  }

  if (event.action && event.label) {
    handlers.onActionProposal?.(
      toActionProposal({ ...event, action: event.action, label: event.label }),
    );
  }
}

function relayCitation(handlers: BuddyStreamHandlers, event: BuddyStreamChunk): void {
  if (event.artifact_id && event.filename) {
    handlers.onCitation({
      artifactId: event.artifact_id,
      filename: event.filename,
      sourceUrl: event.source_url,
      startLine: event.start_line,
      startPage: event.start_page,
    });
  }
}

/** The events that carry text or a tool signal. */
function relayProgress(handlers: BuddyStreamHandlers, event: BuddyStreamChunk): void {
  if (event.type === "tool_use" && event.name) handlers.onToolUse?.(event.name);
  if (event.type === "token" && event.content !== undefined) handlers.onToken(event.content);
}

/** Passes the non-terminal events on to the matching handler. */
function relayContent(handlers: BuddyStreamHandlers, event: BuddyStreamChunk): void {
  switch (event.type) {
    case "citation":
      relayCitation(handlers, event);
      break;
    case "action_proposal":
      relayProposal(handlers, event);
      break;
    case "reasoning":
      if (event.reasoning !== undefined) handlers.onReasoning?.(event.reasoning);
      break;
    case "reset":
      handlers.onReset?.();
      break;
    default:
      relayProgress(handlers, event);
  }
}

function handleMessageChunk(handlers: BuddyStreamHandlers, event: BuddyStreamChunk): "stop" | void {
  switch (event.type) {
    case "done":
      handlers.onDone();
      return "stop";
    case "error":
      handlers.onError?.(event.message ?? "Unknown error");
      return "stop";
    default:
      relayContent(handlers, event);
  }
}

/**
 * Sends a message to the user's persistent buddy and streams the grounded reply.
 *
 * @param content - The message to send.
 * @param handlers - Helper operations handling the output of the buddy's response.
 * @param sessionId - The conversation to speak into. Required for the hire's own conversations.
 * @param teamProjectId - Pass to speak in *team mode* about a managed project instead of the hire's
 *   own conversation. Sent in the body, not the query string — the backend's contract puts the
 *   team target on the POST body and leaves the hire's own conversation to `sessionId`.
 * @param currentPage The app path the sender is on (`/team-management`), so the buddy's app
 *   guide can answer "where is this here?". Omitted when unknown, like `teamProjectId`.
 * @param signal Stops the turn — the composer's Stop button. An abort resolves the read
 *   silently (no `onError`, no `onDone`), so the caller reads `signal.aborted` to close the
 *   turn out as cut short rather than failed.
 * @param options Per-message switches (capabilities, filters); see `BuddyMessageOptions`.
 */
export async function streamMessage(
  content: string,
  handlers: BuddyStreamHandlers,
  sessionId: string | undefined,
  teamProjectId?: string,
  currentPage?: string,
  signal?: AbortSignal,
  options?: BuddyMessageOptions,
): Promise<void> {
  const outcome = await readBuddyStream(
    `/api/v1/onboarding/me/buddy/messages`,
    messageBody({ content, sessionId, teamProjectId, currentPage, options }),
    (event) => handleMessageChunk(handlers, event),
    handlers.onError,
    signal,
  );

  // Fallback: ensure onDone is called when the stream ends without a terminal event.
  if (outcome === "ended") handlers.onDone();
}

import { apiClient } from "./apiClient";
import keycloak from "../config/keycloak";
import type { BuddyStreamHandlers, ProposalRisk } from "../features/buddy/types";
import type { BuddyMessage } from "../features/buddy/types";

/**
 * Names the conversation a call is about, on the query string — the shape the read and open
 * endpoints take their target in.
 *
 * Hand-joined rather than `URLSearchParams.size`, and skipped parts are left out entirely:
 * an absent parameter is what the backend reads as "the caller's own conversation".
 */
function buddyQuery(parts: { sessionId?: string; teamProjectId?: string }): string {
  const params: string[] = [];

  if (parts.sessionId) params.push(`sessionId=${encodeURIComponent(parts.sessionId)}`);
  if (parts.teamProjectId) params.push(`teamProjectId=${encodeURIComponent(parts.teamProjectId)}`);

  return params.length > 0 ? `?${params.join("&")}` : "";
}

/**
 * One conversation the hire owns: its id, its title (empty until the first message writes
 * one) and when it was started. Newest first, as the backend orders them.
 */
export interface BuddySessionSummary {
  id: string;
  title: string;
  projectId: string | null;
  createdAt: string;
}

/**
 * The hire's conversations, newest first.
 *
 * Read before every opening: the client picks the one to show — the most recent, or the one
 * it was last in — and names it on every request that follows.
 */
export async function getSessions(): Promise<BuddySessionSummary[]> {
  const response = await apiClient.fetch<{ sessions: BuddySessionSummary[] }>(
    `/api/v1/onboarding/me/buddy/sessions`,
  );

  return response.sessions;
}

/**
 * Starts a conversation for the hire and returns its id.
 *
 * No project is named, deliberately: the hire's conversation is not one project's, and the
 * backend already scopes retrieval to every project they are on. A conversation created by
 * "new conversation" therefore behaves exactly like the first one.
 */
export async function createSession(): Promise<string> {
  const response = await apiClient.fetch<{ id: string }>(`/api/v1/onboarding/me/buddy/sessions`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.id;
}

/**
 * Bins one of the hire's conversations.
 *
 * The conversation leaves the hire's list — the backend keeps it, messages and all, until its
 * retention window ends and then deletes it for good. The list read no longer returns it, so
 * taking the row out client-side is the same thing the next read would show.
 *
 * @param sessionId - The conversation to bin. One of the hire's own; the backend answers `404`
 *   for anyone else's.
 */
export async function binSession(sessionId: string): Promise<void> {
  await apiClient.fetch<void>(
    `/api/v1/onboarding/me/buddy/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}

/**
 * Retrieves one conversation's messages, oldest first (the window since its last opening —
 * not the whole transcript).
 *
 * @param sessionId - The conversation to read. Required for the hire's own conversations — the
 *   backend answers `400` without one.
 * @param teamProjectId - Pass to read the *team-mode* conversation with a managed project
 *   instead; the backend keeps the two apart and team reads name no session.
 */
export async function getMessages(
  sessionId: string | undefined,
  teamProjectId?: string,
): Promise<BuddyMessage[]> {
  return await apiClient.fetch<BuddyMessage[]>(
    `/api/v1/onboarding/me/buddy/messages${buddyQuery({ sessionId, teamProjectId })}`,
  );
}

/** One suggested next step attached to a buddy greeting — one click sends `question`. */
export interface BuddyOpeningAction {
  label: string;
  question: string;
}

/**
 * One thing this hire could usefully ask, offered as a chip beside the composer.
 *
 * `question` goes into the composer; it is never sent. The hire presses send. A chip that
 * spoke for somebody would be putting words in their mouth, which is the same rule `AskTheBuddy`
 * keeps for the board.
 */
export interface BuddySuggestion {
  label: string;
  question: string;
}

/**
 * What this hire could usefully ask, drawn server-side from the tools actually mounted for them —
 * so a chip is never offered for something their buddy cannot answer. Calls no model, so a surface
 * can show these before a greeting has arrived.
 */
export async function getSuggestions(): Promise<BuddySuggestion[]> {
  return await apiClient.fetch<BuddySuggestion[]>(`/api/v1/onboarding/me/buddy/suggestions`);
}

/** How a caller receives a visit's greeting as it is written. */
export interface BuddyOpeningHandlers {
  onToken: (token: string) => void;
  /** The one suggested next step, if the mentor offered one. Arrives before `onDone`. */
  onAction?: (action: BuddyOpeningAction) => void;
  onDone: () => void;
  onError?: (message: string) => void;
}

/**
 * Opens a buddy visit, streaming the greeting as the mentor writes it.
 *
 * The mentor greets the hire grounded in their durable memory and current state; the past
 * transcript is not replayed — a visit starts fresh with this greeting.
 *
 * The first token can still be tens of seconds away. The greeting is written before
 * anything the hire never sees, so nothing is queued behind invisible output — but the model is
 * remote and conditionally reasoning, and it emits nothing while it thinks. Handlers must treat a
 * long silence before the first token as normal, not as a failed stream.
 *
 * Opening twice without the hire saying anything is the same visit: the greeting already there is
 * replayed whole and no model is called.
 *
 * @param handlers - How the streamed greeting is received.
 * @param sessionId - The conversation to open. Required for the hire's own conversations.
 * @param teamProjectId - Pass to open a *team-mode* visit with a managed project instead of the
 *   hire's own conversation — the backend greets a manager about their team there.
 */
export async function streamOpenBuddy(
  handlers: BuddyOpeningHandlers,
  sessionId: string | undefined,
  teamProjectId?: string,
): Promise<void> {
  const outcome = await readBuddyStream(
    `/api/v1/onboarding/me/buddy/open/stream${buddyQuery({ sessionId, teamProjectId })}`,
    undefined,
    (chunk) => {
      switch (chunk.type) {
        case "token":
          if (chunk.content !== undefined) handlers.onToken(chunk.content);
          break;
        case "opening_action":
          // Not an action proposal. `action_proposal` means the buddy is offering to *do*
          // something and is gated on the hire confirming; this only fills the composer.
          if (chunk.label && chunk.question) {
            handlers.onAction?.({ label: chunk.label, question: chunk.question });
          }
          break;
        case "done":
          handlers.onDone();
          return "stop";
        case "error":
          handlers.onError?.(chunk.message ?? "The buddy could not be reached.");
          return "stop";
      }
    },
    handlers.onError,
  );

  // The greeting is all there is here, so a body that ends without a terminal event still
  // finished it -- the page must stop waiting either way.
  if (outcome === "ended") handlers.onDone();
}

/**
 * Generic stream event returned by the backend when sending a buddy message. Mirrors the
 * backend's `BuddyStreamEvent`, which reuses the `sse_event` vocabulary the AI service has
 * always spoken (`tool_use`/`token`/`citation`/…).
 */
interface BuddyStreamChunk {
  type:
    | "tool_use"
    | "token"
    | "citation"
    | "action_proposal"
    | "opening_action"
    | "reasoning"
    | "reset"
    | "done"
    | "error";
  content?: string;
  /** Set on a `reasoning` chunk: a delta of the thought being written, appended as it comes. */
  reasoning?: string;
  message?: string;
  name?: string;
  artifact_id?: string;
  filename?: string;
  source_url?: string;
  start_line?: number;
  start_page?: number;
  // Set only on an action_proposal chunk: the buddy is offering to do something, gated on confirm.
  action?: string;
  label?: string;
  question?: string;
  // Confirm payloads of the proposing action — echoed back verbatim on confirm
  // (as camelCase), so the target is the one the buddy proposed.
  task_id?: string;
  title?: string;
  attester_id?: string;
  github_login?: string;
  competency_key?: string;
  level?: string;
  // Path-action confirm payloads: which node of the hire's own onboarding path the action names,
  // the answer `answer_question` would send in their own words, and a new step's description.
  step_id?: string;
  question_id?: string;
  phase_id?: string;
  onboarding_task_id?: string;
  answer?: string;
  /** `answer_question` confirm payload: the options a multiple-choice answer stands for. */
  option_ids?: string[];
  description?: string;
  /** `request_skip` confirm payload: the reason that goes to the PM. */
  reason?: string;
  /** `add_path_step` confirm payload: where the step goes in its phase's graph. */
  waits_on_ids?: string[];
  unlocks_ids?: string[];
  /**
   * `place_checklist` confirm payload: the list the buddy offered to keep.
   *
   * Content rather than a target id, and echoed back for a sharper version of the same reason:
   * re-deriving these lines at confirm time would keep a card the hire never read.
   */
  checklist_title?: string;
  checklist_items?: string[];
  /** `amend_checklist`: which card of theirs the lines would be added to. */
  card_id?: string;
  /** `place_note` confirm payload. */
  note_text?: string;
  /** `reword_checklist_item`: the line as it reads now, and as it would read. */
  line_before?: string;
  line_after?: string;
  /** `place_link` / `edit_link`: where the link would point, and what it would be called. */
  link_url?: string;
  link_label?: string;
  /** `dismiss_cards` / `reorder_cards`: the cards in order, and their board names (display only). */
  card_ids?: string[];
  card_names?: string[];
  // Team-mode proposal: the stored proposal to confirm or dismiss by id. Present instead of the
  // per-action payload fields — the client echoes nothing back but this id.
  proposal_id?: string;
  // What confirming would change, in words: every team-mode proposal, and the hire's board edits.
  preview?: string;
  // Team-mode proposal: STANDARD, DESTRUCTIVE or BULK — how loudly the card warns.
  risk?: string;
}

/** The outcome of confirming a buddy-proposed action — a single line to relay in the thread. */
export interface BuddyActionResult {
  ok: boolean;
  message: string;
}

/**
 * Confirms a buddy-proposed action. This is the only call that mutates — the proposal itself
 * changed nothing. The project is re-resolved server-side from the caller, so only the action name
 * and the proposal's own confirm payloads are sent: `question` for flag-to-PM, `taskId` for a
 * goal claim, `title` + `attesterId` for an attestation request, `githubLogin` for saving a
 * username, `competencyKey` + `level` for recording where a conversation placed the hire, and the
 * path-node ids (`stepId`, `questionId`, `phaseId`, plus `answer`, `description` and `reason`) for
 * the actions that move the hire along their onboarding path.
 */
export async function performAction(
  action: string,
  extras: {
    question?: string;
    taskId?: string;
    title?: string;
    attesterId?: string;
    githubLogin?: string;
    competencyKey?: string;
    level?: string;
    stepId?: string;
    questionId?: string;
    phaseId?: string;
    onboardingTaskId?: string;
    answer?: string;
    optionIds?: string[];
    description?: string;
    reason?: string;
    waitsOnIds?: string[];
    unlocksIds?: string[];
    checklistTitle?: string;
    checklistItems?: string[];
    cardId?: string;
    noteText?: string;
    lineBefore?: string;
    lineAfter?: string;
    linkUrl?: string;
    linkLabel?: string;
    cardIds?: string[];
  } = {},
): Promise<BuddyActionResult> {
  return await apiClient.fetch<BuddyActionResult>(`/api/v1/onboarding/me/buddy/actions`, {
    method: "POST",
    body: JSON.stringify({
      action,
      question: extras.question,
      taskId: extras.taskId,
      title: extras.title,
      attesterId: extras.attesterId,
      githubLogin: extras.githubLogin,
      competencyKey: extras.competencyKey,
      level: extras.level,
      stepId: extras.stepId,
      questionId: extras.questionId,
      phaseId: extras.phaseId,
      onboardingTaskId: extras.onboardingTaskId,
      answer: extras.answer,
      optionIds: extras.optionIds,
      description: extras.description,
      reason: extras.reason,
      waitsOnIds: extras.waitsOnIds,
      unlocksIds: extras.unlocksIds,
      checklistTitle: extras.checklistTitle,
      checklistItems: extras.checklistItems,
      cardId: extras.cardId,
      noteText: extras.noteText,
      lineBefore: extras.lineBefore,
      lineAfter: extras.lineAfter,
      linkUrl: extras.linkUrl,
      linkLabel: extras.linkLabel,
      cardIds: extras.cardIds,
    }),
  });
}

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
function readProposalRisk(risk: string | undefined): ProposalRisk | null {
  if (risk === "DESTRUCTIVE" || risk === "BULK" || risk === "STANDARD") return risk;

  if (risk !== undefined) {
    console.warn(`Buddy sent an unknown proposal risk: ${risk}`);
  }

  return null;
}

/**
 * Confirms a *team-mode* proposal by id. The proposal is stored server-side, so the id is the
 * whole payload — nothing about the change is re-sent, because what the change is lives on the
 * backend, which the manager already saw described in the card's preview.
 *
 * A proposal that has already been confirmed or dismissed comes back `404` — the caller renders
 * that as the outcome line, not as an error.
 */
export async function confirmStoredProposal(proposalId: string): Promise<BuddyActionResult> {
  return await apiClient.fetch<BuddyActionResult>(
    `/api/v1/onboarding/me/buddy/proposals/${encodeURIComponent(proposalId)}/confirm`,
    { method: "POST" },
  );
}

/**
 * Dismisses a *team-mode* proposal by id. Nothing changes but the proposal — it can no longer be
 * confirmed. The same `404` rule as `confirmStoredProposal` applies.
 */
export async function dismissStoredProposal(proposalId: string): Promise<BuddyActionResult> {
  return await apiClient.fetch<BuddyActionResult>(
    `/api/v1/onboarding/me/buddy/proposals/${encodeURIComponent(proposalId)}/dismiss`,
    { method: "POST" },
  );
}

/**
 * How a buddy stream finished.
 *
 * Three outcomes, not two, and the difference decides whether the caller announces completion.
 * `terminated` means the server said `done` or `error` and has already been reported. `ended` means
 * the body ran out with no terminal event, so the caller still owes its own `onDone`. `aborted`
 * means the request never produced a stream at all — the caller must not announce completion
 * there, because nothing was answered.
 */
type BuddyStreamOutcome = "terminated" | "ended" | "aborted";

/**
 * Reads one of the buddy's Server-Sent Event endpoints, handing each parsed chunk to `onChunk`.
 *
 * Extracted once there were two callers — sending a message and opening a visit — rather than in
 * advance: token refresh, the HTTP check, the `data:` framing and the buffered line split are
 * identical for both, and only the handling of each chunk differs.
 *
 * `onChunk` returns `"stop"` to end the read, which is how a terminal `done` or `error` closes the
 * stream without every caller writing its own loop exit.
 */
async function readBuddyStream(
  path: string,
  body: unknown,
  onChunk: (chunk: BuddyStreamChunk) => "stop" | void,
  onError?: (message: string) => void,
  signal?: AbortSignal,
): Promise<BuddyStreamOutcome> {
  // Ensure the token is up to date (refresh if it expires in < 30s)
  try {
    if (keycloak.authenticated) {
      await keycloak.updateToken(30);
    }
  } catch (error) {
    console.error("Failed to refresh Keycloak token for buddy stream", error);
    void keycloak.login();
    return "aborted";
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keycloak.token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // An abort is the hire's Stop, not a failure: it is reported to nobody, and the caller
    // reads it from the signal it passed in. Everything else is reported rather than thrown,
    // so "we never reached the server" arrives at the caller's error surface as a sentence
    // instead of as a rejection it has to translate. The only thing the hire needs from this
    // is whether trying again is worth it.
    if (isAbortError(error)) return "aborted";
    onError?.("Could not reach the server.");
    return "aborted";
  }

  if (!res.ok) {
    onError?.(`HTTP error! status: ${res.status}`);
    return "aborted";
  }

  const reader = res.body?.getReader();

  if (!reader) {
    // Reported like every other failure here rather than thrown: a caller that wired up
    // `onError` should not also have to wrap the call.
    onError?.("No response stream.");
    return "aborted";
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        let event: BuddyStreamChunk;
        try {
          event = JSON.parse(line.replace("data:", "").trim()) as BuddyStreamChunk;
        } catch {
          // A malformed chunk is skipped, never fatal -- the same tolerance the backend applies,
          // and what `aiStreamService` already does with the identical framing. One unparseable
          // line (a keep-alive, a proxy's own text, a truncated tail) used to throw out of the
          // loop and take the rest of the reply with it.
          continue;
        }

        if (onChunk(event) === "stop") {
          // The caller is finished with this stream, so let go of the body rather than leaving
          // an open connection for the collector to notice eventually.
          void reader.cancel();
          return "terminated";
        }
      }
    }
  } catch (error) {
    // An abort mid-read is the hire's Stop — the same silent path as above.
    if (isAbortError(error)) return "aborted";
    // A connection dropped mid-stream. Without this it rejected out of the function, past every
    // `onError` the caller wired up, and whatever had streamed so far simply stopped.
    console.error("Buddy stream failed mid-response", error);
    onError?.("The connection to your buddy dropped.");
    return "aborted";
  }

  return "ended";
}

/**
 * A stop the hire asked for, told apart from a failure.
 *
 * Both `fetch` and the reader reject with this on abort — `name` rather than `instanceof`,
 * because a DOMException is not an `Error` subclass in every engine that runs this.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

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
    // Omitted, never null: a team target replaces the conversation, and carrying
    // `teamProjectId: null` would send a field the contract does not have.
    {
      content,
      ...(teamProjectId ? { teamProjectId } : { sessionId }),
      ...(currentPage ? { currentPage } : {}),
      ...(options?.capabilitiesEnabled === undefined
        ? {}
        : { capabilitiesEnabled: options.capabilitiesEnabled }),
      ...(options?.filters ? { filters: options.filters } : {}),
    },
    (event) => {
      switch (event.type) {
        case "tool_use":
          if (event.name) {
            handlers.onToolUse?.(event.name);
          }
          break;

        case "token":
          if (event.content !== undefined) {
            handlers.onToken(event.content);
          }
          break;

        case "reasoning":
          if (event.reasoning !== undefined) {
            handlers.onReasoning?.(event.reasoning);
          }
          break;

        case "reset":
          handlers.onReset?.();
          break;

        case "citation":
          if (event.artifact_id && event.filename) {
            handlers.onCitation({
              artifactId: event.artifact_id,
              filename: event.filename,
              sourceUrl: event.source_url,
              startLine: event.start_line,
              startPage: event.start_page,
            });
          }
          break;

        case "action_proposal":
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
            break;
          }

          if (event.action && event.label) {
            handlers.onActionProposal?.({
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
            });
          }
          break;

        case "done":
          handlers.onDone();
          return "stop";

        case "error":
          handlers.onError?.(event.message ?? "Unknown error");
          return "stop";
      }
    },
    handlers.onError,
    signal,
  );

  // Fallback: ensure onDone is called when the stream ends without a terminal event.
  if (outcome === "ended") handlers.onDone();
}

import type { Citation } from "../chatbot/types";

/**
 * An action the buddy has *proposed* — the hire must confirm it before anything changes. Carried on
 * the assistant message it was proposed in, so the confirm button renders inline in the thread.
 *
 * `status` tracks the one round-trip: `idle` (awaiting the hire) → `confirming` → `resolved` (the
 * backend ran it; `ok` says whether it changed anything, `outcome` is the line to show) or `error`
 * (the request itself failed, retryable). `dismissed` when the hire chose not to.
 */
export type ProposedActionStatus = "idle" | "confirming" | "resolved" | "error" | "dismissed";

/**
 * The backend's `open_orientation` action. Once confirmed, its payoff is not the outcome line
 * but the orientation packet itself, rendered in the thread (see `BuddyOrientationCard`) — the
 * conversation is the surface now, so confirming must not navigate anywhere.
 */
export const BUDDY_ACTION_OPEN_ORIENTATION = "open_orientation";

/**
 * The actions that change the hire's onboarding path.
 *
 * Listed once, here, because two surfaces need the same answer: confirming one of these has to tell
 * whatever is showing a path that it is now stale (see `announceBuddyPathChanged`). Answering a
 * question counts even when the answer was wrong — the attempt is recorded and the question's status
 * moves either way.
 */
export const BUDDY_PATH_ACTIONS: readonly string[] = [
  "complete_step",
  "complete_task",
  "answer_question",
  "add_path_step",
  "request_skip",
];

export type ProposedAction = {
  /** Local id for keying and targeting the confirm — the backend doesn't assign one. */
  id: string;
  /** The action's tool name, sent back verbatim to confirm it (e.g. "claim_goal"). */
  action: string;
  /** The button text ("Work toward this task"). */
  label: string;
  /** Carried through only for flag-to-PM: the question the buddy composed. */
  question?: string;
  /**
   * The goal-claim confirm payload (`claim_goal`), echoed back verbatim so the action runs
   * against the target the buddy proposed, never one the client picked.
   */
  taskId?: string;
  /**
   * The attestation confirm payload: what work, and which teammate is being asked to confirm it.
   *
   * Both must reach the stream and be echoed back on confirm. A `request_attestation` that
   * arrives without them has nothing to act on and comes back as a polite refusal, which reads
   * like a precondition rather than a broken wire.
   */
  title?: string;
  attesterId?: string;
  /**
   * The GitHub username `set_github_login` proposed, echoed back verbatim on confirm.
   *
   * Not merely the value the hire typed: the buddy is told a username in conversation, so what
   * is confirmed has to be what was *proposed* and shown on the button — never something the
   * client substituted afterwards. Same rule as `taskId`.
   */
  githubLogin?: string;
  /**
   * The `record_assessment` confirm payload: which competency, and where the conversation placed
   * the hire on it.
   *
   * Echoed back verbatim for the same reason as `githubLogin`, and one more: the level is a
   * judgement about the hire's own skill that they read on the button before agreeing to it. What
   * gets written has to be what they were shown, so the client never derives it.
   */
  competencyKey?: string;
  level?: string;
  /**
   * The path-action confirm payloads: which node of the hire's own onboarding path the action is
   * aimed at, the answer `answer_question` would send, and a new step's description.
   *
   * Echoed back verbatim for the same reason as `githubLogin`: the hire reads the step, or their own
   * answer, on the button before agreeing to it, so what gets written has to be what they were
   * shown — never something the client derived afterwards.
   */
  stepId?: string;
  questionId?: string;
  phaseId?: string;
  onboardingTaskId?: string;
  answer?: string;
  description?: string;
  /**
   * The reason `request_skip` sends to the PM. Shown in full under the button, because it goes out
   * in the hire's name and a label has no room for it.
   */
  reason?: string;
  /**
   * Where `add_path_step` puts the new step in its phase's graph — what it waits on, and what will
   * wait on it. Echoed back verbatim and re-checked against the hire's own path on confirm.
   */
  waitsOnIds?: string[];
  unlocksIds?: string[];
  status: ProposedActionStatus;
  /** Whether a resolved action actually changed something (false = a handled "couldn't"). */
  ok?: boolean;
  /** The outcome line to show once resolved. */
  outcome?: string;
};

/**
 * A single turn in the user's persistent buddy conversation, as returned by the backend.
 */
export type BuddyMessage = {
  role: "USER" | "ASSISTANT";

  /**
   * Text content of the message.
   */
  content: string;

  /**
   * When the message was sent.
   */
  createdAt: string;
};

/**
 * A buddy message as tracked in hook state: adds a locally-synthesized id (the backend
 * doesn't assign one) and in-memory citations for the current session's streamed replies.
 */
export type BuddyMessageView = BuddyMessage & {
  id: string;
  citations?: Citation[];
  /** Actions the buddy proposed in this turn, each awaiting the hire's confirmation. */
  actions?: ProposedAction[];
  /**
   * True for a greeting that opened a new visit *under* a conversation already on screen.
   *
   * Only ever set for a greeting this surface streamed itself, because that is the only one it
   * can know about: a greeting read back from the server arrives as an ordinary message at the
   * top of the window, where a "this is where the new one starts" rule would be pointing at
   * nothing. It drives the divider in `BuddyThread`.
   */
  startsVisit?: boolean;
  /**
   * Why this turn has no answer in it, when a stream failed rather than finished.
   *
   * The same shape the chat feature uses, and for the same reason: whatever streamed before the
   * failure stays on screen, with the reason beside it. Without one, a failed reply left the
   * hire's own question sitting under a turn that renders as nothing, which is indistinguishable
   * from the buddy having ignored them -- on the surface the whole feature is built around.
   */
  error?: string;
};

/**
 * The stream callbacks a buddy visit needs.
 *
 * Deliberately its own type rather than a widening of the chat's `StreamHandlers`: the buddy's
 * stream has no reasoning phase and proposes actions, which chat never does. Loosening the shared
 * type to fit both would make handlers optional for chat, where they are required.
 */
export type BuddyStreamHandlers = {
  onToken: (token: string) => void;
  onCitation: (citation: Citation) => void;
  onDone: () => void;
  /** Optional: a caller with no error surface of its own lets the failure pass silently. */
  onError?: (message: string) => void;
  /** Optional: only some turns run a tool, and the surface may not show which. */
  onToolUse?: (tool: string) => void;
  /**
   * The buddy has *proposed* an action the hire must confirm (e.g. "Work toward this task"). Nothing has
   * changed yet — the surface renders a confirm affordance and only mutates when the hire clicks.
   */
  onActionProposal?: (proposal: {
    action: string;
    label: string;
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
    description?: string;
    reason?: string;
    waitsOnIds?: string[];
    unlocksIds?: string[];
  }) => void;
};

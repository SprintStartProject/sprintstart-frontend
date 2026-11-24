/**
 * What the hire is told when a stream does not finish.
 *
 * Plain, and never the raw failure: a transport message or an HTTP status answers a question
 * nobody asked. What matters is whether trying again is worth it, so each line says so.
 */
export const REPLY_FAILED = "Your buddy could not finish that reply. Ask again in a moment.";
export const REPLY_TIMED_OUT = "Your buddy stopped responding for five minutes. Try again.";
export const GREETING_FAILED = "Your buddy could not be reached just now.";
export const HISTORY_FAILED = "Your conversation could not be loaded.";
export const CONVERSATION_FAILED =
  "Your buddy could not start a new conversation. Ask again in a moment.";
/** The bin landed, but the move off the binned conversation did not — the list must not claim a clean success. */
export const BIN_MOVE_FAILED =
  'Binned, but the next conversation couldn\'t open — use "Try again" to retry.';
/** The one sentence for a proposal this caller cannot find (HTTP 404). */
export const PROPOSAL_GONE = "This proposal is no longer available.";
/**
 * How long a turn may go without a single event before it is failed.
 *
 * The read has no timeout of its own — a stream that stops arriving leaves the request open
 * forever — so the turn is failed from here, the same inter-event watchdog the retired chat
 * ran: every event (a tool, a thought, a token, a citation) re-arms it, and five silent
 * minutes mean the stream is wedged. Measured between events, not from the start: a long
 * tool-heavy turn keeps talking, and each event is proof of life.
 */
export const STREAM_TIMEOUT_MS = 300_000;

export function isNotFound(e: unknown): boolean {
  return e instanceof Error && "status" in e && (e as { status: number }).status === 404;
}

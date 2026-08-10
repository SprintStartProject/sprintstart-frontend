/**
 * Closed set of "thinking" tool names the backend reports via the
 * `tool_use` SSE event. Drives the status label shown next to the
 * bouncing dots while the assistant is working.
 */
export type ThinkingState = "retrieve" | "synthesis" | "grep";

/**
 * Single source of truth for the status copy shown while the assistant is
 * thinking. Add a new entry here when the backend reports a new tool name.
 * Kept as a `Record<ThinkingState, string>` so the mapping is exhaustive —
 * adding a new {@link ThinkingState} value without a label is a type error.
 */
export const THINKING_LABELS: Record<ThinkingState, string> = {
  retrieve: "Searching knowledge base...",
  synthesis: "Synthesizing answer...",
  grep: "Scanning documents...",
};

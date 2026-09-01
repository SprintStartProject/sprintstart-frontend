// ============================================================
// components/common/assistantSurfaces.ts
// ============================================================
// The vocabulary of the two-halved assistant: which surfaces
// exist, what order they sit in, and where each one lives.
// ============================================================

/** The two places a question can be asked. */
export type AssistantSurface = "chat" | "buddy";

/**
 * Left to right, the order the switch renders them in — and therefore the direction a swipe
 * moves.
 *
 * Its own module rather than a second export beside the component, so `AssistantShell` can
 * read the order without importing a component, and so the switch's file stays a component
 * file (which is what keeps fast refresh working).
 */
export const ASSISTANT_SURFACES = ["chat", "buddy"] as const;

export const ASSISTANT_SURFACE_ROUTES: Record<AssistantSurface, string> = {
  chat: "/chat",
  buddy: "/buddy",
};

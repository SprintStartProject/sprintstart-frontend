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

/**
 * Which half of the assistant a URL is. `/chat/:id` is still the chat.
 *
 * A function rather than the expression written out where it is needed, because it is now asked
 * from two directions: the shell asks it to draw the switch and the subtitle, and each half asks
 * it whether it is the one on screen. **While the panel slides, both halves are mounted** —
 * `AnimatePresence` holds the outgoing one for the length of the animation — so anything a page
 * binds on `window` is live in both of them at once, and one `Alt + N` in that window would
 * start a new conversation in each. The location is what breaks the tie: it is the router's, not
 * the outlet's, so the half being left reads the URL of the half being arrived at.
 */
export function surfaceFromPathname(pathname: string): AssistantSurface {
  return pathname.startsWith(ASSISTANT_SURFACE_ROUTES.buddy) ? "buddy" : "chat";
}

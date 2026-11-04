import { useEffect, type ReactNode } from "react";
import { announceBuddyPageReady } from "../../features/buddy/aiBuddyBus";

type BuddyPageShellProps = {
  /** The standing column beside the conversation — see `ConversationRail`. */
  rail?: ReactNode;
  /** What brings it back when it is closed. Positioned by the rail's own control. */
  railToggle?: ReactNode;
  /**
   * "Start a new conversation", floating over the top of the transcript. Here rather than in
   * the page header: the header is shared with Chat, and only the buddy half has conversations
   * to start.
   */
  newConversationControl?: ReactNode;
  /** Whether that column is currently taking width, which decides this column's left gutter. */
  isRailOpen?: boolean;
  children: ReactNode;
};

/**
 * The page's shape: the conversation, with the rail and the floating controls around it.
 *
 * It fills the panel the page's frame gives it rather than claiming a height of its own — the
 * frame owns the viewport and the page header. It never grows past that panel: the composer has to
 * stay on screen, because a conversation whose input scrolls away is one you have to scroll back
 * to in order to answer.
 */
export function BuddyPageShell({
  rail,
  railToggle,
  newConversationControl,
  isRailOpen = false,
  children,
}: BuddyPageShellProps) {
  // Tells the dock's hand-off that the page is really on screen, so it can stop standing in for it.
  // No entrance animation of its own: arriving from the dock, the page is revealed by that window
  // fading away, and a second fade underneath would show the background through both.
  useEffect(() => {
    announceBuddyPageReady();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 bg-app-bg">
      {rail}

      {/* `app-rail-open` collapses this column's left gutter, so the rail opens *into* the empty
          gutter instead of shoving the conversation right. The separating space belongs before
          the `${'{'}` — prettier-plugin-tailwindcss trims class strings when it sorts them, and
          gluing two classes together here once turned a whole page into a flex row. */}
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${isRailOpen ? "app-rail-open" : ""}`}
      >
        {railToggle}
        {newConversationControl}

        {children}
      </div>
    </div>
  );
}

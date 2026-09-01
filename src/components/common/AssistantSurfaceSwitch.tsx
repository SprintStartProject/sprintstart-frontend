import { useNavigate } from "react-router-dom";
import { Bot, MessagesSquare } from "lucide-react";
import { SegmentedTabs, type SegmentedTabOption } from "../ui/SegmentedTabs";

/** The two places a question can be asked. */
export type AssistantSurface = "chat" | "buddy";

const SURFACE_ROUTES: Record<AssistantSurface, string> = {
  chat: "/chat",
  buddy: "/buddy",
};

// Module scope: the options never depend on anything, and a fresh array each render would
// re-key the sliding pill.
const OPTIONS: SegmentedTabOption<AssistantSurface>[] = [
  { value: "chat", label: "Chat", icon: <MessagesSquare className="h-4 w-4" aria-hidden="true" /> },
  { value: "buddy", label: "Buddy", icon: <Bot className="h-4 w-4" aria-hidden="true" /> },
];

/**
 * The switch between the two assistants: the project chat and the onboarding buddy.
 *
 * They are two conversations with two backends and two memories, and they will stay that way
 * — but they were also two pages that looked 99% alike with no visible relationship, so a
 * hire who had asked something could not tell which of them they had asked it in, and had to
 * search both. This is the answer to that: the same control, in the same place, on both
 * pages. Separate, and visibly beside each other.
 *
 * The app's one segmented control rather than a pair of links, for the same reason every
 * other tabbed page uses it: a slider that moves between two named halves says "these are the
 * two sides of one thing" in a way two links in a header never do.
 *
 * Deliberately not a merge. Making the buddy a chat in the chat list would mean one message
 * model, one streaming loop and one history store, and the buddy has none of those — its
 * transcript lives behind `/onboarding/me/buddy`, not behind `/chats`. Anything that looked
 * like one list would be lying about where the answers are.
 */
export function AssistantSurfaceSwitch({
  current,
  className = "",
}: {
  /** Which of the two pages is rendering this — the page knows, so it is not derived here. */
  current: AssistantSurface;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <SegmentedTabs
      value={current}
      options={OPTIONS}
      onChange={(next) => {
        if (next === current) return;
        void navigate(SURFACE_ROUTES[next]);
      }}
      layoutId="assistant-surface-pill"
      ariaLabel="Assistant"
      className={className}
    />
  );
}

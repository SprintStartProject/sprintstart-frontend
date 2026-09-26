import { MessageCircle } from "lucide-react";
import { openAiBuddy } from "../aiBuddyBus";

type AskTheBuddyProps = {
  /** The question to put in the composer — a first sentence, not a command. */
  question: string;
  /** What the control says. Defaults to a plain invitation. */
  label?: string;
};

/**
 * Taking what you are looking at into the conversation.
 *
 * One mechanism serves every surface that has one. A card can seed a question and the mentor
 * answers it with its own tools — which means a card never needs its own action machinery, and
 * anything that *would* change the hire's onboarding still arrives as a proposal the hire confirms.
 *
 * Grabbing a task is the one exception with its own button (`task-pool/GrabTaskButton`), because a
 * hire who already knows what they want should not need a conversation to say so. It keeps a
 * confirm step of its own, and this stays beside it for the hire who wants help choosing.
 *
 * The draft is pre-filled rather than sent, so the hire can change it before it goes — it is their
 * question, and a card that speaks for somebody is a card they stop trusting.
 *
 * Opens the always-on widget through the existing bus rather than navigating: keeping the page on
 * screen is the point, since what is on it is what the question is about.
 *
 * It lives with the buddy, not with the board, and belongs on the hire's own surfaces. The widget
 * it opens is mounted for every signed-in user — the same audience `/buddy` itself has — so this
 * would technically work on a PM surface such as `/starter-work`. It is kept off them because the
 * buddy is the hire's channel, not because the control would do nothing there.
 *
 * The one place `openAiBuddy` really is a no-op is `/buddy`, where the widget takes itself off the
 * page: nothing renders this there, and the page's own composer is the thing to use.
 */
export function AskTheBuddy({ question, label = "Ask your buddy about this" }: AskTheBuddyProps) {
  return (
    <button
      type="button"
      onClick={() => openAiBuddy({ draft: question })}
      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-app-brand-text transition hover:underline"
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

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
 * Claiming a suggested task is the case that proves it: "I want to work on X" makes the mentor
 * propose `claim_goal`, and the confirm button is still the thing that claims it. A claim button on
 * the card would have gone around that gate.
 *
 * The draft is pre-filled rather than sent, so the hire can change it before it goes — it is their
 * question, and a card that speaks for somebody is a card they stop trusting.
 *
 * Opens the always-on widget through the existing bus rather than navigating: keeping the page on
 * screen is the point, since what is on it is what the question is about.
 *
 * It lives with the buddy, not with the board, and only belongs on surfaces a hire can reach.
 * `openAiBuddy` is a no-op wherever the widget is not mounted, and the widget is mounted only for
 * `USER` profiles. Putting this on a PM surface such as `/starter-work` would be a control that
 * silently does nothing, which is why it is not on any of them.
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

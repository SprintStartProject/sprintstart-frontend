import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import { Button } from "../../../components/ui/Button";
import type { BuddyOpeningAction, BuddySuggestion } from "../../../services/buddyService";
import { BuddyMarkdown } from "./BuddyMarkdown";
import { BuddySuggestionChips } from "./BuddySuggestionChips";

type BuddyWelcomeProps = {
  /** The greeting so far — grows token by token, and is empty until the first one lands. */
  greeting: string;
  /** True while the visit is still opening and no word has arrived yet. */
  isOpening: boolean;
  /** The one next step the greeting invites, if it carried one. */
  openerAction: BuddyOpeningAction | null;
  /** Sends the opener's question outright — see below for why this one does not just fill the box. */
  onTakeOpener: (question: string) => void;
  suggestions: BuddySuggestion[];
  /** Fills the composer with a chip's question. Never sends it. */
  onPickSuggestion: (question: string) => void;
};

/**
 * The first thing a hire sees on `/buddy`, before they have said anything.
 *
 * The greeting used to arrive as a lone bubble in the top-left of an otherwise empty page,
 * with the chips and the opener stacked in strips *above* the transcript — four blocks
 * competing for the top of the screen, and the conversation squeezed under them. It is one
 * centred column now: the buddy, what it has to say, and the two ways to answer it.
 *
 * The greeting is prose here rather than a bubble on purpose. There is no conversation yet —
 * one bubble on its own is a transcript of nothing — and the moment the hire replies this
 * whole state gives way to the thread, where the greeting takes its place as the first turn.
 */
export function BuddyWelcome({
  greeting,
  isOpening,
  openerAction,
  onTakeOpener,
  suggestions,
  onPickSuggestion,
}: BuddyWelcomeProps) {
  const prefersReducedMotion = useReducedMotion();

  const rise = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10 text-center">
      {/* Held awake: this bot is the one thing on screen while the greeting is still being
                written, and a mascot that dozes off there reads as a page that has hung. */}
      <motion.div {...rise(0)} className="-mb-1">
        <SleepyBot size={76} canSleep={false} tracksPointer className="text-app-brand-text" />
      </motion.div>

      <motion.div {...rise(0.05)} className="mt-2 max-w-xl min-w-0">
        {greeting ? (
          <div className="text-base leading-relaxed text-app-text sm:text-lg [&_ol]:text-left [&_ul]:text-left">
            <BuddyMarkdown content={greeting} />
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 text-base text-app-text-muted">
            {isOpening ? "Catching up on where you left off" : "Ask me anything to get started"}
            {isOpening && (
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
              </span>
            )}
          </p>
        )}
      </motion.div>

      {/* This one sends on a single click, unlike the chips below it, and looks different
                because it is different: accepting something the mentor just offered is not
                composing a question of your own. */}
      {openerAction && (
        <motion.div {...rise(0.1)} className="mt-6">
          <Button
            variant="primary"
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            onClick={() => onTakeOpener(openerAction.question)}
          >
            {openerAction.label}
          </Button>
        </motion.div>
      )}

      {suggestions.length > 0 && (
        <motion.div {...rise(0.15)} className="mt-8 w-full max-w-2xl">
          <BuddySuggestionChips
            suggestions={suggestions}
            onPick={onPickSuggestion}
            heading={openerAction ? "Or ask about something else" : "Try asking"}
            align="center"
          />
        </motion.div>
      )}
    </div>
  );
}

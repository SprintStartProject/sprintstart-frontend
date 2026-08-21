import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import { ChatContext } from "../../../context/ChatContext";
import { centralSpringToken } from "../../../styles/tokens";
import type { DashboardWidgetSize } from "../layout/types";

const SUGGESTIONS = [
  "What should I work on next?",
  "How do I set up the project locally?",
  "Who owns this part of the codebase?",
  "Explain the onboarding flow",
];

/**
 * Lets the user start a question straight from the dashboard.
 *
 * The text is handed to the global chat context and the user is routed to
 * `/chat` with the composer prefilled but *not* submitted, so they can still
 * edit before sending — the same behaviour as the suggestion chips inside the
 * chat empty state.
 *
 * Reads {@link ChatContext} directly rather than via `useChat`: that hook is
 * bound to the chat route's `:id` param and would redirect away from the
 * dashboard to the most recent conversation.
 */
export function QuickChatWidget({ size }: { size: DashboardWidgetSize }) {
  // Only a whole row is wide enough to put the bot beside the composer. At half a row the
  // two would fight for it, so the card stacks and everything below the composer centres
  // under it — a left-aligned row of chips under a centred bot reads as a mistake.
  const isWide = size === "wide";

  // Two chips at half a row. The cell is a fixed height, and four of them wrap onto a second
  // line that the card has no room for — which is what was clipping them at the bottom edge.
  const suggestions = isWide ? SUGGESTIONS : SUGGESTIONS.slice(0, 2);
  const navigate = useNavigate();
  const chat = useContext(ChatContext);
  const [question, setQuestion] = useState("");
  const [focused, setFocused] = useState(false);

  function openInChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // A non-empty draft also suppresses the chat page's "jump to most
    // recent conversation" redirect, so the user lands on a fresh chat.
    chat?.setNewRequest(trimmed);
    void navigate("/chat", { state: { newChat: true } });
  }

  return (
    <div
      className={`relative flex h-full flex-col justify-center rounded-2xl ${isWide ? "px-6 py-4" : "p-6"}`}
    >
      {/* The clip lives on this layer rather than on the card itself, so
          the glow blobs stay inside the rounded edge while the content
          above is free to leave it — which is how the bot's Z's get to
          drift off the widget. Radius tracks the card's. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <div
          className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-15 blur-3xl"
          style={{ background: "var(--progress-fill-end)" }}
        />
        <div className="absolute -top-20 -right-16 h-48 w-48 rounded-full bg-app-brand/12 blur-3xl" />
      </div>

      <div
        className={`relative flex flex-col gap-5 ${isWide ? "lg:flex-row lg:items-center" : ""}`}
      >
        {/* Stacked and centred rather than a row: at this size the bot
            is the subject of the widget, not a bullet point in front of
            a label, and a 76px character with text beside it drags the
            baseline off-centre. */}
        <div
          className={`flex flex-col items-center text-center ${
            isWide ? "lg:w-56 lg:shrink-0" : ""
          }`}
        >
          {/* The same assistant as in the chat, idle timer and all —
              so the character is one creature that follows you around
              rather than a different mascot per screen.
              Negative margin rather than the parent's `gap`, which
              cannot go below zero: the SVG's own viewBox leaves
              empty space below the drawn glyph, plus a little more
              from the inline element's own baseline slack, and only
              pulling the label up into that dead space actually
              closes the gap — a small positive one just stacks on
              top of it. Matches the same pull used in the chat empty
              state's bot, so the character sits the same distance
              from whatever it introduces everywhere it appears. */}
          <span className="-mb-2 text-app-brand-text">
            <SleepyBot size={isWide ? 56 : 76} tracksPointer />
          </span>

          <div className="min-w-0">
            <p className="font-semibold text-app-text">Ask the AI assistant</p>
            {/* A single grid row has no line to spare for a subtitle the arrow already implies. */}
            {!isWide && <p className="text-xs text-app-text-muted">Continue in chat</p>}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Gradient hairline that lights up on focus: a 1px gradient
                        backdrop with the real input inset on top of it. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              openInChat(question);
            }}
            className={`rounded-2xl bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end p-px transition-opacity ${
              focused ? "opacity-100" : "opacity-40"
            }`}
          >
            <div className="flex items-center gap-2 rounded-[15px] bg-app-surface px-3.5 py-2.5">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-label="Ask the AI assistant a question"
                placeholder="Ask anything about your project…"
                className="min-w-0 flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-app-text-muted"
              />

              <button
                type="submit"
                disabled={!question.trim()}
                aria-label="Continue in chat"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className={`mt-3 flex flex-wrap gap-2 ${isWide ? "" : "justify-center"}`}>
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...centralSpringToken,
                  delay: 0.05 * index,
                }}
                whileHover={{ y: -2 }}
                onClick={() => openInChat(suggestion)}
                className="rounded-full border border-app-border-muted bg-app-surface-muted px-3 py-1.5 text-xs text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-brand-text"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

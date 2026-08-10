import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { ChatContext } from "../../../context/ChatContext";
import { centralSpringToken } from "../../../styles/tokens";

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
export function QuickChatWidget() {
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
    <div className="relative overflow-hidden rounded-2xl border border-app-border bg-app-surface p-6 transition-colors hover:border-app-brand-border-strong">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--progress-fill-end)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-app-brand/12 blur-3xl"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:w-56 lg:shrink-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <p className="font-semibold text-app-text">Ask the AI assistant</p>
            <p className="truncate text-xs text-app-text-muted">Continue in chat</p>
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

          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion, index) => (
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

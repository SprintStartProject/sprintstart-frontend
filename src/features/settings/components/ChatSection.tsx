import { Brain } from "lucide-react";
import { useChatPreferences } from "../../../context/useChatPreferences";

/**
 * Chat section of the settings page. Hosts user-facing chat display
 * preferences. The streaming indicator and Stop button themselves live in
 * the chat view; this section only toggles what gets rendered.
 *
 * Show Thought Process — on by default (matches the pre-existing behaviour).
 * When turned off the "Thought Process" reasoning block above each assistant
 * message is hidden; the reasoning data is still collected on the message,
 * only the UI is suppressed.
 */
export function ChatSection() {
  const { showThoughtProcess, setShowThoughtProcess } = useChatPreferences();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Brain className="mt-0.5 h-5 w-5 shrink-0 text-app-brand-text" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-text">Show Thought Process</p>
          <p className="mt-1 text-sm text-app-text-subtle">
            Display the reasoning block above each assistant answer. Turning this off hides it — the
            reasoning is still generated, just not shown.
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={showThoughtProcess}
        data-testid="chat-thought-process-toggle"
        onClick={() => setShowThoughtProcess(!showThoughtProcess)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
          showThoughtProcess ? "bg-app-brand" : "bg-app-border-strong",
        ].join(" ")}
        aria-label="Toggle Thought Process visibility"
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            showThoughtProcess ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

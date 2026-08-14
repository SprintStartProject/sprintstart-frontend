import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, X } from "lucide-react";
import { useBuddy } from "../hooks/useBuddy";
import { BuddyPanel } from "./BuddyPanel";

/** Where the full conversation lives. The panel hands off to it rather than growing. */
const BUDDY_PAGE = "/buddy";

/**
 * The always-on, repo-grounded onboarding companion. Mounted once at the app
 * root (see App.tsx) so it survives page navigation and keeps its open/closed
 * state for the lifetime of the session.
 *
 * The widget owns the hand-off because it owns the navigation: the panel stays a presentational
 * component that is handed a callback, which is also what keeps it testable without a router.
 */
export function BuddyWidget() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    messages,
    isThinking,
    isOpen,
    toggleOpen,
    draft,
    setDraft,
    handleSubmit,
    confirmAction,
    dismissAction,
    bottomRef,
    suggestions,
  } = useBuddy();

  // Nothing to hand off to when the page is already on screen -- the control would offer what
  // the hire is looking at. The panel drops it entirely rather than disabling it.
  const openFull =
    pathname === BUDDY_PAGE
      ? undefined
      : () => {
          void navigate(BUDDY_PAGE, { state: { draft } });
          // Closed on the way out: leaving a floating copy of the conversation over the
          // full-page one is two composers for the same thread.
          toggleOpen();
        };

  return (
    <>
      {isOpen && (
        <BuddyPanel
          messages={messages}
          isThinking={isThinking}
          draft={draft}
          setDraft={setDraft}
          handleSubmit={handleSubmit}
          confirmAction={confirmAction}
          dismissAction={dismissAction}
          bottomRef={bottomRef}
          suggestions={suggestions}
          onClose={toggleOpen}
          onOpenFull={openFull}
        />
      )}

      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleOpen}
        className="fixed right-8 bottom-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-app-brand text-white shadow-lg shadow-app-brand/25 transition-colors hover:bg-app-brand-hover focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg focus:outline-none"
        aria-label={isOpen ? "Close buddy chat" : "Open buddy chat"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>
    </>
  );
}

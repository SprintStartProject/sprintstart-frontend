import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMessages,
  streamOpenBuddy,
  performAction,
  streamMessage,
  type BuddyOpeningAction,
} from "../../../services/buddyService";
import type { BuddyMessageView, ProposedAction } from "../types";

/**
 * The conversation core behind every buddy surface: the message list, the optimistic
 * send-and-stream loop, and the "which tool is it running" signal. Deliberately knows
 * nothing about *where* it is shown -- the floating widget ([useBuddy]) and the
 * full-page `/buddy` home both build on it, so a hire's one buddy session behaves the
 * same in either place.
 *
 * @param autoLoad When true, loads the current visit's messages on mount (the widget).
 *   Leave it false and call [loadHistory] on first open so an unopened surface makes no
 *   request.
 * @param open When true, *opens a visit* on mount instead: the buddy folds the previous
 *   visit into its memory and greets proactively (the `/buddy` home). No transcript is
 *   replayed — the greeting is the first message and continuity lives in the memory.
 */
export function useBuddyConversation({
  autoLoad = false,
  open = false,
}: { autoLoad?: boolean; open?: boolean } = {}) {
  const [messages, setMessages] = useState<BuddyMessageView[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // The tool the buddy is running right now, if any -- drives "Checking your progress…"
  // in place of a generic spinner. Cleared as soon as the answer starts streaming.
  const [activeTool, setActiveTool] = useState<string | null>(null);
  // The one suggested next step the opening greeting invites, until the hire acts or asks.
  const [openerAction, setOpenerAction] = useState<BuddyOpeningAction | null>(null);
  // True while the visit is being opened, so the page can show a greeting-loading state.
  const [isOpening, setIsOpening] = useState(open);
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  /**
   * Loads the conversation so far, at most once. Idempotent so both the widget's
   * open handler and the page's mount effect can call it without double-fetching.
   */
  const loadHistory = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const history = await getMessages();
    setMessages(history.map((message) => ({ ...message, id: crypto.randomUUID() })));
  }, []);

  /**
   * Opens a visit: the buddy greets proactively, at most once. The greeting becomes the
   * first (and only) message shown; the past transcript is deliberately not replayed.
   */
  const openVisit = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const id = crypto.randomUUID();
    try {
      await streamOpenBuddy({
        onToken: (token) => {
          // The greeting is a single growing message rather than one per token, so the
          // hire watches it being written instead of watching messages pile up.
          setMessages((prev) => {
            const existing = prev.find((message) => message.id === id);
            if (!existing) {
              return [
                {
                  id,
                  role: "ASSISTANT",
                  content: token,
                  createdAt: new Date().toISOString(),
                  citations: [],
                },
              ];
            }
            return prev.map((message) =>
              message.id === id ? { ...message, content: message.content + token } : message,
            );
          });
          // The page stops waiting at the first word, not the last: everything after this
          // is the hire reading along, and the composer is theirs from here.
          setIsOpening(false);
        },
        onAction: setOpenerAction,
        onDone: () => setIsOpening(false),
        onError: (message) => console.error(message),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsOpening(false);
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask (the repo's React-19 pattern) so the first setState never runs
    // synchronously in the effect body.
    void (async () => {
      if (open) await openVisit();
      else if (autoLoad) await loadHistory();
    })();
  }, [open, autoLoad, openVisit, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Sends a new message and streams the buddy's reply into the conversation.
   */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: BuddyMessageView = {
      id: crypto.randomUUID(),
      role: "USER",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: BuddyMessageView = {
      id: assistantId,
      role: "ASSISTANT",
      content: "",
      createdAt: new Date().toISOString(),
      citations: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsThinking(true);
    setActiveTool(null);
    // Once the hire says anything, the opener's one-click suggestion has served its purpose.
    setOpenerAction(null);

    try {
      await streamMessage(text, {
        onToolUse: (name) => {
          setActiveTool(name);
        },

        onToken: (token) => {
          setIsStreaming(true);
          setIsThinking(false);
          setActiveTool(null);

          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
          );
        },

        onCitation: (citation) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, citations: [...(m.citations ?? []), citation] } : m,
            ),
          );
        },

        onActionProposal: (proposal) => {
          // The buddy is offering to do something — attach it to this reply as a pending
          // action. Nothing has changed yet; the hire confirms it below. The confirm
          // payloads ride along so the action runs against what the buddy proposed.
          setIsThinking(false);
          setActiveTool(null);
          const action: ProposedAction = {
            id: crypto.randomUUID(),
            action: proposal.action,
            label: proposal.label,
            question: proposal.question,
            taskId: proposal.taskId,
            title: proposal.title,
            attesterId: proposal.attesterId,
            githubLogin: proposal.githubLogin,
            competencyKey: proposal.competencyKey,
            level: proposal.level,
            status: "idle",
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, actions: [...(m.actions ?? []), action] } : m,
            ),
          );
        },

        onDone: () => {
          setIsStreaming(false);
          setActiveTool(null);
        },

        onError: (err) => {
          console.error(err);
          setIsStreaming(false);
          setIsThinking(false);
          setActiveTool(null);
        },
      });
    } catch (e) {
      console.error(e);
      setIsStreaming(false);
      setIsThinking(false);
      setActiveTool(null);
    }
  }, []);

  /** Patches one proposed action in place, keyed by its message and action id. */
  const patchAction = useCallback(
    (messageId: string, actionId: string, patch: Partial<ProposedAction>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, actions: m.actions?.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) }
            : m,
        ),
      );
    },
    [],
  );

  /**
   * Confirms a proposed action: the one call that mutates. Reflects the outcome inline — a
   * legible line whether it changed something (`ok`) or legibly couldn't, or a retryable error
   * if the request itself failed.
   */
  const confirmAction = useCallback(
    (messageId: string, action: ProposedAction) => {
      patchAction(messageId, action.id, { status: "confirming" });
      // Fire-and-forget: the outcome lands back in message state, so the handler stays a plain
      // void callback (no Promise handed to a JSX prop).
      void (async () => {
        try {
          const result = await performAction(action.action, {
            question: action.question,
            taskId: action.taskId,
            title: action.title,
            attesterId: action.attesterId,
            githubLogin: action.githubLogin,
            competencyKey: action.competencyKey,
            level: action.level,
          });
          patchAction(messageId, action.id, {
            status: "resolved",
            ok: result.ok,
            outcome: result.message,
          });
        } catch (e) {
          console.error(e);
          patchAction(messageId, action.id, { status: "error" });
        }
      })();
    },
    [patchAction],
  );

  /** Declines a proposed action — nothing changes; the conversation simply continues. */
  const dismissAction = useCallback(
    (messageId: string, actionId: string) => {
      patchAction(messageId, actionId, { status: "dismissed" });
    },
    [patchAction],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      const text = draft;
      if (!text.trim()) return;

      setDraft("");
      void sendMessage(text);
    },
    [draft, sendMessage],
  );

  return {
    messages,
    isThinking,
    isStreaming,
    activeTool,
    openerAction,
    isOpening,

    draft,
    setDraft,
    sendMessage,
    handleSubmit,
    confirmAction,
    dismissAction,

    loadHistory,
    bottomRef,
  };
}

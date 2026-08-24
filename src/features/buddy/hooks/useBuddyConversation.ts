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
 * send-and-stream loop, and the "which tool is it running" signal.
 *
 * Deliberately knows nothing about *where* it is shown. It is instantiated exactly once, by
 * [BuddyProvider], and both surfaces read that one instance through `useBuddySession` — so a
 * hire's one buddy session really is one, rather than two lists that happen to share a name.
 *
 * Nothing is requested until a surface calls [ensureOpened].
 */
export function useBuddyConversation() {
  const [messages, setMessages] = useState<BuddyMessageView[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // The tool the buddy is running right now, if any -- drives "Checking your progress…"
  // in place of a generic spinner. Cleared as soon as the answer starts streaming.
  const [activeTool, setActiveTool] = useState<string | null>(null);
  // The one suggested next step the opening greeting invites, until the hire acts or asks.
  const [openerAction, setOpenerAction] = useState<BuddyOpeningAction | null>(null);
  // True while a surface is opening the conversation, so it can show a loading state rather
  // than an empty thread. Starts false: nothing is opening until somebody asks.
  const [isOpening, setIsOpening] = useState(false);
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  /**
   * Streams the buddy's opening greeting into the thread.
   *
   * Only reached for a visit with nothing in it — see [ensureOpened]. The greeting is a single
   * growing message rather than one per token, so the hire watches it being written instead of
   * watching messages pile up.
   */
  const greet = useCallback(async () => {
    const id = crypto.randomUUID();
    await streamOpenBuddy({
      onToken: (token) => {
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
        // The surface stops waiting at the first word, not the last: everything after this is
        // the hire reading along, and the composer is theirs from here.
        setIsOpening(false);
      },
      onAction: setOpenerAction,
      onDone: () => setIsOpening(false),
      onError: (message) => console.error(message),
    });
  }, []);

  /**
   * Brings the conversation on screen, once per session.
   *
   * **Reading comes before greeting, and that ordering is the whole fix.** The page used to
   * call the open endpoint unconditionally. Opening is idempotent only while the hire has said
   * nothing; once they have, a second open *rotates the visit* — the backend folds what was
   * said into the buddy's memory and starts a new window. So a hire who asked something in the
   * dock and then opened the full page destroyed their own context and was shown a greeting
   * instead of their conversation. It was not a rendering problem; the messages were really
   * gone.
   *
   * Now: fetch what the visit already holds. If there is anything there, that *is* the
   * conversation — show it, and call no model at all. Only a genuinely empty visit gets a
   * greeting, which is the case the greeting was written for.
   *
   * Idempotent by ref rather than by state, so the dock's open handler and the page's mount
   * effect can both call it without either double-fetching or racing.
   *
   * What this cannot do is reach back past the current visit: `getMessages` returns the window
   * since the buddy last updated its memory, and no hire-facing endpoint exposes anything
   * older. Showing a hire every question they have ever asked needs a backend change, not a
   * frontend one.
   */
  const ensureOpened = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setIsOpening(true);

    try {
      const history = await getMessages();

      if (history.length > 0) {
        setMessages(history.map((message) => ({ ...message, id: crypto.randomUUID() })));
        return;
      }

      await greet();
    } catch (e) {
      console.error(e);
    } finally {
      setIsOpening(false);
    }
  }, [greet]);

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

    /**
     * Proposals held back until the reply is finished.
     *
     * The backend can emit `action_proposal` before it has written a word, which put an
     * "Accept this task" button on screen above an empty bubble — the hire was asked to agree
     * to something the buddy had not said yet. Buffering them costs nothing (a proposal is
     * inert until confirmed) and guarantees the only sane order: what it wants to do, then the
     * button that does it.
     */
    const proposed: ProposedAction[] = [];
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
          // The buddy is offering to do something. Nothing has changed yet and nothing will
          // until the hire confirms — so this is only recorded here, and attached to the reply
          // once the reply exists. The confirm payloads ride along so the action runs against
          // what the buddy actually proposed.
          setActiveTool(null);
          proposed.push({
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
          });
        },

        onDone: () => {
          setIsStreaming(false);
          // Also here, not only in `onToken`: a turn whose whole answer is a proposal never
          // emits a token, and the typing dots would sit under it forever.
          setIsThinking(false);
          setActiveTool(null);

          if (proposed.length > 0) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, actions: [...(m.actions ?? []), ...proposed] } : m,
              ),
            );
          }
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

    ensureOpened,
    bottomRef,
  };
}

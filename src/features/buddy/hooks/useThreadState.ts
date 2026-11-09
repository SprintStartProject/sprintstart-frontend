import { useCallback, useEffect, useRef, useState } from "react";
import type { BuddyOpeningAction } from "../../../services/buddyService";
import type { BuddyMessageView } from "../types";

/**
 * What is on screen in the conversation, as state: the thread, the busy flags and the banner.
 *
 * Only holds and exposes; every rule about when these change lives with the code that changes them.
 */
export function useThreadState() {
  const [messages, setMessages] = useState<BuddyMessageView[]>([]);
  /**
   * The thread as of the last render, readable from the opening callbacks without making them
   * depend on it. The composer is live before the opening read settles, so a hire can speak while
   * `openSession` is still awaiting `getMessages`; the greeting guard asks this whether anyone has
   * spoken, because a callback's closed-over state is a render behind.
   */
  const messagesRef = useRef<BuddyMessageView[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const messagesNow = useCallback(() => messagesRef.current, []);

  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // The tool the buddy is running right now, if any -- drives "Checking your progress…" in place of
  // a generic spinner. Cleared as soon as the answer starts streaming.
  const [activeTool, setActiveTool] = useState<string | null>(null);
  // The one suggested next step the opening greeting invites, until the hire acts or asks.
  const [openerAction, setOpenerAction] = useState<BuddyOpeningAction | null>(null);
  // True while a surface is opening the conversation, so it can show a loading state rather than
  // an empty thread. Starts false: nothing is opening until somebody asks.
  const [isOpening, setIsOpening] = useState(false);
  /**
   * True for as long as a greeting is actually streaming — longer than `isOpening`, which the first
   * token deliberately releases so the composer unlocks while the words are still arriving. The
   * switcher reads this one: a switch mid-greeting would clear the thread under a live stream.
   */
  const [isGreeting, setIsGreeting] = useState(false);
  // Set when the conversation could not be brought on screen at all -- distinct from a turn that
  // failed, which carries its own reason. Nothing is on screen to hang that on, so it is state.
  const [openError, setOpenError] = useState<string | null>(null);
  /**
   * The last greeting a surface has actually put in front of the hire — either watched while it
   * streamed, or revealed by `useGreetingReveal`. Held here, not per surface, so a greeting the dock
   * already played is not played again on `/buddy`, and the other way round.
   */
  const [presentedGreetingId, setPresentedGreetingId] = useState<string | null>(null);

  return {
    messages,
    setMessages,
    messagesNow,
    isThinking,
    setIsThinking,
    isStreaming,
    setIsStreaming,
    activeTool,
    setActiveTool,
    openerAction,
    setOpenerAction,
    isOpening,
    setIsOpening,
    isGreeting,
    setIsGreeting,
    openError,
    setOpenError,
    presentedGreetingId,
    setPresentedGreetingId,
  };
}

export type ThreadState = ReturnType<typeof useThreadState>;

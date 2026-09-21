import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { BuddyMessageView } from "../types";

/** How long the buddy "thinks" before a greeting it had already written starts to appear, in ms. */
const THINK_MS = 900;

/** How long the typing-in of an already-written greeting takes at most, in ms. */
const TYPE_MAX_MS = 1400;

/** One step of the typing-in. Roughly a frame and a half — smooth without a render per frame. */
const TICK_MS = 24;

type Reveal = {
  id: string;
  /** How much of the greeting is on screen; `null` while the buddy is still "thinking". */
  chars: number | null;
};

type UseGreetingRevealArgs = {
  messages: BuddyMessageView[];
  /** Whether the surface is actually on screen — the dock while it is open, the page always. */
  active: boolean;
  presentedGreetingId: string | null;
  markGreetingPresented: (id: string) => void;
};

/**
 * Plays a greeting that was written before anybody was looking as if it were being written now.
 *
 * `useBuddy` warms the visit when the app mounts, so the greeting is usually finished long before
 * the hire clicks the buddy — and a window that opens with the whole message already sitting in it
 * reads as a page that loaded, not as somebody writing to you. The greeting then competes with the
 * window's own entrance instead of arriving after it.
 *
 * So the first time a surface shows a greeting nobody has seen yet, it holds it back: the typing
 * bubble for {@link THINK_MS}, then the text typed in word by word over at most
 * {@link TYPE_MAX_MS}. A greeting the hire watched streaming live already had all of that and is
 * left alone, and one that has been presented once — in the dock or on `/buddy` — is never played
 * again. Reduced motion skips the whole thing.
 *
 * Only the *last* message qualifies. Once the hire has said something the greeting is history, and
 * holding it back would hide what they are replying to.
 */
export function useGreetingReveal({
  messages,
  active,
  presentedGreetingId,
  markGreetingPresented,
}: UseGreetingRevealArgs) {
  const prefersReducedMotion = useReducedMotion();
  const [reveal, setReveal] = useState<Reveal | null>(null);

  const last = messages[messages.length - 1];
  const greeting = last?.role === "ASSISTANT" && last.isGreeting && !last.error ? last : undefined;
  const greetingId = greeting?.id;
  const greetingLength = greeting?.content.length ?? 0;

  // Read by the ticking timer, which outlives the render that started it and must type towards
  // the greeting as it is *now* — it may still be streaming if the window opened mid-sentence.
  const lengthRef = useRef(greetingLength);
  useEffect(() => {
    lengthRef.current = greetingLength;
  }, [greetingLength]);

  // Watched while it was still empty: the typing bubble and the stream are the real thing, so there
  // is nothing to replay later.
  useEffect(() => {
    if (!active || !greetingId || greetingLength > 0) return;
    if (greetingId !== presentedGreetingId) markGreetingPresented(greetingId);
  }, [active, greetingId, greetingLength, presentedGreetingId, markGreetingPresented]);

  const shouldReveal =
    active &&
    !prefersReducedMotion &&
    greetingId !== undefined &&
    greetingLength > 0 &&
    greetingId !== presentedGreetingId;

  // Adjusted during render rather than in an effect, so the first frame of an opening window
  // already has the greeting held back — an effect would paint it whole for one frame first.
  if (shouldReveal && reveal?.id !== greetingId) {
    setReveal({ id: greetingId, chars: null });
  } else if (!shouldReveal && reveal !== null) {
    setReveal(null);
  }

  const revealId = reveal?.id;

  useEffect(() => {
    if (!revealId) return;

    let interval: number | undefined;
    let chars = 0;

    const think = window.setTimeout(() => {
      setReveal({ id: revealId, chars: 0 });
      const step = Math.max(2, Math.ceil(lengthRef.current / (TYPE_MAX_MS / TICK_MS)));

      interval = window.setInterval(() => {
        chars += step;
        if (chars >= lengthRef.current) {
          window.clearInterval(interval);
          markGreetingPresented(revealId);
          setReveal(null);
          return;
        }
        setReveal({ id: revealId, chars });
      }, TICK_MS);
    }, THINK_MS);

    return () => {
      window.clearTimeout(think);
      window.clearInterval(interval);
    };
  }, [revealId, markGreetingPresented]);

  const visibleMessages = useMemo(() => {
    if (!reveal) return messages;

    return messages.map((message) => {
      if (message.id !== reveal.id) return message;
      if (reveal.chars === null) return { ...message, content: "" };
      // Cut at the end of a word, so it grows word by word the way a stream does.
      const cut = message.content.indexOf(" ", reveal.chars);
      return { ...message, content: cut === -1 ? message.content : message.content.slice(0, cut) };
    });
  }, [messages, reveal]);

  return {
    messages: visibleMessages,
    /** True while the greeting is held back behind the typing bubble. */
    isThinking: reveal !== null && reveal.chars === null,
    /** True for the whole reveal, thinking and typing. */
    isRevealing: reveal !== null,
  };
}

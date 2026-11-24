import type { Dispatch, SetStateAction } from "react";
import { streamOpenBuddy, type BuddyOpeningAction } from "../../../services/buddyService";
import type { BuddyMessageView } from "../types";
import { GREETING_FAILED } from "./replyMessages";
import { appendToken, greetingPlaceholder, settleGreeting } from "./messageReducers";

/** Which conversation a greeting is for: the hire's own, or a team project's. */
export type GreetTarget = { sessionId?: string; teamProjectId?: string };

export type GreetView = {
  setMessages: Dispatch<SetStateAction<BuddyMessageView[]>>;
  setOpenerAction: Dispatch<SetStateAction<BuddyOpeningAction | null>>;
  setIsOpening: Dispatch<SetStateAction<boolean>>;
  setIsGreeting: Dispatch<SetStateAction<boolean>>;
};

/**
 * Streams the buddy's opening greeting into the thread.
 *
 * The greeting is a single growing message rather than one per token, so the hire watches it
 * being written instead of watching messages pile up. It claims its place in the thread before the
 * stream is awaited: the composer is live while it is written, and a question typed straight away
 * must not land above it. The switch gate holds for the whole greeting, not just the empty-screen
 * part — see `isGreeting`.
 */
export async function streamGreeting(view: GreetView, target: GreetTarget): Promise<void> {
  const id = crypto.randomUUID();
  view.setMessages((prev) => [...prev, greetingPlaceholder(id, new Date().toISOString())]);

  // A bag rather than two `let`s: a local written only inside callbacks narrows to its initial
  // value at the read below, a property does not.
  const stream = { wroteSomething: false, failure: null as string | null };

  view.setIsGreeting(true);
  try {
    await streamOpenBuddy(
      {
        onToken: (token) => {
          stream.wroteSomething = true;
          view.setMessages((prev) => appendToken(prev, id, token));
          // The surface stops waiting at the first word, not the last: everything after this is
          // the hire reading along, and the composer is theirs from here.
          view.setIsOpening(false);
        },
        onAction: view.setOpenerAction,
        onDone: () => view.setIsOpening(false),
        onError: (message) => {
          console.error(message);
          stream.failure = GREETING_FAILED;
        },
      },
      target.sessionId,
      target.teamProjectId,
    );
  } catch (e) {
    console.error(e);
    stream.failure = GREETING_FAILED;
  } finally {
    view.setMessages((prev) => settleGreeting(prev, id, stream));
    view.setIsOpening(false);
    view.setIsGreeting(false);
  }
}

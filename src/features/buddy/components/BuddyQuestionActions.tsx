import { FlagToPmButton } from "../../knowledge-request/components/FlagToPmButton";

/**
 * What a hire can do with a question they have already asked.
 *
 * Right now that is one thing — send it to a person — but it lives in its own component
 * because both surfaces render it and the wording has to match. The dock could not escalate at
 * all before this; the offer existed only on the page, and only under the buddy's answer.
 *
 * Under the question rather than under the reply, which is the point: a hire does not flag an
 * answer, they flag the thing they still need answered. That also makes an older question
 * escalatable — scroll back, find the one that never got resolved, send that.
 */
export function BuddyQuestionActions({ question }: { question: string }) {
  return (
    <FlagToPmButton
      defaultQuestion={question}
      // Short, because it repeats under every question. The default phrasing ("Buddy can't
      // help?") is a reaction to an answer, which is not what this is attached to any more.
      triggerLabel="Send this to your PM"
    />
  );
}

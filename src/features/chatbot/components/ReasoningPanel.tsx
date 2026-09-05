import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Options as ReactMarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChevronRight } from "lucide-react";
import { BotGlyph } from "./BotGlyph";

// Hoisted to module scope — ReactMarkdown re-walks the AST whenever the plugin
// arrays change identity, and this one re-renders on every reasoning token.
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [[rehypeKatex, { strict: "ignore" }]];

type ReasoningPanelProps = {
  /** The reasoning text so far. Grows token by token while the model is thinking. */
  reasoning: string;
  /** True while this message is the one receiving tokens. */
  isStreaming: boolean;
  /**
   * How much answer text has arrived, in characters.
   *
   * A length rather than a "there is one" flag: a turn that calls a tool answers in more than
   * one round, and it is each *step* that means something here, not the fact that some text
   * exists. See the fold rules below.
   */
  answerLength: number;
};

/**
 * The model's visible thought process, in a box that cannot take over the chat.
 *
 * Three rules, and each is a thing the plain `<details>` this replaces got wrong once the
 * reasoning ran long (reported by the customer, who watched one answer become a screenful of
 * thinking):
 *
 * 1. **It is capped.** The body scrolls inside its own `max-h-56` instead of growing without limit, so
 *    a long chain of thought never pushes the answer it belongs to off the screen.
 * 2. **It follows itself while it is being written**, but only while the reader has not
 *    scrolled up inside it — the same "stick to the bottom unless you left the bottom" rule
 *    the transcript itself uses, applied to the box.
 * 3. **It gets out of the way when the answer starts, and comes back when the thinking does.**
 *    Reasoning is interesting while it is the only thing happening and noise once there is a
 *    reply to read, so the panel collapses itself the moment an answer token lands. It stays
 *    collapsed, one click from being reopened, and the summary keeps saying it is there.
 *
 *    But "an answer token landed" stopped meaning "the thinking is over" once the model began
 *    streaming its tool-decision turn: a turn that searches writes a short preamble ("Let me
 *    check the retro…"), *then* calls the tool, *then* thinks again about what came back. A
 *    fold that only ever happened once left the synthesis — the half worth reading — arriving
 *    into a box that had already shut itself. So the rule runs per round: fresh reasoning
 *    re-opens the panel, and the next answer token folds it again.
 *
 * Rules 1 and 3 are both off the moment the reader touches the toggle. Somebody who opened
 * this deliberately wants to read it, and a panel that closed itself under them would be the
 * same complaint from the other direction.
 *
 * Deliberately a button and a region rather than `<details>`/`<summary>`: `onToggle` fires for
 * a programmatic `open` too, so the element cannot tell "the reader collapsed this" from "the
 * answer arrived and we collapsed it" — which is exactly the distinction the rules above turn on.
 */
export function ReasoningPanel({ reasoning, isStreaming, answerLength }: ReasoningPanelProps) {
  // Open on arrival, closed for a turn that is already finished — a chat loaded from history
  // is a page of answers, not a page of thinking. Initialised rather than left to the effect
  // below, which would open every historical panel for one frame first.
  const [isOpen, setIsOpen] = useState(() => answerLength === 0);
  /** Set once the reader works the toggle: from then on the panel is theirs, not ours. */
  const [isReaderControlled, setReaderControlled] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  // How much of each text the panel has already reacted to, so a fold or an un-fold happens on
  // the step that earned it and not on every render. Lengths rather than "has any", because
  // both of these grow more than once per turn.
  const [seenReasoningLength, setSeenReasoningLength] = useState(reasoning.length);
  const [seenAnswerLength, setSeenAnswerLength] = useState(answerLength);
  /** Which of the two grew last — what the header reports, and what the fold turns on. */
  const [isReasoningNewest, setReasoningNewest] = useState(answerLength === 0);

  // React's documented "adjust state when a prop changes" pattern: a guarded setState during
  // render rather than an effect, so the panel is never painted in the state it is leaving.
  //
  // Reasoning is checked first and the answer second, so a single draft flush carrying both
  // ends folded — whatever else arrived, there is now a reply on screen to read.
  if (reasoning.length > seenReasoningLength) {
    setSeenReasoningLength(reasoning.length);
    setReasoningNewest(true);
    // Only while this turn is still being written. Reasoning that "grows" on a finished
    // message is a message being swapped in, not a model thinking out loud.
    if (isStreaming && !isReaderControlled) setIsOpen(true);
  }

  if (answerLength > seenAnswerLength) {
    setSeenAnswerLength(answerLength);
    setReasoningNewest(false);
    if (!isReaderControlled) setIsOpen(false);
  }

  // Follow the newest line while it is being written. `scrollTop` rather than
  // `scrollIntoView`: the latter scrolls every ancestor too, which would drag the whole
  // transcript around every time the model thought another word.
  useEffect(() => {
    if (!isOpen || !stickToBottom) return;
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [reasoning, isOpen, stickToBottom]);

  const toggle = () => {
    setReaderControlled(true);
    setIsOpen((open) => !open);
  };

  // Reported off "which text grew last" rather than "is there an answer yet", so the label
  // still tells the truth on the second and later rounds of a turn that used a tool.
  const isThinkingNow = isStreaming && isReasoningNewest;

  return (
    <div className="mb-2 w-full overflow-hidden rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface-muted/50 text-sm shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-4 py-2 text-left font-medium text-app-text-muted transition-colors select-none hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <ChevronRight
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
        <BotGlyph size={16} state="awake" />
        <span>Thought process</span>
        {/* Says which of the two states it is in without relying on the animation alone:
            still being written, or finished and available to read back. */}
        {isThinkingNow ? (
          <span className="animate-pulse text-xs italic">thinking…</span>
        ) : (
          !isOpen && <span className="text-xs text-app-text-disabled">(hidden)</span>
        )}
      </button>

      {isOpen && (
        <div
          ref={bodyRef}
          onScroll={(event) => {
            const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
            // A band rather than an exact match: content arriving grows `scrollHeight`
            // faster than the assignment above follows it, so an exact test drops out of
            // "at the bottom" on almost every token.
            setStickToBottom(scrollHeight - scrollTop - clientHeight < 24);
          }}
          className="chat-md max-h-56 overflow-y-auto px-4 pb-3 text-app-text-muted opacity-80"
        >
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
            {reasoning}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

import { memo, useState } from "react";
import { AlertCircle, BookmarkPlus } from "lucide-react";
import type { ChatMessage } from "../types";
import type { SelectedCitation } from "../../../context/ChatContext";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { MessageMarkdown } from "./MessageMarkdown";
import { MessageCitations } from "./MessageCitations";
import { CopyButton } from "./CopyButton";
import { SaveToBoard } from "../../board/save/SaveToBoard";
import { chatMessageNote } from "../../board/generation/chatToCard";
import { SleepyBot } from "./SleepyBot";
import { BotGlyph } from "./BotGlyph";
import ReactMarkdown, { type Options as ReactMarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Hoisted to module scope (A4) — stable identity across renders.
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [[rehypeKatex, { strict: "ignore" }]];

type ArtifactOpenPayload = {
  artifactId: string;
  filename: string;
  sourceUrl?: string;
  lines: number[];
};

type MessageRowProps = {
  message: ChatMessage;
  /** Whether the message immediately before this one was also an assistant turn. */
  showDivider: boolean;
  /** True while the assistant is generating (controls empty-bubble suppression + caret). */
  isThinking: boolean;
  /** True while tokens are actively streaming into *some* message. */
  isStreaming: boolean;
  /** id of the message currently receiving streamed tokens (for the caret). */
  streamingMessageId: string | null;
  /** Avatar/profile context for the user (request) side. */
  profileIcon?: string;
  profileFallbackName: string;
  profileSeed?: string;
  /** Called when the user clicks an inline `[N]` citation reference. */
  onCitationClick: (citation: SelectedCitation) => void;
  /** Called when the user opens an artifact from the citations footer. */
  onOpenArtifact: (data: ArtifactOpenPayload) => void;
};

/**
 * A single chat message row: avatar + bubble (markdown + citations + copy) +
 * optional reasoning block and error banner.
 *
 * Wrapped in `React.memo` so that when one message receives a streamed token,
 * only that row re-renders — all sibling rows whose props are referentially
 * equal bail out (A1). The streaming row re-renders because its `message`
 * prop gets a new object each token (content grows).
 */
function MessageRowImpl({
  message,
  showDivider,
  isThinking,
  isStreaming,
  streamingMessageId,
  profileIcon,
  profileFallbackName,
  profileSeed,
  onCitationClick,
  onOpenArtifact,
}: MessageRowProps) {
  const isRequest = message.role === "USER";

  // E19: The reasoning <details> should auto-open when reasoning first
  // arrives, but not re-open on every token if the user manually collapsed
  // it. We track "has reasoning ever appeared" via a state that only flips
  // from false → true (never back), and let the user toggle freely after.
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [reasoningSeen, setReasoningSeen] = useState(false);
  if (!reasoningSeen && !!message.reasoning) {
    setReasoningSeen(true);
    setReasoningOpen(true);
  }

  // Suppress the empty assistant placeholder while the assistant is still
  // thinking (no tokens yet) — the ThinkingIndicator renders instead. A
  // bubble that carries an error is never suppressed: an interrupted or
  // stopped turn leaves exactly that (empty content + error) and would
  // otherwise stay invisible for the rest of the session.
  if (
    message.role === "ASSISTANT" &&
    message.content === "" &&
    !message.reasoning &&
    !message.error &&
    isThinking
  ) {
    return null;
  }

  const citations = message.citations ?? [];
  const showStreamingCaret = !isRequest && isStreaming && message.id === streamingMessageId;

  // An assistant turn that carries an error and no text: the error banner is the whole
  // message, so it replaces the bubble instead of hanging underneath an empty one.
  const isEmptyErrorTurn = !isRequest && !!message.error && message.content === "";
  const hasBubbleContent = isRequest || message.content !== "" || citations.length > 0;

  return (
    <>
      {showDivider && <div className="mx-auto w-3/4 border-t border-app-border-muted" />}
      <div className={`flex w-full gap-3 ${isRequest ? "flex-row-reverse" : "flex-row"}`}>
        {/* No disc behind the bot: the drawn glyph already has a
            silhouette of its own, and a ring around it read as a badge
            holding a tiny icon rather than as a character. Losing it
            also frees the full 32px for the bot itself. */}
        <div className="flex size-8 shrink-0 items-center justify-center">
          {isRequest ? (
            <UserAvatar
              profileIcon={profileIcon}
              fallbackName={profileFallbackName}
              seed={profileSeed}
              size={32}
            />
          ) : (
            // Every answer gets a bot that can doze off. Because each
            // one draws its own random idle window, a long thread
            // nods off in a ragged sequence rather than all at once.
            // Only the message currently receiving tokens is held
            // awake — that one is visibly working.
            <SleepyBot
              size={30}
              canSleep={message.id !== streamingMessageId}
              className="text-app-brand-text"
            />
          )}
        </div>

        <div
          className={`flex flex-col ${
            isRequest ? "max-w-[70%] items-end" : "max-w-[85%] items-start"
          }`}
        >
          {!isRequest && Boolean(message.reasoning) && (
            <details
              open={reasoningOpen}
              onToggle={(e) => setReasoningOpen(e.currentTarget.open)}
              className="mb-2 w-full rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface-muted/50 text-sm shadow-sm"
            >
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 font-medium text-app-text-muted transition-colors select-none hover:text-app-text">
                <BotGlyph size={16} state="awake" />
                Thought Process
              </summary>
              <div className="chat-md px-4 pb-3 text-app-text-muted opacity-80">
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
                  {message.reasoning}
                </ReactMarkdown>
              </div>
            </details>
          )}

          {/* A turn that produced no text at all — stopped, interrupted, or failed
                        before the first token — has nothing to put in a bubble. Rendering one
                        anyway left a stray empty pill above the error, which is what made a
                        cancelled chat look broken rather than cancelled. */}
          {!isEmptyErrorTurn && hasBubbleContent && (
            <div
              // E5: mark the actively-streaming message as busy so
              // screen readers don't announce partial content mid-stream.
              aria-busy={showStreamingCaret || undefined}
              className={`chat-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                isRequest
                  ? "chat-md-user rounded-tr-sm bg-app-brand text-white"
                  : "rounded-tl-sm border border-app-border-muted bg-app-surface-muted text-app-text"
              }`}
            >
              <MessageMarkdown
                content={message.content}
                isRequest={isRequest}
                citations={citations}
                onCitationClick={onCitationClick}
              />

              {showStreamingCaret && message.content !== "" && (
                <span className="streaming-caret" aria-hidden="true" />
              )}

              {!isRequest && citations.length > 0 && (
                <MessageCitations citations={citations} onOpenArtifact={onOpenArtifact} />
              )}
            </div>
          )}

          {!isRequest && message.error && (
            <div
              className={`flex w-full items-start gap-2.5 rounded-2xl rounded-tl-sm border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm leading-relaxed text-app-danger-text ${
                isEmptyErrorTurn ? "" : "mt-2"
              }`}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{message.error}</span>
            </div>
          )}

          {/* Under a finished answer only. A half-streamed reply is not a thing to keep — the
              card would hold whatever had arrived by the moment somebody pressed it. */}
          {!isRequest && !showStreamingCaret && message.content !== "" && (
            <div className="flex items-center gap-1">
              <CopyButton text={message.content} />

              <SaveToBoard
                request={() => chatMessageNote(message.content)}
                // The chat is durable and has a page of its own, so a kept answer can point back at
                // the conversation it came out of — which is usually the part worth re-reading.
                origin={() =>
                  message.chat
                    ? { url: `/chat/${message.chat.id}`, label: message.chat.title || "this chat" }
                    : null
                }
                label="Keep on my board"
                savedLabel="On your board"
                description="The answer, as a note you can edit."
                icon={<BookmarkPlus className="h-4 w-4" aria-hidden="true" />}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const MessageRow = memo(MessageRowImpl);

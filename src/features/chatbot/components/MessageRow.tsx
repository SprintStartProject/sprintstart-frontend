import { memo } from "react";
import { AlertCircle } from "lucide-react";
import type { ChatMessage } from "../types";
import type { SelectedCitation } from "../../../context/ChatContext";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { MessageMarkdown } from "./MessageMarkdown";
import { MessageCitations } from "./MessageCitations";
import { CopyButton } from "./CopyButton";
import { ReasoningPanel } from "./ReasoningPanel";
import { SleepyBot } from "./SleepyBot";

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

        {/* The assistant's column takes its full width instead of hugging its contents.
                    That is what stops the streamed answer twitching: a hugging bubble is
                    re-measured on every token, so it widened word by word and jumped back
                    whenever a re-parse changed what the markdown rendered to. A fixed box that
                    only grows downwards can be read while it is still being written, which is
                    what the customer actually asked for. The user's own messages still hug —
                    they arrive whole, so there is nothing to settle. */}
        <div
          className={`flex flex-col ${
            isRequest ? "max-w-[70%] items-end" : "w-full max-w-[85%] items-start"
          }`}
        >
          {!isRequest && Boolean(message.reasoning) && (
            <ReasoningPanel
              reasoning={message.reasoning ?? ""}
              isStreaming={message.id === streamingMessageId}
              hasAnswer={message.content !== ""}
            />
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
                  : "w-full rounded-tl-sm border border-app-border-muted bg-app-surface-muted text-app-text"
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

          {!isRequest && !showStreamingCaret && message.content !== "" && (
            <CopyButton text={message.content} />
          )}
        </div>
      </div>
    </>
  );
}

export const MessageRow = memo(MessageRowImpl);
